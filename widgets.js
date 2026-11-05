/* ==========================================================================
   LEADVAULT WIDGETS: overview, leads, calls, contacts, sales, email,
   website (GA4), Google Search (Search Console), AI visibility.
   Each widget: {g group, t title, d description, ic icon, tint, c width, sk skeleton, ok(client,S), draw(el, ctx)}
   ========================================================================== */
(function () {
'use strict';
const {esc, ic, fmt, money, when} = LV;
const W = LV.W = LV.W || {};
const T = {keys: '#B7791F', wa: '#25A366', forms: '#1F7A5A', calls: '#3E7CB1', contacts: '#8E5A9B', appts: '#B7791F', opps: '#C29B3F', loc: '#5B8C85', web: '#3E7CB1', gsc: '#2F6DB5', ai: '#8E5A9B', email: '#D1495B'};
const isGhl = c => c.source === 'ghl';
const empty = (b, t) => '<div class="empty"><b>' + esc(b) + '</b>' + esc(t || '') + '</div>';

/* ---------- data helpers ---------- */
const forms = d => { const seen = new Set(); return (d.forms || []).concat(d.siteForms || []).filter(f => { const k = (f.email || f.phone || f.id) + '|' + Math.round(f.at / 6e4); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.at - a.at); };
LV.forms = forms;
/* key events: phone taps and WhatsApp clicks from the website snippet */
const keysOf = (d, c) => (c && isGhl(c) ? (d.siteTaps || []) : (d.calls || []).filter(x => x.status === 'tap'));
const isWa = x => x.kind === 'whatsapp';
LV.keysOf = keysOf;
const days = R => { const out = []; for (let t = new Date(R.from).setHours(0, 0, 0, 0); t <= R.to; t += 864e5) out.push(t); return out; };
const series = (R, list, f) => { const ds = days(R), idx = {}; ds.forEach((t, i) => { idx[new Date(t).toDateString()] = i; }); const v = ds.map(() => 0); list.forEach(x => { const i = idx[new Date(f ? f(x) : x.at).toDateString()]; if (i != null) v[i] += (x.__w || 1); }); return {labels: ds, vals: v}; };
const count = (list, f, n) => { const m = {}; list.forEach(x => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(k => ({k, v: m[k]})).sort((a, b) => b.v - a.v).slice(0, n || 10); };
const chColor = {'Organic search': 'var(--s1)', 'Paid search': 'var(--s2)', 'Direct': 'var(--s6)', 'Social': 'var(--s4)', 'Referral': 'var(--s3)', 'Email': 'var(--s5)', 'AI assistant': 'var(--s8)', 'Campaign': 'var(--s7)', 'Imported': '#9AA5A0'};
const kpi = (label, val, prev, tint, spark, opts) => '<div class="kpi" style="--t:' + tint + '"><div class="lab"><i></i>' + esc(label) + '</div><span class="big"' + (opts && opts.raw ? (/^[\d.,]+%?$/.test(String(val)) ? ' data-n="' + parseFloat(String(val).replace(/,/g, '')) + '"' : '') : ' data-n="' + (Number(val) || 0) + '"') + '>' + (opts && opts.money ? money(val) : opts && opts.raw ? val : fmt(val)) + '</span>' + (prev === null || prev === undefined ? '<span class="delta">' + esc((opts && opts.note) || '') + '</span>' : LV.delta(Number(val) || 0, prev, opts && opts.invert)) + (spark ? LV.spark(spark, tint) : '') + '</div>';
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
    '<div class="kv"><span>Type</span><b>' + (x.status === 'tap' ? (isWa(x) ? 'Opened a WhatsApp chat from your website' : 'Tapped the phone number on your website') : (x.dir === 'outbound' ? 'Outgoing call' : 'Incoming call')) + '</b>' +
    (x.status && x.status !== 'tap' ? '<span>Result</span><b>' + esc(x.status) + '</b>' : '') + (x.dur ? '<span>Length</span><b>' + LV.dur(x.dur) + '</b>' : '') +
    (x.phone ? '<span>Number</span><b>' + esc(x.phone) + '</b>' : '') + (x.page ? '<span>Page</span><b>' + esc(x.page) + '</b>' : '') + (x.ch ? '<span>Came from</span><b>' + esc(x.ch) + '</b>' : '') + '</div>');
};

/* ================= OVERVIEW ================= */
W.kpis = mk({g: 'Overview', t: 'At a glance', d: 'Leads, calls, contacts, bookings and pipeline.', ic: 'bolt', tint: T.forms, c: 12, sk: 'kpis',
  draw(el, {d, client}) {
    const R = d.range, P = d.prev || {}, F = forms(d), C = d.calls || [];
    const K = keysOf(d, client), kw = K.filter(isWa).length;
    let h = kpi('Form leads', F.length, P.forms != null ? P.forms : null, T.forms, series(R, F).vals);
    if (isGhl(client)) { h += kpi('Calls', C.length, P.calls != null ? P.calls : null, T.calls, series(R, C).vals); if (K.length) h += kpi('Key events', K.length, null, T.keys, series(R, K).vals, {note: (K.length - kw) + ' phone · ' + kw + ' WhatsApp'}); }
    else h += kpi('Key events', K.length, P.calls != null ? P.calls : null, T.keys, series(R, K).vals) + kpi('Phone taps', K.length - kw, null, T.calls, null, {note: 'tapped your number'}) + kpi('WhatsApp clicks', kw, null, T.wa, null, {note: 'opened a chat'});
    if (isGhl(client)) {
      h += kpi('New contacts', d.contactsTotal || (d.contacts || []).length, P.contacts, T.contacts, series(R, d.contacts || []).vals);
      h += kpi('Appointments', (d.appts || []).filter(a => a.start <= R.to).length, P.appts, T.appts);
      const newOpps = (d.opps || []).filter(o => o.at >= R.from);
      h += kpi('New pipeline', newOpps.reduce((s, o) => s + o.value, 0), P.oppValue, T.opps, null, {money: true});
    }
    if (d.ga) h += kpi('Website visits', d.ga.now.sessions || 0, d.ga.prev.sessions || 0, T.web, d.ga.days.map(x => x.s));
    if (d.gsc) h += kpi('Clicks from Google', d.gsc.now.clicks || 0, d.gsc.prev.clicks || 0, T.gsc, d.gsc.days.map(x => x.c));
    el.innerHTML = '<div class="kpis">' + h + '</div>';
  }});
W.trend = mk({g: 'Overview', t: 'Leads over time', d: 'Form leads, calls, key events and new contacts, day by day.', ic: 'line', tint: T.forms, c: 8, sk: 'chart',
  draw(el, {d, client}) {
    const R = d.range, F = series(R, forms(d)), s = [{name: 'Form leads', vals: F.vals, color: 'var(--s1)'}];
    if (isGhl(client)) s.push({name: 'Calls', vals: series(R, d.calls || []).vals, color: 'var(--s3)'});
    const K = keysOf(d, client); if (K.length || !isGhl(client)) s.push({name: 'Key events', vals: series(R, K).vals, color: 'var(--s2)'});
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
    el.innerHTML = C.length ? '<div class="rows">' + C.map((x, i) => '<div class="row click" data-i="' + i + '"><div class="wic" style="--t:' + (x.status === 'missed' ? 'var(--bad)' : isWa(x) ? T.wa : T.calls) + ';width:34px;height:34px">' + ic(isWa(x) ? 'wa' : 'phone', 16) + '</div><div class="main"><b>' + esc(x.name || x.phone || (isWa(x) ? 'WhatsApp chat' : 'Caller')) + '</b><small>' + (x.status === 'tap' ? (isWa(x) ? 'Opened WhatsApp' : 'Tapped your number') + (x.page ? ' on ' + esc(x.page) : '') : (x.dir === 'outbound' ? 'Outgoing' : 'Incoming') + (x.dur ? ' · ' + LV.dur(x.dur) : '')) + '</small></div><div class="end"><span class="pill ' + (pill[x.status] || '') + '">' + esc(x.status === 'tap' ? (isWa(x) ? 'WhatsApp' : 'Phone tap') : x.status) + '</span><div><small style="color:var(--ink-3)">' + esc(when(x.at)) + '</small></div></div></div>').join('') + '</div>' : empty('No calls in this period');
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

/* ================= KEY EVENTS (phone taps + WhatsApp clicks) ================= */
W.keyevents = mk({g: 'Key events', t: 'Key events', d: 'Phone taps and WhatsApp clicks from your website, day by day.', ic: 'bolt', tint: T.keys, c: 8, sk: 'chart', rh: 10,
  draw(el, {d, client}) {
    const R = d.range, K = keysOf(d, client), P = d.prev || {}, ph = K.filter(x => !isWa(x)), wa = K.filter(isWa);
    el.innerHTML = '<div class="kpis" style="margin-bottom:14px">' + kpi('Key events', K.length, !isGhl(client) && P.calls != null ? P.calls : null, T.keys) + kpi('Phone taps', ph.length, null, T.calls, null, {note: 'tapped your number'}) + kpi('WhatsApp clicks', wa.length, null, T.wa, null, {note: 'opened a chat'}) + '</div><div data-ch></div>';
    const box = el.querySelector('[data-ch]'), S1 = series(R, ph), S2 = series(R, wa);
    requestAnimationFrame(() => LV.lineChart(box, S1.labels, [{name: 'Phone taps', vals: S1.vals, color: T.calls}, {name: 'WhatsApp clicks', vals: S2.vals, color: T.wa}], {h: Math.max(150, (el.clientHeight || 360) - 170), label: 'Key events'}));
  }});
W.keyevents_list = mk({g: 'Key events', t: 'Latest key events', d: 'Every phone tap and WhatsApp click, newest first.', ic: 'phone', tint: T.keys, c: 4, sk: 'list',
  draw(el, {d, client}) {
    const K = keysOf(d, client).slice().sort((a, b) => b.at - a.at).slice(0, 40);
    el.innerHTML = K.length ? '<div class="rows">' + K.map((x, i) => '<div class="row click" data-i="' + i + '"><div class="wic" style="--t:' + (isWa(x) ? T.wa : T.calls) + ';width:34px;height:34px">' + ic(isWa(x) ? 'wa' : 'phone', 16) + '</div><div class="main"><b>' + (isWa(x) ? 'WhatsApp click' : 'Phone tap') + '</b><small>' + esc((x.page || '/') + ' · ' + (x.ch || 'Direct')) + '</small></div><div class="end"><small>' + esc(when(x.at)) + '</small></div></div>').join('') + '</div>' : empty('No key events yet', 'Phone taps and WhatsApp clicks show up here the moment they happen.');
    el.querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => LV.openCall(K[Number(r.dataset.i)])));
  }});
W.keyevents_pages = mk({g: 'Key events', t: 'Pages that drive key events', d: 'Where visitors were when they tapped to call or opened WhatsApp.', ic: 'book', tint: T.keys, c: 6, sk: 'list',
  draw(el, {d, client}) { el.innerHTML = LV.bars(count(keysOf(d, client), x => x.page || '/', 10), {tint: T.keys, empty: 'Pages show up after the first key event.'}); }});
W.keyevents_mix = mk({g: 'Key events', t: 'Phone vs WhatsApp', d: 'How visitors prefer to reach you.', ic: 'donut', tint: T.wa, c: 4, sk: 'chart',
  draw(el, {d, client}) { const K = keysOf(d, client), w = K.filter(isWa).length; el.innerHTML = LV.donut([{k: 'Phone taps', v: K.length - w, color: T.calls}, {k: 'WhatsApp clicks', v: w, color: T.wa}].filter(x => x.v), {unit: 'key events'}); }});
W.keyevents_sources = mk({g: 'Key events', t: 'Where key events come from', d: 'The channel visitors arrived through before reaching out.', ic: 'donut', tint: T.keys, c: 4, sk: 'chart',
  draw(el, {d, client}) { el.innerHTML = LV.donut(count(keysOf(d, client), x => x.ch || 'Direct', 7).map(x => ({k: x.k, v: x.v, color: chColor[x.k]})), {unit: 'key events'}); }});

/* ================= MORE GA4 ================= */
const gaNeed = (el, d, k) => { if (!d.ga) { el.innerHTML = empty('Google Analytics didn’t answer', 'Try refreshing in a minute.'); return true; } if (k && !(d.ga[k] || []).length) { el.innerHTML = empty('Nothing yet', 'Google Analytics has no data for this view in the period.'); return true; } return false; };
const pctS = v => (Math.round((Number(v) || 0) * 1000) / 10) + '%';
const gaDays = (d, R, f) => { const m = {}; (d.ga.days2 || []).forEach(x => { m[new Date(x.d).toISOString().slice(0, 10)] = f(x); }); return series(R, []).labels.map(t => m[new Date(t - new Date(t).getTimezoneOffset() * 6e4).toISOString().slice(0, 10)] || 0); };
W.web_engagement = mk({g: 'Website', t: 'Engagement at a glance', d: 'How engaged visitors are: engaged visits, engagement rate, time on site and bounce rate.', ic: 'target', tint: T.web, c: 12, sk: 'kpis', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d)) return; const n = d.ga.now, p = d.ga.prev;
    el.innerHTML = '<div class="kpis">' + kpi('Engaged visits', n.engagedSessions || 0, p.engagedSessions || 0, T.web) + kpi('Engagement rate', pctS(n.engagementRate), null, T.forms, null, {raw: true, note: 'was ' + pctS(p.engagementRate)}) + kpi('Average time on site', LV.dur(Math.round(n.averageSessionDuration || 0)), null, T.contacts, null, {raw: true, note: 'was ' + LV.dur(Math.round(p.averageSessionDuration || 0))}) + kpi('Bounce rate', pctS(n.bounceRate), null, T.email, null, {raw: true, note: 'was ' + pctS(p.bounceRate) + ' (lower is better)'}) + kpi('Key events (GA4)', n.keyEvents || 0, p.keyEvents || 0, T.keys) + '</div>'; }});
