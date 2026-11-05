/* ==========================================================================
   LEADVAULT WIDGETS: overview, leads, calls, contacts, sales, email,
   website (GA4), Google Search (Search Console), AI visibility.
   Each widget: {g group, t title, d description, ic icon, tint, c width, sk skeleton, ok(client,S), draw(el, ctx)}
   ========================================================================== */
(function () {
'use strict';
const {esc, ic, fmt, money, when} = LV;
const W = LV.W = LV.W || {};
const T = {forms: '#1F7A5A', calls: '#3E7CB1', contacts: '#8E5A9B', appts: '#B7791F', opps: '#C29B3F', loc: '#5B8C85', web: '#3E7CB1', gsc: '#2F6DB5', ai: '#8E5A9B', email: '#D1495B'};
const isGhl = c => c.source === 'ghl';
const empty = (b, t) => '<div class="empty"><b>' + esc(b) + '</b>' + esc(t || '') + '</div>';

/* ---------- data helpers ---------- */
const forms = d => { const seen = new Set(); return (d.forms || []).concat(d.siteForms || []).filter(f => { const k = (f.email || f.phone || f.id) + '|' + Math.round(f.at / 6e4); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.at - a.at); };
LV.forms = forms;
const days = R => { const out = []; for (let t = new Date(R.from).setHours(0, 0, 0, 0); t <= R.to; t += 864e5) out.push(t); return out; };
const series = (R, list, f) => { const ds = days(R), idx = {}; ds.forEach((t, i) => { idx[new Date(t).toDateString()] = i; }); const v = ds.map(() => 0); list.forEach(x => { const i = idx[new Date(f ? f(x) : x.at).toDateString()]; if (i != null) v[i] += (x.__w || 1); }); return {labels: ds, vals: v}; };
const count = (list, f, n) => { const m = {}; list.forEach(x => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(k => ({k, v: m[k]})).sort((a, b) => b.v - a.v).slice(0, n || 10); };
const chColor = {'Organic search': 'var(--s1)', 'Paid search': 'var(--s2)', 'Direct': 'var(--s6)', 'Social': 'var(--s4)', 'Referral': 'var(--s3)', 'Email': 'var(--s5)', 'AI assistant': 'var(--s8)', 'Campaign': 'var(--s7)', 'Imported': '#9AA5A0'};
const kpi = (label, val, prev, tint, spark, opts) => '<div class="kpi" style="--t:' + tint + '"><div class="lab"><i></i>' + esc(label) + '</div><span class="big">' + (opts && opts.money ? money(val) : opts && opts.raw ? val : fmt(val)) + '</span>' + (prev === null || prev === undefined ? '<span class="delta">' + esc((opts && opts.note) || '') + '</span>' : LV.delta(Number(val) || 0, prev, opts && opts.invert)) + (spark ? LV.spark(spark, tint) : '') + '</div>';
const mk = (o) => o;

/* ---------- lead & call drawers ---------- */
const MARKS = [['star', 'Important', 'star'], ['done', 'Handled', 'check'], ['spam', 'Spam', 'flag']];
LV.openLead = function (f) {
  const S = LV.S, m = S.marks[f.id];
  const fields = Object.keys(f.fields || {}).filter(k => !/^(name|full name|first name|last name|email|phone)$/i.test(k));
  LV.drawer(f.name || f.email || f.phone || 'Website visitor', esc(f.form) + ' · ' + esc(when(f.at)),
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px">' +
      (f.phone ? '<a class="btn go sm" href="tel:' + esc(f.phone) + '">' + ic('phone', 15) + ' Call</a>' : '') +
      (f.email ? '<a class="btn sm" href="mailto:' + esc(f.email) + '">' + ic('mail', 15) + ' Email</a>' : '') +
      MARKS.map(x => '<button class="btn sm' + (m && m.m === x[0] ? ' brass' : '') + '" type="button" data-mark="' + x[0] + '">' + ic(x[2], 15) + ' ' + x[1] + '</button>').join('') + '</div>' +
    (m ? '<div class="gate-note" style="margin-bottom:16px">' + ic(MARKS.find(x => x[0] === m.m) ? MARKS.find(x => x[0] === m.m)[2] : 'flag', 16) + '<span>Marked ' + esc((MARKS.find(x => x[0] === m.m) || [0, m.m])[1].toLowerCase()) + ' by ' + esc(m.by) + ', ' + esc(when(m.at)) + '</span></div>' : '') +
    '<div class="kv">' +
      (f.email ? '<span>Email</span><b>' + esc(f.email) + '</b>' : '') + (f.phone ? '<span>Phone</span><b>' + esc(f.phone) + '</b>' : '') +
      '<span>Came from</span><b>' + esc(f.ch || '—') + (f.source ? ' <small style="color:var(--ink-3)">(' + esc(f.source) + ')</small>' : '') + '</b>' +
      (f.page ? '<span>Page</span><b>' + esc(f.page) + '</b>' : '') + (f.city ? '<span>Location</span><b>' + esc(f.city + (f.region ? ', ' + f.region : '')) + '</b>' : '') +
      '<span>Received</span><b>' + esc(new Date(f.at).toLocaleString('en-CA', {dateStyle: 'medium', timeStyle: 'short'})) + '</b></div>' +
    (fields.length ? '<div class="sec">What they wrote</div><div class="kv">' + fields.map(k => '<span>' + esc(k) + '</span><b style="white-space:pre-wrap">' + esc(f.fields[k]) + '</b>').join('') + '</div>' : '') +
    '<div class="sec">Client pipeline</div><div data-crm><div class="sk" style="height:40px"></div></div>',
    (body, close) => {
      body.querySelectorAll('[data-mark]').forEach(b => b.addEventListener('click', async () => {
        const v = m && m.m === b.dataset.mark ? '' : b.dataset.mark;
        const r = await LV.api('portalMark', {session: S.session, domain: S.domain, id: f.id, mark: v});
        if (r.error) return LV.toast(r.error);
        S.marks = r.marks; close(); LV.drawGrid(); LV.toast(v ? 'Marked ' + (MARKS.find(x => x[0] === v)[1]).toLowerCase() : 'Mark cleared');
      }));
      if (LV.crmInline) LV.crmInline(body.querySelector('[data-crm]'), f); else body.querySelector('[data-crm]').remove();
    });
};
LV.openCall = function (x) {
  LV.drawer(x.name || x.phone || 'Caller', esc(when(x.at)),
    '<div style="display:flex;gap:8px;margin:0 0 18px">' + (x.phone ? '<a class="btn go sm" href="tel:' + esc(x.phone) + '">' + ic('phone', 15) + ' Call back</a>' : '') + '</div>' +
    '<div class="kv"><span>Type</span><b>' + (x.status === 'tap' ? 'Tapped the phone number on your website' : (x.dir === 'outbound' ? 'Outgoing call' : 'Incoming call')) + '</b>' +
    (x.status && x.status !== 'tap' ? '<span>Result</span><b>' + esc(x.status) + '</b>' : '') + (x.dur ? '<span>Length</span><b>' + LV.dur(x.dur) + '</b>' : '') +
    (x.phone ? '<span>Number</span><b>' + esc(x.phone) + '</b>' : '') + (x.page ? '<span>Page</span><b>' + esc(x.page) + '</b>' : '') + (x.ch ? '<span>Came from</span><b>' + esc(x.ch) + '</b>' : '') + '</div>');
};

/* ================= OVERVIEW ================= */
W.kpis = mk({g: 'Overview', t: 'At a glance', d: 'Leads, calls, contacts, bookings and pipeline.', ic: 'bolt', tint: T.forms, c: 12, sk: 'kpis',
  draw(el, {d, client}) {
    const R = d.range, P = d.prev || {}, F = forms(d), C = d.calls || [];
    let h = kpi('Form leads', F.length, P.forms != null ? P.forms : null, T.forms, series(R, F).vals) + kpi(isGhl(client) ? 'Calls' : 'Phone taps', C.length, P.calls != null ? P.calls : null, T.calls, series(R, C).vals);
    if (isGhl(client)) {
      h += kpi('New contacts', d.contactsTotal || (d.contacts || []).length, P.contacts, T.contacts, series(R, d.contacts || []).vals);
      h += kpi('Appointments', (d.appts || []).filter(a => a.start <= R.to).length, P.appts, T.appts);
      const newOpps = (d.opps || []).filter(o => o.at >= R.from);
      h += kpi('New pipeline', newOpps.reduce((s, o) => s + o.value, 0), P.oppValue, T.opps, null, {money: true});
    }
    if (d.ga) h += kpi('Website visits', d.ga.now.sessions || 0, d.ga.prev.sessions || 0, T.web, d.ga.days.map(x => x.s));
    el.innerHTML = '<div class="kpis">' + h + '</div>';
  }});
W.trend = mk({g: 'Overview', t: 'Leads over time', d: 'Form leads, calls and new contacts, day by day.', ic: 'line', tint: T.forms, c: 8, sk: 'chart',
  draw(el, {d}) {
    const R = d.range, F = series(R, forms(d)), C = series(R, d.calls || []), s = [{name: 'Form leads', vals: F.vals, color: 'var(--s1)'}, {name: 'Calls', vals: C.vals, color: 'var(--s3)'}];
    if (d.contacts) s.push({name: 'New contacts', vals: series(R, d.contacts).vals, color: 'var(--s2)', dash: true});
    requestAnimationFrame(() => LV.lineChart(el, F.labels, s, {h: Math.max(200, (el.clientHeight || 300) - 40), label: 'Leads over time'}));
  }});
W.sources = mk({g: 'Overview', t: 'Lead sources', d: 'Where form leads came from.', ic: 'donut', tint: T.forms, c: 4, sk: 'chart',
  draw(el, {d}) { el.innerHTML = LV.donut(count(forms(d), f => f.ch || 'Direct', 8).map(x => ({k: x.k, v: x.v, color: chColor[x.k]})), {unit: 'leads'}); }});
W.locations = mk({g: 'Overview', t: 'Where leads come from', d: 'Leads by city, with the region.', ic: 'pin', tint: T.loc, c: 6, sk: 'list',
  draw(el, {d}) {
    const src = forms(d).concat(d.contacts || []).filter(x => x.city), seen = new Set();
    const uniq = src.filter(x => { const k = (x.email || x.phone || x.id); if (seen.has(k)) return false; seen.add(k); return true; });
    const reg = {}; uniq.forEach(x => { const k = x.city.trim().toLowerCase(); if (x.region && !reg[k]) reg[k] = x.region; });
    el.innerHTML = LV.bars(count(uniq, x => x.city.trim().toLowerCase(), 10).map(r => ({k: r.k.replace(/\b\w/g, c => c.toUpperCase()) + (reg[r.k] ? ', ' + reg[r.k] : ''), v: r.v})), {tint: T.loc, empty: 'Cities show up once leads include them.'});
  }});
W.forms_by = mk({g: 'Overview', t: 'Leads by form', d: 'Which forms bring in the most leads.', ic: 'bars', tint: T.forms, c: 6, sk: 'list',
  draw(el, {d}) { el.innerHTML = LV.bars(count(forms(d), f => f.form, 10), {tint: T.forms}); }});
W.pages = mk({g: 'Overview', t: 'Top pages for leads', d: 'The page people were on when they sent a form.', ic: 'book', tint: T.loc, c: 6, sk: 'list',
  draw(el, {d}) { el.innerHTML = LV.bars(count(forms(d), f => f.page, 10), {tint: '#5B8C85', empty: 'Pages show up once leads include them.'}); }});

/* ================= LEADS ================= */
W.inbox = mk({g: 'Leads', t: 'Lead inbox', d: 'Every form lead in one place. Search, filter, and mark what’s handled.', ic: 'inbox', tint: T.forms, c: 12, sk: 'inbox',
  draw(el, {d, it, S}) {
    const all = forms(d), st = it.__st = it.__st || {q: '', f: 'all', ch: '', form: ''};
    const chs = count(all, f => f.ch, 8).map(x => x.k), fms = count(all, f => f.form, 12).map(x => x.k);
    el.innerHTML = '<div class="toolbar"><label class="search">' + ic('search', 16) + '<input class="input" type="search" placeholder="Search name, email, phone or message" value="' + esc(st.q) + '" data-q aria-label="Search leads"></label>' +
      '<select class="input" style="width:auto;height:38px" data-ch aria-label="Source"><option value="">All sources</option>' + chs.map(c => '<option' + (c === st.ch ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<select class="input" style="width:auto;height:38px" data-form aria-label="Form"><option value="">All forms</option>' + fms.map(c => '<option' + (c === st.form ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<button class="btn sm" type="button" data-csv>' + ic('download', 15) + ' CSV</button></div>' +
      '<div class="chips" style="margin-bottom:10px">' + [['all', 'All'], ['open', 'Not handled'], ['star', 'Important'], ['done', 'Handled'], ['spam', 'Spam']].map(x => '<button class="chip' + (st.f === x[0] ? ' on' : '') + '" type="button" data-f="' + x[0] + '">' + x[1] + '</button>').join('') + '</div><div class="rows scrolly" data-list></div>';
    const list = el.querySelector('[data-list]');
    const paint = () => {
      const q = st.q.toLowerCase();
      const rows = all.filter(f => {
        const m = (S.marks[f.id] || {}).m || '';
        if (st.f === 'open' && (m === 'done' || m === 'spam')) return false;
        if (['star', 'done', 'spam'].indexOf(st.f) > -1 && m !== st.f) return false;
        if (st.f === 'all' && m === 'spam') return false;
        if (st.ch && f.ch !== st.ch) return false; if (st.form && f.form !== st.form) return false;
        return !q || JSON.stringify([f.name, f.email, f.phone, f.fields, f.city]).toLowerCase().indexOf(q) > -1;
      });
      list.innerHTML = rows.length ? rows.slice(0, 200).map(f => {
        const m = (S.marks[f.id] || {}).m, msg = Object.keys(f.fields || {}).filter(k => /message|comment|details|describe|project|note|question|how can/i.test(k)).map(k => f.fields[k])[0] || '';
        const nm = f.name || f.email || f.phone || 'Website visitor';
        return '<div class="row click" data-id="' + esc(f.id) + '">' + LV.av(nm) + '<div class="main"><b>' + esc(nm) + (m ? ' <span class="pill ' + (m === 'spam' ? 'bad' : m === 'done' ? 'ok' : 'brass') + '">' + ({star: 'Important', done: 'Handled', spam: 'Spam'})[m] + '</span>' : '') + '</b><small>' + esc(f.form + (msg ? ' — ' + msg : (f.email ? ' — ' + f.email : ''))) + '</small></div>' +
          '<div class="end hide-sm"><span class="pill" style="background:color-mix(in srgb,' + (chColor[f.ch] || '#888') + ' 14%,#fff)">' + esc(f.ch || 'Direct') + '</span>' + (f.city ? '<div><small style="color:var(--ink-3)">' + esc(f.city) + '</small></div>' : '') + '</div><div class="end" style="min-width:96px"><small>' + esc(when(f.at)) + '</small></div></div>';
      }).join('') + (rows.length > 200 ? '<div class="empty">Showing the newest 200 of ' + fmt(rows.length) + '. Narrow it with search.</div>' : '') : empty(all.length ? 'No leads match' : 'No form leads yet', all.length ? 'Try another filter.' : 'Leads from your forms appear here the moment they arrive.');
      list.querySelectorAll('[data-id]').forEach(r => r.addEventListener('click', () => LV.openLead(all.find(f => f.id === r.dataset.id))));
    };
    el.querySelector('[data-q]').addEventListener('input', LV.debounce(e => { st.q = e.target.value; paint(); }, 150));
    el.querySelector('[data-ch]').addEventListener('change', e => { st.ch = e.target.value; paint(); });
    el.querySelector('[data-form]').addEventListener('change', e => { st.form = e.target.value; paint(); });
    el.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { st.f = b.dataset.f; el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); paint(); }));
    el.querySelector('[data-csv]').addEventListener('click', () => LV.csv('leads.csv', [['Received', 'Name', 'Email', 'Phone', 'Form', 'Source', 'Page', 'City', 'Details']].concat(all.map(f => [new Date(f.at).toISOString(), f.name, f.email, f.phone, f.form, f.ch, f.page, f.city, Object.keys(f.fields || {}).map(k => k + ': ' + f.fields[k]).join(' | ')]))));
    paint();
  }});
W.forms_list = mk({g: 'Leads', t: 'Latest form leads', d: 'The newest leads, compact.', ic: 'form', tint: T.forms, c: 6, sk: 'list',
  draw(el, {d}) { const F = forms(d).slice(0, 12); el.innerHTML = F.length ? '<div class="rows">' + F.map((f, i) => '<div class="row click" data-i="' + i + '">' + LV.av(f.name || f.email) + '<div class="main"><b>' + esc(f.name || f.email || f.phone || 'Website visitor') + '</b><small>' + esc(f.form) + '</small></div><div class="end"><small>' + esc(when(f.at)) + '</small></div></div>').join('') + '</div>' : empty('No form leads yet', 'They show up here as they arrive.');
    el.querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => LV.openLead(F[Number(r.dataset.i)]))); }});

/* ================= CALLS ================= */
W.calls_mix = mk({g: 'Calls', t: 'Calls answered vs missed', d: 'How calls ended.', ic: 'donut', tint: T.calls, c: 4, sk: 'chart',
  draw(el, {d, client}) {
    const C = d.calls || [];
    if (!isGhl(client)) { el.innerHTML = LV.donut(count(C, x => x.ch || 'Direct', 6).map(x => ({k: x.k, v: x.v, color: chColor[x.k]})), {unit: 'taps'}); return; }
    const lab = {answered: 'Answered', missed: 'Missed', voicemail: 'Voicemail', outbound: 'Outgoing'}, col = {answered: 'var(--ok)', missed: 'var(--bad)', voicemail: 'var(--warn)', outbound: 'var(--s3)'};
    el.innerHTML = LV.donut(count(C, x => x.status, 4).map(x => ({k: lab[x.k] || x.k, v: x.v, color: col[x.k]})), {unit: 'calls'});
  }});
W.calls_list = mk({g: 'Calls', t: 'Recent calls', d: 'Incoming and outgoing calls, with how they ended.', ic: 'phone', tint: T.calls, c: 8, sk: 'list',
  draw(el, {d}) {
    const C = (d.calls || []).slice(0, 40), pill = {answered: 'ok', missed: 'bad', voicemail: 'warn', outbound: 'info', tap: 'brass'};
    el.innerHTML = C.length ? '<div class="rows">' + C.map((x, i) => '<div class="row click" data-i="' + i + '"><div class="wic" style="--t:' + (x.status === 'missed' ? 'var(--bad)' : T.calls) + ';width:34px;height:34px">' + ic('phone', 16) + '</div><div class="main"><b>' + esc(x.name || x.phone || 'Caller') + '</b><small>' + (x.status === 'tap' ? 'Tapped your number' + (x.page ? ' on ' + esc(x.page) : '') : (x.dir === 'outbound' ? 'Outgoing' : 'Incoming') + (x.dur ? ' · ' + LV.dur(x.dur) : '')) + '</small></div><div class="end"><span class="pill ' + (pill[x.status] || '') + '">' + esc(x.status === 'tap' ? 'Tap' : x.status) + '</span><div><small style="color:var(--ink-3)">' + esc(when(x.at)) + '</small></div></div></div>').join('') + '</div>' : empty('No calls in this period');
    el.querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => LV.openCall(C[Number(r.dataset.i)])));
  }});

