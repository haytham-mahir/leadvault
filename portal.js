/* ==========================================================================
   LEADVAULT CLIENT DASHBOARD: shell, sign-in, tabs, widget grid, layout
   editing, notifications (bell = forms, phone = calls), team, account.
   Widgets live in widgets.js, the sales desk / clients / assistant in desk.js.
   ========================================================================== */
(function () {
'use strict';
const {esc, ic, api, fmt, when} = LV;
const app = document.getElementById('app');
const SKEY = 'lv_portal_session';
const PERIODS = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['180', '6 months'], ['365', '12 months'], ['all', 'All time'], ['month', 'This month'], ['lastmonth', 'Last month']];
const S = LV.S = {session: LV.ss.get(SKEY) || '', me: null, domain: '', period: LV.ls.get('lv_period', '30'), dash: 0, data: null, loading: false, editing: false, layout: null, marks: {}, crm: null};

/* ---------------- boot ---------------- */
LV.onAuthLost = msg => signOut(msg || 'Please sign in again.', true);
start();

async function start() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('as')) { S.session = qs.get('as'); LV.ss.set(SKEY, S.session); history.replaceState(null, '', location.pathname); }
  if (!S.session) return showGate();
  LV.boot.show('Opening your vault…');
  const ok = await loadMe();
  if (!ok) return;
  LV.boot.msg('Gathering your leads…');
  await loadData(false, true);
  LV.boot.open();
}

function showGate(note) {
  LV.stopIdle();
  document.title = 'Sign in · Leadvault';
  const g = LV.gate(app, {kind: 'client', note, title: 'Sign in to your dashboard', sub: 'Use the email and password your account manager sent you.',
    onSubmit: async (email, password) => {
      const r = await api('portalLogin', {email, password});
      if (r.error) return r;
      g.unlock();
      S.session = r.session; LV.ss.set(SKEY, S.session);
      await new Promise(res => setTimeout(res, 650));
      LV.boot.show('Unlocking your dashboard…');
      if (await loadMe()) { LV.boot.msg('Gathering your leads…'); await loadData(false, true); LV.boot.open(); }
      return {ok: true};
    }});
}

async function loadMe() {
  const r = await api('portalMe', {session: S.session});
  if (r.error) { if (!r.auth) { LV.boot.open(); showGate(r.error); } return false; }
  S.me = r;
  const doms = r.clients.map(c => c.domain);
  const pref = LV.ls.get('lv_domain_' + r.user.email, '');
  S.domain = doms.indexOf(pref) > -1 ? pref : doms[0];
  S.layout = normalizeLayout(r.layouts[S.domain]);
  S.dash = 0;
  LV.startIdle({seconds: r.idle || LV.IDLE, onTimeout: () => signOut('You were signed out after 5 minutes without activity.'), ping: () => api('portalPing', {session: S.session})});
  renderApp();
  bellCheck(true);
  clearInterval(S.poll); S.poll = setInterval(() => { if (document.visibilityState === 'visible') { bellCheck(false); } }, 60000);
  clearInterval(S.refresh); S.refresh = setInterval(() => { if (document.visibilityState === 'visible' && !S.editing) loadData(true); }, 180000);
  return true;
}

async function signOut(msg, lost) {
  clearInterval(S.poll); clearInterval(S.refresh); LV.stopIdle();
  if (!lost && S.session) api('portalLogout', {session: S.session, domain: S.domain});
  LV.ss.del(SKEY); S.session = ''; S.me = null; S.data = null;
  document.querySelectorAll('.back,.bot,.bot-fab,.toast').forEach(x => x.remove());
  showGate(msg);
}
LV.signOut = signOut;

/* ---------------- data ---------------- */
const client = () => (S.me && S.me.clients.find(c => c.domain === S.domain)) || {};
LV.client = client;
async function loadData(quiet, fresh) {
  const key = S.domain + ':' + S.period, mine = Symbol();
  S.req = mine;
  if (!quiet) { S.loading = true; S.data = null; if (S.me) renderApp(); }
  const r = await api('portalData', {session: S.session, domain: S.domain, period: S.period, fresh: !!(quiet && fresh)});
  if (S.req !== mine || key !== S.domain + ':' + S.period) return;
  S.loading = false;
  if (r.error) { if (!r.auth) { S.data = {error: r.error, forms: [], calls: [], range: null}; renderApp(); } return; }
  S.data = r;
  api('portalMarks', {session: S.session, domain: S.domain}).then(m => { if (m.marks) { S.marks = m.marks; if (!S.editing) drawGrid(); } });
  if (S.me) renderApp(true);
}
LV.reload = () => loadData(true, true);