W.web_engaged_trend = mk({g: 'Website', t: 'Engaged visits and key events over time', d: 'Day by day, from Google Analytics.', ic: 'line', tint: T.web, c: 8, sk: 'chart', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'days2')) return; const R = d.range, lab = series(R, []).labels;
    requestAnimationFrame(() => LV.lineChart(el, lab, [{name: 'Engaged visits', vals: gaDays(d, R, x => x.es), color: 'var(--s3)'}, {name: 'Key events', vals: gaDays(d, R, x => x.ke), color: 'var(--s2)'}, {name: 'New visitors', vals: gaDays(d, R, x => x.nu), color: 'var(--s4)', dash: true}], {h: Math.max(200, (el.clientHeight || 300) - 40)})); }});
W.web_devices = mk({g: 'Website', t: 'Visits by device', d: 'Phone, computer or tablet.', ic: 'device', tint: T.web, c: 4, sk: 'chart', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'devices')) return; const L = {mobile: 'Phone', desktop: 'Computer', tablet: 'Tablet', smarttv: 'TV'}; el.innerHTML = LV.donut(d.ga.devices.map(x => ({k: L[x.k] || x.k, v: x.v})), {unit: 'visits'}); }});
W.web_newret = mk({g: 'Website', t: 'New vs returning visitors', d: 'First-timers and people who came back.', ic: 'users', tint: T.contacts, c: 4, sk: 'chart', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'newret')) return; el.innerHTML = LV.donut(d.ga.newret.map(x => ({k: x.k === 'new' ? 'New' : x.k === 'returning' ? 'Returning' : x.k, v: x.v, color: x.k === 'new' ? 'var(--s1)' : 'var(--s2)'})), {unit: 'visitors'}); }});
W.web_countries = mk({g: 'Website', t: 'Visitors by country', d: 'Where your visitors are in the world.', ic: 'globe', tint: T.loc, c: 4, sk: 'list', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'countries')) return; el.innerHTML = LV.bars(d.ga.countries.slice(0, 12).map(x => ({k: x.k, v: x.v, sub: fmt(x.s) + ' visits'})), {tint: T.loc}); }});
W.web_landing = mk({g: 'Website', t: 'Landing pages', d: 'The first page of each visit, with engagement and key events.', ic: 'table', tint: T.web, c: 8, sk: 'table', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'landing')) return;
    el.innerHTML = LV.table([{h: 'Landing page', f: r => esc(r.k)}, {h: 'Visits', n: 1, f: r => fmt(r.s)}, {h: 'Engaged', n: 1, f: r => pctS(r.er)}, {h: 'Key events', n: 1, f: r => fmt(r.ke)}, {h: 'Avg time', n: 1, f: r => LV.dur(Math.round(r.t || 0))}], d.ga.landing.slice(0, 25)); }});