/* ================= CONTACTS ================= */
W.contacts_list = mk({g: 'Contacts', t: 'New contacts', d: 'People added in the period.', ic: 'users', tint: T.contacts, c: 6, sk: 'list', ok: isGhl,
  draw(el, {d}) { const L = (d.contacts || []).slice(0, 30); el.innerHTML = L.length ? '<div class="rows">' + L.map(k => '<div class="row">' + LV.av(k.name) + '<div class="main"><b>' + esc(k.name || k.email || k.phone) + '</b><small>' + esc([k.email, k.phone, k.source].filter(Boolean).join(' · ')) + '</small></div><div class="end"><small>' + esc(when(k.at)) + '</small></div></div>').join('') + '</div>' : empty('No new contacts in this period'); }});
W.people = mk({g: 'Contacts', t: 'Contact list', d: 'Your full contact list. Search anyone by name, email or phone.', ic: 'users', tint: T.contacts, c: 12, sk: 'table',
  draw(el, {S}) {
    el.innerHTML = '<div class="toolbar"><label class="search">' + ic('search', 16) + '<input class="input" type="search" placeholder="Search contacts" data-q aria-label="Search contacts"></label><span data-n style="color:var(--ink-3);font-size:13px"></span></div><div style="overflow:auto" data-t>' + LV.skel('table') + '</div>';
    const t = el.querySelector('[data-t]'), n = el.querySelector('[data-n]');
    const run = async q => {
      const r = await LV.api('portalPeople', {session: S.session, domain: S.domain, q, limit: 50});
      if (r.error) { t.innerHTML = empty('Couldn’t load contacts', r.error); return; }
      n.textContent = fmt(r.total) + ' contacts';
      t.innerHTML = r.people.length ? '<table class="t"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th class="hide-sm">Source</th><th class="hide-sm">Tags</th><th>Added</th></tr></thead><tbody>' + r.people.map(p => '<tr><td><div style="display:flex;gap:10px;align-items:center">' + LV.av(p.name || p.email, 28) + '<b style="font-weight:600">' + esc(p.name || '—') + '</b></div></td><td>' + esc(p.email || '') + '</td><td>' + esc(p.phone || '') + '</td><td class="hide-sm">' + esc(p.source || '') + '</td><td class="hide-sm">' + (p.tags || []).slice(0, 3).map(x => '<span class="pill">' + esc(x) + '</span>').join(' ') + '</td><td>' + esc(LV.date(p.at)) + '</td></tr>').join('') + '</tbody></table>' : empty('No contacts match');
    };
    el.querySelector('[data-q]').addEventListener('input', LV.debounce(e => run(e.target.value), 350));
    run('');
  }});