/* ---------------- layout ---------------- */
const W = () => LV.W || {};
const okFor = t => { const w = W()[t]; if (!w) return false; const c = client(); if (w.ok && !w.ok(c, S)) return false; return true; };
const visIt = it => it.t === 'note' ? (!it.about || okFor(it.about)) : okFor(it.t);
const visDash = d => d.items.some(it => it.t !== 'note' && visIt(it));
const canEdit = () => !!(S.me && (S.me.user.preview || S.me.user.write >= 0));
LV.item = (t, c, x) => Object.assign({id: LV.uid(), t, c: c || (W()[t] && W()[t].c) || 12}, x || {});
function normalizeLayout(L) {
  const fresh = LV.defaultLayout ? LV.defaultLayout(client(), S) : {v: 1, dashes: [{id: 'd1', name: 'Overview', items: []}]};
  if (!L || !Array.isArray(L.dashes) || !L.dashes.length) return fresh;
  /* tabs that appear by themselves once (Website, Google Search, AI, Sales desk, Clients) */
  L.auto = L.auto || {};
  fresh.dashes.forEach(d => { if (d.auto && !L.auto[d.auto]) { L.auto[d.auto] = 1; if (!L.dashes.some(x => x.auto === d.auto)) L.dashes.push(d); } });
  return L;
}
const dashList = () => { const v = S.editing ? S.layout.dashes : S.layout.dashes.filter(visDash); return v.length ? v : S.layout.dashes.slice(0, 1); };
const curDash = () => { const v = dashList(); return v[Math.min(S.dash, v.length - 1)]; };
let saveT = null, undoStack = [];
function saveLayout(label) {
  if (label) { undoStack.push({label, snap: S.lastSnap}); if (undoStack.length > 20) undoStack.shift(); }
  S.lastSnap = JSON.stringify(S.layout);
  clearTimeout(saveT);
  saveT = setTimeout(() => api('portalSaveLayout', {session: S.session, domain: S.domain, layout: S.layout}).then(j => { if (j.error) LV.toast(j.error); }), 900);
  if (label) LV.toast(label, {label: 'Undo', fn: undo});
}
function undo() { const u = undoStack.pop(); if (!u || !u.snap) return; S.layout = JSON.parse(u.snap); S.lastSnap = u.snap; saveLayout(); renderApp(); }