W.web_channels = mk({g: 'Website', t: 'Channel performance', d: 'Each channel’s visits, visitors, engagement and key events.', ic: 'table', tint: T.web, c: 8, sk: 'table', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'chanTable')) return;
    el.innerHTML = LV.table([{h: 'Channel', f: r => '<span style="display:inline-flex;gap:8px;align-items:center"><i style="width:9px;height:9px;border-radius:3px;background:' + (chColor[r.k] || 'var(--s6)') + '"></i>' + esc(r.k) + '</span>'}, {h: 'Visits', n: 1, f: r => fmt(r.s)}, {h: 'Visitors', n: 1, f: r => fmt(r.u)}, {h: 'Engaged', n: 1, f: r => LV.pct(r.es, r.s)}, {h: 'Key events', n: 1, f: r => fmt(r.ke)}, {h: 'Avg time', n: 1, f: r => LV.dur(Math.round(r.t || 0))}], d.ga.chanTable); }});
W.web_srcmed = mk({g: 'Website', t: 'Source and medium', d: 'Exactly where visits came from, like google / organic.', ic: 'table', tint: T.web, c: 6, sk: 'table', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'srcMed')) return; el.innerHTML = LV.table([{h: 'Source / medium', f: r => esc(r.k)}, {h: 'Visits', n: 1, f: r => fmt(r.s)}, {h: 'Visitors', n: 1, f: r => fmt(r.u)}, {h: 'Key events', n: 1, f: r => fmt(r.ke)}], d.ga.srcMed); }});
W.web_events = mk({g: 'Website', t: 'Events', d: 'Everything visitors did that Google Analytics recorded, and which count as key events.', ic: 'bolt', tint: T.keys, c: 6, sk: 'table', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'events')) return; el.innerHTML = LV.table([{h: 'Event', f: r => esc(r.k) + (r.ke ? ' <span class="pill brass">key event</span>' : '')}, {h: 'Count', n: 1, f: r => fmt(r.v)}, {h: 'Visitors', n: 1, f: r => fmt(r.u)}, {h: 'Key events', n: 1, f: r => fmt(r.ke)}], d.ga.events); }});
W.web_keyevents = mk({g: 'Website', t: 'GA4 key events', d: 'The actions marked as key events in Google Analytics, by name.', ic: 'star', tint: T.keys, c: 6, sk: 'list', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d)) return; el.innerHTML = LV.bars((d.ga.events || []).filter(x => x.ke > 0).map(x => ({k: x.k, v: x.ke, sub: fmt(x.u) + ' people'})), {tint: T.keys, empty: 'No key events marked in Google Analytics yet.'}); }});
W.web_heat = mk({g: 'Website', t: 'When visitors come', d: 'Visits by day of the week and hour of the day.', ic: 'heat', tint: T.web, c: 12, sk: 'chart', ok: gaOk,
  draw(el, {d}) { if (gaNeed(el, d, 'heat')) return; const m = {}; d.ga.heat.forEach(x => { m[x.d + ':' + x.h] = (m[x.d + ':' + x.h] || 0) + x.v; });
    const days = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]], hrs = Array.from({length: 24}, (_, h) => (h % 12 || 12) + (h < 12 ? 'a' : 'p'));
    el.innerHTML = LV.heat(days.map(x => x[0]), hrs, (i, j) => m[days[i][1] + ':' + j] || 0, {every: 3}); }});