/* ================= SALES ================= */
W.pipeline = mk({g: 'Sales', t: 'Pipeline by stage', d: 'Open deals in each stage, with their value.', ic: 'funnel', tint: T.opps, c: 6, sk: 'list', ok: isGhl,
  draw(el, {d}) {
    const open = (d.opps || []).filter(o => o.status === 'open'), out = [];
    (d.pipelines || []).forEach(p => p.stages.forEach(s => { const L = open.filter(o => o.stageId === s.id); if (L.length) out.push({k: s.name, v: L.reduce((a, o) => a + o.value, 0), sub: L.length + ' deal' + (L.length > 1 ? 's' : '') + ((d.pipelines.length > 1) ? ' · ' + p.name : '')}); }));
    el.innerHTML = LV.bars(out, {money: true, tint: T.opps, empty: 'No open deals.'});
  }});
W.opps_list = mk({g: 'Sales', t: 'Latest deals', d: 'New and updated deals, with value and status.', ic: 'money', tint: T.opps, c: 6, sk: 'list', ok: isGhl,
  draw(el, {d}) {
    const L = (d.opps || []).slice().sort((a, b) => (b.upd || b.at) - (a.upd || a.at)).slice(0, 15), pill = {won: 'ok', lost: 'bad', abandoned: 'warn', open: 'info'};
    el.innerHTML = L.length ? '<div class="rows">' + L.map(o => '<div class="row">' + LV.av(o.contact || o.name) + '<div class="main"><b>' + esc(o.name) + '</b><small>' + esc(o.stage) + ' · ' + esc(when(o.upd || o.at)) + '</small></div><div class="end"><b class="num">' + money(o.value) + '</b><div><span class="pill ' + (pill[o.status] || '') + '">' + esc(o.status) + '</span></div></div></div>').join('') + '</div>' : empty('No deals yet');
  }});