/* ---------------- header ---------------- */
function header() {
  const me = S.me, c = client();
  const logo = c.logo || ('https://www.google.com/s2/favicons?domain=' + encodeURIComponent(c.domain || '') + '&sz=64');
  return (me.user.preview ? '<div class="preview-bar">' + ic('eye', 14) + ' You’re viewing ' + esc(c.name) + '’s dashboard as the Leadvault team. Changes to the layout become this business’s default.</div>' : '') +
    '<header class="top"><div class="top-in">' +
    '<a class="brandmark" href="./" aria-label="Leadvault home">' + LV.mark(30) + '<span class="hide-sm">Leadvault</span></a><div class="vsep hide-sm"></div>' +
    '<div class="biz"><img alt="" src="' + esc(logo) + '" onerror="this.style.visibility=\'hidden\'">' +
      (me.clients.length > 1 ? '<button type="button" class="biz-btn" data-biz aria-haspopup="listbox"><span>' + esc(c.name) + '</span>' + ic('chev', 16) + '</button>' : '<b class="biz-btn" style="cursor:default"><span>' + esc(c.name) + '</span></b>') + '</div>' +
    '<div class="grow"></div>' +
    '<div class="seg hide-sm" data-period role="group" aria-label="Period">' + PERIODS.map(p => '<button type="button" data-p="' + p[0] + '"' + (p[0] === S.period ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + p[1] + '</button>').join('') + '</div>' +
    '<div class="anchor"><button class="iconbtn" type="button" data-team title="Your team" aria-label="Your team">' + ic('users') + '</button></div>' +
    '<div class="anchor"><button class="iconbtn" type="button" data-bell title="Form leads" aria-label="Form leads">' + ic('bell') + '<span class="spin"></span><span class="badge" data-bellc hidden></span></button></div>' +
    '<div class="anchor"><button class="iconbtn" type="button" data-phone title="Calls" aria-label="Calls">' + ic('phone') + '<span class="spin"></span><span class="badge" data-phonec hidden></span></button></div>' +
    '<div class="anchor"><button class="avatar" type="button" data-me aria-label="Account">' + esc(LV.initials(me.user.name || me.user.email)) + '</button></div>' +
    '</div></header>';
}

/* ---------------- render ---------------- */
function renderApp(keepScroll) {
  if (!S.me) return;
  const y = window.scrollY;
  const c = client(), dash = curDash(), VD = dashList();
  document.title = (c.name || 'Dashboard') + ' · Leadvault';
  const range = S.data && S.data.range;
  app.innerHTML = header() + '<main class="wrap' + (S.editing ? ' editing' : '') + '">' +
    '<div class="seg light" data-period style="display:none;margin:0 0 14px" id="mperiod">' + PERIODS.map(p => '<button type="button" data-p="' + p[0] + '"' + (p[0] === S.period ? ' class="on"' : '') + '>' + p[1] + '</button>').join('') + '</div>' +
    '<nav class="tabs" role="tablist">' + VD.map((d, i) => '<button class="tab' + (d === dash ? ' on' : '') + '" type="button" role="tab" aria-selected="' + (d === dash) + '" data-dash="' + i + '">' + esc(d.name) + (S.editing ? '<span class="x" data-deldash="' + i + '" title="Delete tab">' + ic('x', 13) + '</span>' : '') + '</button>').join('') +
      (S.editing ? '<button class="tab" type="button" data-adddash>' + ic('plus', 14) + ' Tab</button>' : '') +
      '<div class="tools">' + (S.editing
        ? '<button class="btn sm" type="button" data-addw>' + ic('plus', 15) + ' Add widget</button><button class="btn sm" type="button" data-rename>Rename tab</button><button class="btn sm" type="button" data-reset>Reset</button>' + ((S.me.user.owner && !S.me.user.preview) ? '<button class="btn sm" type="button" data-default>Save as default for team</button>' : '') + '<button class="btn sm go" type="button" data-done>Done</button>'
        : (canEdit() ? '<button class="btn sm ghost" type="button" data-edit>' + ic('grid', 15) + ' Arrange</button>' : '') + '<button class="btn sm ghost" type="button" data-refresh title="Refresh now">' + ic('refresh', 15) + '</button>') + '</div></nav>' +
    (S.data && S.data.errors && S.data.errors.length ? '<div class="errbar">' + ic('flag', 18) + '<span>Some data couldn’t load: ' + esc(S.data.errors.slice(0, 2).join(' · ')) + '. The rest is up to date.</span></div>' : '') +
    (S.data && S.data.error ? '<div class="errbar">' + ic('flag', 18) + '<span>' + esc(S.data.error) + '</span></div>' : '') +
    '<div class="grid" id="grid"></div>' +
    (range ? '<p style="color:var(--ink-3);font-size:12.5px;margin:22px 2px 0">' + LV.date(range.from) + ' – ' + LV.date(range.to) + ' · updated ' + when(S.data.at) + (S.data.cached ? '' : '') + '</p>' : '') +
    '</main>';
  if (window.innerWidth <= 760) document.getElementById('mperiod').style.display = 'inline-flex';
  wireTop();
  drawGrid();
  if (LV.botMount) LV.botMount(c);
  if (keepScroll) window.scrollTo(0, y);
}
LV.render = renderApp;

function drawGrid() {
  const grid = document.getElementById('grid'); if (!grid) return;
  const dash = curDash(); if (!dash) return;
  const items = S.editing ? dash.items : dash.items.filter(visIt);
  if (!items.length) { grid.innerHTML = '<div class="w" style="--c:12"><div class="empty"><b>This tab is empty</b>' + (canEdit() ? 'Choose Arrange, then Add widget.' : 'Nothing to show yet.') + '</div></div>'; return; }
  grid.innerHTML = items.map(it => {
    const w = W()[it.t] || {t: it.t, ic: 'spark'};
    if (it.t === 'note') return '<section class="w note" style="--c:' + (it.c || 12) + '" data-id="' + it.id + '"' + (S.editing ? ' draggable="true"' : '') + '>' + editBtns(it) + '<h2>' + esc(it.title || 'Heading') + '</h2>' + (it.text ? '<p>' + esc(it.text) + '</p>' : '') + '</section>';
    return '<section class="w' + (it.h ? ' fixed' : '') + '" style="--c:' + (it.c || w.c || 12) + (it.h ? ';--h:' + it.h + 'px' : '') + '" data-id="' + it.id + '"' + (S.editing ? ' draggable="true"' : '') + '>' + editBtns(it) +
      '<div class="wh"><div class="wic" style="--t:' + (w.tint || 'var(--vault)') + '">' + ic(w.ic, 18) + '</div><div style="min-width:0"><h3>' + esc(it.title || w.t) + '</h3><small>' + esc(w.d || '') + '</small></div><div class="acts" data-acts></div></div>' +
      '<div class="wb" data-body>' + (S.data && !S.loading ? '' : skel(w.sk)) + '</div></section>';
  }).join('');
  if (S.data && !S.loading) items.forEach(it => {
    if (it.t === 'note') return;
    const w = W()[it.t], el = grid.querySelector('[data-id="' + it.id + '"]'); if (!w || !el) return;
    try { w.draw(el.querySelector('[data-body]'), {d: S.data, it, S, acts: el.querySelector('[data-acts]'), client: client()}); }
    catch (e) { console.error(it.t, e); el.querySelector('[data-body]').innerHTML = '<div class="empty"><b>This widget couldn’t draw</b>' + esc(e.message) + '</div>'; }
  });
  if (S.editing) wireEdit(grid, dash);
}
LV.drawGrid = drawGrid;

function editBtns(it) {
  return '<div class="wedit"><button class="btn sm" type="button" data-size="' + it.id + '" title="Width">' + ic('move', 14) + ' ' + (it.c || 12) + '/12</button>' + (it.t === 'note' ? '<button class="btn sm" type="button" data-note="' + it.id + '">' + ic('edit', 14) + '</button>' : '') + '<button class="btn sm danger" type="button" data-rm="' + it.id + '" aria-label="Remove widget">' + ic('trash', 14) + '</button></div>';
}

const SK = {
  kpis: () => '<div class="kpis">' + [1, 2, 3, 4].map(() => '<div class="kpi"><div class="sk" style="width:90px;height:12px"></div><div class="sk" style="width:70px;height:28px;margin:10px 0 8px"></div><div class="sk" style="width:110px;height:10px"></div></div>').join('') + '</div>',
  chart: () => '<div class="sk" style="height:220px;border-radius:12px"></div>',
  list: () => [1, 2, 3, 4, 5].map(() => '<div class="row"><div class="sk" style="width:34px;height:34px;border-radius:50%"></div><div style="flex:1"><div class="sk" style="width:60%;height:12px"></div><div class="sk" style="width:40%;height:10px;margin-top:6px"></div></div></div>').join(''),
  table: () => [1, 2, 3, 4, 5, 6].map(() => '<div class="sk" style="height:34px;margin:0 0 8px"></div>').join(''),
  inbox: () => '<div class="sk" style="height:38px;margin-bottom:12px"></div>' + [1, 2, 3, 4].map(() => '<div class="row"><div class="sk" style="width:34px;height:34px;border-radius:50%"></div><div style="flex:1"><div class="sk" style="width:50%;height:12px"></div><div class="sk" style="width:70%;height:10px;margin-top:6px"></div></div></div>').join('')
};
const skel = k => (SK[k] || SK.list)();
LV.skel = skel;

/* ---------------- top bar wiring ---------------- */
function wireTop() {
  app.querySelectorAll('[data-period] button').forEach(b => b.addEventListener('click', () => { if (S.period === b.dataset.p) return; S.period = b.dataset.p; LV.ls.set('lv_period', S.period); loadData(); }));
  app.querySelectorAll('[data-dash]').forEach(b => b.addEventListener('click', e => {
    if (e.target.closest('[data-deldash]')) return;
    S.dash = Number(b.dataset.dash); renderApp();
  }));
  app.querySelectorAll('[data-deldash]').forEach(x => x.addEventListener('click', async e => {
    e.stopPropagation(); const d = dashList()[Number(x.dataset.deldash)];
    if (S.layout.dashes.length < 2) return LV.toast('Keep at least one tab.');
    S.layout.dashes = S.layout.dashes.filter(z => z !== d); S.dash = 0; saveLayout('Deleted “' + d.name + '”'); renderApp();
  }));
  const on = (sel, fn) => { const el = app.querySelector(sel); if (el) el.addEventListener('click', fn); };
  on('[data-adddash]', () => { const name = prompt('Name the new tab', 'My view'); if (!name) return; S.layout.dashes.push({id: LV.uid(), name: name.slice(0, 40), items: []}); S.dash = dashList().length - 1; saveLayout('Added “' + name + '”'); renderApp(); });
  on('[data-rename]', () => { const d = curDash(); const name = prompt('Rename this tab', d.name); if (!name) return; d.name = name.slice(0, 40); saveLayout('Renamed tab'); renderApp(); });
  on('[data-edit]', () => { S.editing = true; S.lastSnap = JSON.stringify(S.layout); renderApp(); });
  on('[data-done]', () => { S.editing = false; renderApp(); });
  on('[data-refresh]', () => { LV.toast('Refreshing…'); loadData(true, true); bellCheck(true); });
  on('[data-addw]', () => catalog(curDash()));
  on('[data-reset]', async () => { if (!await LV.confirm('Reset this dashboard?', 'Every tab goes back to the standard layout. Your data isn’t affected.', 'Reset')) return; S.layout = normalizeLayout(null); S.dash = 0; saveLayout('Layout reset'); renderApp(); });
  on('[data-default]', async () => { const r = await api('portalSaveDefaultLayout', {session: S.session, domain: S.domain, layout: S.layout}); LV.toast(r.error || 'Saved. New team members start with this layout.'); });
  on('[data-bell]', e => feedPop('forms', e.currentTarget));
  on('[data-phone]', e => feedPop('calls', e.currentTarget));
  on('[data-team]', e => teamPop(e.currentTarget));
  on('[data-me]', e => meMenu(e.currentTarget));
  on('[data-biz]', e => bizMenu(e.currentTarget));
  paintBadges();
}

function closePops() { document.querySelectorAll('.pop').forEach(p => p.remove()); }
document.addEventListener('click', e => { if (!e.target.closest('.pop') && !e.target.closest('.anchor') && !e.target.closest('.biz')) closePops(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePops(); });
function pop(anchor, html, cls) {
  closePops();
  const p = document.createElement('div'); p.className = 'pop ' + (cls || ''); p.innerHTML = html;
  anchor.parentNode.appendChild(p);
  return p;
}

function meMenu(btn) {
  const u = S.me.user;
  const p = pop(btn, '<div class="pop-h"><div><b>' + esc(u.name || u.email) + '</b><div style="color:var(--ink-3);font-size:12.5px">' + esc(u.email) + '</div></div></div><div class="menu" style="width:auto">' +
    (u.preview ? '' : '<button type="button" data-pw>' + ic('key', 16) + ' Change password</button>') +
    '<button type="button" data-out>' + ic('out', 16) + ' Sign out</button></div>', 'menu');
  p.style.width = '260px';
  const pw = p.querySelector('[data-pw]'); if (pw) pw.addEventListener('click', () => { closePops(); changePassword(); });
  p.querySelector('[data-out]').addEventListener('click', () => signOut('You’re signed out.'));
}
function changePassword() {
  LV.modal('<h2>Change password</h2><p style="color:var(--ink-2);margin:4px 0 18px">You’ll sign in again with the new password.</p><form><label class="field"><span>Current password</span><input class="input" type="password" name="cur" autocomplete="current-password" required></label><label class="field"><span>New password</span><input class="input" type="password" name="pw" autocomplete="new-password" minlength="10" required><div class="hint">At least 10 characters.</div></label><div class="gate-err" role="alert"><span></span></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go" type="submit">Change password</button></div></form>', (m, close) => {
    const f = m.querySelector('form');
    f.addEventListener('submit', async e => {
      e.preventDefault(); const b = f.querySelector('[type=submit]'); b.classList.add('busy');
      const r = await api('portalPassword', {session: S.session, current: f.cur.value, password: f.pw.value});
      b.classList.remove('busy');
      if (r.error) { const er = f.querySelector('.gate-err'); er.querySelector('span').textContent = r.error; er.classList.add('on'); return; }
      close(); signOut('Password changed. Sign in with your new password.', true);
    });
  });
}
function bizMenu(btn) {
  const p = pop(btn, '<div class="pop-h"><b>Your businesses</b></div><div class="menu" style="width:auto">' + S.me.clients.map(c => '<button type="button" data-d="' + esc(c.domain) + '"' + (c.domain === S.domain ? ' class="on"' : '') + '><img alt="" width="20" height="20" style="border-radius:5px" src="' + esc(c.logo || 'https://www.google.com/s2/favicons?domain=' + c.domain + '&sz=64') + '"> ' + esc(c.name) + '</button>').join('') + '</div>', 'menu');
  p.style.left = '0'; p.style.right = 'auto'; p.style.width = '300px';
  p.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
    closePops(); S.domain = b.dataset.d; LV.ls.set('lv_domain_' + S.me.user.email, S.domain);
    S.layout = normalizeLayout(S.me.layouts[S.domain]); S.dash = 0; S.marks = {}; S.crm = null; feed.forms = feed.calls = null; loadData(); bellCheck(true);
  }));
}

