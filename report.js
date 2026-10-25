/* Markly report cards: drawn straight on <canvas>, so no external library is needed and it works offline. */
(function () {
  const SANS = '"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  const SERIF = 'Georgia,"Times New Roman",serif';
  const MONO = '"Courier New",Consolas,monospace';

  // head: band | plain | center | side | frame      rows: table | bars | cards | minimal
  const templates = [
    { id: 'midnight', name: 'Midnight', note: 'Dark navy, table', bg: ['#0b1020', '#1a2342'], ink: '#f5f7ff', mut: '#aab3ce', acc: '#42d6c5', onAcc: '#0b1020', panel: '#212b4d', head: 'band', rows: 'table', font: SANS, r: 12 },
    { id: 'paper', name: 'Clean Paper', note: 'White, simple table', bg: '#ffffff', ink: '#17203a', mut: '#6a7490', acc: '#4f46e5', onAcc: '#ffffff', panel: '#eef1f8', head: 'plain', rows: 'table', font: SANS, r: 10 },
    { id: 'sunset', name: 'Sunset Bars', note: 'Warm gradient, bars', bg: ['#2b1034', '#ff7a59'], ink: '#fff7f2', mut: '#ffd9cc', acc: '#ffd166', onAcc: '#2b1034', panel: '#ffffff22', head: 'center', rows: 'bars', font: SANS, r: 18 },
    { id: 'forest', name: 'Forest Cards', note: 'Green, two columns', bg: ['#062a22', '#0f4c3a'], ink: '#eafff5', mut: '#9fd8c3', acc: '#4ade80', onAcc: '#062a22', panel: '#0b3a2d', head: 'side', rows: 'cards', font: SANS, r: 18 },
    { id: 'mono', name: 'Mono Ledger', note: 'Black on white, typewriter', bg: '#fbfbf8', ink: '#111111', mut: '#666666', acc: '#111111', onAcc: '#ffffff', panel: '#efefe9', head: 'plain', rows: 'minimal', font: MONO, r: 0 },
    { id: 'ocean', name: 'Ocean Bars', note: 'Blue, side accent', bg: ['#eaf4ff', '#d3e8ff'], ink: '#0c2340', mut: '#4a6685', acc: '#1f7aec', onAcc: '#ffffff', panel: '#ffffffcc', head: 'side', rows: 'bars', font: SANS, r: 16 },
    { id: 'rose', name: 'Rose Cards', note: 'Pink, centered', bg: ['#fff1f5', '#ffd9e6'], ink: '#3b0f23', mut: '#8a4a63', acc: '#e0316c', onAcc: '#ffffff', panel: '#ffffffd9', head: 'center', rows: 'cards', font: SANS, r: 20 },
    { id: 'gold', name: 'Certificate', note: 'Gold frame, serif', bg: '#fffaf0', ink: '#2c2210', mut: '#7d6a45', acc: '#b8860b', onAcc: '#fffaf0', panel: '#f6ecd2', head: 'frame', rows: 'minimal', font: SERIF, r: 4 },
    { id: 'neon', name: 'Neon Night', note: 'Black, neon bars', bg: ['#05050a', '#12081f'], ink: '#f4f0ff', mut: '#9a8fc0', acc: '#00f0ff', onAcc: '#05050a', panel: '#1a1230', head: 'plain', rows: 'bars', font: SANS, r: 14 },
    { id: 'pastel', name: 'Pastel Soft', note: 'Lilac band, cards', bg: ['#f6f2ff', '#eaf7ff'], ink: '#2a2450', mut: '#6f6a96', acc: '#8b7cff', onAcc: '#ffffff', panel: '#ffffff', head: 'band', rows: 'cards', font: SANS, r: 18 }
  ];

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (r <= 0) { c.rect(x, y, w, h); return; }
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fit(c, s, maxW) {
    s = String(s);
    if (c.measureText(s).width <= maxW) return s;
    while (s.length > 1 && c.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function T(c, s, x, y, o) {
    c.font = (o.weight || 400) + ' ' + o.size + 'px ' + o.font;
    c.fillStyle = o.color;
    c.textAlign = o.align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillText(o.max ? fit(c, s, o.max) : s, x, y);
  }
  const f2 = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

  /* d = { name, date, subjects:[{name,max,obtained,pct,grade}], obtained, max, percent, avg, grade, gpa } */
  function draw(cv, t, d, scale) {
    scale = scale || 1;
    const W = 1000, P = 56, n = d.subjects.length;
    const HEAD = t.head === 'center' ? 250 : t.head === 'frame' ? 270 : 200;
    const STATS = 150;
    const body = t.rows === 'table' ? 70 + n * 58 : t.rows === 'bars' ? n * 84 : t.rows === 'cards' ? Math.ceil(n / 2) * 134 : n * 54;
    const H = HEAD + STATS + body + 120;
    cv.width = W * scale; cv.height = H * scale;
    const c = cv.getContext('2d');
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const F = t.font;

    // background
    if (Array.isArray(t.bg)) { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, t.bg[0]); g.addColorStop(1, t.bg[1]); c.fillStyle = g; }
    else c.fillStyle = t.bg;
    c.fillRect(0, 0, W, H);

    // ---- header
    const meta = 'Student: ' + (d.name || 'Student') + '   |   Date: ' + d.date;
    if (t.head === 'band') {
      c.fillStyle = t.acc; c.fillRect(0, 0, W, HEAD - 20);
      T(c, 'Markly Results', P, 86, { size: 46, weight: 800, color: t.onAcc, font: F });
      T(c, 'Academic results report', P, 122, { size: 21, weight: 600, color: t.onAcc, font: F });
      T(c, meta, P, 160, { size: 20, color: t.onAcc, font: F, max: W - 2 * P });
    } else if (t.head === 'plain') {
      T(c, 'Markly Results', P, 92, { size: 46, weight: 800, color: t.ink, font: F });
      T(c, 'Academic results report', P, 128, { size: 21, weight: 600, color: t.acc, font: F });
      T(c, meta, P, 162, { size: 20, color: t.mut, font: F, max: W - 2 * P });
      c.fillStyle = t.acc; c.fillRect(P, HEAD - 14, 120, 4);
    } else if (t.head === 'center') {
      T(c, 'Markly Results', W / 2, 96, { size: 48, weight: 800, color: t.ink, font: F, align: 'center' });
      T(c, 'Academic results report', W / 2, 134, { size: 21, weight: 600, color: t.acc, font: F, align: 'center' });
      T(c, d.name || 'Student', W / 2, 188, { size: 30, weight: 700, color: t.ink, font: F, align: 'center', max: W - 2 * P });
      T(c, d.date, W / 2, 222, { size: 19, color: t.mut, font: F, align: 'center' });
    } else if (t.head === 'side') {
      c.fillStyle = t.acc; rr(c, P - 28, 54, 8, HEAD - 100, 4); c.fill();
      T(c, 'Markly Results', P, 92, { size: 46, weight: 800, color: t.ink, font: F });
      T(c, 'Academic results report', P, 128, { size: 21, weight: 600, color: t.acc, font: F });
      T(c, meta, P, 162, { size: 20, color: t.mut, font: F, max: W - 2 * P });
    } else { // frame
      c.strokeStyle = t.acc; c.lineWidth = 4; c.strokeRect(22, 22, W - 44, H - 44);
      c.lineWidth = 1.5; c.strokeRect(34, 34, W - 68, H - 68);
      T(c, 'Certificate of Results', W / 2, 112, { size: 46, weight: 700, color: t.ink, font: F, align: 'center' });
      T(c, 'awarded to', W / 2, 152, { size: 20, color: t.mut, font: F, align: 'center' });
      T(c, d.name || 'Student', W / 2, 206, { size: 40, weight: 700, color: t.acc, font: F, align: 'center', max: W - 2 * P });
      T(c, d.date, W / 2, 242, { size: 19, color: t.mut, font: F, align: 'center' });
    }

    // ---- stats
    const sy = HEAD, gap = 16, bw = (W - 2 * P - 3 * gap) / 4;
    const stats = [['Total obtained', f2(d.obtained) + ' / ' + f2(d.max)], ['Percentage', d.percent.toFixed(2) + '%'], ['Average', f2(d.avg)], ['Grade · GPA', d.grade + ' · ' + d.gpa.toFixed(2)]];
    stats.forEach((s, i) => {
      const x = P + i * (bw + gap);
      c.fillStyle = t.panel; rr(c, x, sy + 8, bw, 100, t.r); c.fill();
      T(c, s[0], x + 16, sy + 42, { size: 15, weight: 600, color: t.mut, font: F, max: bw - 28 });
      T(c, s[1], x + 16, sy + 84, { size: i === 0 ? 24 : 30, weight: 800, color: i === 1 ? t.acc : t.ink, font: F, max: bw - 28 });
    });

    // ---- rows
    const y0 = HEAD + STATS;
    if (t.rows === 'table') {
      c.fillStyle = t.acc; rr(c, P, y0, W - 2 * P, 48, Math.min(t.r, 14)); c.fill();
      const hs = { size: 16, weight: 800, color: t.onAcc, font: F };
      T(c, 'Subject', P + 16, y0 + 31, hs);
      T(c, 'Obtained', 560, y0 + 31, { ...hs, align: 'right' });
      T(c, 'Max', 670, y0 + 31, { ...hs, align: 'right' });
      T(c, 'Percent', 800, y0 + 31, { ...hs, align: 'right' });
      T(c, 'Grade', W - P - 16, y0 + 31, { ...hs, align: 'right' });
      d.subjects.forEach((s, i) => {
        const y = y0 + 56 + i * 58;
        if (i % 2 === 0) { c.fillStyle = t.panel; c.fillRect(P, y, W - 2 * P, 58); }
        const b = y + 37;
        T(c, s.name, P + 16, b, { size: 22, color: t.ink, font: F, max: 330 });
        T(c, f2(s.obtained), 560, b, { size: 22, color: t.ink, font: F, align: 'right' });
        T(c, f2(s.max), 670, b, { size: 22, color: t.mut, font: F, align: 'right' });
        T(c, s.pct.toFixed(2) + '%', 800, b, { size: 22, weight: 700, color: t.acc, font: F, align: 'right' });
        T(c, s.grade, W - P - 16, b, { size: 22, weight: 800, color: t.ink, font: F, align: 'right' });
      });
    } else if (t.rows === 'bars') {
      d.subjects.forEach((s, i) => {
        const y = y0 + i * 84, w = W - 2 * P;
        T(c, s.name, P, y + 34, { size: 24, weight: 700, color: t.ink, font: F, max: 430 });
        T(c, f2(s.obtained) + ' / ' + f2(s.max) + '   ' + s.pct.toFixed(1) + '%   ' + s.grade, W - P, y + 34, { size: 21, color: t.mut, font: F, align: 'right' });
        c.fillStyle = t.panel; rr(c, P, y + 48, w, 16, 8); c.fill();
        if (s.pct > 0) { c.fillStyle = t.acc; rr(c, P, y + 48, Math.max(16, w * Math.min(100, s.pct) / 100), 16, 8); c.fill(); }
      });
    } else if (t.rows === 'cards') {
      const cw = (W - 2 * P - 20) / 2;
      d.subjects.forEach((s, i) => {
        const x = P + (i % 2) * (cw + 20), y = y0 + Math.floor(i / 2) * 134;
        c.fillStyle = t.panel; rr(c, x, y, cw, 118, t.r); c.fill();
        T(c, s.name, x + 20, y + 38, { size: 22, weight: 700, color: t.ink, font: F, max: cw - 150 });
        T(c, f2(s.obtained) + ' / ' + f2(s.max), x + 20, y + 68, { size: 18, color: t.mut, font: F });
        T(c, s.pct.toFixed(1) + '%', x + cw - 20, y + 46, { size: 30, weight: 800, color: t.acc, font: F, align: 'right' });
        T(c, 'Grade ' + s.grade, x + cw - 20, y + 74, { size: 17, color: t.mut, font: F, align: 'right' });
        c.fillStyle = t.mut + '44'; rr(c, x + 20, y + 90, cw - 40, 10, 5); c.fill();
        if (s.pct > 0) { c.fillStyle = t.acc; rr(c, x + 20, y + 90, Math.max(10, (cw - 40) * Math.min(100, s.pct) / 100), 10, 5); c.fill(); }
      });
    } else { // minimal
      d.subjects.forEach((s, i) => {
        const y = y0 + i * 54;
        T(c, s.name, P, y + 34, { size: 23, color: t.ink, font: F, max: 400 });
        T(c, f2(s.obtained) + ' / ' + f2(s.max) + '   ' + s.pct.toFixed(1) + '%   ' + s.grade, W - P, y + 34, { size: 22, weight: 700, color: t.ink, font: F, align: 'right' });
        c.strokeStyle = t.mut + '88'; c.lineWidth = 1.5; c.setLineDash([2, 6]);
        c.beginPath(); c.moveTo(P, y + 46); c.lineTo(W - P, y + 46); c.stroke(); c.setLineDash([]);
      });
    }

    // ---- footer
    T(c, 'Markly · Your marks, made simple', W / 2, H - 56, { size: 18, color: t.mut, font: F, align: 'center' });
  }

  window.MarklyReport = { templates, draw };
})();