W.appts = mk({g: 'Sales', t: 'Appointments', d: 'Upcoming bookings, and the ones in the period.', ic: 'cal', tint: T.appts, c: 6, sk: 'list', ok: isGhl,
  draw(el, {d}) {
    const now = Date.now(), up = (d.appts || []).filter(a => a.start >= now).slice(0, 10), past = (d.appts || []).filter(a => a.start < now).slice(-6).reverse();
    const row = a => '<div class="row"><div style="flex:none;width:46px;text-align:center;border:1px solid var(--line);border-radius:10px;padding:3px 0"><small style="display:block;color:var(--bad);font-weight:700;font-size:10.5px">' + new Date(a.start).toLocaleDateString('en-CA', {month: 'short'}) + '</small><b class="num" style="font-size:17px;line-height:1">' + new Date(a.start).getDate() + '</b></div><div class="main"><b>' + esc(a.title) + '</b><small>' + new Date(a.start).toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'}) + (a.calendar ? ' · ' + esc(a.calendar) : '') + '</small></div><div class="end"><span class="pill ' + (/confirm|showed/.test(a.status) ? 'ok' : /cancel|noshow/.test(a.status) ? 'bad' : '') + '">' + esc(a.status) + '</span></div></div>';
    el.innerHTML = (up.length ? '<div class="sec" style="margin-top:0">Coming up</div><div class="rows">' + up.map(row).join('') + '</div>' : '') + (past.length ? '<div class="sec">Earlier in the period</div><div class="rows">' + past.map(row).join('') + '</div>' : '') || empty('No appointments', 'Bookings from your calendars appear here.');
  }});

