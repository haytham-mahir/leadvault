/* ==========================================================================
   LEADVAULT TEAM CONSOLE: businesses, connections, client logins, team.
   ========================================================================== */
(function () {
'use strict';
const {esc, ic, api, fmt, when} = LV;
const app = document.getElementById('app');
const SKEY = 'lv_console_session';
const C = {session: LV.ss.get(SKEY) || '', me: null, clients: [], stats: null, setup: null, q: '', f: 'all'};
const SITE = (window.LV_CONFIG && window.LV_CONFIG.site) || '../';

LV.onAuthLost = msg => signOut(msg || 'Please sign in again.', true);
start();

async function start() {
  if (!C.session) return gate();
  LV.boot.show('Opening the console…');
  const ok = await load(true);
  LV.boot.open();
  if (!ok) gate();
}
function gate(note) {
  LV.stopIdle();
  document.title = 'Console · Leadvault';
  const g = LV.gate(app, {kind: 'team', note, keyMode: true, title: 'Team console', sub: 'Sign in with your Leadvault team account.',
    headline: 'Run every client’s vault.', blurb: 'Connect businesses, hand out logins and keep an eye on every connection from one place.', foot: [['5 min', 'idle sign-out'], ['Owner', 'and member roles'], ['Live', 'connection checks']],
    onSubmit: async (email, password, x) => {
      const r = await api('teamLogin', x.key ? {key: x.key} : {email, password});
      if (r.error) return r;
      g.unlock(); C.session = r.session; LV.ss.set(SKEY, C.session); C.me = r.me;
      await new Promise(res => setTimeout(res, 650));
      if (r.setup) { firstOwner(); return {ok: true}; }
      LV.boot.show('Opening the console…'); await load(true); LV.boot.open();
      return {ok: true};
    }});
}
function firstOwner() {
  startIdle();
  app.innerHTML = '<div class="gate-form" style="min-height:100vh"><form class="gate-card"><div style="margin-bottom:18px">' + LV.mark(40) + '</div><h2>Create your owner account</h2><p class="sub">You signed in with the owner key. Create the account you’ll use from now on.</p>' +
    '<label class="field"><span>Your name</span><input class="input" name="name" required autocomplete="name"></label><label class="field"><span>Email</span><input class="input" type="email" name="email" required autocomplete="username"></label><label class="field"><span>Password</span><input class="input" type="password" name="password" minlength="10" required autocomplete="new-password"><div class="hint">At least 10 characters.</div></label><div class="gate-err" role="alert"><span></span></div><button class="btn go">Create account and continue</button></form></div>';
  const f = app.querySelector('form');
  f.addEventListener('submit', async e => {
    e.preventDefault(); const b = f.querySelector('.go'); b.classList.add('busy');
    const r = await api('teamSave', {session: C.session, name: f.name.value, email: f.email.value, password: f.password.value, role: 'owner'});
    if (r.error) { b.classList.remove('busy'); const er = f.querySelector('.gate-err'); er.querySelector('span').textContent = r.error; er.classList.add('on'); return; }
    const l = await api('teamLogin', {email: f.email.value, password: f.password.value});
    C.session = l.session; LV.ss.set(SKEY, C.session); C.me = l.me; await load(true);
  });
}
function startIdle() { LV.startIdle({onTimeout: () => signOut('You were signed out after 5 minutes without activity.'), ping: () => api('teamPing', {session: C.session})}); }
async function signOut(msg, lost) {
  LV.stopIdle(); if (!lost && C.session) api('teamLogout', {session: C.session});
  LV.ss.del(SKEY); C.session = ''; document.querySelectorAll('.back,.toast').forEach(x => x.remove()); gate(msg);
}
async function load(first) {
  const r = await api('lvClients', {session: C.session});
  if (r.error) { if (!r.auth) LV.toast(r.error); return false; }
  C.clients = r.clients; C.stats = r.stats; C.me = r.me || C.me; C.setup = r.setup;
  if (first) startIdle();
  render(); return true;
}

/* ---------------- render ---------------- */
function render() {
  const st = C.stats || {};
  document.title = 'Console · Leadvault';
  app.innerHTML = '<header class="top"><div class="top-in"><a class="brandmark" href="./">' + LV.mark(30) + 'Leadvault <span style="font:500 14px var(--f-ui);opacity:.65;margin-left:2px">Console</span></a><div class="grow"></div>' +
    '<button class="btn sm brass" type="button" data-new>' + ic('plus', 15) + ' New client</button>' +
    '<div class="anchor"><button class="avatar" type="button" data-me aria-label="Account">' + esc(LV.initials((C.me && (C.me.name || C.me.email)) || 'O')) + '</button></div></div></header>' +
    '<main class="wrap">' + setupBanner() +
    '<div class="kpis" style="margin-bottom:22px;background:#fff">' + [['Businesses', st.clients, 'var(--vault)'], ['Connected', st.connected, 'var(--ok)'], ['Client logins', st.logins, 'var(--s3)'], ['Active this week', st.active, 'var(--s2)'], ['Needs attention', st.needs, st.needs ? 'var(--bad)' : 'var(--s6)']].map(k => '<div class="kpi" style="--t:' + k[2] + '"><div class="lab"><i></i>' + k[0] + '</div><span class="big">' + fmt(k[1] || 0) + '</span></div>').join('') + '</div>' +
    '<div class="toolbar"><label class="search">' + ic('search', 16) + '<input class="input" type="search" placeholder="Search businesses, websites or logins" value="' + esc(C.q) + '" data-q aria-label="Search"></label><div class="chips">' + [['all', 'All'], ['ghl', 'CRM connected'], ['site', 'Website only'], ['needs', 'Needs attention']].map(x => '<button class="chip' + (C.f === x[0] ? ' on' : '') + '" type="button" data-f="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>' +
    '<div class="grid" data-cards></div></main>';
  app.querySelector('[data-new]').addEventListener('click', newClient);
  app.querySelector('[data-me]').addEventListener('click', e => meMenu(e.currentTarget));
  app.querySelector('[data-q]').addEventListener('input', LV.debounce(e => { C.q = e.target.value; cards(); }, 120));
  app.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { C.f = b.dataset.f; app.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); cards(); }));
  const sb = app.querySelector('[data-setup]'); if (sb) sb.addEventListener('click', setupHelp);
  cards();
}
function setupBanner() {
  const s = C.setup || {}, miss = [];
  if (!s.ai) miss.push('the Vault assistant (ANTHROPIC_API_KEY)');
  if (!s.serp) miss.push('AI Overview tracking (SERPAPI_KEY)');
  if (!s.site) miss.push('your dashboard address (SITE_URL)');
  return miss.length ? '<div class="gate-note" style="margin-bottom:18px;align-items:center">' + ic('key', 18) + '<span style="flex:1">Optional setup left: ' + esc(miss.join(', ')) + '.</span><button class="btn sm" type="button" data-setup>How to set these</button></div>' : '';
}
function needs(c) { return !c.logins.length || (c.source === 'ghl' && !(c.check && c.check.ok)) || (c.source === 'site' && !c.lastHit); }
function cards() {
  const box = app.querySelector('[data-cards]'), q = C.q.toLowerCase();
  const L = C.clients.filter(c => (C.f === 'all' || (C.f === 'needs' ? needs(c) : c.source === C.f)) && (!q || JSON.stringify([c.name, c.domain, c.logins.map(l => l.email + l.name)]).toLowerCase().indexOf(q) > -1));
  if (!C.clients.length) { box.innerHTML = '<section class="w" style="--c:12"><div class="empty" style="padding:50px 16px">' + LV.dial('still').replace('class="dial', 'style="--d:110px;margin:0 auto 18px" class="dial') + '<b style="font-size:17px">Add your first business</b>Connect a GoHighLevel location, or add a website with the Leadvault snippet.<div style="margin-top:16px"><button class="btn go" type="button" data-first>' + ic('plus', 15) + ' New client</button></div></div></section>'; box.querySelector('[data-first]').addEventListener('click', newClient); return; }
  box.innerHTML = L.length ? L.map(card).join('') : '<section class="w" style="--c:12"><div class="empty"><b>No businesses match</b>Try another search or filter.</div></section>';
  L.forEach(c => wireCard(box.querySelector('[data-card="' + c.domain + '"]'), c));
}
const AREAS = [['Contacts', /Contacts/], ['Forms', /Form/], ['Deals', /Opportunities/], ['Pipelines', /Pipelines/], ['Calendars', /Calendars/], ['Conversations', /Conversations/], ['Tags', /Tags/]];
function card(c) {
  const logo = c.logo || 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(c.domain) + '&sz=64';
  let status;
  if (c.source === 'ghl') status = c.check && c.check.ok ? '<span class="pill ok">' + ic('check', 12) + ' Connected</span>' : (c.check ? '<span class="pill bad">Missing permissions</span>' : '<span class="pill warn">Not checked</span>');
  else status = c.lastHit ? '<span class="pill ok">' + ic('check', 12) + ' Snippet reporting</span>' : '<span class="pill warn">Snippet not seen yet</span>';
  const areas = c.source === 'ghl' ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0">' + AREAS.map(a => { const ok = c.check && c.check.passed.some(p => a[1].test(p)); return '<span class="pill ' + (ok ? 'ok' : (c.check ? 'bad' : '')) + '">' + (ok ? '✓ ' : '× ') + a[0] + '</span>'; }).join('') + '</div>' : '';
  return '<section class="w reveal" style="--c:6" data-card="' + esc(c.domain) + '">' +
    '<div class="wh" style="margin-bottom:6px"><img src="' + esc(logo) + '" alt="" width="44" height="44" style="border-radius:12px;border:1px solid var(--line);object-fit:contain;padding:4px;background:#fff" onerror="this.style.visibility=\'hidden\'"><div style="min-width:0;flex:1"><h3 style="font-size:16.5px">' + esc(c.name) + '</h3><small><a href="https://' + esc(c.domain) + '" target="_blank" rel="noopener">' + esc(c.domain) + '</a> · ' + (c.source === 'ghl' ? 'GoHighLevel' : 'Website only') + '</small></div><div class="acts">' + status + '<div class="anchor"><button class="iconbtn light" type="button" data-more aria-label="More" style="width:34px;height:34px">' + ic('more', 18) + '</button></div></div></div>' +
    areas +
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0 4px">' +
      tile('data-ga', 'globe', 'Google Analytics', c.ga) + tile('data-gsc', 'search', 'Search Console', c.gsc) + tile('data-ai', 'spark', 'AI Overviews', c.tracker && c.tracker.on) +
      '<label class="btn sm" style="justify-content:space-between;min-width:0"><span style="display:flex;gap:7px;align-items:center">' + ic('chat', 14) + ' Assistant</span><input type="checkbox" data-bot' + (c.bot ? ' checked' : '') + ' style="accent-color:var(--vault)" aria-label="Assistant on"></label></div>' +
    ((!c.ga || !c.gsc || c.source !== 'ghl') ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 2px">' + ((!c.ga || !c.gsc) ? '<button class="btn sm magic" type="button" data-auto>' + ic('wand', 14) + ' Connect Google in one click</button>' : '') + (c.source !== 'ghl' ? '<button class="btn sm" type="button" data-ghl>' + ic('layers', 14) + ' Connect GoHighLevel</button>' : '') + '</div>' : '') +
    '<div class="sec" style="display:flex;justify-content:space-between;align-items:center">Logins <span style="display:flex;gap:6px">' + (c.bot ? '<button class="btn sm ghost" type="button" data-chats>Read chats</button>' : '') + '<button class="btn sm" type="button" data-openas>' + ic('eye', 14) + ' Open dashboard</button><button class="btn sm go" type="button" data-login>' + ic('plus', 14) + ' Login</button></span></div>' +
    (c.logins.length ? '<div class="rows">' + c.logins.map(l => '<div class="row">' + LV.av(l.name || l.email, 30) + '<div class="main"><b>' + esc(l.name || l.email) + (l.owner ? ' <span class="pill brass">Owner</span>' : '') + (l.active ? '' : ' <span class="pill bad">Off</span>') + '</b><small>' + esc(l.email) + ' · ' + ['View only', 'Sales desk', 'Sales desk + campaigns'][l.write || 0] + ' · ' + (l.last ? 'last in ' + esc(when(l.last)) : 'never signed in') + '</small></div><div class="end"><div class="anchor"><button class="btn sm ghost" type="button" data-lm="' + esc(l.email) + '" aria-label="Login actions">' + ic('more', 16) + '</button></div></div></div>').join('') + '</div>' : '<div style="color:var(--ink-3);font-size:13px;padding:6px 0">No logins yet. Create one so the client can sign in.</div>') +
    '</section>';
}
function tile(attr, icon, label, on) { return '<button class="btn sm" type="button" ' + attr + ' style="justify-content:space-between;min-width:0"><span style="display:flex;gap:7px;align-items:center;overflow:hidden;text-overflow:ellipsis">' + ic(icon, 14) + ' ' + label + '</span>' + (on ? '<span class="pill ok" style="height:20px">On</span>' : '<span class="pill" style="height:20px">Set up</span>') + '</button>'; }
function wireCard(el, c) {
  const on = (s, f) => { const x = el.querySelector(s); if (x) x.addEventListener('click', f); };
  on('[data-more]', e => menu(e.currentTarget, [
    ['edit', 'Rename', () => rename(c)], ['refresh', c.source === 'ghl' ? 'Check connection' : 'Check the snippet', () => check(c)],
    c.source === 'ghl' ? ['key', 'Update token', () => updateToken(c)] : ['layers', 'Connect GoHighLevel', () => updateToken(c, true)], ['wand', 'Connect Google in one click', () => autoConnect(c)], ['refresh', 'Refresh logo', () => refreshLogo(c)], ['copy', 'Website snippet', () => snippet(c)], ['download', 'Import leads (CSV)', () => importLeads(c)],
    C.me && C.me.role === 'owner' ? ['trash', 'Remove business', () => removeClient(c), true] : null]));
  on('[data-ga]', () => pickGa(c)); on('[data-gsc]', () => pickGsc(c)); on('[data-ai]', () => tracker(c)); on('[data-auto]', () => autoConnect(c)); on('[data-ghl]', () => updateToken(c, true));
  on('[data-login]', () => loginForm(c)); on('[data-openas]', () => openAs(c)); on('[data-chats]', () => chats(c));
  const bot = el.querySelector('[data-bot]'); bot.addEventListener('change', async () => { const r = await api('lvSetBot', {session: C.session, domain: c.domain, value: bot.checked}); if (r.error) { bot.checked = !bot.checked; return LV.toast(r.error); } LV.toast('Assistant ' + (bot.checked ? 'on' : 'off') + ' for ' + c.name); upd(r.client); });
  el.querySelectorAll('[data-lm]').forEach(b => b.addEventListener('click', e => { const l = c.logins.find(x => x.email === b.dataset.lm); menu(e.currentTarget, [
    ['edit', 'Edit login', () => loginForm(c, l)], ['key', 'Reset password', () => resetPw(c, l)], ['out', 'Sign out everywhere', () => signOutLogin(l)],
    [l.active ? 'lock' : 'check', l.active ? 'Turn off' : 'Turn on', () => toggleLogin(c, l)], ['trash', 'Delete login', () => delLogin(l), true]]); }));
}
function upd(nc) { if (!nc) return; const i = C.clients.findIndex(x => x.domain === nc.domain); if (i > -1) C.clients[i] = nc; else C.clients.push(nc); cards(); }

/* ---------------- popovers ---------------- */
function closePops() { document.querySelectorAll('.pop').forEach(p => p.remove()); }
document.addEventListener('click', e => { if (!e.target.closest('.pop') && !e.target.closest('.anchor')) closePops(); });
function menu(btn, items) {
  closePops(); const p = document.createElement('div'); p.className = 'pop menu';
  p.innerHTML = items.filter(Boolean).map((x, i) => '<button type="button" data-i="' + i + '"' + (x[3] ? ' style="color:var(--bad)"' : '') + '>' + ic(x[0], 16) + ' ' + esc(x[1]) + '</button>').join('');
  btn.parentNode.appendChild(p);
  const L = items.filter(Boolean); p.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { closePops(); L[Number(b.dataset.i)][2](); }));
}
function meMenu(btn) {
  menu(btn, [C.me && C.me.role === 'owner' ? ['users', 'Team members', team] : null, ['key', 'Setup and keys', setupHelp], ['out', 'Sign out', () => signOut('You’re signed out.')]]);
}