/* ================= THE STORY: plain-words summaries that follow the data ================= */
const PL = {'7': 'the last 7 days', '30': 'the last 30 days', '90': 'the last 90 days', '180': 'the last 6 months', '365': 'the last 12 months', all: 'all time', month: 'this month', lastmonth: 'last month'};
const pl = (n, one, many) => fmt(n) + ' ' + (n === 1 ? one : (many || one + 's'));
const chg = (now, prev) => {
  if (prev == null) return '';
  if (!prev && !now) return '';
  if (!prev) return ', up from none the period before';
  const p = Math.round((now - prev) / prev * 100);
  if (p === 0) return ', the same as the period before';
  return ', <span class="' + (p > 0 ? 'up' : 'down') + '">' + (p > 0 ? 'up ' : 'down ') + Math.abs(p) + '%</span> on the period before (' + fmt(prev) + ')';
};
const topOf = (list, f) => { const c = count(list, f, 1); return c[0] || null; };
const story = {
  leads(d, c, S) {
    const F = forms(d), P = d.prev || {}, per = PL[S.period] || 'this period';
    if (!F.length) return 'No form leads came in during ' + per + (P.forms ? ', compared with ' + pl(P.forms, 'lead') + ' the period before' : '') + '.';
    let t = 'In ' + per + ', ' + esc(c.name || 'the business') + ' received <b>' + pl(F.length, 'form lead') + '</b>' + chg(F.length, P.forms) + '.';
    const src = topOf(F, f => f.ch), fm = topOf(F, f => f.form), pg = topOf(F.filter(f => f.page), f => f.page);
    if (src) t += ' Most came through <span class="hl">' + esc(src.k) + '</span> (' + fmt(src.v) + ')' + (fm && count(F, f => f.form, 3).length > 1 ? ', and the busiest form was <b>' + esc(fm.k) + '</b>' : '') + '.';
    if (pg && pg.v > 1) t += ' The page that turned the most visitors into leads was <b>' + esc(pg.k) + '</b>.';
    const byDay = count(F, f => new Date(f.at).toDateString(), 1)[0];
    if (byDay && byDay.v > 1) t += ' Your busiest day was <b>' + new Date(byDay.k).toLocaleDateString('en-CA', {weekday: 'long', month: 'short', day: 'numeric'}) + '</b> with ' + pl(byDay.v, 'lead') + '.';
    return t;
  },
  keys(d, c) {
    const K = keysOf(d, c), w = K.filter(isWa).length, ph = K.length - w;
    let t = '';
    if (isGhl(c) && (d.calls || []).length) { const C = d.calls, miss = C.filter(x => x.status === 'missed').length, ans = C.filter(x => x.status === 'answered').length; t += 'Your CRM logged <b>' + pl(C.length, 'call') + '</b>: ' + fmt(ans) + ' answered' + (miss ? ' and <span class="down">' + fmt(miss) + ' missed</span>' : '') + '. '; }
    if (!K.length) return t + (t ? '' : 'No one tapped your phone number or opened WhatsApp from the website yet. ') + 'Key events appear here the moment a visitor reaches out.';
    t += 'Visitors tapped your phone number <b>' + pl(ph, 'time') + '</b> and opened WhatsApp <b>' + pl(w, 'time') + '</b>: <span class="hl">' + pl(K.length, 'key event') + '</span> in total' + (!isGhl(c) ? chg(K.length, (d.prev || {}).calls) : '') + '.';
    const pg = topOf(K, x => x.page);
    if (pg) t += ' Most started on <b>' + esc(pg.k) + '</b>.';
    if (w && ph) t += w > ph ? ' WhatsApp is the favourite way to get in touch.' : ' The phone is still the favourite way to get in touch.';
    return t;
  },
  web(d) {
    if (!d.ga) return '';
    const n = d.ga.now, p = d.ga.prev, F = forms(d).length, ch = (d.ga.channels || [])[0];
    let t = 'The website had <b>' + pl(n.sessions || 0, 'visit') + '</b> from <b>' + pl(n.totalUsers || 0, 'person', 'people') + '</b>' + chg(n.sessions || 0, p.sessions) + '.';
    if (n.engagementRate) t += ' <b>' + pctS(n.engagementRate) + '</b> of visits were engaged, and visitors stayed <b>' + LV.dur(Math.round(n.averageSessionDuration || 0)) + '</b> on average.';
    if (ch) t += ' <span class="hl">' + esc(ch.k) + '</span> brought the most visits (' + fmt(ch.v) + ').';
    if (n.sessions) t += ' ' + LV.pct(F, n.sessions) + ' of visits turned into a form lead.';
    const dv = d.ga.devices || [], dev = dv[0], dt = dv.reduce((a, x) => a + x.v, 0); if (dev && dt) t += ' ' + Math.round(dev.v / dt * 100) + '% of visits came from a ' + ({mobile: 'phone', desktop: 'computer', tablet: 'tablet'}[dev.k] || dev.k) + '.';
    return t;
  },
  search(d) {
    if (!d.gsc) return '';
    const n = d.gsc.now, p = d.gsc.prev, q = (d.gsc.queries || []).slice().sort((a, b) => b.c - a.c)[0];
    let t = 'On Google, you appeared <b>' + pl(n.imp || 0, 'time') + '</b> and earned <b>' + pl(n.clicks || 0, 'click') + '</b>' + chg(n.clicks || 0, p.clicks) + ', at an average position of <b>' + (Math.round((n.pos || 0) * 10) / 10) + '</b>.';
    if (q && q.c) t += ' The search that brought the most clicks was <span class="hl">“' + esc(q.k) + '”</span>.';
    const near = (d.gsc.queries || []).filter(x => x.pos > 10 && x.pos <= 20 && x.i >= 5).length;
    if (near) t += ' ' + pl(near, 'search is', 'searches are') + ' just below page one.';
    return t;
  },
  ai(d) {
    const A = d.ai || {}; if (!A.visits && !(A.leads || []).length) return '';
    return 'AI assistants sent <b>' + pl(A.visits || 0, 'visit') + '</b>' + (A.assistants && A.assistants[0] ? ', mostly from <span class="hl">' + esc(A.assistants[0].k) + '</span>' : '') + ((A.leads || []).length ? ', and ' + pl(A.leads.length, 'of those visitors', 'of those visitors') + ' sent a form' : '') + '.';
  },
  todo(d, c, S) {
    const F = forms(d), P = d.prev || {}, out = [], marks = S.marks || {};
    const open = F.filter(f => !/done|spam/.test((marks[f.id] || {}).m || '')).length;
    if (open) out.push(['inbox', '<b>' + pl(open, 'lead') + '</b> ' + (open === 1 ? 'isn’t' : 'aren’t') + ' marked handled yet. Open the Lead inbox to follow up while they’re warm.']);
    if (P.forms && F.length < P.forms * .8) out.push(['flag', 'Leads are down <b>' + Math.round((1 - F.length / P.forms) * 100) + '%</b>. Check that your forms and phone links still work, and which channel dropped.']);
    if (isGhl(c)) { const miss = (d.calls || []).filter(x => x.status === 'missed').length; if (miss) out.push(['phone', '<b>' + pl(miss, 'call was', 'calls were') + ' missed</b>. A quick call back today can win them back.']); }
    const K = keysOf(d, c); if (K.length > F.length * 2 && K.length > 3) out.push(['bolt', 'People reach out by phone and WhatsApp far more than by form. Make sure your number is easy to tap on every page.']);
    if (d.gsc) { const q = (d.gsc.queries || []).filter(x => x.pos > 10 && x.pos <= 20 && x.i >= 5).sort((a, b) => b.i - a.i)[0]; if (q) out.push(['target', '<b>“' + esc(q.k) + '”</b> sits at position ' + q.pos + ' with ' + fmt(q.i) + ' impressions. A stronger page for it could reach page one.']); }
    if (d.ga) { const lp = (d.ga.landing || []).filter(x => x.s >= 20 && x.er < .4).sort((a, b) => b.s - a.s)[0]; if (lp) out.push(['book', 'Visitors leave <b>' + esc(lp.k) + '</b> quickly (only ' + pctS(lp.er) + ' engaged). It gets ' + fmt(lp.s) + ' visits, so it’s worth improving.']); }
    if (!c.ga) out.push(['globe', 'Connect <b>Google Analytics</b> to see visits, engagement and which pages turn visitors into leads.']);
    if (!c.gsc) out.push(['search', 'Connect <b>Search Console</b> to see the Google searches you show up for.']);
    return out.slice(0, 5);
  }
};
LV.story = story;
W.story = mk({g: 'Overview', t: 'In brief', d: 'A plain-words summary of the period that rewrites itself as the numbers change.', ic: 'wand', tint: T.opps, c: 12, sk: 'list', rh: 10,
  draw(el, {d, client, S}) {
    const parts = ['leads', 'keys', 'web', 'search', 'ai'].map(k => story[k](d, client, S)).filter(Boolean), todo = story.todo(d, client, S);
    el.innerHTML = '<div class="story"><div class="sl">' + parts.map(p => '<p>' + p + '</p>').join('') + '</div><div class="sx"><h4>What to do next</h4>' + (todo.length ? '<ul>' + todo.map(x => '<li>' + ic(x[0], 16) + '<span>' + x[1] + '</span></li>').join('') + '</ul>' : '<p>Everything looks on track. Keep an eye on the inbox.</p>') + '</div></div>';
  }});