/* ================= EMAIL ================= */
W.email = mk({g: 'Marketing', t: 'Email', d: 'Emails sent, replies, and the subjects that went out most.', ic: 'mail', tint: T.email, c: 12, sk: 'inbox', ok: isGhl,
  draw(el, {d}) {
    const E = d.emails || {sent: 0, replies: 0, list: [], campaigns: []};
    if (E.err) { el.innerHTML = empty('Email isn’t available', E.err); return; }
    el.innerHTML = '<div class="kpis" style="margin-bottom:16px">' + kpi('Emails sent', E.sent, null, T.email) + kpi('Replies', E.replies, null, T.forms) + kpi('Reply rate', LV.pct(E.replies, E.sent), null, T.calls, null, {raw: true}) + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px"><div><div class="sec" style="margin-top:0">Most-sent subjects</div>' + LV.bars((E.campaigns || []).map(c => ({k: c.subject, v: c.sent, sub: 'last ' + when(c.last)})).slice(0, 8), {tint: T.email, empty: 'No emails sent in this period.'}) + '</div>' +
      '<div><div class="sec" style="margin-top:0">Latest replies</div>' + (E.list.filter(m => m.dir !== 'outbound').slice(0, 8).map(m => '<div class="row">' + LV.av(m.name || m.email) + '<div class="main"><b>' + esc(m.name || m.email) + '</b><small>' + esc(m.subject || m.body) + '</small></div><div class="end"><small>' + esc(when(m.at)) + '</small></div></div>').join('') || empty('No replies yet')) + '</div></div>';
  }});

/* ================= WEBSITE (GA4) ================= */
const gaOk = c => !!c.ga;
W.web_kpis = mk({g: 'Website', t: 'Website at a glance', d: 'Visits, visitors and pages from Google Analytics, and how many visits became leads.', ic: 'globe', tint: T.web, c: 12, sk: 'kpis', ok: gaOk,
  draw(el, {d}) {
    if (!d.ga) { el.innerHTML = empty('Google Analytics didn’t answer', 'Try refreshing in a minute.'); return; }
    const n = d.ga.now, p = d.ga.prev, F = forms(d).length;
    el.innerHTML = '<div class="kpis">' + kpi('Visits', n.sessions || 0, p.sessions || 0, T.web, d.ga.days.map(x => x.s)) + kpi('Visitors', n.totalUsers || 0, p.totalUsers || 0, T.forms, d.ga.days.map(x => x.u)) + kpi('New visitors', n.newUsers || 0, p.newUsers || 0, T.contacts) + kpi('Page views', n.screenPageViews || 0, p.screenPageViews || 0, T.loc) + kpi('Visits that became leads', LV.pct(F, n.sessions || 0), null, T.opps, null, {raw: true, note: fmt(F) + ' leads'}) + '</div>';
  }});