/* ---------------- new client (fixed-size, two tabs) ---------------- */
function newClient() {
  LV.modal('<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h2>New client</h2><p style="color:var(--ink-2);margin:2px 0 0">Connect their CRM, or track their website with the snippet.</p></div><button class="iconbtn light" type="button" data-close aria-label="Close">' + ic('x') + '</button></div>' +
    '<div class="seg light" style="margin:18px 0;width:100%;display:grid;grid-template-columns:1fr 1fr"><button type="button" data-k="ghl" class="on">GoHighLevel</button><button type="button" data-k="site">Website only</button></div>' +
    '<form style="min-height:390px;display:flex;flex-direction:column"><label class="field"><span>Business name</span><input class="input" name="name" placeholder="Acme Roofing" required></label><label class="field"><span>Website</span><input class="input" name="domain" placeholder="acmeroofing.ca" required></label>' +
    '<div data-ghl><label class="field"><span>Location ID</span><input class="input" name="loc" placeholder="Settings → Business Profile → Location ID" autocomplete="off"></label><label class="field"><span>Private Integration token</span><input class="input" name="tok" placeholder="pit-…" autocomplete="off"><div class="hint">Settings → Private Integrations. Give it read access to contacts, forms, opportunities, calendars, conversations and locations, plus write access for the sales desk.</div></label></div>' +
    '<div data-site hidden><div class="gate-note">' + ic('globe', 18) + '<span>You’ll get a one-line snippet to paste before &lt;/head&gt; on their site. It sends form leads and phone-number taps to their dashboard.</span></div></div>' +
    '<div class="gate-err" role="alert"><span></span></div><div style="margin-top:auto;display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Add client</button></div></form>', (m, close) => {
    let kind = 'ghl'; const f = m.querySelector('form'), err = m.querySelector('.gate-err');
    m.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { kind = b.dataset.k; m.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); m.querySelector('[data-ghl]').hidden = kind !== 'ghl'; m.querySelector('[data-site]').hidden = kind !== 'site'; }));
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.classList.remove('on'); const b = f.querySelector('.go'); b.classList.add('busy');
      const r = kind === 'ghl' ? await api('lvAddClient', {session: C.session, name: f.name.value, domain: f.domain.value, locationId: f.loc.value, token: f.tok.value}) : await api('lvAddSiteClient', {session: C.session, name: f.name.value, domain: f.domain.value});
      b.classList.remove('busy');
      if (r.error) { err.querySelector('span').textContent = r.error; err.classList.add('on'); return; }
      close(); upd(r.client); C.stats.clients++;
      afterAdd(r);
    });
  });
}
function afterAdd(r) {
  const c = r.client, chk = r.check;
  LV.modal('<h2>' + esc(c.name) + ' is in</h2>' +
    (chk ? (chk.ok ? '<div class="gate-note" style="background:var(--ok-soft);color:var(--ok);margin-top:14px">' + ic('check', 18) + '<span>Every permission checked out.</span></div>' : '<div class="gate-err on" style="margin-top:14px">' + ic('flag', 18) + '<span>Missing: ' + esc(chk.missing.join(', ')) + '. Add these to the token, then use Check connection.</span></div>') : '') +
    '<div class="sec">Website snippet' + (c.source === 'ghl' ? ' (optional, adds phone taps)' : '') + '</div><textarea class="input" readonly style="font-size:12.5px;min-height:70px">' + esc(r.snippet) + '</textarea>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" type="button" data-copy>' + ic('copy', 15) + ' Copy snippet</button><button class="btn go" type="button" data-login>' + ic('plus', 15) + ' Create the first login</button></div>', (m, close) => {
    m.querySelector('[data-copy]').addEventListener('click', () => LV.copy(r.snippet, 'Snippet copied'));
    m.querySelector('[data-login]').addEventListener('click', () => { close(); loginForm(c); });
  });
}