/* ---------------- widget catalog + edit mode ---------------- */
function catalog(dash) {
  const groups = [...new Set(Object.values(W()).map(w => w.g))];
  const has = new Set(dash.items.map(i => i.t));
  LV.modal('<div style="display:flex;justify-content:space-between;gap:12px"><div><h2>Add widgets</h2><div style="color:var(--ink-2);font-size:13.5px">Pick what to show on “' + esc(dash.name) + '”.</div></div><button class="iconbtn light" type="button" data-close aria-label="Close">' + ic('x') + '</button></div><div class="cat">' +
    groups.map(g => { const ks = Object.keys(W()).filter(k => W()[k].g === g && okFor(k)); if (!ks.length) return ''; return '<div class="grp">' + esc(g) + '</div>' + ks.map(k => '<div class="it"><div class="wic" style="--t:' + W()[k].tint + '">' + ic(W()[k].ic, 18) + '</div><div><b>' + esc(W()[k].t) + '</b><small>' + esc(W()[k].d) + '</small></div><button class="btn sm' + (has.has(k) ? '' : ' go') + '" type="button" data-add="' + k + '">' + (has.has(k) ? 'Add again' : 'Add') + '</button></div>').join(''); }).join('') + '</div>', (m, close) => {
    m.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { dash.items.push(LV.item(b.dataset.add)); saveLayout(); b.textContent = 'Added'; b.classList.remove('go'); b.disabled = true; }));
    m.closest('.back').addEventListener('click', e => { if (e.target.classList.contains('back') || e.target.closest('[data-close]')) setTimeout(renderApp, 0); });
  });
}
function wireEdit(grid, dash) {
  const find = id => dash.items.find(i => i.id === id);
  grid.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { const it = find(b.dataset.rm); dash.items = dash.items.filter(i => i !== it); saveLayout('Removed “' + (it.title || (W()[it.t] || {}).t || 'widget') + '”'); drawGrid(); }));
  grid.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { const it = find(b.dataset.size), S4 = [4, 6, 8, 12]; it.c = S4[(S4.indexOf(it.c || 12) + 1) % S4.length]; saveLayout(); drawGrid(); }));
  grid.querySelectorAll('[data-note]').forEach(b => b.addEventListener('click', () => {
    const it = find(b.dataset.note);
    LV.modal('<h2>Heading and summary</h2><form style="margin-top:14px"><label class="field"><span>Heading</span><input class="input" name="t" value="' + esc(it.title || '') + '"></label><label class="field"><span>Summary</span><textarea class="input" name="x">' + esc(it.text || '') + '</textarea></label><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Save</button></div></form>', (m, close) => {
      m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); it.title = e.target.t.value.slice(0, 80); it.text = e.target.x.value.slice(0, 600); saveLayout(); close(); drawGrid(); });
    });
  }));
  let dragId = null;
  grid.querySelectorAll('.w[draggable]').forEach(el => {
    el.addEventListener('dragstart', e => { dragId = el.dataset.id; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', () => { el.classList.remove('drag'); grid.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', e => {
      e.preventDefault(); const from = dash.items.findIndex(i => i.id === dragId), to = dash.items.findIndex(i => i.id === el.dataset.id);
      if (from < 0 || to < 0 || from === to) return;
      const [m] = dash.items.splice(from, 1); dash.items.splice(to, 0, m); saveLayout('Moved widget'); drawGrid();
    });
  });
}