W.web_trend = mk({g: 'Website', t: 'Visits and leads over time', d: 'Website visits day by day, with the leads they brought in.', ic: 'line', tint: T.web, c: 8, sk: 'chart', ok: gaOk,
  draw(el, {d}) { if (!d.ga) return el.innerHTML = empty('No data'); const R = d.range, V = d.ga.days, lab = series(R, []).labels, m = {}; V.forEach(x => { m[new Date(x.d).toISOString().slice(0, 10)] = x.s; });
    const vals = lab.map(t => { const k = new Date(t - new Date(t).getTimezoneOffset() * 6e4).toISOString().slice(0, 10); return m[k] || 0; });
    requestAnimationFrame(() => LV.lineChart(el, lab, [{name: 'Visits', vals, color: 'var(--s3)'}, {name: 'Leads', vals: series(R, forms(d)).vals, color: 'var(--s1)'}], {h: Math.max(200, (el.clientHeight || 300) - 40)})); }});
W.web_sources = mk({g: 'Website', t: 'Where visitors come from', d: 'Visits by channel.', ic: 'donut', tint: T.web, c: 4, sk: 'chart', ok: gaOk,
  draw(el, {d}) { el.innerHTML = d.ga ? LV.donut(d.ga.channels.slice(0, 7).map(x => ({k: x.k, v: x.v})), {unit: 'visits'}) : empty('No data'); }});
W.web_pages = mk({g: 'Website', t: 'Most visited pages', d: 'The pages people look at most.', ic: 'book', tint: T.web, c: 6, sk: 'list', ok: gaOk,
  draw(el, {d}) { el.innerHTML = d.ga ? LV.bars(d.ga.pages.slice(0, 12).map(x => ({k: x.k, v: x.v, sub: fmt(x.u) + ' people'})), {tint: T.web}) : empty('No data'); }});
W.web_cities = mk({g: 'Website', t: 'Where visitors are', d: 'Visitors by city.', ic: 'pin', tint: T.loc, c: 6, sk: 'list', ok: gaOk,
  draw(el, {d}) { el.innerHTML = d.ga ? LV.bars(d.ga.cities.slice(0, 12).map(x => ({k: x.k + (x.r ? ', ' + x.r : ''), v: x.v})), {tint: T.loc}) : empty('No data'); }});