/* ---------------- logins ---------------- */
function loginForm(c, l) {
  const edit = !!l;
  LV.modal('<h2>' + (edit ? 'Edit login' : 'New login for ' + esc(c.name)) + '</h2><form style="margin-top:14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="field"><span>Name</span><input class="input" name="name" value="' + esc(l ? l.name : '') + '"></label><label class="field"><span>Email</span><input class="input" type="email" name="email" required value="' + esc(l ? l.email : '') + '"></label></div>' +
    '<label class="field"><span>What they can do</span><select class="input" name="write">' + [['0', 'View the dashboard'], ['1', 'View + work the sales desk'], ['2', 'View + sales desk + send campaigns']].map(o => '<option value="' + o[0] + '"' + (String(l ? l.write : 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' + (c.source !== 'ghl' ? '<div class="hint">The sales desk needs a GoHighLevel connection.</div>' : '') + '</label>' +
    '<label class="field"><span>Businesses</span><div class="chips">' + C.clients.map(x => '<button type="button" class="chip' + ((l ? l.clients.indexOf(x.domain) > -1 : x.domain === c.domain) ? ' on' : '') + '" data-d="' + esc(x.domain) + '">' + esc(x.name) + '</button>').join('') + '</div></label>' +
    '<label class="check"><input type="checkbox" name="owner"' + (l && l.owner ? ' checked' : '') + '> Account owner (can set the team’s default layout)</label>' +
    (edit ? '' : '<p class="hint" style="margin:-8px 0 16px">We’ll make a strong password and a ready-to-send welcome message.</p>') +
    '<div class="gate-err" role="alert"><span></span></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">' + (edit ? 'Save login' : 'Create login') + '</button></div></form>', (m, close) => {
    const f = m.querySelector('form'), err = m.querySelector('.gate-err');
    m.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
    f.addEventListener('submit', async e => {
      e.preventDefault(); const b = f.querySelector('.go'); b.classList.add('busy');
      const r = await api('lvLoginSave', {session: C.session, original: l ? l.email : '', email: f.email.value, name: f.name.value, write: Number(f.write.value), owner: f.owner.checked, clients: [...m.querySelectorAll('[data-d].on')].map(x => x.dataset.d)});
      b.classList.remove('busy');
      if (r.error) { err.querySelector('span').textContent = r.error; err.classList.add('on'); return; }
      close(); await load(); if (r.password) welcome(r);
      else LV.toast('Login saved');
    });
  });
}
function welcome(r) {
  LV.modal('<h2>Login ready</h2><p style="color:var(--ink-2);margin:4px 0 14px">Send this to ' + esc(r.login.name || r.login.email) + '. The password is shown only once.</p><textarea class="input" readonly style="min-height:200px;font-size:13.5px">' + esc(r.message) + '</textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" type="button" data-close>Done</button><button class="btn go" type="button" data-copy>' + ic('copy', 15) + ' Copy message</button></div>', m => {
    m.querySelector('[data-copy]').addEventListener('click', () => LV.copy(r.message, 'Message copied'));
  });
}
async function resetPw(c, l) { if (!await LV.confirm('Reset ' + (l.name || l.email) + '’s password?', 'Their current password stops working and they’re signed out everywhere.', 'Reset password')) return; const r = await api('lvLoginSave', {session: C.session, original: l.email, email: l.email, clients: l.clients, resetPassword: true}); if (r.error) return LV.toast(r.error); welcome(r); load(); }
async function signOutLogin(l) { const r = await api('lvLoginSignOut', {session: C.session, email: l.email}); LV.toast(r.error || (l.name || l.email) + ' is signed out everywhere'); }
async function toggleLogin(c, l) { const r = await api('lvLoginSave', {session: C.session, original: l.email, email: l.email, clients: l.clients, active: !l.active}); if (r.error) return LV.toast(r.error); LV.toast(l.active ? 'Login turned off' : 'Login turned on'); load(); }
async function delLogin(l) { if (!await LV.confirm('Delete ' + (l.name || l.email) + '?', 'They won’t be able to sign in. Their layouts are removed.', 'Delete login', true)) return; const r = await api('lvLoginDelete', {session: C.session, email: l.email}); if (r.error) return LV.toast(r.error); LV.toast('Login deleted'); load(); }
async function openAs(c) { const r = await api('lvOpenAs', {session: C.session, domain: c.domain}); if (r.error) return LV.toast(r.error); window.open(SITE + '?as=' + encodeURIComponent(r.session), '_blank', 'noopener'); }

/* ---------------- business actions ---------------- */
async function rename(c) { const n = prompt('Business name', c.name); if (!n) return; const r = await api('lvRenameClient', {session: C.session, domain: c.domain, name: n}); if (r.error) return LV.toast(r.error); upd(r.client); LV.toast('Renamed'); }
async function check(c) {
  LV.toast('Checking ' + c.name + '…');
  const r = await api('lvCheck', {session: C.session, domain: c.domain}); if (r.error) return LV.toast(r.error);
  if (r.check) { LV.toast(r.check.ok ? 'All permissions check out' : 'Missing: ' + r.check.missing.join(', ')); load(); }
  else { LV.modal('<h2>Website snippet</h2><p style="color:var(--ink-2)">' + (r.found ? 'Found on the home page.' : 'Not found on the home page' + (r.err ? ' (' + esc(r.err) + ')' : '') + '.') + ' Last report: ' + esc(r.last ? when(r.last) : 'none yet') + '.</p><textarea class="input" readonly style="font-size:12.5px">' + esc(r.snippet) + '</textarea><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" type="button" data-close>Close</button></div>'); }
}
function updateToken(c, first) {
  LV.modal('<h2>' + (first ? 'Connect GoHighLevel to ' + esc(c.name) : 'Update GoHighLevel token') + '</h2>' + (first ? '<p style="color:var(--ink-2);margin:6px 0 0">In GoHighLevel open the sub-account, then <b>Settings → Private Integrations → Create</b>. Tick contacts, conversations, opportunities, calendars, forms and locations, copy the token, and paste it below with the Location ID (Settings → Business Profile). Leadvault checks it right away.</p>' : '') + '<form style="margin-top:14px"><label class="field"><span>Location ID</span><input class="input" name="loc" value="' + esc(c.locationId) + '"></label><label class="field"><span>New Private Integration token</span><input class="input" name="tok" placeholder="Current token ends in ' + esc(c.tokenTail) + '" autocomplete="off"></label><div class="gate-err" role="alert"><span></span></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Save and check</button></div></form>', (m, close) => {
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const f = e.target, b = f.querySelector('.go'); b.classList.add('busy'); const r = await api('lvSetToken', {session: C.session, domain: c.domain, locationId: f.loc.value, token: f.tok.value}); b.classList.remove('busy'); if (r.error) { const er = f.querySelector('.gate-err'); er.querySelector('span').textContent = r.error; er.classList.add('on'); return; } close(); upd(r.client); LV.toast(r.check.ok ? 'Token saved, all permissions check out' : 'Saved. Missing: ' + r.check.missing.join(', ')); });
  });
}
/* One click: find this business's GA4 property and Search Console site by its web address and connect both. */
async function autoConnect(c) {
  const step = (cls, n, title, body) => '<div class="step ' + cls + '"><span class="n">' + n + '</span><div style="flex:1;min-width:0"><b>' + title + '</b>' + (body ? '<div style="color:var(--ink-2);font-size:13.5px;margin-top:3px">' + body + '</div>' : '') + '</div></div>';
  const m = LV.modal('<div style="display:flex;gap:14px;align-items:center"><div class="wic" style="--t:var(--brass);width:46px;height:46px">' + ic('wand', 22) + '</div><div><h2>Connecting Google for ' + esc(c.name) + '</h2><div style="color:var(--ink-2);font-size:13.5px">Looking for everything that belongs to ' + esc(c.domain) + '.</div></div></div><div class="connect" data-r style="margin-top:18px">' +
    step('scan', '1', 'Google Analytics', 'Searching your properties for ' + esc(c.domain) + '…') + step('scan', '2', 'Search Console', 'Searching your verified sites…') + '</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn" type="button" data-close>Close</button></div>');
  const r = await api('lvAutoConnect', {session: C.session, domain: c.domain}), box = m.el.querySelector('[data-r]');
  if (r.error) { box.innerHTML = step('warn', '!', 'Couldn’t check right now', esc(r.error)); return; }
  const own = esc(r.owner || 'the Leadvault Google account'), link = t => esc(t).replace(/(https:\/\/[^\s<]+)/, '<a href="$1" target="_blank" rel="noopener">open the switch</a>');
  const gaHtml = r.ga ? step('ok', ic('check', 14), 'Google Analytics connected', esc(r.ga.name) + ' · property ' + esc(r.ga.id) + '. The Website tab and GA4 widgets are ready.')
    : r.gaErr ? step('warn', '!', 'Google Analytics needs one fix', link(r.gaErr))
    : step('warn', '!', 'No Google Analytics property found for ' + esc(c.domain), 'In Google Analytics open <b>Admin → Property access management → + Add users</b>, add <b>' + own + '</b> as <b>Viewer</b>, then click Try again.' + (r.gaOptions ? ' Or <a href="#" data-pick-ga>pick from the ' + r.gaOptions + ' properties already shared</a>.' : '') + ' <a href="https://analytics.google.com/analytics/web/" target="_blank" rel="noopener">Open Google Analytics</a>');
  const gscHtml = r.gsc ? step('ok', ic('check', 14), 'Search Console connected', esc(r.gsc.id) + '. The Google Search tab is ready.')
    : r.gscErr ? step('warn', '!', 'Search Console needs one fix', link(r.gscErr))
    : step('warn', '!', 'No Search Console site found for ' + esc(c.domain), 'In Search Console open <b>Settings → Users and permissions → Add user</b>, add <b>' + own + '</b> with <b>Restricted</b> access, then click Try again. <a href="https://search.google.com/search-console/users" target="_blank" rel="noopener">Open Search Console</a>');
  box.innerHTML = gaHtml + gscHtml + (c.source !== 'ghl' ? step('', '3', 'GoHighLevel (optional)', 'Using GoHighLevel for this business? <a href="#" data-ghl2>Connect it with a token</a> to add calls, contacts, deals and bookings.') : '');
  const foot = m.el.querySelector('[data-close]').parentNode;
  if (!r.ga || !r.gsc) { const t = document.createElement('button'); t.className = 'btn go'; t.type = 'button'; t.innerHTML = ic('refresh', 15) + ' Try again'; t.addEventListener('click', () => { m.close(); autoConnect(c); }); foot.appendChild(t); }
  const pg = box.querySelector('[data-pick-ga]'); if (pg) pg.addEventListener('click', e => { e.preventDefault(); m.close(); pickGa(c); });
  const g2 = box.querySelector('[data-ghl2]'); if (g2) g2.addEventListener('click', e => { e.preventDefault(); m.close(); updateToken(c, true); });
  if (r.client) upd(r.client);
  if (r.ga || r.gsc) LV.toast((r.ga && r.gsc) ? 'Google Analytics and Search Console connected' : r.ga ? 'Google Analytics connected' : 'Search Console connected');
}
async function refreshLogo(c) {
  LV.toast('Looking for ' + c.name + '’s logo…');
  const r = await api('lvLogo', {session: C.session, domain: c.domain});
  if (r.error) return LV.toast(r.error);
  if (r.client) upd(r.client);
  LV.toast(r.logo ? 'Logo updated' : 'No logo found on ' + c.domain + '. Set a Site Icon on the website, then try again.');
}
async function snippet(c) { const r = await api('lvSiteCheck', {session: C.session, domain: c.domain}); if (r.error) return LV.toast(r.error); LV.modal('<h2>Website snippet for ' + esc(c.name) + '</h2><p style="color:var(--ink-2)">Paste this before &lt;/head&gt; on every page. ' + (r.found ? 'It’s already on the home page.' : '') + ' Last report: ' + esc(r.last ? when(r.last) : 'none yet') + '.</p><textarea class="input" readonly style="font-size:12.5px">' + esc(r.snippet) + '</textarea><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" type="button" data-close>Close</button><button class="btn go" type="button" data-c>' + ic('copy', 15) + ' Copy</button></div>', m => m.querySelector('[data-c]').addEventListener('click', () => LV.copy(r.snippet, 'Snippet copied'))); }
async function removeClient(c) { if (!await LV.confirm('Remove ' + c.name + '?', 'Its connection is deleted and its logins lose access to it. Leads already received stay in the database sheet.', 'Remove business', true)) return; const r = await api('lvRemoveClient', {session: C.session, domain: c.domain}); if (r.error) return LV.toast(r.error); LV.toast(c.name + ' removed'); load(); }
async function pickGa(c) {
  const m = LV.modal('<h2>Google Analytics for ' + esc(c.name) + '</h2><p style="color:var(--ink-2);margin:4px 0 14px">Properties the Leadvault Google account can read.</p><div data-l>' + LV.skel('list') + '</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">' + (c.ga ? '<button class="btn danger" type="button" data-off>Disconnect</button>' : '') + '<button class="btn" type="button" data-close>Close</button></div>');
  const r = await api('lvGaList', {session: C.session}), L = m.el.querySelector('[data-l]');
  if (r.error) return L.innerHTML = '<div class="gate-err on"><span>' + esc(r.error) + '</span></div>';
  const host = u => String(u || '').toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#:]/)[0], match = p => (p.urls || []).some(u => host(u) === c.domain);
  r.properties.sort((a, b) => match(b) - match(a));
  L.innerHTML = r.properties.length ? '<div class="rows" style="max-height:50vh;overflow:auto">' + r.properties.map(p => '<div class="row click" data-id="' + p.id + '" data-n="' + esc(p.name) + '"><div class="main"><b>' + esc(p.name) + '</b><small>' + esc(p.account) + ' · ' + p.id + ((p.urls || [])[0] ? ' · ' + esc(host(p.urls[0])) : '') + '</small></div>' + (c.ga === p.id ? '<span class="pill ok">Connected</span>' : match(p) ? '<span class="pill brass">' + ic('wand', 12) + ' Matches ' + esc(c.domain) + '</span>' : '') + '</div>').join('') + '</div>' : '<div class="empty"><b>No properties</b>Give the Leadvault Google account Viewer access to the property first.</div>';
  L.querySelectorAll('[data-id]').forEach(x => x.addEventListener('click', async () => { const y = await api('lvSetGa', {session: C.session, domain: c.domain, value: x.dataset.id, label: x.dataset.n}); if (y.error) return LV.toast(y.error); m.close(); upd(y.client); LV.toast('Google Analytics connected'); }));
  const off = m.el.querySelector('[data-off]'); if (off) off.addEventListener('click', async () => { const y = await api('lvSetGa', {session: C.session, domain: c.domain, value: ''}); m.close(); upd(y.client); });
}
async function pickGsc(c) {
  const m = LV.modal('<h2>Search Console for ' + esc(c.name) + '</h2><p style="color:var(--ink-2);margin:4px 0 14px">Sites the Leadvault Google account can read.</p><div data-l>' + LV.skel('list') + '</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">' + (c.gsc ? '<button class="btn danger" type="button" data-off>Disconnect</button>' : '') + '<button class="btn" type="button" data-close>Close</button></div>');
  const r = await api('lvGscList', {session: C.session}), L = m.el.querySelector('[data-l]');
  if (r.error) return L.innerHTML = '<div class="gate-err on"><span>' + esc(r.error) + '</span></div>';
  const sorted = r.sites.slice().sort((a, b) => (b.id.indexOf(c.domain) > -1) - (a.id.indexOf(c.domain) > -1));
  L.innerHTML = sorted.length ? '<div class="rows" style="max-height:50vh;overflow:auto">' + sorted.map(s => '<div class="row click" data-id="' + esc(s.id) + '"><div class="main"><b>' + esc(s.id) + '</b><small>' + esc(s.level) + '</small></div>' + (c.gsc === s.id ? '<span class="pill ok">Connected</span>' : '') + '</div>').join('') + '</div>' : '<div class="empty"><b>No sites</b>Add the Leadvault Google account as a user on the Search Console property first.</div>';
  L.querySelectorAll('[data-id]').forEach(x => x.addEventListener('click', async () => { const y = await api('lvSetGsc', {session: C.session, domain: c.domain, value: x.dataset.id}); if (y.error) return LV.toast(y.error); m.close(); upd(y.client); LV.toast('Search Console connected'); }));
  const off = m.el.querySelector('[data-off]'); if (off) off.addEventListener('click', async () => { const y = await api('lvSetGsc', {session: C.session, domain: c.domain, value: ''}); m.close(); upd(y.client); });
}
function tracker(c) {
  const t = c.tracker || {on: false, queries: []};
  LV.modal('<h2>Track Google AI Overviews</h2><p style="color:var(--ink-2);margin:4px 0 14px">Once a day, Leadvault checks whether Google shows an AI Overview for each search, and whether it cites or names ' + esc(c.name) + '.</p>' + (C.setup && !C.setup.serp ? '<div class="gate-note">' + ic('key', 18) + '<span>Needs a SerpAPI key in Script properties (SERPAPI_KEY) before checks can run.</span></div>' : '') +
    '<form><label class="check"><input type="checkbox" name="on"' + (t.on ? ' checked' : '') + '> Track daily</label><label class="field"><span>Searches (one per line, up to 15)</span><textarea class="input" name="q" rows="7" placeholder="roofer calgary&#10;roof repair near me">' + esc((t.queries || []).join('\n')) + '</textarea></label><label class="field"><span>Location (optional)</span><input class="input" name="loc" value="' + esc(t.location || '') + '" placeholder="Calgary, Alberta, Canada"></label><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Save tracking</button></div></form>', (m, close) => {
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const f = e.target; const r = await api('lvSetTracker', {session: C.session, domain: c.domain, on: f.on.checked, queries: f.q.value.split('\n'), location: f.loc.value}); if (r.error) return LV.toast(r.error); close(); upd(r.client); LV.toast('Tracking saved'); });
  });
}
async function chats(c) {
  const d = LV.drawer('Assistant chats', esc(c.name), LV.skel('list'));
  const r = await api('lvChats', {session: C.session, domain: c.domain});
  if (r.error) return d.body.innerHTML = '<div class="empty">' + esc(r.error) + '</div>';
  d.body.innerHTML = r.chats.length ? r.chats.map(x => '<div style="border:1px solid var(--line-2);border-radius:14px;padding:12px;margin-bottom:12px"><small style="color:var(--ink-3)">' + esc(x.who) + ' · ' + esc(when(x.at)) + '</small><div class="thread"><div class="msg out">' + esc(x.q) + '</div><div class="msg in">' + esc(x.a) + '</div></div></div>').join('') : '<div class="empty"><b>No chats yet</b>Questions the client asks the assistant show up here.</div>';
}
function importLeads(c) {
  LV.modal('<h2>Import leads into ' + esc(c.name) + '</h2><p style="color:var(--ink-2);margin:4px 0 14px">A CSV with a header row. Columns we recognize: name, email, phone, form, date, source, city, message. Each row needs an email or a phone.</p><input type="file" accept=".csv,text/csv" class="input" style="padding:8px"><div data-p style="margin-top:12px"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" type="button" data-close>Cancel</button><button class="btn go" type="button" data-go disabled>Import</button></div>', (m, close) => {
    let rows = [];
    m.querySelector('input').addEventListener('change', async e => {
      const txt = await e.target.files[0].text(), lines = parseCsv(txt), head = (lines.shift() || []).map(h => h.trim().toLowerCase());
      const map = k => head.findIndex(h => h.indexOf(k) > -1);
      const ix = {name: map('name'), email: map('mail'), phone: map('phone'), form: map('form'), at: Math.max(map('date'), map('time'), map('created')), source: map('source'), city: map('city'), message: Math.max(map('message'), map('note'), map('comment'))};
      rows = lines.filter(r => r.some(Boolean)).map(r => { const o = {}; Object.keys(ix).forEach(k => { if (ix[k] > -1) o[k] = r[ix[k]] || ''; }); return o; }).filter(o => o.email || o.phone);
      m.querySelector('[data-p]').innerHTML = '<span class="pill ok">' + fmt(rows.length) + ' leads ready</span>';
      m.querySelector('[data-go]').disabled = !rows.length;
    });
    m.querySelector('[data-go]').addEventListener('click', async e => { e.target.classList.add('busy'); const r = await api('lvImportLeads', {session: C.session, domain: c.domain, rows}); e.target.classList.remove('busy'); if (r.error) return LV.toast(r.error); close(); LV.toast('Imported ' + fmt(r.imported) + ' leads'); });
  });
}
function parseCsv(t) { const out = []; let row = [], cur = '', q = false; for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; } else cur += ch; } if (cur || row.length) { row.push(cur); out.push(row); } return out; }