/* ---------------- notifications: bell (forms) + phone (calls) ----------------
   Until the first answer arrives both icons show a spinner and the panels show a
   loading state — never “no notifications” before we actually know. */
const feed = {forms: null, calls: null, seen: null, loading: false};
const readKey = k => 'lv_read_' + k + '_' + S.domain;
const fid = x => String(x.id || (x.at + '|' + (x.email || x.phone || '')));
async function bellCheck(first) {
  if (!S.session) return;
  if (first) { feed.forms = feed.calls = null; }
  feed.loading = true; paintBadges();
  const dom = S.domain, r = await api('portalFeed', {session: S.session, domain: dom, fresh: !first});
  if (dom !== S.domain) return;
  feed.loading = false;
  if (!r.error) { feed.forms = r.forms || []; feed.calls = r.calls || []; feed.seen = r.seen || {forms: 0, calls: 0}; }
  else if (feed.forms == null) { feed.forms = []; feed.calls = []; feed.err = r.error; }
  paintBadges();
  const open = document.querySelector('.pop[data-feed]'); if (open) fillFeed(open, open.dataset.feed);
}
function unread(k) {
  const list = feed[k] || [], seen = (feed.seen || {})[k] || 0, rd = new Set(LV.ls.get(readKey(k), []));
  return list.filter(x => x.at > seen && !rd.has(fid(x)) && !(k === 'calls' && x.dir === 'outbound')).length;
}
function paintBadges() {
  [['forms', '[data-bell]', '[data-bellc]'], ['calls', '[data-phone]', '[data-phonec]']].forEach(([k, b, c]) => {
    const btn = app.querySelector(b), badge = app.querySelector(c); if (!btn) return;
    btn.classList.toggle('loading', feed[k] == null);
    const n = feed[k] == null ? 0 : unread(k);
    badge.hidden = !n; badge.textContent = n > 9 ? '9+' : n;
  });
}
function feedPop(k, btn) {
  if (document.querySelector('.pop[data-feed="' + k + '"]')) return closePops();
  const p = pop(btn, '', ''); p.dataset.feed = k; fillFeed(p, k);
}
function fillFeed(p, k) {
  const title = k === 'forms' ? 'Form leads' : 'Calls', list = feed[k];
  if (list == null) {
    p.innerHTML = '<div class="pop-h"><b>' + title + '</b></div><div class="pop-load" role="status" aria-label="Loading">' + [1, 2, 3].map(() => '<div style="display:flex;gap:10px"><div class="sk" style="width:34px;height:34px;border-radius:50%"></div><div style="flex:1"><div class="sk" style="width:60%;height:12px"></div><div class="sk" style="width:85%;height:10px;margin-top:7px"></div></div></div>').join('') + '<div style="color:var(--ink-3);font-size:12.5px;text-align:center">Checking for new ' + (k === 'forms' ? 'leads' : 'calls') + '…</div></div>';
    return;
  }
  const seen = (feed.seen || {})[k] || 0, rd = new Set(LV.ls.get(readKey(k), []));
  p.innerHTML = '<div class="pop-h"><b>' + title + '</b><div style="display:flex;gap:6px;align-items:center">' + (feed.loading ? '<span class="pill">Updating…</span>' : '') + (list.length ? '<button class="btn sm ghost" type="button" data-all>Mark all read</button>' : '') + '</div></div>' +
    (feed.err && !list.length ? '<div class="empty"><b>Couldn’t check right now</b>' + esc(feed.err) + '</div>' : '') +
    (!list.length && !feed.err ? '<div class="empty"><b>Nothing in the last 14 days</b>New ' + (k === 'forms' ? 'form leads' : 'calls') + ' show up here as they come in.</div>' : '') +
    list.map((x, i) => {
      const isNew = x.at > seen && !rd.has(fid(x)) && !(k === 'calls' && x.dir === 'outbound');
      const nm = x.name || x.email || x.phone || (k === 'calls' ? 'Caller' : 'Website visitor');
      const sub = k === 'forms' ? (x.form + (x.page ? ' · ' + x.page : '')) : (x.status === 'tap' ? 'Tapped your phone number' + (x.page ? ' on ' + x.page : '') : (x.dir === 'outbound' ? 'Outgoing' : cap(x.status)) + (x.dur ? ' · ' + LV.dur(x.dur) : ''));
      return '<div class="row click" data-i="' + i + '" style="' + (isNew ? 'background:var(--brass-soft)' : '') + '">' + LV.av(nm) + '<div class="main"><b>' + esc(nm) + '</b><small>' + esc(sub) + '</small></div><div class="end"><small>' + esc(when(x.at)) + '</small>' + (isNew ? '<div><span class="pill brass" style="margin-top:3px">New</span></div>' : '') + '</div></div>';
    }).join('');
  const all = p.querySelector('[data-all]');
  if (all) all.addEventListener('click', () => { const at = Math.max(...list.map(x => x.at)); feed.seen[k] = at; LV.ls.set(readKey(k), []); api('portalSeen', {session: S.session, domain: S.domain, kind: k, at}); paintBadges(); fillFeed(p, k); });
  p.querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => {
    const x = list[Number(r.dataset.i)], s = new Set(LV.ls.get(readKey(k), [])); s.add(fid(x)); LV.ls.set(readKey(k), [...s].slice(-300)); paintBadges();
    closePops(); if (k === 'forms') LV.openLead(x); else LV.openCall(x);
  }));
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