const insight = (key, title, icn, tint, okf) => mk({g: 'Text', t: title, d: 'A section heading with a summary that follows the data.', ic: icn, tint, c: 12, sk: 'list', rh: 3, insight: 1, ok: okf,
  draw(el, {d, client, S}) {
    const sec = el.closest('.w'); if (sec) sec.classList.add('note');
    const h = sec && sec.querySelector('.wh'); if (h) h.style.display = 'none';
    el.innerHTML = '<div class="insight"><div class="ib" style="--t:' + tint + '">' + ic(icn, 20) + '</div><div><h2>' + esc(title) + '</h2><p>' + (story[key](d, client, S) || 'Nothing to report yet.') + '</p></div></div>';
  }});
W.ins_leads = insight('leads', 'Leads', 'inbox', T.forms);
W.ins_keys = insight('keys', 'Calls and key events', 'bolt', T.keys);
W.ins_web = insight('web', 'Your website', 'globe', T.web, gaOk);
W.ins_search = insight('search', 'Google Search', 'search', T.gsc, c => !!c.gsc);
W.ins_ai = insight('ai', 'AI visibility', 'spark', T.ai, c => !!c.ai);

/* ================= TEXT ================= */
W.note = mk({g: 'Text', t: 'Heading and summary', d: 'A heading with a short plain-words summary.', ic: 'edit', tint: '#4A5852', c: 12, sk: 'list', draw() {}});