/* ---------------- team + setup ---------------- */
async function team() {
  const d = LV.drawer('Team members', 'People who can use this console', LV.skel('list'));
  const paint = async () => {
    const r = await api('teamList', {session: C.session}); if (r.error) return d.body.innerHTML = '<div class="empty">' + esc(r.error) + '</div>';
    d.body.innerHTML = '<form data-add style="display:grid;grid-template-columns:1fr 1fr 120px auto;gap:8px;margin-bottom:18px"><input class="input" name="name" placeholder="Name"><input class="input" type="email" name="email" placeholder="Email" required><select class="input" name="role"><option value="member">Member</option><option value="owner">Owner</option></select><button class="btn go">Add</button></form>' +
      '<div class="rows">' + r.team.map(t => '<div class="row">' + LV.av(t.name || t.email) + '<div class="main"><b>' + esc(t.name || t.email) + ' <span class="pill ' + (t.role === 'owner' ? 'brass' : '') + '">' + esc(t.role) + '</span></b><small>' + esc(t.email) + ' · ' + (t.last ? 'last in ' + esc(when(t.last)) : 'never signed in') + '</small></div><div class="end"><button class="btn sm ghost" type="button" data-rm="' + esc(t.email) + '">' + ic('trash', 14) + '</button></div></div>').join('') + '</div>';
    d.body.querySelector('[data-add]').addEventListener('submit', async e => { e.preventDefault(); const f = e.target; const x = await api('teamSave', {session: C.session, name: f.name.value, email: f.email.value, role: f.role.value}); if (x.error) return LV.toast(x.error);
      LV.modal('<h2>Team member added</h2><p style="color:var(--ink-2)">Send them the console link and this password. It’s shown only once.</p><div class="kv" style="margin:14px 0"><span>Console</span><b>' + esc(location.href.split('?')[0]) + '</b><span>Email</span><b>' + esc(x.member.email) + '</b><span>Password</span><b>' + esc(x.password || '(unchanged)') + '</b></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" type="button" data-close>Done</button><button class="btn go" type="button" data-c>Copy</button></div>', m => m.querySelector('[data-c]').addEventListener('click', () => LV.copy('Leadvault console: ' + location.href.split('?')[0] + '\nEmail: ' + x.member.email + '\nPassword: ' + x.password, 'Copied')));
      paint(); });
    d.body.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => { if (!await LV.confirm('Remove ' + b.dataset.rm + '?', 'They lose access to the console right away.', 'Remove', true)) return; const x = await api('teamDelete', {session: C.session, email: b.dataset.rm}); if (x.error) return LV.toast(x.error); paint(); }));
  };
  paint();
}
function setupHelp() {
  const s = C.setup || {};
  const row = (ok, k, what) => '<div class="row"><span class="pill ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'Set' : 'Not set') + '</span><div class="main"><b>' + k + '</b><small style="white-space:normal">' + what + '</small></div></div>';
  LV.modal('<h2>Setup and keys</h2><p style="color:var(--ink-2);margin:4px 0 12px">In the Leadvault Apps Script project: Project Settings → Script properties → Add script property.</p><div class="rows">' +
    row(s.ai, 'ANTHROPIC_API_KEY', 'Turns on the Vault assistant on client dashboards. Optional: AI_MODEL to pick the model.') +
    row(s.serp, 'SERPAPI_KEY', 'Lets the daily job check Google AI Overviews for tracked searches.') +
    row(!!s.site, 'SITE_URL', 'The dashboard address used in welcome messages and snippets. Now: ' + esc(s.site || 'https://haytham-mahir.github.io/leadvault/ (default)')) +
    '</div><p class="hint" style="margin-top:14px">Backend runs as ' + esc(s.owner || 'the deploying Google account') + '. Google Analytics and Search Console properties must be shared with that account.</p><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" type="button" data-close>Close</button></div>');
}
})();