/* ---------------- team ---------------- */
async function teamPop(btn) {
  const p = pop(btn, '<div class="pop-h"><b>Your team</b></div><div class="pop-load">' + LV.skel('list') + '</div>');
  const r = await api('portalTeam', {session: S.session, domain: S.domain});
  if (!p.isConnected) return;
  if (r.error) { p.innerHTML = '<div class="pop-h"><b>Your team</b></div><div class="empty">' + esc(r.error) + '</div>'; return; }
  p.innerHTML = '<div class="pop-h"><b>Your team</b><small style="color:var(--ink-3)">' + r.people.filter(x => x.here).length + ' here now</small></div>' +
    r.people.map(x => '<div class="row">' + LV.av(x.name || x.email) + '<div class="main"><b>' + esc(x.name || x.email) + (x.owner ? ' <span class="pill brass">Owner</span>' : '') + '</b><small>' + (x.here ? '<span style="color:var(--ok)">● Here now</span>' : 'Last seen ' + esc(when(x.last))) + '</small></div></div>').join('') +
    '<div class="sec" style="padding:0 16px">Recent activity</div>' +
    (r.activity.length ? r.activity.slice(0, 25).map(a => '<div class="row" style="padding:8px 16px"><div class="main"><small style="white-space:normal;color:var(--ink-2)"><b style="display:inline;color:var(--ink)">' + esc(a.n || a.e.split('@')[0]) + '</b> ' + esc(a.w) + '</small></div><div class="end"><small>' + esc(when(a.at)) + '</small></div></div>').join('') : '<div class="empty">No activity yet.</div>');
}
})();
