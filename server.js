/* Markly backend — no npm packages needed (Node 18+).
   Serves the website AND the API:
     POST   /api/register        { email, password }  -> { token, email }
     POST   /api/login           { email, password }  -> { token, email }
     GET    /api/saves           -> { saves: [...] }
     PUT    /api/saves/:id       save object          -> { ok: true }
     DELETE /api/saves/:id       -> { ok: true }
   Data lives in data/db.json. Passwords are hashed with scrypt. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_BODY = 1024 * 1024;
const MAX_SAVES = 500;
const TOKEN_DAYS = 60;

/* ---------- tiny JSON database ---------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { secret: crypto.randomBytes(32).toString('hex'), users: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { /* first run */ }
function writeDB() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
writeDB();

/* ---------- auth helpers ---------- */
const b64 = s => Buffer.from(s).toString('base64url');
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return body + '.' + crypto.createHmac('sha256', db.secret).update(body).digest('base64url');
}
function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', db.secret).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const validEmail = e => typeof e === 'string' && e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/* very small rate limit: 20 auth attempts / 10 min per IP */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 20;
}

/* ---------- http helpers ---------- */
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch (e) { reject(Object.assign(new Error('Invalid JSON'), { code: 400 })); } });
    req.on('error', reject);
  });
}
function userOf(req) {
  const h = req.headers.authorization || '';
  const p = verify(h.startsWith('Bearer ') ? h.slice(7) : '');
  return p && db.users[p.e] ? { email: p.e, user: db.users[p.e] } : null;
}
function cleanSave(id, s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.subjects) || s.subjects.length < 1 || s.subjects.length > 30) return null;
  const subjects = s.subjects.map(x => ({ name: String((x && x.name) || '').slice(0, 60), max: Number(x && x.max), obtained: Number(x && x.obtained) }));
  if (subjects.some(x => !x.name || !(x.max > 0) || x.max > 100000 || !(x.obtained >= 0) || x.obtained > x.max)) return null;
  const total = subjects.reduce((a, x) => a + x.max, 0), got = subjects.reduce((a, x) => a + x.obtained, 0);
  return { id, name: String(s.name || 'Result').slice(0, 80), savedAt: new Date(s.savedAt || Date.now()).toISOString(), studentName: String(s.studentName || '').slice(0, 50), subjects, percent: total ? got / total * 100 : 0 };
}

/* ---------- API ---------- */
async function api(req, res, url) {
  const ip = req.socket.remoteAddress || 'x';
  try {
    if (url.pathname === '/api/register' && req.method === 'POST') {
      if (limited(ip)) return send(res, 429, { error: 'Too many attempts. Try again later.' });
      const { email, password } = await readBody(req);
      if (!validEmail(email)) return send(res, 400, { error: 'Enter a valid email address.' });
      if (typeof password !== 'string' || password.length < 6 || password.length > 200) return send(res, 400, { error: 'Password must be at least 6 characters.' });
      const key = email.toLowerCase();
      if (db.users[key]) return send(res, 409, { error: 'This email already has an account. Use Sign in.' });
      const salt = crypto.randomBytes(16).toString('hex');
      db.users[key] = { salt, hash: hash(password, salt), created: new Date().toISOString(), saves: {} };
      writeDB();
      return send(res, 200, { token: sign({ e: key, exp: Date.now() + TOKEN_DAYS * 864e5 }), email: key });
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      if (limited(ip)) return send(res, 429, { error: 'Too many attempts. Try again later.' });
      const { email, password } = await readBody(req);
      const key = String(email || '').toLowerCase(), u = db.users[key];
      if (!u || typeof password !== 'string') return send(res, 401, { error: 'Wrong email or password.' });
      const a = Buffer.from(hash(password, u.salt), 'hex'), b = Buffer.from(u.hash, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return send(res, 401, { error: 'Wrong email or password.' });
      return send(res, 200, { token: sign({ e: key, exp: Date.now() + TOKEN_DAYS * 864e5 }), email: key });
    }

    const me = userOf(req);
    if (!me) return send(res, 401, { error: 'Please sign in again.' });

    if (url.pathname === '/api/saves' && req.method === 'GET') return send(res, 200, { saves: Object.values(me.user.saves) });

    const m = url.pathname.match(/^\/api\/saves\/([A-Za-z0-9_-]{1,64})$/);
    if (m && req.method === 'PUT') {
      const clean = cleanSave(m[1], await readBody(req));
      if (!clean) return send(res, 400, { error: 'Invalid result data.' });
      if (!me.user.saves[m[1]] && Object.keys(me.user.saves).length >= MAX_SAVES) return send(res, 400, { error: 'Save limit reached. Delete old results first.' });
      me.user.saves[m[1]] = clean; writeDB();
      return send(res, 200, { ok: true });
    }
    if (m && req.method === 'DELETE') { delete me.user.saves[m[1]]; writeDB(); return send(res, 200, { ok: true }); }
    return send(res, 404, { error: 'Not found.' });
  } catch (e) {
    return send(res, e.code === 413 || e.code === 400 ? e.code : 500, { error: e.code ? e.message : 'Server error.' });
  }
}

/* ---------- static files ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PRIVATE = /^(\/server\.js|\/package(-lock)?\.json|\/data(\/|$)|\/node_modules(\/|$)|\/\.)/;

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || PRIVATE.test(p)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': p === '/sw.js' ? 'no-cache' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  });
}

http.createServer((req, res) => {
  // CORS lets the site live on GitHub Pages while this API runs elsewhere. Set MARKLY_ORIGIN to lock it down.
  res.setHeader('Access-Control-Allow-Origin', process.env.MARKLY_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url);
}).listen(PORT, () => console.log(`Markly running → http://localhost:${PORT}`));
