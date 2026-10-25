(() => {
  'use strict';

  /* If your backend runs on another address (e.g. Render), put it here: 'https://markly-api.onrender.com'
     Leave '' when server.js serves this site itself. */
  const API_BASE = '';

  const $ = id => document.getElementById(id);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const K = { state: 'markly.v2.state', saves: 'markly.v2.saves', prefs: 'markly.v2.prefs', auth: 'markly.v2.auth' };
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const ACCENTS = { violet: '#8b7cff', teal: '#2dd4bf', coral: '#ff7a59', amber: '#f5b82e', rose: '#ff5d8f', blue: '#4ea1ff', green: '#4ade80' };
  const NAMES = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Urdu'];
  const GP = { 'A+': 4, A: 3.7, B: 3, C: 2, D: 1, F: 0 };

  let prefs = Object.assign({ theme: matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark', accent: 'violet', pass: 40, target: 80, tpl: 'midnight' }, LS.get(K.prefs, {}));
  let S = Object.assign({ name: '', subjects: [], saveId: null }, LS.get(K.state, {}));
  let saves = LS.get(K.saves, []);
  let auth = LS.get(K.auth, null);
  let lastPct = 0, sortMode = 0, tab = 'marks', editing = false, authMode = 'login', deferredInstall = null, toastT, saveT;

  /* ---------- helpers ---------- */
  const fmt = n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const pct = (a, b) => (b > 0 ? a / b * 100 : 0);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gradeOf = p => (p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F');
  const stepOf = m => (m % 1 === 0 ? 1 : 0.01);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const longDate = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const shortDate = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setNum(el, to, f) {
    const from = el._v == null ? to : el._v; el._v = to; cancelAnimationFrame(el._r);
    if (from === to || calm()) { el.textContent = f(to); return; }
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(from + (to - from) * e);
      if (k < 1) el._r = requestAnimationFrame(step);
    })(t0);
  }
  function confetti() {
    if (calm()) return;
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:98';
    document.body.appendChild(cv);
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const cols = [getComputedStyle(document.documentElement).getPropertyValue('--a').trim() || '#8b7cff', '#ffd166', '#4ade80', '#4ea1ff', '#ff5d8f'];
    const ps = Array.from({ length: 90 }, () => ({ x: W / 2, y: H * 0.38, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 3, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: cols[Math.random() * cols.length | 0] }));
    let n = 0;
    (function f() {
      n++; c.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += p.va; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); });
      if (n < 120) requestAnimationFrame(f); else cv.remove();
    })();
  }

  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => LS.set(K.state, S), 250); };
  const savePrefs = () => LS.set(K.prefs, prefs);

  function totals() {
    const obtained = S.subjects.reduce((a, s) => a + s.obtained, 0);
    const max = S.subjects.reduce((a, s) => a + s.max, 0);
    const percent = pct(obtained, max);
    const n = S.subjects.length;
    const grades = S.subjects.map(s => gradeOf(pct(s.obtained, s.max)));
    const gpa = n ? grades.reduce((a, g) => a + GP[g], 0) / n : 0;
    return { obtained, max, percent, n, avg: n ? obtained / n : 0, grade: gradeOf(percent), gpa };
  }

  /* ---------- theme + accent ---------- */
  function applyPrefs() {
    const h = document.documentElement;
    h.dataset.theme = prefs.theme; h.dataset.accent = prefs.accent;
    $('themeBtn').textContent = prefs.theme === 'dark' ? '☀' : '☾';
    $('themeBtn').setAttribute('aria-label', prefs.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    $('themeColor').setAttribute('content', prefs.theme === 'dark' ? '#0c111d' : '#edf0f6');
    qsa('.sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.accent === prefs.accent));
    savePrefs();
  }
  $('accentMenu').innerHTML = Object.keys(ACCENTS).map(k => `<button class="sw" type="button" data-accent="${k}" style="--c:${ACCENTS[k]}" aria-label="${k} accent" aria-pressed="false"></button>`).join('');
  $('accentMenu').addEventListener('click', e => { const b = e.target.closest('.sw'); if (b) { prefs.accent = b.dataset.accent; applyPrefs(); } });
  $('accentBtn').addEventListener('click', e => {
    e.stopPropagation();
    const m = $('accentMenu'); m.hidden = !m.hidden; $('accentBtn').setAttribute('aria-expanded', String(!m.hidden));
  });
  $('themeBtn').addEventListener('click', () => { prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'; applyPrefs(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('.pop-wrap')) $('accentMenu').hidden = true;
    if (!e.target.closest('#moreMenu') && e.target.id !== 'moreBtn') $('moreMenu').hidden = true;
  });

  /* ---------- views ---------- */
  function show(id) {
    ['viewName', 'viewSubjects', 'viewDash'].forEach(v => ($(v).hidden = v !== id));
    $('resumeBtn').hidden = !S.subjects.length;
    if (id === 'viewDash') { ['kObt', 'kPct', 'kAvg', 'ringPct'].forEach(k => ($(k)._v = 0)); renderSummary(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function makeInputs() {
    const count = Math.max(1, Math.min(30, Math.floor(Number($('subjectCount').value) || 1)));
    $('subjectCount').value = count;
    $('subjectInputs').innerHTML = Array.from({ length: count }, (_, i) => {
      const old = S.subjects[i] || {};
      return `<div class="sub-row"><i>${i + 1}</i>
        <input class="inp" id="sn${i}" maxlength="60" aria-label="Subject ${i + 1} name" value="${esc(old.name || NAMES[i] || 'Subject ' + (i + 1))}">
        <input class="inp" id="sm${i}" type="number" min="1" max="100000" step="any" aria-label="Subject ${i + 1} maximum marks" value="${old.max > 0 ? old.max : 100}"></div>`;
    }).join('');
  }

  function begin() {
    const name = $('studentName').value.trim();
    if (!name) { toast('Please enter your name first.'); $('studentName').focus(); return; }
    const c = Number($('subjectCount').value);
    if (!Number.isInteger(c) || c < 1 || c > 30) { toast('Choose between 1 and 30 subjects.'); $('subjectCount').focus(); return; }
    S.name = name; editing = false;
    makeInputs(); $('createBtn').textContent = 'Create dashboard'; show('viewSubjects');
  }

  function createDashboard() {
    const next = [];
    const c = Number($('subjectCount').value);
    for (let i = 0; i < c; i++) {
      const name = $('sn' + i).value.trim(), max = Number($('sm' + i).value);
      if (!name) { toast(`Enter a name for subject ${i + 1}.`); $('sn' + i).focus(); return; }
      if (!Number.isFinite(max) || max <= 0 || max > 100000) { toast(`Maximum marks for subject ${i + 1} must be 1–100,000.`); $('sm' + i).focus(); return; }
      const old = S.subjects[i];
      next.push({ name, max, obtained: editing && old ? Math.min(old.obtained, max) : 0 });
    }
    if (!editing) S.saveId = null;
    S.subjects = next; persist(); renderAll(); show('viewDash');
  }

  /* ---------- dashboard ---------- */
  function order() {
    const idx = S.subjects.map((_, i) => i);
    if (sortMode === 1) idx.sort((a, b) => pct(S.subjects[b].obtained, S.subjects[b].max) - pct(S.subjects[a].obtained, S.subjects[a].max));
    if (sortMode === 2) idx.sort((a, b) => pct(S.subjects[a].obtained, S.subjects[a].max) - pct(S.subjects[b].obtained, S.subjects[b].max));
    return idx;
  }

  function rowHTML(i) {
    const s = S.subjects[i];
    return `<article class="row" data-i="${i}">
      <div class="row-top">
        <input class="r-name" value="${esc(s.name)}" maxlength="60" aria-label="Subject name">
        <div class="r-marks"><input class="r-obt" type="number" min="0" max="${s.max}" step="any" value="${s.obtained}" aria-label="Obtained marks"><span>/</span><input class="r-max" type="number" min="1" max="100000" step="any" value="${s.max}" aria-label="Maximum marks"></div>
      </div>
      <input class="range" type="range" min="0" max="${s.max}" step="${stepOf(s.max)}" value="${s.obtained}" aria-label="${esc(s.name)} obtained marks">
      <div class="row-bot"><span class="r-pct"></span><span class="badge r-grade"></span><span class="r-status"></span><button class="x r-del" type="button" aria-label="Remove ${esc(s.name)}">✕</button></div>
    </article>`;
  }

  function renderRows() {
    $('rows').innerHTML = order().map(rowHTML).join('');
    S.subjects.forEach((_, i) => paintRow(i));
    qsa('.row', $('rows')).forEach((r, k) => r.style.setProperty('--n', Math.min(k, 12)));
    $('sortBtn').textContent = 'Sort: ' + ['original', 'high → low', 'low → high'][sortMode];
    $('addBtn').hidden = S.subjects.length >= 30;
  }

  function paintRow(i) {
    const row = $('rows').querySelector(`[data-i="${i}"]`); if (!row) return;
    const s = S.subjects[i], p = pct(s.obtained, s.max);
    const rng = row.querySelector('.range');
    rng.value = s.obtained; rng.style.setProperty('--pg', p + '%');
    rng.setAttribute('aria-valuetext', `${fmt(s.obtained)} of ${fmt(s.max)}, ${p.toFixed(1)} percent`);
    row.querySelector('.r-pct').textContent = p.toFixed(2) + '%';
    row.querySelector('.r-grade').textContent = 'Grade ' + gradeOf(p);
    const st = row.querySelector('.r-status'), ok = p >= prefs.pass;
    st.textContent = ok ? 'Pass' : 'Below pass mark'; st.className = 'r-status ' + (ok ? 'pass' : 'fail');
    row.querySelector('.r-del').hidden = S.subjects.length < 2;
  }

  function renderSummary() {
    const t = totals(), left = t.max - t.obtained;
    $('dashTitle').textContent = (S.name ? S.name + "'s" : 'Your') + ' results';
    setNum($('kObt'), t.obtained, fmt); $('kMax').textContent = 'out of ' + fmt(t.max);
    setNum($('kPct'), t.percent, v => v.toFixed(2) + '%');
    const passed = S.subjects.filter(s => pct(s.obtained, s.max) >= prefs.pass).length;
    $('kPass').textContent = `${passed} of ${t.n} subjects passed`;
    $('kGrade').textContent = t.grade; $('kGpa').textContent = 'GPA ' + t.gpa.toFixed(2);
    setNum($('kAvg'), t.avg, fmt);
    if (t.n) {
      const top = S.subjects.reduce((a, b) => (pct(b.obtained, b.max) > pct(a.obtained, a.max) ? b : a));
      $('kBest').textContent = 'Best: ' + top.name;
    }
    $('ring').style.setProperty('--p', Math.min(100, t.percent) + '%');
    setNum($('ringPct'), t.percent, v => v.toFixed(1) + '%');
    $('sSub').textContent = t.n; $('sGot').textContent = fmt(t.obtained); $('sLeft').textContent = fmt(left); $('sMax').textContent = fmt(t.max);
    $('savedCount').textContent = saves.length;
    lastPct = t.percent;
  }

  function renderInsights() {
    const t = totals();
    if (!t.n) { $('tab-insights').innerHTML = ''; return; }
    const sorted = S.subjects.map(s => ({ ...s, p: pct(s.obtained, s.max) })).sort((a, b) => b.p - a.p);
    const dist = {}; sorted.forEach(s => { const g = gradeOf(s.p); dist[g] = (dist[g] || 0) + 1; });
    $('tab-insights').innerHTML = `<div class="ins">
      <div class="card"><h4>Subjects compared</h4>${sorted.map(s => `<div class="bar-line"><span class="nm">${esc(s.name)}</span><span class="tr"><i style="width:${Math.min(100, s.p)}%"></i></span><span class="v">${s.p.toFixed(1)}%</span></div>`).join('')}</div>
      <div class="card"><h4>Grades</h4><div class="chips">${['A+', 'A', 'B', 'C', 'D', 'F'].map(g => `<div class="chip"><b>${dist[g] || 0}</b><small>${g}</small></div>`).join('')}</div>
        <p class="muted small-note">A+ 90+ · A 80+ · B 70+ · C 60+ · D 50+ · F below 50. GPA uses a 4.0 scale.</p></div>
      <div class="card"><h4>Target planner</h4>
        <div class="plan"><label for="targetPct">I want</label><input class="inp tiny" id="targetPct" type="number" min="1" max="100" value="${prefs.target}"><span>% overall</span>
        <label for="passPct" style="margin-left:14px">Pass mark</label><input class="inp tiny" id="passPct" type="number" min="1" max="100" value="${prefs.pass}"><span>%</span></div>
        <div class="plan-out" id="planOut"></div></div>
    </div>`;
    renderPlan();
  }

  function renderPlan() {
    const out = $('planOut'); if (!out) return;
    const t = totals(), need = prefs.target / 100 * t.max - t.obtained, room = t.max - t.obtained;
    out.textContent = need <= 0 ? `You have reached ${prefs.target}% already (${t.percent.toFixed(2)}%). Keep it up.`
      : need > room ? `${prefs.target}% is out of reach with these maximum marks — even full marks in every subject falls short.`
      : `You need ${fmt(need)} more marks to reach ${prefs.target}%, about ${fmt(need / t.n)} more per subject.`;
  }

  function renderSaves() {
    const q = ($('saveSearch').value || '').trim().toLowerCase();
    const list = saves.filter(x => x.name.toLowerCase().includes(q)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    $('cloudBadge').textContent = auth ? 'Synced to ' + auth.email : 'On this device';
    $('cloudBadge').classList.toggle('cloud', !!auth);
    if (!list.length) { $('savedList').innerHTML = `<div class="empty">${saves.length ? 'No result matches your search.' : 'No saved results yet. Use “Save result” to keep this one.'}</div>`; return; }
    let day = '', html = '';
    list.forEach(x => {
      const d = longDate(x.savedAt);
      if (d !== day) { day = d; html += `<h4 class="day">${esc(d)}</h4>`; }
      html += `<div class="save" data-id="${x.id}"><div><b>${esc(x.name)}</b><span class="meta">${esc(x.studentName || 'Student')} · ${x.subjects.length} subjects · ${new Date(x.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="pc">${x.percent.toFixed(1)}%</div>
        <div class="sa"><button class="btn small primary" data-a="open">Open</button><button class="btn small ghost" data-a="png">PNG</button><button class="btn small ghost" data-a="rename">Rename</button><button class="btn small ghost" data-a="del">Delete</button></div></div>`;
    });
    $('savedList').innerHTML = html;
  }

  function renderAll() { renderRows(); renderSummary(); if (tab === 'insights') renderInsights(); if (tab === 'saved') renderSaves(); }

  function afterChange(i) {
    const before = lastPct;
    if (i != null) paintRow(i); else S.subjects.forEach((_, k) => paintRow(k));
    renderSummary(); persist();
    if (before < 90 && lastPct >= 90) { confetti(); toast('Grade A+ — great work!'); }
    if (tab === 'insights') renderInsights();
  }

  function setTab(name) {
    tab = name;
    qsa('.tab').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ['marks', 'insights', 'saved'].forEach(n => ($('tab-' + n).hidden = n !== name));
    if (name === 'insights') renderInsights();
    if (name === 'saved') renderSaves();
  }
  qsa('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  /* row events */
  $('rows').addEventListener('input', e => {
    const row = e.target.closest('.row'); if (!row) return;
    const i = Number(row.dataset.i), s = S.subjects[i];
    if (e.target.classList.contains('range')) {
      s.obtained = Number(e.target.value); row.querySelector('.r-obt').value = s.obtained; afterChange(i);
    } else if (e.target.classList.contains('r-obt')) {
      const v = Number(e.target.value);
      if (e.target.value === '' || !Number.isFinite(v)) return;
      s.obtained = Math.max(0, Math.min(s.max, v)); afterChange(i);
    } else if (e.target.classList.contains('r-name')) {
      s.name = e.target.value.slice(0, 60) || 'Subject'; persist(); if (tab === 'insights') renderInsights();
    }
  });
  $('rows').addEventListener('change', e => {
    const row = e.target.closest('.row'); if (!row) return;
    const i = Number(row.dataset.i), s = S.subjects[i];
    if (e.target.classList.contains('r-obt')) { e.target.value = s.obtained; }
    if (e.target.classList.contains('r-max')) {
      const m = Number(e.target.value);
      if (!Number.isFinite(m) || m <= 0 || m > 100000) { e.target.value = s.max; toast('Maximum marks must be 1–100,000.'); return; }
      s.max = m; s.obtained = Math.min(s.obtained, m);
      const rg = row.querySelector('.range'); rg.max = m; rg.step = stepOf(m);
      const ob = row.querySelector('.r-obt'); ob.max = m; ob.value = s.obtained;
      afterChange(i);
    }
    if (e.target.classList.contains('r-name') && !e.target.value.trim()) e.target.value = s.name;
  });
  $('rows').addEventListener('click', e => {
    const del = e.target.closest('.r-del'); if (!del) return;
    if (S.subjects.length < 2) return;
    const i = Number(del.closest('.row').dataset.i);
    if (!confirm(`Remove “${S.subjects[i].name}”?`)) return;
    S.subjects.splice(i, 1); persist(); renderAll();
  });

  $('sortBtn').addEventListener('click', () => { sortMode = (sortMode + 1) % 3; renderRows(); });
  $('fillBtn').addEventListener('click', () => {
    const p = Math.max(0, Math.min(100, Number($('fillPct').value) || 0));
    S.subjects.forEach(s => (s.obtained = Math.round(s.max * p) / 100));
    renderRows(); renderSummary(); persist(); toast(`All subjects set to ${p}%.`);
  });
  $('addBtn').addEventListener('click', () => {
    if (S.subjects.length >= 30) return;
    S.subjects.push({ name: 'Subject ' + (S.subjects.length + 1), max: 100, obtained: 0 });
    renderRows(); renderSummary(); persist();
    const last = $('rows').lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* insights inputs (delegated, because the panel is re-rendered) */
  $('tab-insights').addEventListener('input', e => {
    const v = Number(e.target.value); if (!Number.isFinite(v) || v < 1 || v > 100) return;
    if (e.target.id === 'targetPct') { prefs.target = v; savePrefs(); renderPlan(); }
    if (e.target.id === 'passPct') { prefs.pass = v; savePrefs(); S.subjects.forEach((_, i) => paintRow(i)); renderSummary(); }
  });

  /* ---------- top-level buttons ---------- */
  $('continueBtn').addEventListener('click', begin);
  ['studentName', 'subjectCount'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') begin(); }));
  $('resumeBtn').addEventListener('click', () => show('viewDash'));
  $('createBtn').addEventListener('click', createDashboard);
  $('backBtn').addEventListener('click', () => show('viewName'));
  ['homeBtn2', 'homeBtn3', 'brand'].forEach(id => $(id).addEventListener('click', e => { e.preventDefault(); $('studentName').value = S.name || ''; show('viewName'); }));
  $('editBtn').addEventListener('click', () => {
    $('subjectCount').value = S.subjects.length; editing = true; makeInputs();
    $('createBtn').textContent = 'Update dashboard'; show('viewSubjects');
  });
  $('moreBtn').addEventListener('click', e => { e.stopPropagation(); $('moreMenu').hidden = !$('moreMenu').hidden; });

  /* ---------- export / import / misc ---------- */
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const safe = s => String(s || 'student').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'student';

  $('moreMenu').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act, t = totals(); $('moreMenu').hidden = true;
    if (act === 'copy') {
      const txt = `Markly — ${S.name || 'Student'}\n` + S.subjects.map(s => `${s.name}: ${fmt(s.obtained)}/${fmt(s.max)} (${pct(s.obtained, s.max).toFixed(1)}%)`).join('\n') + `\nTotal: ${fmt(t.obtained)}/${fmt(t.max)} = ${t.percent.toFixed(2)}% · Grade ${t.grade} · GPA ${t.gpa.toFixed(2)}`;
      try { await navigator.clipboard.writeText(txt); toast('Summary copied.'); } catch (err) { toast('Copy is blocked by this browser.'); }
    }
    if (act === 'csv') {
      const rows = [['Subject', 'Obtained', 'Maximum', 'Percent', 'Grade']].concat(S.subjects.map(s => [s.name, s.obtained, s.max, pct(s.obtained, s.max).toFixed(2), gradeOf(pct(s.obtained, s.max))]));
      rows.push(['Total', t.obtained, t.max, t.percent.toFixed(2), t.grade]);
      download(new Blob([rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }), safe(S.name) + '-markly.csv');
    }
    if (act === 'json') download(new Blob([JSON.stringify({ app: 'markly', version: 2, name: S.name, subjects: S.subjects }, null, 2)], { type: 'application/json' }), safe(S.name) + '-markly.json');
    if (act === 'import') $('importFile').click();
    if (act === 'print') window.print();
    if (act === 'reset') {
      if (!confirm('Reset all subject marks to zero?')) return;
      S.subjects.forEach(s => (s.obtained = 0)); renderRows(); renderSummary(); persist(); toast('All marks reset.');
    }
  });
  $('importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const subs = (j.subjects || []).filter(s => s && typeof s.name === 'string' && Number(s.max) > 0).slice(0, 30)
        .map(s => ({ name: s.name.slice(0, 60), max: Number(s.max), obtained: Math.max(0, Math.min(Number(s.max), Number(s.obtained) || 0)) }));
      if (!subs.length) throw new Error('empty');
      S.name = String(j.name || S.name || '').slice(0, 50); S.subjects = subs; S.saveId = null; persist(); renderAll(); toast('Imported ' + subs.length + ' subjects.');
    } catch (err) { toast('That file is not a valid Markly JSON.'); }
  });

  /* ---------- PNG templates ---------- */
  function reportData(src) {
    src = src || S;
    const subjects = src.subjects.map(s => { const p = pct(s.obtained, s.max); return { name: s.name, max: s.max, obtained: s.obtained, pct: p, grade: gradeOf(p) }; });
    const obtained = subjects.reduce((a, s) => a + s.obtained, 0), max = subjects.reduce((a, s) => a + s.max, 0), percent = pct(obtained, max);
    const gpa = subjects.length ? subjects.reduce((a, s) => a + GP[s.grade], 0) / subjects.length : 0;
    return { name: src.studentName || src.name, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), subjects, obtained, max, percent, avg: subjects.length ? obtained / subjects.length : 0, grade: gradeOf(percent), gpa };
  }

  function openTemplates(src) {
    if (!src.subjects.length) return;
    const data = reportData(src);
    $('tplGrid').innerHTML = '';
    MarklyReport.templates.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tpl'; b.setAttribute('aria-label', 'Download PNG in ' + t.name + ' style');
      const pv = document.createElement('div'); pv.className = 'pv';
      const cv = document.createElement('canvas'); MarklyReport.draw(cv, t, data, 0.5); pv.appendChild(cv);
      b.append(pv);
      b.insertAdjacentHTML('beforeend', `<span>${t.name}</span><small>${t.note}</small>`);
      b.addEventListener('click', () => downloadPNG(t, data));
      $('tplGrid').appendChild(b);
    });
    $('tplDlg').showModal();
  }

  function downloadPNG(t, data) {
    const cv = document.createElement('canvas');
    try { MarklyReport.draw(cv, t, data, 2); } catch (err) { toast('Could not create the PNG.'); return; }
    cv.toBlob(blob => {
      if (!blob) { toast('Could not create the PNG. Try fewer subjects or another style.'); return; }
      download(blob, `${safe(data.name)}-markly-${t.id}.png`);
      prefs.tpl = t.id; savePrefs();
      $('tplDlg').close(); toast(`Downloading ${t.name} report…`);
    }, 'image/png');
  }
  $('pngBtn').addEventListener('click', () => openTemplates(S));

  /* ---------- saving ---------- */
  const where = () => (auth ? `Saved on this device and in your account (${auth.email}).` : 'Saved on this device. Sign in to keep results in your account too.');

  $('saveBtn').addEventListener('click', openSave);
  function openSave() {
    if (!S.subjects.length) return;
    const existing = saves.find(x => x.id === S.saveId);
    $('saveName').value = existing ? existing.name : `${S.name || 'My result'} – ${shortDate(new Date().toISOString())}`;
    $('updateSaveBtn').hidden = !existing;
    $('saveWhere').textContent = where();
    $('saveDlg').showModal(); $('saveName').select();
  }
  function commitSave(update) {
    const name = $('saveName').value.trim() || `Result – ${shortDate(new Date().toISOString())}`;
    const t = totals(), now = new Date().toISOString();
    let entry = update ? saves.find(x => x.id === S.saveId) : null;
    const body = { name, savedAt: now, studentName: S.name, subjects: JSON.parse(JSON.stringify(S.subjects)), percent: t.percent };
    if (entry) Object.assign(entry, body); else { entry = Object.assign({ id: uid() }, body); saves.push(entry); }
    S.saveId = entry.id; LS.set(K.saves, saves); persist(); renderSummary();
    if (tab === 'saved') renderSaves();
    $('saveDlg').close();
    if (auth) api('/api/saves/' + entry.id, { method: 'PUT', body: JSON.stringify(entry) }).then(() => toast('Saved to your account.')).catch(() => toast('Saved on this device. Cloud sync failed — it will retry when you sign in again.'));
    else toast('Saved on this device.');
  }
  $('saveForm').addEventListener('submit', e => { e.preventDefault(); commitSave(false); });
  $('updateSaveBtn').addEventListener('click', () => commitSave(true));

  $('savedList').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const id = b.closest('.save').dataset.id, x = saves.find(v => v.id === id); if (!x) return;
    if (b.dataset.a === 'open') {
      S.name = x.studentName || ''; S.subjects = JSON.parse(JSON.stringify(x.subjects)); S.saveId = x.id; persist(); setTab('marks'); renderAll(); toast(`Opened “${x.name}”.`);
    }
    if (b.dataset.a === 'png') openTemplates({ name: x.studentName, studentName: x.studentName, subjects: x.subjects });
    if (b.dataset.a === 'rename') {
      const n = prompt('New name for this result:', x.name); if (!n || !n.trim()) return;
      x.name = n.trim().slice(0, 80); LS.set(K.saves, saves); renderSaves();
      if (auth) api('/api/saves/' + x.id, { method: 'PUT', body: JSON.stringify(x) }).catch(() => {});
    }
    if (b.dataset.a === 'del') {
      if (!confirm(`Delete “${x.name}”?`)) return;
      saves = saves.filter(v => v.id !== id); LS.set(K.saves, saves); if (S.saveId === id) S.saveId = null; renderSaves(); renderSummary();
      if (auth) api('/api/saves/' + id, { method: 'DELETE' }).catch(() => {});
    }
  });
  $('saveSearch').addEventListener('input', renderSaves);

  /* ---------- account (optional) ---------- */
  async function api(path, opt = {}) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(API_BASE + path, Object.assign({}, opt, {
        signal: ctl.signal,
        headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: 'Bearer ' + auth.token } : {}, opt.headers || {})
      }));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), { status: r.status });
      return j;
    } finally { clearTimeout(t); }
  }

  function paintAccount() {
    $('accountBtn').textContent = auth ? '● ' + auth.email.split('@')[0] : 'Sign in';
    $('authOut').hidden = !!auth; $('authIn').hidden = !auth;
    if (auth) $('authWho').textContent = auth.email;
    renderSummary(); if (tab === 'saved') renderSaves();
  }
  $('accountBtn').addEventListener('click', () => { $('authErr').textContent = ''; paintAccount(); $('accountDlg').showModal(); });
  qsa('.seg button').forEach(b => b.addEventListener('click', () => {
    authMode = b.dataset.mode; qsa('.seg button').forEach(x => x.classList.toggle('on', x === b));
    $('authGo').textContent = authMode === 'login' ? 'Sign in' : 'Create account'; $('authErr').textContent = '';
    $('authPass').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
  }));

  async function syncCloud() {
    const remote = (await api('/api/saves')).saves || [];
    const map = new Map(remote.map(x => [x.id, x]));
    for (const l of saves) if (!map.has(l.id)) { await api('/api/saves/' + l.id, { method: 'PUT', body: JSON.stringify(l) }); map.set(l.id, l); }
    saves = [...map.values()]; LS.set(K.saves, saves);
  }

  $('authGo').addEventListener('click', async () => {
    const email = $('authEmail').value.trim(), password = $('authPass').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('authErr').textContent = 'Enter a valid email address.'; return; }
    if (password.length < 6) { $('authErr').textContent = 'Password must be at least 6 characters.'; return; }
    $('authGo').disabled = true; $('authErr').textContent = '';
    try {
      const r = await api(authMode === 'login' ? '/api/login' : '/api/register', { method: 'POST', body: JSON.stringify({ email, password }) });
      auth = { token: r.token, email: r.email }; LS.set(K.auth, auth);
      await syncCloud(); $('authPass').value = ''; paintAccount(); $('accountDlg').close();
      toast('Signed in. Your results are synced.');
    } catch (err) {
      auth = err.status ? null : auth;
      $('authErr').textContent = err.status ? err.message : 'The Markly server is not reachable right now. You can continue as a guest — results save on this device with a date and a name.';
    } finally { $('authGo').disabled = false; }
  });
  $('signOutBtn').addEventListener('click', () => { auth = null; try { localStorage.removeItem(K.auth); } catch (e) {} paintAccount(); $('accountDlg').close(); toast('Signed out. Saved results stay on this device.'); });

  /* ---------- dialogs: close buttons ---------- */
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
    else if (e.target.tagName === 'DIALOG') e.target.close();
  });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('viewDash').hidden) { e.preventDefault(); openSave(); } });

  /* ---------- install (Android / iPhone / PC) ---------- */
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const UA = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(UA);
  const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|MicroMessenger|; wv\)/i.test(UA);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('installBtn').classList.add('ready'); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; $('installBtn').hidden = true; toast('Markly installed.'); });
  if (standalone()) $('installBtn').hidden = true;

  function installWhy() {
    if (!window.isSecureContext) return 'This page is not on https, so the browser will not install it. Open the https (GitHub Pages) link.';
    if (inApp) return 'You are inside an in-app browser (WhatsApp, Instagram, Facebook…). Open the link in Chrome (Android) or Safari (iPhone), then install.';
    if (isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(UA)) return 'On iPhone only Safari can add apps to the Home Screen. Open this page in Safari, then tap Share → Add to Home Screen.';
    if (isIOS) return 'iPhone has no one-tap install. Tap the Share button, then “Add to Home Screen”.';
    if (/Firefox/.test(UA) && !isAndroid) return 'Firefox on PC cannot install web apps. Open this page in Chrome or Edge.';
    return 'Your browser has not offered the install prompt yet. Reload the page once, wait a few seconds and tap Install again — or use the browser menu ⋮ → “Install app” / “Add to Home screen”.';
  }

  $('installBtn').addEventListener('click', async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      const c = await deferredInstall.userChoice; deferredInstall = null; $('installBtn').classList.remove('ready');
      if (c.outcome === 'accepted') toast('Installing Markly…');
      return;
    }
    $('how-ios').classList.toggle('hit', isIOS); $('how-android').classList.toggle('hit', isAndroid && !isIOS); $('how-pc').classList.toggle('hit', !isIOS && !isAndroid);
    $('installWhy').textContent = installWhy(); $('installWhy').hidden = false;
    $('installDlg').showModal();
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});

  /* ---------- 3D tilt on cards (mouse only) ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !calm()) {
    const clear = keep => qsa('[data-tilt].tilting').forEach(x => { if (x !== keep) { x.classList.remove('tilting'); x.style.transform = ''; } });
    document.addEventListener('pointermove', e => {
      const el = e.target.closest ? e.target.closest('[data-tilt]') : null;
      clear(el);
      if (!el || (el.matches('.setup') && el.contains(document.activeElement))) return;
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.classList.add('tilting');
      el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 8).toFixed(2)}deg) rotateY(${((px - 0.5) * 10).toFixed(2)}deg)`;
      el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
    });
    document.addEventListener('mouseleave', () => clear(null));
  }

  /* ---------- boot ---------- */
  applyPrefs(); paintAccount();
  if (S.name) $('studentName').value = S.name;
  if (S.subjects.length) { $('subjectCount').value = S.subjects.length; renderAll(); show('viewDash'); } else show('viewName');
  window.scrollTo(0, 0);
})();