/* ================= GOOGLE SEARCH ================= */
const gscOk = c => !!c.gsc;
const gscRows = (rows, cols) => '<div style="overflow:auto"><table class="t"><thead><tr><th>' + cols[0] + '</th><th class="n">Clicks</th><th class="n">Impressions</th><th class="n hide-sm">Click rate</th><th class="n">Position</th></tr></thead><tbody>' + rows.map(r => '<tr><td style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r.k) + '">' + esc(r.k) + '</td><td class="n">' + fmt(r.c) + '</td><td class="n">' + fmt(r.i) + '</td><td class="n hide-sm">' + (Math.round(r.ctr * 1000) / 10) + '%</td><td class="n">' + r.pos + '</td></tr>').join('') + '</tbody></table></div>';
W.sc_kpis = mk({g: 'Google Search', t: 'Google Search at a glance', d: 'Clicks, impressions, click rate and average position. Google reports two days late.', ic: 'search', tint: T.gsc, c: 12, sk: 'kpis', ok: gscOk,
  draw(el, {d}) { if (!d.gsc) return el.innerHTML = empty('Search Console didn’t answer', 'Try refreshing in a minute.'); const n = d.gsc.now, p = d.gsc.prev;
    el.innerHTML = '<div class="kpis">' + kpi('Clicks', n.clicks, p.clicks, T.gsc, d.gsc.days.map(x => x.c)) + kpi('Impressions', n.imp, p.imp, T.forms, d.gsc.days.map(x => x.i)) + kpi('Click rate', (Math.round(n.ctr * 1000) / 10) + '%', null, T.opps, null, {raw: true, note: 'was ' + (Math.round(p.ctr * 1000) / 10) + '%'}) + kpi('Average position', Math.round(n.pos * 10) / 10, null, T.contacts, null, {raw: true, note: 'was ' + (Math.round(p.pos * 10) / 10) + ' (lower is better)'}) + '</div>'; }});
W.sc_trend = mk({g: 'Google Search', t: 'Clicks from Google over time', d: 'Clicks and impressions, day by day.', ic: 'line', tint: T.gsc, c: 8, sk: 'chart', ok: gscOk,
  draw(el, {d}) { if (!d.gsc || !d.gsc.days.length) return el.innerHTML = empty('No data yet'); const D = d.gsc.days;
    requestAnimationFrame(() => LV.lineChart(el, D.map(x => x.d), [{name: 'Clicks', vals: D.map(x => x.c), color: 'var(--s3)'}], {h: Math.max(200, (el.clientHeight || 300) - 20)})); }});
W.sc_devices = mk({g: 'Google Search', t: 'Search clicks by device', d: 'Phone, computer or tablet.', ic: 'donut', tint: T.gsc, c: 4, sk: 'chart', ok: gscOk,
  draw(el, {d}) { const L = {MOBILE: 'Phone', DESKTOP: 'Computer', TABLET: 'Tablet'}; el.innerHTML = d.gsc ? LV.donut(d.gsc.devices.map(x => ({k: L[x.k] || x.k, v: x.c})), {unit: 'clicks'}) : empty('No data'); }});
W.sc_queries = mk({g: 'Google Search', t: 'What people search for', d: 'The searches your site showed up for.', ic: 'search', tint: T.gsc, c: 12, sk: 'table', ok: gscOk,
  draw(el, {d}) { el.innerHTML = d.gsc && d.gsc.queries.length ? gscRows(d.gsc.queries.slice(0, 50), ['Search']) : empty('No searches yet'); }});
W.sc_almost = mk({g: 'Google Search', t: 'Almost on page one', d: 'Searches where you sit just below the top ten: the quickest wins.', ic: 'target', tint: '#B7791F', c: 6, sk: 'list', ok: gscOk,
  draw(el, {d}) { const L = d.gsc ? d.gsc.queries.filter(q => q.pos > 10 && q.pos <= 20 && q.i >= 5).sort((a, b) => b.i - a.i).slice(0, 15) : [];
    el.innerHTML = L.length ? '<div class="rows">' + L.map(q => '<div class="row"><div class="main"><b>' + esc(q.k) + '</b><small>' + fmt(q.i) + ' impressions · ' + fmt(q.c) + ' clicks</small></div><div class="end"><span class="pill warn">#' + q.pos + '</span></div></div>').join('') + '</div>' : empty('Nothing close to page one yet'); }});
W.sc_pages = mk({g: 'Google Search', t: 'Pages Google sends people to', d: 'The pages with the most clicks from search.', ic: 'book', tint: T.gsc, c: 6, sk: 'list', ok: gscOk,
  draw(el, {d}) { el.innerHTML = d.gsc ? LV.bars(d.gsc.pages.slice(0, 12).map(x => ({k: x.k, v: x.c, sub: 'pos ' + x.pos})), {tint: T.gsc}) : empty('No data'); }});
W.sc_countries = mk({g: 'Google Search', t: 'Search clicks by country', d: 'Where searchers are.', ic: 'pin', tint: T.loc, c: 6, sk: 'list', ok: gscOk,
  draw(el, {d}) { el.innerHTML = d.gsc ? LV.bars(d.gsc.countries.slice(0, 10).map(x => ({k: String(x.k).toUpperCase(), v: x.c})), {tint: T.loc}) : empty('No data'); }});

/* ================= AI VISIBILITY ================= */
const aiOk = c => !!c.ai;
const aiCol = {ChatGPT: '#1F7A5A', Perplexity: '#3E7CB1', Gemini: '#8E5A9B', Copilot: '#5B8C85', Claude: '#C29B3F', DeepSeek: '#D1495B', Grok: '#6B7C3A', 'Meta AI': '#9C6B4E', 'Other AI': '#9AA5A0'};
W.ai_kpis = mk({g: 'AI visibility', t: 'AI visibility at a glance', d: 'Visits and leads from ChatGPT, Perplexity, Gemini, Copilot and Claude, and Google AI Overviews.', ic: 'spark', tint: T.ai, c: 12, sk: 'kpis', ok: aiOk,
  draw(el, {d}) { const A = d.ai || {}, O = A.overviews && A.overviews.latest;
    el.innerHTML = '<div class="kpis">' + kpi('Visits from AI assistants', A.visits || 0, null, T.ai, (A.days || []).map(x => x.v), {note: d.ga ? '' : 'Connect Google Analytics for visits'}) + kpi('Leads from AI assistants', (A.leads || []).length, null, T.forms) + kpi('Top assistant', (A.assistants && A.assistants[0] ? A.assistants[0].k : '—'), null, T.opps, null, {raw: true}) +
      (O ? kpi('AI Overviews that cite you', O.filter(x => x.cited).length + ' of ' + O.length, null, T.gsc, null, {raw: true, note: O.filter(x => x.shown).length + ' searches showed one'}) : '') + '</div>'; }});
W.ai_trend = mk({g: 'AI visibility', t: 'Visits from AI assistants over time', d: 'Day by day, with the leads they brought.', ic: 'line', tint: T.ai, c: 8, sk: 'chart', ok: aiOk,
  draw(el, {d}) { const R = d.range, lab = series(R, []).labels, m = {}; ((d.ai || {}).days || []).forEach(x => { m[new Date(x.d).toISOString().slice(0, 10)] = x.v; });
    const vals = lab.map(t => m[new Date(t - new Date(t).getTimezoneOffset() * 6e4).toISOString().slice(0, 10)] || 0);
    requestAnimationFrame(() => LV.lineChart(el, lab, [{name: 'AI visits', vals, color: 'var(--s4)'}, {name: 'AI leads', vals: series(R, (d.ai || {}).leads || []).vals, color: 'var(--s1)'}], {h: Math.max(200, (el.clientHeight || 300) - 40)})); }});
W.ai_assistants = mk({g: 'AI visibility', t: 'Which assistants send visitors', d: 'Visits by AI assistant.', ic: 'donut', tint: T.ai, c: 4, sk: 'chart', ok: aiOk,
  draw(el, {d}) { const A = (d.ai || {}).assistants || []; el.innerHTML = A.length ? LV.donut(A.map(x => ({k: x.k, v: x.v, color: aiCol[x.k]})), {unit: 'visits'}) : empty('No AI visits yet', 'They appear as soon as an assistant sends someone.'); }});
W.ai_overviews = mk({g: 'AI visibility', t: 'Google AI Overviews', d: 'For each tracked search: whether Google showed an AI Overview, and whether it cited or named you.', ic: 'search', tint: T.gsc, c: 12, sk: 'table', ok: aiOk,
  draw(el, {d}) { const O = (d.ai || {}).overviews;
    if (!O || !O.latest) { el.innerHTML = empty('Not tracking yet', 'Your Leadvault team can add searches to track in the console.'); return; }
    const y = b => b ? '<span class="pill ok">Yes</span>' : '<span class="pill">No</span>';
    el.innerHTML = '<p style="margin:0 0 10px;color:var(--ink-3);font-size:12.5px">Checked ' + esc(when(O.latest[0] && O.latest[0].at)) + '</p><div style="overflow:auto"><table class="t"><thead><tr><th>Search</th><th>AI Overview shown</th><th>Cites your site</th><th>Names you</th><th class="n">Google rank</th></tr></thead><tbody>' + O.latest.map(r => '<tr><td>' + esc(r.q) + '</td><td>' + y(r.shown) + '</td><td>' + y(r.cited) + '</td><td>' + y(r.named) + '</td><td class="n">' + (r.rank || '—') + '</td></tr>').join('') + '</tbody></table></div>'; }});
W.ai_pages = mk({g: 'AI visibility', t: 'Pages AI assistants send people to', d: 'Where visitors from AI land.', ic: 'book', tint: T.ai, c: 6, sk: 'list', ok: aiOk,
  draw(el, {d}) { el.innerHTML = LV.bars(((d.ai || {}).pages || []).slice(0, 10), {tint: T.ai, empty: 'No AI visits yet.'}); }});
W.ai_leads = mk({g: 'AI visibility', t: 'Leads from AI assistants', d: 'Form leads from people who came from an AI assistant.', ic: 'form', tint: T.ai, c: 6, sk: 'list', ok: aiOk,
  draw(el, {d}) { const L = ((d.ai || {}).leads || []).slice(0, 12); el.innerHTML = L.length ? '<div class="rows">' + L.map((f, i) => '<div class="row click" data-i="' + i + '">' + LV.av(f.name || f.email) + '<div class="main"><b>' + esc(f.name || f.email || 'Visitor') + '</b><small>' + esc(f.form + ' · ' + (f.source || f.ch)) + '</small></div><div class="end"><small>' + esc(when(f.at)) + '</small></div></div>').join('') + '</div>' : empty('No AI leads yet');
    el.querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => LV.openLead(L[Number(r.dataset.i)]))); }});