/* ================= DEFAULT LAYOUT ================= */
/* ================= THE STANDARD DASHBOARD =================
   Every business gets the same full Overview: the story, the headline numbers, then one section
   per source (leads, key events, website, Google, AI), each opened by a summary that follows the data.
   Sections for sources that aren't connected simply don't show. */
LV.defaultLayout = function (c, S) {
  const I = (t, gw, gh, x) => Object.assign(LV.item(t, gw), {gh}, x || {});
  const over = [
    I('story', 12, 10), I('kpis', 12, 6),
    I('trend', 8, 9), I('sources', 4, 9),
    I('ins_leads', 12, 3), I('forms_list', 6, 9), I('pages', 6, 9),
    I('ins_keys', 12, 3), I('keyevents', 8, 10), I('keyevents_mix', 4, 10)
  ];
  if (c.source === 'ghl') over.push(I('calls_mix', 4, 9), I('calls_list', 8, 9));
  over.push(I('ins_web', 12, 3), I('web_kpis', 12, 6), I('web_trend', 8, 9), I('web_sources', 4, 9), I('web_landing', 8, 10), I('web_devices', 4, 10));
  over.push(I('ins_search', 12, 3), I('sc_kpis', 12, 6), I('sc_trend', 8, 9), I('sc_devices', 4, 9), I('sc_queries', 12, 11));
  over.push(I('ins_ai', 12, 3), I('ai_kpis', 12, 6));
  const L = {v: 2, auto: {}, dashes: [
    {id: 'd1', name: 'Overview', items: over},
    {id: 'd2', name: 'Leads', items: [I('note', 12, 3, {title: 'Every lead in one place', text: 'Search, filter and open any lead. Mark what’s handled so your team doesn’t double up.'}), I('inbox', 12, 13), I('locations', 6, 9), I('forms_by', 6, 9)]},
    {id: 'd3', name: 'Key events', items: [I('ins_keys', 12, 3), I('keyevents', 8, 11), I('keyevents_mix', 4, 11), I('keyevents_list', 4, 11), I('keyevents_pages', 4, 11), I('keyevents_sources', 4, 11)]}
  ]};
  if (c.source === 'ghl') {
    L.dashes.push({id: 'd4', name: 'Sales', items: [I('note', 12, 3, {title: 'Your sales pipeline', text: 'Open deals by stage, the latest movement, and who’s booked.'}), I('pipeline', 6, 10), I('appts', 6, 10), I('opps_list', 6, 10), I('contacts_list', 6, 10), I('people', 12, 12)]});
    L.dashes.push({id: 'd5', name: 'Email', items: [I('note', 12, 3, {title: 'Email', text: 'What went out, and who wrote back.'}), I('email', 12, 13)]});
  }
  const add = (auto, name, items) => { L.dashes.push({id: 'a_' + auto, name, auto, items}); L.auto[auto] = 1; };
  add('crm', 'Clients', [I('note', 12, 3, {title: 'Your clients', text: 'Everyone who reached out, as cards. Move them through the stages, set a value, an owner and a follow-up date. Your whole team sees changes live.'}), I('crm_kpis', 12, 6), I('crm_board', 12, 14), I('crm_follow', 6, 11), I('crm_clients', 6, 11)].filter(it => W[it.t]));
  if (c.desk && S.me && S.me.user.write >= 1) add('desk', 'Sales desk', [I('note', 12, 3, {title: 'Your sales desk', text: 'Work your CRM from here: move deals, answer messages, tick off tasks and manage today’s bookings. Every change happens in your CRM right away.'})].concat(['ghl_pipe', 'ghl_convs', 'ghl_tasks', 'ghl_appts', 'ghl_deals', 'ghl_contacts', 'ghl_camp'].filter(k => W[k]).map(k => I(k, k === 'ghl_pipe' ? 12 : 6, 12))));
  if (c.ga) add('web', 'Website', [I('ins_web', 12, 3), I('web_kpis', 12, 6), I('web_engagement', 12, 6), I('web_trend', 8, 9), I('web_sources', 4, 9), I('web_engaged_trend', 8, 9), I('web_newret', 4, 9), I('web_channels', 8, 10), I('web_devices', 4, 10), I('web_landing', 12, 11), I('web_pages', 6, 10), I('web_cities', 6, 10), I('web_countries', 4, 10), I('web_events', 8, 10), I('web_keyevents', 6, 9), I('web_srcmed', 6, 9), I('web_heat', 12, 8)]);
  if (c.gsc) add('gsc', 'Google Search', [I('ins_search', 12, 3), I('sc_kpis', 12, 6), I('sc_trend', 8, 9), I('sc_devices', 4, 9), I('sc_queries', 12, 11), I('sc_almost', 6, 10), I('sc_pages', 6, 10), I('sc_countries', 6, 9)]);
  if (c.ai) add('ai', 'AI visibility', [I('ins_ai', 12, 3), I('ai_kpis', 12, 6), I('ai_trend', 8, 9), I('ai_assistants', 4, 9), I('ai_overviews', 12, 10), I('ai_pages', 6, 9), I('ai_leads', 6, 9)]);
  return L;
};
})();
