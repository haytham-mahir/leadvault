/* ==========================================================================
   LEADVAULT SHARED KIT: api, sign-in gate, dial loader, 5-minute idle
   sign-out, icons, charts, drawers. Used by the dashboard and the console.
   ========================================================================== */
(function () {
'use strict';
const CFG = window.LV_CONFIG || {};
const LV = window.LV = {};
LV.API = CFG.api || '';
LV.IDLE = 300;                       // seconds; mirrors the backend

/* ---------- utilities ---------- */
const esc = LV.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
LV.fmt = n => (Number(n) || 0).toLocaleString('en-CA');
LV.money = n => (Number(n) || 0).toLocaleString('en-CA', {style: 'currency', currency: 'CAD', maximumFractionDigits: 0});
LV.pct = (a, b) => b ? (Math.round(a / b * 1000) / 10) + '%' : '—';
LV.day = 864e5;
LV.when = t => {
  if (!t) return '—';
  const d = Date.now() - t;
  if (d >= 0 && d < 6e4) return 'just now';
  if (d >= 0 && d < 36e5) return Math.round(d / 6e4) + ' min ago';
  const dt = new Date(t), today = new Date();
  if (dt.toDateString() === today.toDateString()) return 'today, ' + dt.toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'});
  const y = new Date(today - 864e5);
  if (dt.toDateString() === y.toDateString()) return 'yesterday, ' + dt.toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'});
  return dt.toLocaleString('en-CA', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
};
LV.date = t => t ? new Date(t).toLocaleDateString('en-CA', {month: 'short', day: 'numeric', year: 'numeric'}) : '—';
LV.dur = s => { s = Number(s) || 0; return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
LV.initials = s => String(s || '?').trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
const AVC = ['#1F7A5A', '#3E7CB1', '#8E5A9B', '#B7791F', '#5B8C85', '#9C6B4E', '#6B7C3A', '#D1495B'];
LV.hue = s => { let h = 0; String(s || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return AVC[h % AVC.length]; };
LV.av = (name, size) => '<span class="av" style="background:' + LV.hue(name) + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '">' + esc(LV.initials(name)) + '</span>';
LV.ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
LV.ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};
LV.uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
LV.debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

/* ---------- api ---------- */
LV.onAuthLost = null;
LV.api = async function (action, body) {
  const payload = Object.assign({action}, body || {});
  let r;
  try {
    r = await fetch(LV.API, {method: 'POST', body: JSON.stringify(payload), headers: {'Content-Type': 'text/plain;charset=utf-8'}, redirect: 'follow'});
  } catch (e) { return {error: 'Can’t reach Leadvault. Check your connection and try again.', net: true}; }
  let j; try { j = await r.json(); } catch (e) { return {error: 'Leadvault sent an unexpected reply. Try again in a moment.'}; }
  if (j && j.auth && LV.onAuthLost) LV.onAuthLost(j.error);
  if (!j.error && LV.idle) LV.idle.bump(true);
  return j;
};

/* ---------- icons (24px stroke) ---------- */
const P = LV.P = {
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  form: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4', money: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  line: 'M3 3v18h18M7 15l4-4 3 3 6-7', bars: 'M4 20V10M10 20V4M16 20v-7M22 20H2', donut: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  funnel: 'M3 4h18l-7 9v6l-4 2v-8z', plus: 'M12 5v14M5 12h14', send: 'M4.5 12 20 4.5 15.5 20l-3.2-6.3zM12.3 13.7 20 4.5', x: 'M6 6l12 12M18 6 6 18',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01', check: 'M20 6 9 17l-5-5', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z', spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', chev: 'm7 10 5 5 5-5', left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', key: 'M15 7a4 4 0 1 1-3.9 5H3v4h3v-2h2v-2h3.1A4 4 0 0 1 15 7zM16 10h.01',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15', copy: 'M9 9h11v11H9zM5 15H4V4h11v1', refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14', move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z', flag: 'M4 22V4M4 4h13l-2 4 2 4H4', tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5', more: 'M12 12h.01M19 12h.01M5 12h.01',
  undo: 'M3 7v6h6M3.5 13A9 9 0 1 0 6 6.3L3 9', wa: 'M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4zM9 8.5c0 3 3.5 6.5 6.5 6.5l1.2-1.4-2-1-1 .9c-1-.4-2.4-1.8-2.8-2.8l.9-1-1-2z', wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20 14 10M12 4l1.5 1.5M18 4l-1.5 1.5', drag: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01', resize: 'M21 15v6h-6M21 21l-7-7M3 9V3h6M3 3l7 7', heat: 'M3 3h4v4H3zM10 3h4v4h-4zM17 3h4v4h-4zM3 10h4v4H3zM10 10h4v4h-4zM17 10h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z', device: 'M5 3h10v18H5zM9 18h2M17 8h4v13h-4z', table: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16', task: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'
};
LV.ic = (n, s) => '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (P[n] || P.spark) + '"/></svg>';

/* ---------- brand mark + combination dial ---------- */
LV.mark = (s, light) => '<svg viewBox="0 0 32 32" width="' + (s || 28) + '" height="' + (s || 28) + '" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="' + (light ? '#fff' : '#C29B3F') + '"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="#0F3D2E" stroke-width="2.4"/><path d="M11.6 12.4 16 20.4l4.4-8" fill="none" stroke="#0F3D2E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 1.5v3.2M16 27.3v3.2M1.5 16h3.2M27.3 16h3.2" stroke="#0F3D2E" stroke-width="1.6"/></svg>';
LV.dial = (cls) => {
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * Math.PI / 180, long = i % 5 === 0, r1 = long ? 70 : 75, r2 = 81;
    ticks += '<line x1="' + (100 + r1 * Math.sin(a)).toFixed(2) + '" y1="' + (100 - r1 * Math.cos(a)).toFixed(2) + '" x2="' + (100 + r2 * Math.sin(a)).toFixed(2) + '" y2="' + (100 - r2 * Math.cos(a)).toFixed(2) + '" stroke="#C29B3F" stroke-width="' + (long ? 2.2 : 1) + '" stroke-opacity="' + (long ? 1 : .6) + '"/>';
  }
  let nums = '';
  for (let n = 0; n < 12; n++) { const a = n * 30 * Math.PI / 180; nums += '<text x="' + (100 + 59 * Math.sin(a)).toFixed(1) + '" y="' + (100 - 59 * Math.cos(a) + 3.5).toFixed(1) + '" text-anchor="middle" font-size="9" font-family="Bricolage Grotesque,sans-serif" font-weight="600" fill="#D9B868">' + (n * 5) + '</text>'; }
  return '<div class="dial ' + (cls || '') + '"><svg viewBox="0 0 200 200" aria-hidden="true">' +
    '<circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1"/>' +
    '<circle cx="100" cy="100" r="88" fill="#0A2A20" stroke="#C29B3F" stroke-width="2"/>' +
    '<g class="ring">' + ticks + nums + '</g>' +
    '<path d="M100 6 94 -4h12z" fill="#D9B868"/>' +
    '<circle cx="100" cy="100" r="44" fill="#145240" stroke="#C29B3F" stroke-width="1.5"/>' +
    '<g class="bolt"><rect x="62" y="96" width="76" height="8" rx="4" fill="#C29B3F"/><circle cx="100" cy="100" r="14" fill="#0F3D2E" stroke="#D9B868" stroke-width="2"/><path d="M95 96.5 100 104l5-7.5" fill="none" stroke="#D9B868" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>' +
    '</svg></div>';
};

/* ---------- the vault door (loading screen and sign-in art) ----------
   A machined steel vault door set in a heavy frame. The combination dial works
   through a real combination (fast spin, slow settle, reverse), the hand-wheel
   turns with weight, eight locking bolts withdraw one after another, light
   leaks through the seam and the door swings open on its hinge into the light.
   Hovering tilts the door towards the pointer, moves the reflection across the
   steel and lets the dial follow your hand. */
let VSEQ = 0;
LV.vault = (cls) => {
  const u = 'v' + (++VSEQ), C = 150, f = n => n.toFixed(1);
  let frameBolts = '', rimBolts = '', lockBolts = '', ticks = '', nums = '', knurl = '', spokes = '', rings = '';
  for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * Math.PI * 2, x = C + 131 * Math.cos(a), y = C + 131 * Math.sin(a);
    frameBolts += '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(a * 57.3 + 30) + ')"><polygon points="-4.6,0 -2.3,-4 2.3,-4 4.6,0 2.3,4 -2.3,4" fill="url(#' + u + 'nut)" stroke="#1d2126" stroke-width=".6"/><circle r="1.6" fill="#0d1013" opacity=".55"/></g>'; }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; rimBolts += '<circle cx="' + f(C + 101 * Math.cos(a)) + '" cy="' + f(C + 101 * Math.sin(a)) + '" r="2.6" fill="url(#' + u + 'dome)" stroke="#15181c" stroke-width=".5"/>'; }
  for (let i = 0; i < 8; i++) lockBolts += '<g transform="rotate(' + (i * 45 + 22.5) + ' 150 150)"><g class="vbolt" style="--i:' + i + '"><rect x="234" y="143" width="30" height="14" rx="2.5" fill="url(#' + u + 'boltg)" stroke="#2a2f35" stroke-width=".7"/><rect x="236" y="144.5" width="26" height="2.2" rx="1" fill="#fff" opacity=".35"/></g></g>';
  for (let i = 0; i < 100; i++) { const a = i / 100 * Math.PI * 2 - Math.PI / 2, L = i % 10 === 0, M = i % 5 === 0, r1 = L ? 33 : M ? 35.5 : 37;
    ticks += '<line x1="' + f(C + r1 * Math.cos(a)) + '" y1="' + f(C + r1 * Math.sin(a)) + '" x2="' + f(C + 39.5 * Math.cos(a)) + '" y2="' + f(C + 39.5 * Math.sin(a)) + '" stroke="#e9e4d6" stroke-opacity="' + (L ? .95 : .55) + '" stroke-width="' + (L ? 1.1 : .5) + '"/>';
    if (L) nums += '<text x="' + f(C + 27.5 * Math.cos(a)) + '" y="' + f(C + 27.5 * Math.sin(a) + 2.2) + '" transform="rotate(' + f(i * 3.6) + ' ' + f(C + 27.5 * Math.cos(a)) + ' ' + f(C + 27.5 * Math.sin(a)) + ')">' + i + '</text>'; }
  for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; knurl += '<line x1="' + f(C + 40.5 * Math.cos(a)) + '" y1="' + f(C + 40.5 * Math.sin(a)) + '" x2="' + f(C + 44 * Math.cos(a)) + '" y2="' + f(C + 44 * Math.sin(a)) + '" stroke="#0e1114" stroke-opacity=".55" stroke-width=".8"/>'; }
  for (let i = 0; i < 5; i++) spokes += '<g transform="rotate(' + (i * 72) + ' 150 150)"><rect x="146" y="72" width="8" height="58" rx="4" fill="url(#' + u + 'spoke)" stroke="#20252a" stroke-width=".6"/><circle cx="150" cy="70" r="9" fill="url(#' + u + 'knob)" stroke="#1b1f23" stroke-width=".7"/><ellipse cx="147" cy="66.5" rx="3.6" ry="2.2" fill="#fff" opacity=".55"/></g>';
  [92, 86, 64, 60].forEach((r, k) => { rings += '<circle cx="150" cy="150" r="' + r + '" fill="none" stroke="' + (k % 2 ? '#fff' : '#000') + '" stroke-opacity="' + (k % 2 ? .10 : .35) + '" stroke-width="' + (k % 2 ? .8 : 1.4) + '"/>'; });
  const defs = '<defs>' +
    '<linearGradient id="' + u + 'frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d646c"/><stop offset=".35" stop-color="#2c3238"/><stop offset=".62" stop-color="#454c54"/><stop offset="1" stop-color="#15191d"/></linearGradient>' +
    '<linearGradient id="' + u + 'bevel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa2aa"/><stop offset=".5" stop-color="#3a4047"/><stop offset="1" stop-color="#0c0f12"/></linearGradient>' +
    '<radialGradient id="' + u + 'nut" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#c9ced3"/><stop offset=".55" stop-color="#6b737b"/><stop offset="1" stop-color="#2a3036"/></radialGradient>' +
    '<radialGradient id="' + u + 'dome" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e7eaed"/><stop offset=".6" stop-color="#7d858d"/><stop offset="1" stop-color="#2d333a"/></radialGradient>' +
    '<linearGradient id="' + u + 'boltg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dde1"/><stop offset=".45" stop-color="#8d959d"/><stop offset="1" stop-color="#3b4249"/></linearGradient>' +
    '<linearGradient id="' + u + 'spoke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3d444b"/><stop offset=".35" stop-color="#e3e6e9"/><stop offset=".6" stop-color="#8a929a"/><stop offset="1" stop-color="#2b3137"/></linearGradient>' +
    '<radialGradient id="' + u + 'knob" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f4f5f6"/><stop offset=".5" stop-color="#9aa1a8"/><stop offset="1" stop-color="#30363c"/></radialGradient>' +
    '<radialGradient id="' + u + 'hub" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#d6dadd"/><stop offset=".55" stop-color="#5f676f"/><stop offset="1" stop-color="#1c2025"/></radialGradient>' +
    '<radialGradient id="' + u + 'dialf" cx=".4" cy=".32" r=".85"><stop offset="0" stop-color="#2d3339"/><stop offset="1" stop-color="#0d1013"/></radialGradient>' +
    '<linearGradient id="' + u + 'brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a6"/><stop offset=".5" stop-color="#c29b3f"/><stop offset="1" stop-color="#7d5f1c"/></linearGradient>' +
    '<radialGradient id="' + u + 'recess" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#05070a"/><stop offset="1" stop-color="#20262c"/></radialGradient>' +
    '</defs>';
  return '<div class="vault ' + (cls || '') + '"><div class="v-tilt">' +
    '<div class="v-floor"></div>' +
    '<svg class="v-frame" viewBox="0 0 300 300" aria-hidden="true">' + defs +
      '<circle cx="150" cy="150" r="146" fill="url(#' + u + 'frame)"/>' +
      '<circle cx="150" cy="150" r="146" fill="none" stroke="url(#' + u + 'bevel)" stroke-width="2.4"/>' +
      '<circle cx="150" cy="150" r="138" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>' +
      '<circle cx="150" cy="150" r="124" fill="none" stroke="url(#' + u + 'bevel)" stroke-width="3" transform="rotate(180 150 150)"/>' +
      frameBolts +
      '<circle cx="150" cy="150" r="121" fill="url(#' + u + 'recess)"/>' +
      '<rect x="6" y="104" width="18" height="30" rx="4" fill="url(#' + u + 'spoke)" stroke="#15191d" stroke-width=".8"/><rect x="6" y="166" width="18" height="30" rx="4" fill="url(#' + u + 'spoke)" stroke="#15191d" stroke-width=".8"/>' +
    '</svg>' +
    '<div class="v-inside"><i class="v-core"></i><i class="v-shelf"></i></div>' +
    '<div class="v-seam"></div>' +
    '<div class="v-door"><div class="v-depth">' + '<i></i>'.repeat(8) + '</div>' +
      '<div class="v-face"></div>' +
      '<svg class="v-art" viewBox="0 0 300 300" aria-hidden="true">' + defs.replace(/id="v\d+/g, 'id="' + u + 'd') .replace(/url\(#v\d+/g, 'url(#' + u + 'd') +
        '<g class="v-locks">' + lockBolts.replace(/url\(#v\d+/g, 'url(#' + u + 'd') + '</g>' +
        '<circle cx="150" cy="150" r="111" fill="none" stroke="#0b0e11" stroke-width="2"/><circle cx="150" cy="150" r="109" fill="none" stroke="#c9ced3" stroke-opacity=".35" stroke-width="1"/>' +
        rings + rimBolts.replace(/url\(#v\d+/g, 'url(#' + u + 'd') +
        '<g class="vwheel">' + spokes.replace(/url\(#v\d+/g, 'url(#' + u + 'd') + '<circle cx="150" cy="150" r="22" fill="url(#' + u + 'dhub)" stroke="#15191d" stroke-width="1"/></g>' +
        '<g class="vdial"><circle cx="150" cy="150" r="44.5" fill="url(#' + u + 'dhub)" stroke="#111417" stroke-width="1"/>' + knurl + '<circle cx="150" cy="150" r="40" fill="url(#' + u + 'ddialf)" stroke="#000" stroke-opacity=".6"/>' + ticks + '<g class="v-nums">' + nums + '</g>' +
          '<circle cx="150" cy="150" r="17" fill="url(#' + u + 'dhub)" stroke="#0d1013" stroke-width="1"/><circle cx="150" cy="150" r="9" fill="url(#' + u + 'ddialf)"/><ellipse cx="146" cy="145" rx="5" ry="3" fill="#fff" opacity=".35"/></g>' +
        '<path class="v-index" d="M150 103.5 145.6 96h8.8z" fill="url(#' + u + 'dbrass)" stroke="#5c4512" stroke-width=".5"/>' +
      '</svg>' +
      '<div class="v-spec"></div>' +
    '</div>' +
  '</div></div>';
};
/* the door leans towards the pointer and the light moves across the steel */
document.addEventListener('pointermove', e => {
  const v = e.target && e.target.closest && e.target.closest('.vault'); if (!v || v.classList.contains('open')) return;
  const r = v.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
  v.style.setProperty('--rx', Math.max(-1, Math.min(1, x)).toFixed(3)); v.style.setProperty('--ry', Math.max(-1, Math.min(1, y)).toFixed(3));
  v.classList.add('hover');
}, {passive: true});
document.addEventListener('pointerout', e => {
  const v = e.target && e.target.closest && e.target.closest('.vault'); if (!v || (e.relatedTarget && v.contains(e.relatedTarget))) return;
  v.classList.remove('hover'); v.style.setProperty('--rx', 0); v.style.setProperty('--ry', 0);
});
/* the unlock-and-open sequence, shared by the loading screen and the sign-in art */
LV.vaultOpen = (v, done) => {
  if (!v || v._seq) return; v._seq = 1;
  const at = (ms, fn) => setTimeout(fn, LV.reduced() ? Math.min(ms, 120) : ms);
  v.style.setProperty('--rx', 0); v.style.setProperty('--ry', 0);
  const d = v.querySelector('.vdial'), m = (getComputedStyle(d).transform || '').match(/matrix\(([^)]+)\)/);
  let a = 0; if (m) { const p = m[1].split(',').map(Number); a = Math.atan2(p[1], p[0]) * 180 / Math.PI; }
  d.style.animation = 'none'; d.style.transform = 'rotate(' + a.toFixed(2) + 'deg)'; void d.getBoundingClientRect();
  v.classList.remove('spin', 'calm', 'hover'); v.classList.add('unlock');        /* dial lands on the last number */
  requestAnimationFrame(() => { d.style.transform = 'rotate(' + (Math.ceil((a + 70) / 36) * 36) + 'deg)'; });
  at(420, () => v.classList.add('turn'));                                          /* wheel turns, bolts withdraw */
  at(1150, () => v.classList.add('crack'));                                        /* the seal breaks, light leaks */
  at(1450, () => { v.classList.add('open'); if (done) done(); });                  /* the door swings */
};
/* dust motes drifting in the light (loading screen and sign-in art) */
LV.particles = function (canvas, o) {
  o = o || {}; const ctx = canvas && canvas.getContext && canvas.getContext('2d'); if (!ctx) return {stop() {}, burst() {}};
  let W = 0, H = 0, run = true; const P = [], dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => { W = canvas.clientWidth || 800; H = canvas.clientHeight || 600; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); window.addEventListener('resize', size);
  const n = o.n || Math.round(Math.min(70, W * H / 22000));
  for (let i = 0; i < n; i++) P.push({x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.1 + .25, s: Math.random() * .16 + .03, a: Math.random() * .4 + .08, t: Math.random() * 6.28, w: Math.random() * .5 + .15});
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    P.forEach(p => {
      if (!still) { p.t += .008; p.y -= p.s * (o.burst ? 6 : 1); p.x += Math.sin(p.t) * p.w * .25 + (o.burst ? (p.x - W / 2) * .004 : 0); if (p.y < -5 || p.x < -5 || p.x > W + 5) { p.y = H + 5; p.x = Math.random() * W; } }
      const tw = .6 + .4 * Math.sin(p.t * 1.7);
      ctx.fillStyle = 'rgba(244,232,200,' + (p.a * tw * (o.burst ? 1.8 : 1)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
    });
  };
  const tick = () => { if (!run) return; draw(); if (!still) requestAnimationFrame(tick); };
  tick();
  return {stop() { run = false; window.removeEventListener('resize', size); }, burst() { o.burst = true; }};
};
/* Full-screen loading screen while the session is restored. */
const BOOT_LINES = ['Dialling the combination', 'Checking your credentials', 'Withdrawing the bolts', 'Counting your leads'];
LV.boot = {
  show(msg) {
    let b = document.getElementById('lvBoot');
    if (!b) {
      b = document.createElement('div'); b.id = 'lvBoot'; b.className = 'boot'; b.setAttribute('role', 'status');
      b.innerHTML = '<div class="boot-spot"></div><canvas class="boot-dust"></canvas><div class="boot-flood"></div><div class="boot-in"><div class="boot-stage">' + LV.vault('spin') + '</div>' +
        '<div class="boot-word">LEADVAULT</div><div class="boot-bar"><i></i></div><div class="boot-msg" aria-live="polite"></div></div>';
      document.body.appendChild(b);
      b._fx = LV.particles(b.querySelector('canvas'));
      let k = 1; b._lines = setInterval(() => { if (b._custom) return; const m = b.querySelector('.boot-msg'); m.classList.remove('in'); void m.offsetWidth; m.textContent = BOOT_LINES[k++ % BOOT_LINES.length]; m.classList.add('in'); }, 1700);
    }
    b.classList.remove('gone', 'opening', 'flood'); b._opening = 0; const v = b.querySelector('.vault'); v._seq = 0; v.className = 'vault spin';
    const m = b.querySelector('.boot-msg'); m.textContent = msg || BOOT_LINES[0]; m.classList.add('in'); b._custom = false;
  },
  msg(t) { const b = document.getElementById('lvBoot'); if (b) { b._custom = true; b.querySelector('.boot-msg').textContent = t; } },
  open() {
    const b = document.getElementById('lvBoot'); if (!b || b._opening) return; b._opening = 1;
    clearInterval(b._lines); b._custom = true;
    const m = b.querySelector('.boot-msg'); m.textContent = 'Access granted'; m.classList.add('ok');
    b.classList.add('opening');
    const vr = b.querySelector('.vault').getBoundingClientRect(), fl = b.querySelector('.boot-flood');
    fl.style.left = (vr.left + vr.width / 2) + 'px'; fl.style.top = (vr.top + vr.height / 2) + 'px';
    const R = LV.reduced() ? .15 : 1;
    LV.vaultOpen(b.querySelector('.vault'), () => { if (b._fx) b._fx.burst(); setTimeout(() => b.classList.add('flood'), 700 * R); });
    setTimeout(() => b.classList.add('gone'), 3150 * R);
    setTimeout(() => { if (b._fx) b._fx.stop(); b.remove(); }, 4100 * R);
  }
};
/* ---------- motion helpers ---------- */
const easeOut = t => 1 - Math.pow(1 - t, 3);
LV.reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
LV.countUp = function (root) {
  if (!root || LV.reduced()) return;
  root.querySelectorAll('[data-n]').forEach(el => {
    if (el._counted) return; el._counted = 1;
    const to = Number(el.getAttribute('data-n')); if (!isFinite(to) || to === 0) return;
    const txt = el.textContent, money = /\$/.test(txt), pct = /%/.test(txt), dec = /\.\d/.test(txt) ? 1 : 0, t0 = performance.now(), dur = Math.min(1500, 650 + Math.log10(Math.abs(to) + 1) * 240);
    const f = v => money ? LV.money(v) : (dec ? v.toFixed(dec) : LV.fmt(Math.round(v))) + (pct ? '%' : '');
    const step = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = f(to * easeOut(k)); if (k < 1) requestAnimationFrame(step); else el.textContent = txt; };
    requestAnimationFrame(step);
  });
};
/* soft light that follows the pointer across cards */
document.addEventListener('pointermove', e => {
  const w = e.target && e.target.closest && e.target.closest('.w,.glow');
  if (!w) return; const r = w.getBoundingClientRect();
  w.style.setProperty('--mx', (e.clientX - r.left) + 'px'); w.style.setProperty('--my', (e.clientY - r.top) + 'px');
}, {passive: true});
/* heatmap: rows x cols */
LV.heat = function (rows, cols, val, o) {
  o = o || {}; let max = 0; rows.forEach((r, i) => cols.forEach((c, j) => { max = Math.max(max, val(i, j)); }));
  if (!max) return '<div class="empty"><b>Nothing yet</b>No data for this period.</div>';
  return '<div class="heat" style="--cols:' + cols.length + '"><span></span>' + cols.map((c, j) => '<small class="hc">' + (j % (o.every || 1) === 0 ? esc(c) : '') + '</small>').join('') +
    rows.map((r, i) => '<small class="hr">' + esc(r) + '</small>' + cols.map((c, j) => { const v = val(i, j); return '<i style="--k:' + (v / max).toFixed(3) + ';animation-delay:' + Math.min(900, (i * cols.length + j) * 4) + 'ms" title="' + esc(r + ' ' + c + ': ' + LV.fmt(v)) + '"></i>'; }).join('')).join('') + '</div>';
};
/* simple data table: cols [{h, f(row), n:numeric}] */
LV.table = function (cols, rows, o) {
  o = o || {}; if (!rows.length) return '<div class="empty"><b>Nothing yet</b>' + esc(o.empty || 'No data for this period.') + '</div>';
  return '<div style="overflow:auto"><table class="t"><thead><tr>' + cols.map(c => '<th' + (c.n ? ' class="n"' : '') + '>' + esc(c.h) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + cols.map(c => '<td' + (c.n ? ' class="n"' : ' style="max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"') + '>' + c.f(r) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
};

/* ---------- sign-in gate ---------- */
/* opts: {title, sub, kind:'client'|'team', note, onSubmit(email,pw,extra) -> Promise<{error}|{ok}>, keyMode} */
LV.gate = function (root, opts) {
  const remembered = LV.ls.get('lv_last_email_' + opts.kind, '');
  root.innerHTML = '<div class="gate">' +
    '<section class="gate-art"><canvas class="gate-dust"></canvas><div class="gate-brand">' + LV.mark(34) + 'Leadvault</div>' +
      '<div class="gate-hero">' + LV.vault('calm') + '<div><h1>' + esc(opts.headline || 'Every lead, kept safe.') + '</h1><p>' + esc(opts.blurb || 'Forms, calls, deals and bookings from every channel, in one place your whole team can trust.') + '</p></div></div>' +
      '<div class="gate-foot">' + (opts.foot || [['5 min', 'idle sign-out'], ['Live', 'from your CRM'], ['Private', 'by design']]).map(f => '<div><b>' + esc(f[0]) + '</b>' + esc(f[1]) + '</div>').join('') + '</div></section>' +
    '<section class="gate-form"><form class="gate-card" novalidate>' +
      '<h2>' + esc(opts.title || 'Sign in') + '</h2><p class="sub">' + esc(opts.sub || 'Use the email and password your account manager sent you.') + '</p>' +
      (opts.note ? '<div class="gate-note">' + LV.ic('clock', 18) + '<span>' + esc(opts.note) + '</span></div>' : '') +
      '<div class="gate-err" role="alert">' + LV.ic('shield', 18) + '<span></span></div>' +
      '<div data-pwmode><label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="username" required value="' + esc(remembered) + '"></label>' +
      '<label class="field"><span>Password</span><div class="pw"><input class="input" type="password" name="password" autocomplete="current-password" required><button type="button" data-show aria-label="Show password">Show</button></div></label>' +
      '<label class="check"><input type="checkbox" name="remember"' + (remembered ? ' checked' : '') + '> Remember my email on this device</label></div>' +
      (opts.keyMode ? '<div data-keymode hidden><label class="field"><span>Owner key</span><input class="input" type="password" name="key" autocomplete="off" placeholder="LV-…"></label><p class="hint" style="margin:-6px 0 18px">Found in Apps Script → Project Settings → Script properties → OWNER_KEY.</p></div>' : '') +
      '<button class="btn go" type="submit">Sign in</button>' +
      (opts.keyMode ? '<button class="btn ghost" type="button" data-switch style="width:100%;justify-content:center;margin-top:8px">Use the owner key instead</button>' : '') +
      '<div class="gate-small">' + LV.ic('lock', 15) + '<span>You’ll be signed out after 5 minutes without activity.</span></div>' +
    '</form></section></div>';
  const f = root.querySelector('form'), err = root.querySelector('.gate-err'), btn = f.querySelector('button[type=submit]');
  const dust = root.querySelector('.gate-dust'); if (dust) { if (LV._gateFx) LV._gateFx.stop(); LV._gateFx = LV.particles(dust, {n: 70}); }
  let keyMode = false;
  f.querySelector('[data-show]').addEventListener('click', e => { const i = f.password; i.type = i.type === 'password' ? 'text' : 'password'; e.target.textContent = i.type === 'password' ? 'Show' : 'Hide'; });
  if (opts.keyMode) f.querySelector('[data-switch]').addEventListener('click', e => {
    keyMode = !keyMode; f.querySelector('[data-pwmode]').hidden = keyMode; f.querySelector('[data-keymode]').hidden = !keyMode;
    e.target.textContent = keyMode ? 'Use email and password' : 'Use the owner key instead'; (keyMode ? f.key : f.email).focus();
  });
  setTimeout(() => (remembered ? f.password : f.email).focus(), 50);
  f.addEventListener('submit', async e => {
    e.preventDefault(); err.classList.remove('on');
    const email = f.email.value.trim(), pw = f.password.value, key = keyMode ? f.key.value.trim() : '';
    if (!keyMode && (!email || !pw)) return fail('Enter your email and password.');
    if (keyMode && !key) return fail('Enter the owner key.');
    btn.classList.add('busy'); btn.disabled = true; const dl = root.querySelector('.gate-art .vault'); if (dl) { dl.classList.remove('calm'); dl.classList.add('spin'); }
    if (f.remember && f.remember.checked) LV.ls.set('lv_last_email_' + opts.kind, email); else LV.ls.del('lv_last_email_' + opts.kind);
    const r = await opts.onSubmit(email, pw, {key});
    btn.classList.remove('busy'); btn.disabled = false;
    if (r && r.error) { fail(r.error); if (dl) { dl.classList.remove('spin'); dl.classList.add('calm'); } }
  });
  function fail(m) { err.querySelector('span').textContent = m; err.classList.add('on'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
  /* the dial unlocks while signing in */
  return {unlock() { const d = root.querySelector('.gate-art .vault'); if (d) d.classList.add('unlock'); }};
};

/* ---------- 5-minute idle sign-out ---------- */
/* Any key, click, scroll or touch counts as activity. At 4 minutes a bar counts
   down the last 60 seconds; at 5 minutes onTimeout() signs the person out. A
   light ping keeps the backend session in step while the person is active. */
LV.startIdle = function (opts) {
  LV.stopIdle();
  const limit = (opts.seconds || LV.IDLE) * 1000, warnAt = limit - 60000;
  let last = Date.now(), pinged = Date.now(), bar = null, tick = null;
  const bump = (fromApi) => {
    last = Date.now();
    if (fromApi) pinged = Date.now();
    if (bar && bar.classList.contains('on')) bar.classList.remove('on');
  };
  const onAct = LV.debounce(() => bump(false), 200);
  const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'];
  evs.forEach(e => window.addEventListener(e, onAct, {passive: true, capture: true}));
  bar = document.createElement('div'); bar.className = 'idle'; bar.setAttribute('role', 'alert');
  bar.innerHTML = '<span>' + LV.ic('clock', 18) + '</span><span>For your security you’ll be signed out in <b data-s>60</b>s.</span><button class="btn brass sm" type="button">Stay signed in</button>';
  document.body.appendChild(bar);
  bar.querySelector('button').addEventListener('click', () => { bump(false); opts.ping && opts.ping(); });
  tick = setInterval(() => {
    const idle = Date.now() - last;
    if (idle >= limit) { LV.stopIdle(); opts.onTimeout(); return; }
    if (idle >= warnAt) { bar.classList.add('on'); bar.querySelector('[data-s]').textContent = Math.ceil((limit - idle) / 1000); }
    /* active, but no server call for 2 minutes: ping so the backend session slides too */
    if (idle < 60000 && Date.now() - pinged > 120000 && opts.ping) { pinged = Date.now(); opts.ping(); }
  }, 1000);
  /* coming back to a sleeping tab after the limit signs out at once */
  const vis = () => { if (document.visibilityState === 'visible' && Date.now() - last >= limit) { LV.stopIdle(); opts.onTimeout(); } };
  document.addEventListener('visibilitychange', vis);
  LV.idle = {bump, stop() { clearInterval(tick); evs.forEach(e => window.removeEventListener(e, onAct, {capture: true})); document.removeEventListener('visibilitychange', vis); bar.remove(); }};
};
LV.stopIdle = function () { if (LV.idle) { LV.idle.stop(); LV.idle = null; } };

/* ---------- toast, drawer, modal, confirm ---------- */
LV.toast = function (msg, action) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
  if (action) t.querySelector('button').addEventListener('click', () => { t.remove(); action.fn(); });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), action ? 7000 : 3600);
};
LV.drawer = function (title, sub, bodyHtml, onMount) {
  const b = document.createElement('div'); b.className = 'back';
  b.innerHTML = '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="drawer-h"><div style="flex:1;min-width:0"><h2>' + esc(title) + '</h2>' + (sub ? '<div style="color:var(--ink-3);font-size:13px;margin-top:3px">' + sub + '</div>' : '') + '</div><button class="iconbtn light" type="button" data-x aria-label="Close">' + LV.ic('x') + '</button></div><div class="drawer-b">' + bodyHtml + '</div></aside>';
  const close = () => { b.remove(); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  b.addEventListener('click', e => { if (e.target === b) close(); });
  b.querySelector('[data-x]').addEventListener('click', close);
  document.addEventListener('keydown', key);
  document.body.appendChild(b);
  const body = b.querySelector('.drawer-b');
  if (onMount) onMount(body, close);
  return {el: b, body, close};
};
LV.modal = function (html, onMount) {
  const b = document.createElement('div'); b.className = 'back center';
  b.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
  const close = () => { b.remove(); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  b.addEventListener('click', e => { if (e.target === b) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(b);
  b.querySelectorAll('[data-close]').forEach(x => x.addEventListener('click', close));
  if (onMount) onMount(b.querySelector('.modal'), close);
  return {close, el: b};
};
LV.confirm = (title, text, yes, danger) => new Promise(res => {
  LV.modal('<h2>' + esc(title) + '</h2><p style="color:var(--ink-2);margin:6px 0 22px">' + esc(text) + '</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-no>Cancel</button><button class="btn ' + (danger ? 'danger' : 'go') + '" type="button" data-yes>' + esc(yes || 'Confirm') + '</button></div>', (m, close) => {
    m.querySelector('[data-no]').addEventListener('click', () => { close(); res(false); });
    m.querySelector('[data-yes]').addEventListener('click', () => { close(); res(true); });
  });
});
LV.copy = (text, msg) => { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => LV.toast(msg || 'Copied'), () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); LV.toast(msg || 'Copied'); } catch (e) {} t.remove(); }); };
LV.csv = (name, rows) => {
  const s = rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], {type: 'text/csv'})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/* ---------- charts ---------- */
const SER = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
LV.SER = SER;
LV.spark = (vals, color) => {
  if (!vals || vals.length < 2) return '';
  const max = Math.max(1, ...vals), w = 120, h = 30, step = w / (vals.length - 1);
  const pts = vals.map((v, i) => (i * step).toFixed(1) + ',' + (h - 2 - (v / max) * (h - 4)).toFixed(1));
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (color || 'var(--s1)') + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
};
/* series: [{name, color, vals:[]}], labels: [ts] */
LV.lineChart = function (el, labels, series, o) {
  o = o || {};
  const H = o.h || 240, W = Math.max(300, el.clientWidth || 600), pad = {l: 40, r: 10, t: 10, b: 26};
  const max = Math.max(1, ...series.flatMap(s => s.vals)), nice = niceMax(max), n = labels.length;
  const x = i => pad.l + (n <= 1 ? 0 : i * (W - pad.l - pad.r) / (n - 1)), y = v => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = nice * k / 4, yy = y(v); g += '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line-2)"/><text x="' + (pad.l - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="var(--ink-3)">' + LV.fmt(v) + '</text>'; }
  const every = Math.max(1, Math.ceil(n / 7));
  labels.forEach((t, i) => { if (i % every === 0 || i === n - 1) g += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="var(--ink-3)">' + new Date(t).toLocaleDateString('en-CA', {month: 'short', day: 'numeric'}) + '</text>'; });
  let paths = '';
  const gid = 'g' + Math.random().toString(36).slice(2, 8), c0 = (series[0] && series[0].color) || SER[0];
  series.forEach((s, si) => {
    const c = s.color || SER[si], pts = s.vals.map((v, i) => [x(i), y(v)]);
    const d = smooth(pts);
    if (si === 0 && !o.noArea) paths += '<path class="ar" d="' + d + ' L' + x(n - 1) + ',' + y(0) + ' L' + x(0) + ',' + y(0) + 'Z" fill="url(#' + gid + ')"/>';
    paths += '<path class="ln' + (s.dash ? ' dash' : '') + '" pathLength="1" style="animation-delay:' + (si * .15) + 's" d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + (si === 0 ? 2.4 : 1.8) + '"' + (s.dash ? ' stroke-dasharray="4 4"' : '') + ' stroke-linecap="round"/>';
    if (n <= 45 && si === 0) { const mi = s.vals.indexOf(Math.max(...s.vals)); if (s.vals[mi] > 0) paths += '<circle class="pk" cx="' + x(mi) + '" cy="' + y(s.vals[mi]) + '" r="4" fill="#fff" stroke="' + c + '" stroke-width="2.2"/>'; }
  });
  el.innerHTML = '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-label="' + esc(o.label || 'Chart') + '"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c0 + '" stop-opacity=".26"/><stop offset="1" stop-color="' + c0 + '" stop-opacity="0"/></linearGradient></defs>' + g + paths + '<line class="cur" y1="' + pad.t + '" y2="' + (H - pad.b) + '" stroke="var(--ink-3)" stroke-dasharray="3 3" opacity="0"/></svg><div class="tip"></div></div>' +
    (series.length > 1 ? '<div class="legend">' + series.map((s, i) => '<span><i style="background:' + (s.color || SER[i]) + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '');
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cur = el.querySelector('.cur');
  svg.addEventListener('mousemove', e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - pad.l) / ((W - pad.l - pad.r) / Math.max(1, n - 1)))));
    cur.setAttribute('x1', x(i)); cur.setAttribute('x2', x(i)); cur.setAttribute('opacity', 1);
    tip.innerHTML = '<b>' + new Date(labels[i]).toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'}) + '</b><br>' + series.map((s, si) => '<span style="color:' + (si ? '#D9B868' : '#9FE0C3') + '">●</span> ' + esc(s.name) + ': ' + LV.fmt(s.vals[i])).join('<br>');
    tip.style.left = (x(i) * r.width / W) + 'px'; tip.style.top = (y(Math.max(...series.map(s => s.vals[i]))) * r.height / H) + 'px'; tip.classList.add('on');
  });
  svg.addEventListener('mouseleave', () => { tip.classList.remove('on'); cur.setAttribute('opacity', 0); });
};
function niceMax(m) { const p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function smooth(p) {
  if (p.length < 3) return 'M' + p.map(q => q.join(',')).join(' L');
  let d = 'M' + p[0][0] + ',' + p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, t = .18;
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), cl = v => Math.max(lo, Math.min(hi, v));
    d += ' C' + (p1[0] + (p2[0] - p0[0]) * t) + ',' + cl(p1[1] + (p2[1] - p0[1]) * t) + ' ' + (p2[0] - (p3[0] - p1[0]) * t) + ',' + cl(p2[1] - (p3[1] - p1[1]) * t) + ' ' + p2[0] + ',' + p2[1];
  }
  return d;
}
/* items: [{k, v, color}] */
LV.donut = function (items, o) {
  o = o || {};
  const tot = items.reduce((s, x) => s + x.v, 0);
  if (!tot) return '<div class="empty"><b>Nothing yet</b>No data for this period.</div>';
  let a = -Math.PI / 2, segs = '';
  items.forEach((it, i) => {
    const f = it.v / tot, a2 = a + f * Math.PI * 2, large = f > .5 ? 1 : 0, R = 60, r = 40;
    const p = (ang, rad) => (75 + rad * Math.cos(ang)).toFixed(2) + ',' + (75 + rad * Math.sin(ang)).toFixed(2);
    if (f >= .9999) segs += '<circle cx="75" cy="75" r="50" fill="none" stroke="' + (it.color || SER[i % 8]) + '" stroke-width="20"/>';
    else segs += '<path class="dn" style="animation-delay:' + (i * .07) + 's" d="M' + p(a, R) + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + p(a2, R) + ' L' + p(a2, r) + ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + p(a, r) + 'Z" fill="' + (it.color || SER[i % 8]) + '"><title>' + esc(it.k) + ': ' + LV.fmt(it.v) + '</title></path>';
    a = a2;
  });
  return '<div class="donut-wrap"><svg viewBox="0 0 150 150" role="img" aria-label="' + esc(o.label || 'Breakdown') + '">' + segs + '<text x="75" y="73" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="600" font-size="22" fill="var(--ink)" data-n="' + tot + '">' + LV.fmt(tot) + '</text><text x="75" y="91" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">' + esc(o.unit || 'total') + '</text></svg>' +
    '<div class="legend">' + items.map((it, i) => '<div><span><i style="background:' + (it.color || SER[i % 8]) + '"></i>' + esc(it.k) + '</span><b class="num">' + LV.fmt(it.v) + ' <small style="color:var(--ink-3);font-weight:500">' + Math.round(it.v / tot * 100) + '%</small></b></div>').join('') + '</div></div>';
};
/* items: [{k, v, sub}] */
LV.bars = function (items, o) {
  o = o || {};
  if (!items.length) return '<div class="empty"><b>Nothing yet</b>' + esc(o.empty || 'No data for this period.') + '</div>';
  const max = Math.max(1, ...items.map(x => x.v));
  return '<div>' + items.map(it => '<div class="bar-row"' + (o.tint ? ' style="--t:' + o.tint + '"' : '') + '><div><div class="lbl"><span title="' + esc(it.k) + '">' + esc(it.k) + '</span>' + (it.sub ? '<small style="color:var(--ink-3)">' + esc(it.sub) + '</small>' : '') + '</div><div class="track"><div class="fill" style="width:' + (it.v / max * 100).toFixed(1) + '%"></div></div></div><div class="v">' + (o.money ? LV.money(it.v) : LV.fmt(it.v)) + '</div></div>').join('') + '</div>';
};
LV.delta = (now, prev, invert) => {
  if (!prev && !now) return '<span class="delta">no change</span>';
  if (!prev) return '<span class="delta up">new this period</span>';
  const d = Math.round((now - prev) / prev * 100), up = d >= 0;
  return '<span class="delta ' + (d === 0 ? '' : ((up ? !invert : invert) ? 'up' : 'down')) + '">' + (up ? '▲ ' : '▼ ') + Math.abs(d) + '% vs before</span>';
};
/* Loading placeholder rows. The dashboard swaps in its richer set; the console uses this one. */
LV.skel = () => [1, 2, 3, 4].map(() => '<div class="row"><div class="sk" style="width:34px;height:34px;border-radius:50%"></div><div style="flex:1"><div class="sk" style="width:60%;height:12px"></div><div class="sk" style="width:40%;height:10px;margin-top:6px"></div></div></div>').join('');
})();

/* wide wordmark logos get a wider slot instead of being squeezed into a square */
LV.fitLogo = t => { if (t && t.naturalWidth && t.naturalWidth > t.naturalHeight * 1.6) t.classList.add('wide'); };
document.addEventListener('load', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-logo')) LV.fitLogo(t); }, true);
(function () { const scan = root => { (root.querySelectorAll ? root.querySelectorAll('img[data-logo]') : []).forEach(i => { if (i.complete) LV.fitLogo(i); }); };
  const go = () => { scan(document); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('img[data-logo]') && n.complete) LV.fitLogo(n); scan(n); } }))).observe(document.body, {childList: true, subtree: true}); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); })();