/* ================= TEXT ================= */
W.note = mk({g: 'Text', t: 'Heading and summary', d: 'A heading with a short plain-words summary.', ic: 'edit', tint: '#4A5852', c: 12, sk: 'list', draw() {}});

/* ================= DEFAULT LAYOUT ================= */
LV.defaultLayout = function (c, S) {
  const I = LV.item, H = 440;
  const L = {v: 1, auto: {}, dashes: [
    {id: 'd1', name: 'Overview', items: [I('note', 12, {title: 'Your business at a glance', text: 'The headline numbers for the period picked at the top, compared with the period before.'}), I('kpis'), I('trend', 8, {h: 400}), I('sources', 4, {h: 400}), I('locations', 6, {h: H}), I('forms_by', 6, {h: H})]},
    {id: 'd2', name: 'Leads', items: [I('note', 12, {title: 'Every lead in one place', text: 'Search, filter and open any lead. Mark what’s handled so your team doesn’t double up.'}), I('inbox'), I('pages', 6, {h: H}), I('calls_mix', 6, {h: H}), I('calls_list', 12, {h: 480})]}
  ]};
  if (c.source === 'ghl') {
    L.dashes.push({id: 'd3', name: 'Sales', items: [I('note', 12, {title: 'Your sales pipeline', text: 'Open deals by stage, the latest movement, and who’s booked.'}), I('pipeline', 6, {h: H}), I('appts', 6, {h: H}), I('opps_list', 6, {h: H}), I('contacts_list', 6, {h: H}), I('people')]});
    L.dashes.push({id: 'd4', name: 'Email', items: [I('note', 12, {title: 'Email', text: 'What went out, and who wrote back.'}), I('email')]});
  }
  const add = (auto, name, items) => { const d = {id: 'a_' + auto, name, auto, items}; L.dashes.push(d); L.auto[auto] = 1; };
  add('crm', 'Clients', [I('note', 12, {title: 'Your clients', text: 'Everyone who reached out, as cards. Move them through the stages, set a value, an owner and a follow-up date. Your whole team sees changes live.'}), I('crm_kpis'), I('crm_board'), I('crm_follow'), I('crm_clients')]);
  if (c.desk && S.me && S.me.user.write >= 1) add('desk', 'Sales desk', [I('note', 12, {title: 'Your sales desk', text: 'Work your CRM from here: move deals, answer messages, tick off tasks and manage today’s bookings. Every change happens in your CRM right away.'}), I('ghl_pipe'), I('ghl_deals'), I('ghl_tasks', 6, {h: 480}), I('ghl_appts', 6, {h: 480}), I('ghl_convs'), I('ghl_contacts')].concat(S.me.user.write >= 2 ? [I('ghl_camp')] : []));
  if (c.ga) add('web', 'Website', [I('note', 12, {title: 'Your website', text: 'Visits, visitors and pages from Google Analytics, and how many visits turned into leads.'}), I('web_kpis'), I('web_trend', 8, {h: 400}), I('web_sources', 4, {h: 400}), I('web_pages', 6, {h: H}), I('web_cities', 6, {h: H})]);
  if (c.gsc) add('gsc', 'Google Search', [I('note', 12, {title: 'How you show up on Google', text: 'Clicks, impressions and positions from Search Console. Google reports these two to three days late.'}), I('sc_kpis'), I('sc_trend', 8, {h: 400}), I('sc_devices', 4, {h: 400}), I('sc_queries', 12, {h: 520}), I('sc_almost', 6, {h: H}), I('sc_pages', 6, {h: H})]);
  if (c.ai) add('ai', 'AI visibility', [I('note', 12, {title: 'How AI assistants see you', text: 'People who found you through ChatGPT, Perplexity, Gemini, Copilot or Claude, and whether Google’s AI Overviews mention you.'}), I('ai_kpis'), I('ai_trend', 8, {h: 400}), I('ai_assistants', 4, {h: 400}), I('ai_overviews'), I('ai_pages', 6, {h: H}), I('ai_leads', 6, {h: H})]);
  return L;
};
})();
