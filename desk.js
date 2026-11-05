/* ==========================================================================
   LEADVAULT: client pipeline (shared CRM of everyone who reached out),
   sales desk (live GoHighLevel actions) and the Vault assistant.
   ========================================================================== */
(function () {
'use strict';
const {esc, ic, fmt, money, when, api} = LV;
const W = LV.W = LV.W || {};
const empty = (b, t) => '<div class="empty"><b>' + esc(b) + '</b>' + esc(t || '') + '</div>';
const S = () => LV.S;

/* ================= CLIENT PIPELINE ================= */
const STAGES = [['new', 'New lead', '#3E7CB1'], ['contacted', 'Contacted', '#5B8C85'], ['quote', 'Quote sent', '#C29B3F'], ['booked', 'Booked', '#8E5A9B'], ['won', 'Won', '#1F7A5A'], ['lost', 'Lost', '#C2413A']];
const stageName = k => (STAGES.find(s => s[0] === k) || STAGES[0])[1];
const pkey = f => String(f.email || f.phone || f.id).toLowerCase().trim();
async function loadCrm(force) {
  const s = S();
  if (s.crm && s.crm.domain === s.domain && !force) return s.crm;
  if (s.crmLoading && !force) return s.crmLoading;
  s.crmLoading = api('portalCrm', {session: s.session, domain: s.domain}).then(r => { s.crmLoading = null; s.crm = {domain: s.domain, people: (r.crm && r.crm.people) || {}, team: r.team || []}; return s.crm; });
  return s.crmLoading;
}
function people(d, crm) {
  const by = {};
  LV.forms(d).slice().reverse().forEach(f => {
    const k = pkey(f); if (!k) return;
    const p = by[k] = by[k] || {id: k, name: '', email: '', phone: '', first: f.at, last: f.at, forms: [], ch: f.ch, city: ''};
    p.name = f.name || p.name; p.email = f.email || p.email; p.phone = f.phone || p.phone; p.city = f.city || p.city; p.last = f.at; p.forms.push(f);
  });
  return Object.values(by).map(p => Object.assign(p, {crm: crm.people[p.id] || {}, stage: (crm.people[p.id] || {}).stage || 'new'})).sort((a, b) => b.last - a.last);
}
async function crmSave(p, patch) {
  const s = S();
  patch.label = p.name || p.email || p.phone;
  const r = await api('portalCrmSave', {session: s.session, domain: s.domain, id: p.id, patch});
  if (r.error) { LV.toast(r.error); return null; }
  s.crm.people[p.id] = r.person; return r.person;
}
const needsCrm = (el, fn) => { const s = S(); if (s.crm && s.crm.domain === s.domain) return fn(s.crm); el.innerHTML = LV.skel('table'); loadCrm().then(c => fn(c)); };

W.crm_kpis = {g: 'Clients', t: 'Clients at a glance', d: 'Open pipeline, jobs won, win rate, first-reply speed and late follow-ups.', ic: 'bolt', tint: '#1F7A5A', c: 12, sk: 'kpis',
  draw(el, {d}) { needsCrm(el, crm => {
    const P = people(d, crm), open = P.filter(p => ['won', 'lost'].indexOf(p.stage) < 0), won = P.filter(p => p.stage === 'won'), lost = P.filter(p => p.stage === 'lost');
    const late = P.filter(p => p.crm.follow && p.crm.follow < Date.now() && ['won', 'lost'].indexOf(p.stage) < 0).length;
    const fr = P.filter(p => p.crm.firstTouch).map(p => p.crm.firstTouch - p.first).filter(x => x > 0), avg = fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : 0;
    const k = (l, v, t, n) => '<div class="kpi" style="--t:' + t + '"><div class="lab"><i></i>' + l + '</div><span class="big">' + v + '</span><span class="delta">' + (n || '') + '</span></div>';
    el.innerHTML = '<div class="kpis">' + k('Open pipeline', money(open.reduce((s, p) => s + (p.crm.value || 0), 0)), '#C29B3F', open.length + ' people') + k('Jobs won', money(won.reduce((s, p) => s + (p.crm.value || 0), 0)), '#1F7A5A', won.length + ' won') +
      k('Win rate', won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) + '%' : '—', '#3E7CB1', 'won ÷ decided') + k('First reply', avg ? (avg < 36e5 ? Math.round(avg / 6e4) + ' min' : Math.round(avg / 36e5 * 10) / 10 + ' h') : '—', '#8E5A9B', 'average') + k('Late follow-ups', late, late ? '#C2413A' : '#5B8C85', late ? 'call these today' : 'all caught up') + '</div>';
  }); }};

W.crm_board = {g: 'Clients', t: 'Client pipeline', d: 'Drag people from New lead to Won. Click a card for notes, value and follow-up.', ic: 'grid', tint: '#3E7CB1', c: 12, sk: 'table',
  draw(el, {d}) { needsCrm(el, crm => {
    const P = people(d, crm);
    if (!P.length) { el.innerHTML = empty('No one has reached out in this period', 'People appear here from your form leads.'); return; }
    el.innerHTML = '<div class="board">' + STAGES.map(s => { const L = P.filter(p => p.stage === s[0]); return '<div class="col" data-st="' + s[0] + '"><div class="col-h"><span style="display:flex;gap:7px;align-items:center"><i style="width:8px;height:8px;border-radius:2px;background:' + s[2] + '"></i>' + s[1] + '</span><small>' + L.length + (L.some(p => p.crm.value) ? ' · ' + money(L.reduce((a, p) => a + (p.crm.value || 0), 0)) : '') + '</small></div>' +
      L.slice(0, 60).map(p => '<div class="card" draggable="true" data-p="' + esc(p.id) + '"><b>' + esc(p.name || p.email || p.phone) + '</b><span style="color:var(--ink-3)">' + esc(p.forms[p.forms.length - 1].form) + '</span><div class="meta"><span>' + esc(when(p.last)) + '</span>' + (p.crm.value ? '<b class="num" style="color:var(--ink);font-size:12.5px;margin:0">' + money(p.crm.value) + '</b>' : '') + (p.crm.follow ? '<span style="color:' + (p.crm.follow < Date.now() ? 'var(--bad)' : 'var(--ink-3)') + '">' + ic('clock', 12) + ' ' + LV.date(p.crm.follow) + '</span>' : '') + '</div></div>').join('') + '</div>'; }).join('') + '</div>';
    let drag = null;
    el.querySelectorAll('.card').forEach(c => {
      c.addEventListener('dragstart', e => { drag = c.dataset.p; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
      c.addEventListener('click', () => openPerson(P.find(p => p.id === c.dataset.p), () => LV.drawGrid()));
    });
    el.querySelectorAll('.col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', async e => {
        e.preventDefault(); col.classList.remove('over'); const p = P.find(x => x.id === drag); if (!p || p.stage === col.dataset.st) return;
        const prev = p.stage; p.stage = col.dataset.st; crm.people[p.id] = Object.assign({}, p.crm, {stage: p.stage});
        LV.drawGrid();
        if (p.stage === 'won') confetti();
        const r = await crmSave(p, {stage: col.dataset.st});
        if (r) LV.toast((p.name || 'Client') + ' moved to ' + stageName(col.dataset.st), {label: 'Undo', fn: async () => { await crmSave(p, {stage: prev}); LV.drawGrid(); }});
      });
    });
  }); }};

W.crm_follow = {g: 'Clients', t: 'Follow-ups', d: 'Who to call back today, what’s late, and new leads still waiting for a first reply.', ic: 'clock', tint: '#B7791F', c: 12, sk: 'list',
  draw(el, {d}) { needsCrm(el, crm => {
    const P = people(d, crm).filter(p => ['won', 'lost'].indexOf(p.stage) < 0), now = Date.now(), eod = new Date().setHours(23, 59, 59, 999);
    const late = P.filter(p => p.crm.follow && p.crm.follow < new Date().setHours(0, 0, 0, 0)), today = P.filter(p => p.crm.follow && p.crm.follow >= new Date().setHours(0, 0, 0, 0) && p.crm.follow <= eod), waiting = P.filter(p => p.stage === 'new' && !p.crm.follow && now - p.first > 2 * 36e5);
    const grp = (t, L, tone) => L.length ? '<div class="sec" style="margin-top:6px">' + t + ' <span class="pill ' + tone + '">' + L.length + '</span></div><div class="rows">' + L.slice(0, 10).map(p => '<div class="row click" data-p="' + esc(p.id) + '">' + LV.av(p.name || p.email) + '<div class="main"><b>' + esc(p.name || p.email || p.phone) + '</b><small>' + esc(stageName(p.stage) + ' · ' + (p.phone || p.email || '')) + '</small></div><div class="end">' + (p.phone ? '<a class="btn sm" href="tel:' + esc(p.phone) + '" onclick="event.stopPropagation()">' + ic('phone', 14) + ' Call</a>' : '') + '</div></div>').join('') + '</div>' : '';
    const h = grp('Late', late, 'bad') + grp('Today', today, 'warn') + grp('Waiting for a first reply', waiting, 'info');
    el.innerHTML = h || empty('You’re all caught up', 'Set a follow-up date on any client and it shows up here.');
    el.querySelectorAll('[data-p]').forEach(r => r.addEventListener('click', () => openPerson(P.find(p => p.id === r.dataset.p), () => LV.drawGrid())));
  }); }};

W.crm_clients = {g: 'Clients', t: 'Client list', d: 'One row per person across every form they sent. Export to CSV.', ic: 'users', tint: '#5B8C85', c: 12, sk: 'table',
  draw(el, {d, acts}) { needsCrm(el, crm => {
    const P = people(d, crm);
    acts.innerHTML = '<button class="btn sm" type="button">' + ic('download', 14) + ' CSV</button>';
    acts.querySelector('button').onclick = () => LV.csv('clients.csv', [['Name', 'Email', 'Phone', 'Stage', 'Value', 'Owner', 'Follow-up', 'First request', 'Latest request', 'Requests']].concat(P.map(p => [p.name, p.email, p.phone, stageName(p.stage), p.crm.value || '', p.crm.owner || '', p.crm.follow ? new Date(p.crm.follow).toISOString().slice(0, 10) : '', new Date(p.first).toISOString(), new Date(p.last).toISOString(), p.forms.length])));
    el.innerHTML = P.length ? '<div style="overflow:auto;max-height:560px"><table class="t"><thead><tr><th>Name</th><th>Stage</th><th class="n">Value</th><th class="hide-sm">Owner</th><th class="hide-sm">Follow-up</th><th class="n">Requests</th><th>Latest</th></tr></thead><tbody>' + P.map(p => '<tr class="click" data-p="' + esc(p.id) + '"><td><b style="font-weight:600">' + esc(p.name || '—') + '</b><div style="color:var(--ink-3);font-size:12px">' + esc(p.email || p.phone) + '</div></td><td><span class="pill" style="background:color-mix(in srgb,' + (STAGES.find(s => s[0] === p.stage) || STAGES[0])[2] + ' 14%,#fff)">' + stageName(p.stage) + '</span></td><td class="n">' + (p.crm.value ? money(p.crm.value) : '—') + '</td><td class="hide-sm">' + esc(p.crm.owner || '—') + '</td><td class="hide-sm">' + (p.crm.follow ? LV.date(p.crm.follow) : '—') + '</td><td class="n">' + p.forms.length + '</td><td>' + esc(when(p.last)) + '</td></tr>').join('') + '</tbody></table></div>' : empty('No clients in this period');
    el.querySelectorAll('[data-p]').forEach(r => r.addEventListener('click', () => openPerson(P.find(p => p.id === r.dataset.p), () => LV.drawGrid())));
  }); }};

function openPerson(p, after) {
  const crm = S().crm;
  LV.drawer(p.name || p.email || p.phone, esc(stageName(p.stage)) + ' · first reached out ' + esc(when(p.first)), '<div data-ed></div>', (body) => { personEditor(body.querySelector('[data-ed]'), p, crm, after); });
}
function personEditor(box, p, crm, after) {
  const c = p.crm || {};
  box.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px">' + (p.phone ? '<a class="btn go sm" href="tel:' + esc(p.phone) + '">' + ic('phone', 15) + ' Call</a>' : '') + (p.email ? '<a class="btn sm" href="mailto:' + esc(p.email) + '">' + ic('mail', 15) + ' Email</a>' : '') + '</div>' +
    '<div class="chips" style="margin-bottom:16px" role="group" aria-label="Stage">' + STAGES.map(s => '<button class="chip' + (p.stage === s[0] ? ' on' : '') + '" type="button" data-st="' + s[0] + '">' + s[1] + '</button>').join('') + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><label class="field"><span>Job value</span><input class="input" type="number" min="0" step="50" data-k="value" value="' + (c.value || '') + '" placeholder="$"></label>' +
    '<label class="field"><span>Owner</span><select class="input" data-k="owner"><option value="">Nobody yet</option>' + (crm.team || []).map(t => '<option' + (c.owner === (t.name || t.email) ? ' selected' : '') + '>' + esc(t.name || t.email) + '</option>').join('') + '</select></label>' +
    '<label class="field"><span>Follow up on</span><input class="input" type="date" data-k="follow" value="' + (c.follow ? new Date(c.follow - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : '') + '"></label></div>' +
    '<div class="sec">Notes</div><form data-note style="display:flex;gap:8px;margin-bottom:12px"><input class="input" name="n" placeholder="Add a note your team can see" autocomplete="off"><button class="btn go">Add</button></form><div data-notes>' + notesHtml(c.notes) + '</div>' +
    '<div class="sec">Requests (' + p.forms.length + ')</div><div class="rows">' + p.forms.slice().reverse().map((f, i) => '<div class="row click" data-f="' + i + '"><div class="main"><b>' + esc(f.form) + '</b><small>' + esc(f.ch + (f.page ? ' · ' + f.page : '')) + '</small></div><div class="end"><small>' + esc(when(f.at)) + '</small></div></div>').join('') + '</div>';
  const refresh = (np) => { p.crm = np; p.stage = np.stage || p.stage; if (after) after(); };
  box.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', async () => { const st = b.dataset.st; box.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x === b)); const r = await crmSave(p, {stage: st}); if (r) { refresh(r); if (st === 'won') confetti(); LV.toast('Moved to ' + stageName(st)); } }));
  box.querySelectorAll('[data-k]').forEach(i => i.addEventListener('change', async () => { const k = i.dataset.k, v = k === 'follow' ? (i.value ? new Date(i.value + 'T09:00').getTime() : 0) : i.value; const r = await crmSave(p, {[k]: v}); if (r) { refresh(r); LV.toast('Saved'); } }));
  box.querySelector('[data-note]').addEventListener('submit', async e => { e.preventDefault(); const t = e.target.n.value.trim(); if (!t) return; e.target.n.value = ''; const r = await crmSave(p, {note: t}); if (r) { refresh(r); box.querySelector('[data-notes]').innerHTML = notesHtml(r.notes); } });
  box.querySelectorAll('[data-f]').forEach(r => r.addEventListener('click', () => LV.openLead(p.forms.slice().reverse()[Number(r.dataset.f)])));
}
const notesHtml = n => (n && n.length) ? n.map(x => '<div style="padding:10px 12px;border:1px solid var(--line-2);border-radius:10px;margin-bottom:8px"><div style="white-space:pre-wrap">' + esc(x.t) + '</div><small style="color:var(--ink-3)">' + esc(x.by) + ' · ' + esc(when(x.at)) + '</small></div>').join('') : '<div style="color:var(--ink-3);font-size:13px">No notes yet.</div>';
/* the pipeline block inside a lead drawer */
LV.crmInline = function (box, f) {
  loadCrm().then(crm => {
    const k = pkey(f), d = LV.S.data, P = people(d, crm), p = P.find(x => x.id === k) || {id: k, name: f.name, email: f.email, phone: f.phone, first: f.at, last: f.at, forms: [f], crm: crm.people[k] || {}, stage: (crm.people[k] || {}).stage || 'new'};
    personEditor(box, p, crm, () => {});
    box.querySelector('[style*="margin:0 0 16px"]').remove();
  });
};
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), cols = ['#C29B3F', '#1F7A5A', '#D9B868', '#3E7CB1', '#8E5A9B'], ps = Array.from({length: 120}, () => ({x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: Math.random() * -12 - 4, r: Math.random() * 6 + 3, c: cols[Math.floor(Math.random() * 5)], a: Math.random() * 6}));
  let t = 0; (function f() { g.clearRect(0, 0, c.width, c.height); ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore(); }); if (++t < 110) requestAnimationFrame(f); else c.remove(); })();
}

/* ================= SALES DESK (live GoHighLevel) ================= */
const desk = (lvl) => (c, s) => !!c.desk && s.me && s.me.user.write >= (lvl || 1);
const ghl = (op, body) => api('portalGhl', Object.assign({session: S().session, domain: S().domain, op}, body || {}));
let deskCache = null;
async function deals(force) {
  if (deskCache && deskCache.domain === S().domain && !force && Date.now() - deskCache.at < 60000) return deskCache;
  const r = await ghl('deals'); if (r.error) return r;
  deskCache = {domain: S().domain, at: Date.now(), pipelines: r.pipelines, opps: r.opps}; return deskCache;
}

W.ghl_pipe = {g: 'Sales desk', t: 'Pipeline summary', d: 'Open value, deals won this month, win rate and new deals, live from your CRM.', ic: 'bars', tint: '#8E5A9B', c: 12, sk: 'kpis', ok: desk(1),
  async draw(el) {
    const r = await deals(); if (r.error) return el.innerHTML = empty('Couldn’t load the pipeline', r.error);
    const O = r.opps, open = O.filter(o => o.status === 'open'), m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const wonM = O.filter(o => o.status === 'won' && o.upd >= m0), lostM = O.filter(o => o.status === 'lost' && o.upd >= m0), newM = O.filter(o => o.at >= m0);
    const k = (l, v, t, n) => '<div class="kpi" style="--t:' + t + '"><div class="lab"><i></i>' + l + '</div><span class="big">' + v + '</span><span class="delta">' + n + '</span></div>';
    el.innerHTML = '<div class="kpis">' + k('Open pipeline', money(open.reduce((s, o) => s + o.value, 0)), '#C29B3F', open.length + ' open deals') + k('Won this month', money(wonM.reduce((s, o) => s + o.value, 0)), '#1F7A5A', wonM.length + ' deals') + k('Win rate this month', wonM.length + lostM.length ? Math.round(wonM.length / (wonM.length + lostM.length) * 100) + '%' : '—', '#3E7CB1', wonM.length + ' won, ' + lostM.length + ' lost') + k('New deals this month', newM.length, '#8E5A9B', money(newM.reduce((s, o) => s + o.value, 0))) + '</div>';
  }};

W.ghl_deals = {g: 'Sales desk', t: 'Deals pipeline', d: 'Drag a deal to another stage, mark it won or lost, or change its value. Changes save to your CRM right away.', ic: 'funnel', tint: '#3E7CB1', c: 12, sk: 'table', ok: desk(1),
  async draw(el, {it, acts}) {
    const r = await deals(); if (r.error) return el.innerHTML = empty('Couldn’t load deals', r.error);
    if (!r.pipelines.length) return el.innerHTML = empty('No pipelines yet', 'Create a pipeline in your CRM and it shows up here.');
    it.__p = it.__p && r.pipelines.find(p => p.id === it.__p) ? it.__p : r.pipelines[0].id;
    const pipe = r.pipelines.find(p => p.id === it.__p);
    acts.innerHTML = (r.pipelines.length > 1 ? '<select class="input" style="height:30px;width:auto" data-pipe>' + r.pipelines.map(p => '<option value="' + p.id + '"' + (p.id === it.__p ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' : '') + '<button class="btn sm go" type="button" data-new>' + ic('plus', 14) + ' Deal</button>';
    const sel = acts.querySelector('[data-pipe]'); if (sel) sel.onchange = () => { it.__p = sel.value; W.ghl_deals.draw(el, {it, acts}); };
    acts.querySelector('[data-new]').onclick = () => newDeal(pipe, () => W.ghl_deals.draw(el, {it, acts}));
    const open = r.opps.filter(o => o.pipelineId === pipe.id && o.status === 'open');
    el.innerHTML = '<div class="board">' + pipe.stages.map(s => { const L = open.filter(o => o.stageId === s.id); return '<div class="col" data-st="' + s.id + '"><div class="col-h"><span>' + esc(s.name) + '</span><small>' + L.length + ' · ' + money(L.reduce((a, o) => a + o.value, 0)) + '</small></div>' + L.slice(0, 80).map(o => '<div class="card" draggable="true" data-o="' + o.id + '"><b>' + esc(o.name) + '</b><span style="color:var(--ink-3)">' + esc(o.contact || '') + '</span><div class="meta"><b class="num" style="color:var(--ink);font-size:13px;margin:0">' + money(o.value) + '</b><span>' + esc(when(o.upd || o.at)) + '</span></div></div>').join('') + '</div>'; }).join('') + '</div>';
    let drag = null;
    el.querySelectorAll('.card').forEach(c => { c.addEventListener('dragstart', () => { drag = c.dataset.o; c.classList.add('dragging'); }); c.addEventListener('dragend', () => c.classList.remove('dragging')); c.addEventListener('click', () => dealDrawer(r.opps.find(o => o.id === c.dataset.o), pipe, () => W.ghl_deals.draw(el, {it, acts}))); });
    el.querySelectorAll('.col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', async e => {
        e.preventDefault(); col.classList.remove('over'); const o = r.opps.find(x => x.id === drag); if (!o || o.stageId === col.dataset.st) return;
        const prev = o.stageId, sn = pipe.stages.find(s => s.id === col.dataset.st).name; o.stageId = col.dataset.st; o.stage = sn; W.ghl_deals.draw(el, {it, acts});
        const x = await ghl('dealMove', {id: o.id, stageId: col.dataset.st, pipelineId: pipe.id, stageName: sn});
        if (x.error) { o.stageId = prev; LV.toast(x.error); W.ghl_deals.draw(el, {it, acts}); } else LV.toast('Moved to ' + sn);
      });
    });
  }};
function dealDrawer(o, pipe, after) {
  LV.drawer(o.name, esc(o.stage) + ' · ' + money(o.value), '<div class="chips" style="margin-bottom:16px">' + ['won', 'lost', 'abandoned'].map(s => '<button class="chip" type="button" data-s="' + s + '">Mark ' + s + '</button>').join('') + '</div>' +
    '<form data-f><label class="field"><span>Deal name</span><input class="input" name="name" value="' + esc(o.name) + '"></label><label class="field"><span>Value</span><input class="input" type="number" name="value" value="' + o.value + '"></label><label class="field"><span>Stage</span><select class="input" name="stage">' + pipe.stages.map(s => '<option value="' + s.id + '"' + (s.id === o.stageId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></label><button class="btn go">Save changes</button></form>' +
    (o.contactId ? '<div class="sec">Contact</div><button class="btn sm" type="button" data-c>' + ic('users', 14) + ' Open ' + esc(o.contact || 'contact') + '</button>' : ''), (body, close) => {
      body.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', async () => { b.classList.add('busy'); const r = await ghl('dealStatus', {id: o.id, status: b.dataset.s}); if (r.error) { b.classList.remove('busy'); return LV.toast(r.error); } o.status = b.dataset.s; if (b.dataset.s === 'won') confetti(); LV.toast('Marked ' + b.dataset.s); close(); deskCache = null; after(); }));
      body.querySelector('[data-f]').addEventListener('submit', async e => {
        e.preventDefault(); const f = e.target, btn = f.querySelector('button'); btn.classList.add('busy');
        let r = await ghl('dealSave', {id: o.id, name: f.name.value, value: f.value.value});
        if (!r.error && f.stage.value !== o.stageId) r = await ghl('dealMove', {id: o.id, stageId: f.stage.value, pipelineId: pipe.id, stageName: f.stage.selectedOptions[0].text});
        btn.classList.remove('busy'); if (r.error) return LV.toast(r.error);
        LV.toast('Deal saved'); close(); deskCache = null; after();
      });
      const cb = body.querySelector('[data-c]'); if (cb) cb.addEventListener('click', () => { close(); contactDrawer(o.contactId); });
    });
}
function newDeal(pipe, after) {
  LV.modal('<h2>New deal</h2><form style="margin-top:14px"><label class="field"><span>Contact</span><input class="input" name="q" placeholder="Search by name, email or phone" autocomplete="off"><div data-res class="rows" style="max-height:180px;overflow:auto"></div></label><label class="field"><span>Deal name</span><input class="input" name="name" required></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="field"><span>Value</span><input class="input" type="number" name="value" min="0"></label><label class="field"><span>Stage</span><select class="input" name="stage">' + pipe.stages.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('') + '</select></label></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Create deal</button></div></form>', (m, close) => {
    const f = m.querySelector('form'), res = m.querySelector('[data-res]'); let cid = '';
    f.q.addEventListener('input', LV.debounce(async () => { const r = await ghl('contacts', {q: f.q.value}); res.innerHTML = (r.contacts || []).slice(0, 8).map(k => '<div class="row click" data-id="' + k.id + '" data-n="' + esc(k.name) + '"><div class="main"><b>' + esc(k.name || k.email) + '</b><small>' + esc(k.email || k.phone) + '</small></div></div>').join(''); res.querySelectorAll('[data-id]').forEach(x => x.addEventListener('click', () => { cid = x.dataset.id; f.q.value = x.dataset.n; res.innerHTML = ''; if (!f.name.value) f.name.value = x.dataset.n; })); }, 300));
    f.addEventListener('submit', async e => { e.preventDefault(); if (!cid) return LV.toast('Pick a contact from the list.'); const b = f.querySelector('.go'); b.classList.add('busy'); const r = await ghl('dealNew', {contactId: cid, name: f.name.value, value: f.value.value, pipelineId: pipe.id, stageId: f.stage.value}); b.classList.remove('busy'); if (r.error) return LV.toast(r.error); LV.toast('Deal created'); close(); deskCache = null; after(); });
  });
}

W.ghl_contacts = {g: 'Sales desk', t: 'Contacts desk', d: 'Find any contact, then edit details, tags and notes, add tasks and send a text or email.', ic: 'users', tint: '#1F7A5A', c: 12, sk: 'list', ok: desk(1),
  draw(el, {acts}) {
    acts.innerHTML = '<button class="btn sm go" type="button">' + ic('plus', 14) + ' Contact</button>';
    acts.querySelector('button').onclick = newContact;
    el.innerHTML = '<div class="toolbar"><label class="search">' + ic('search', 16) + '<input class="input" type="search" placeholder="Search contacts" data-q aria-label="Search contacts"></label></div><div data-l>' + LV.skel('list') + '</div>';
    const L = el.querySelector('[data-l]');
    const run = async q => { const r = await ghl('contacts', {q}); if (r.error) return L.innerHTML = empty('Couldn’t load contacts', r.error);
      L.innerHTML = r.contacts.length ? '<div class="rows">' + r.contacts.map(k => '<div class="row click" data-id="' + k.id + '">' + LV.av(k.name || k.email) + '<div class="main"><b>' + esc(k.name || k.email || k.phone) + '</b><small>' + esc([k.email, k.phone].filter(Boolean).join(' · ')) + '</small></div><div class="end hide-sm">' + (k.tags || []).slice(0, 3).map(t => '<span class="pill">' + esc(t) + '</span>').join(' ') + '</div></div>').join('') + '</div>' : empty('No contacts match');
      L.querySelectorAll('[data-id]').forEach(x => x.addEventListener('click', () => contactDrawer(x.dataset.id))); };
    el.querySelector('[data-q]').addEventListener('input', LV.debounce(e => run(e.target.value), 350));
    run('');
  }};
function newContact() {
  LV.modal('<h2>New contact</h2><form style="margin-top:14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="field"><span>First name</span><input class="input" name="firstName"></label><label class="field"><span>Last name</span><input class="input" name="lastName"></label></div><label class="field"><span>Email</span><input class="input" type="email" name="email"></label><label class="field"><span>Phone</span><input class="input" name="phone"></label><label class="field"><span>Company</span><input class="input" name="companyName"></label><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Add contact</button></div></form>', (m, close) => {
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const f = e.target, b = f.querySelector('.go'); b.classList.add('busy'); const r = await ghl('contactNew', Object.fromEntries(new FormData(f))); b.classList.remove('busy'); if (r.error) return LV.toast(r.error); close(); LV.toast('Contact added'); contactDrawer(r.contact.id); });
  });
}
async function contactDrawer(id) {
  const dr = LV.drawer('Contact', '', LV.skel('list'));
  const r = await ghl('contact', {id});
  if (r.error) { dr.body.innerHTML = empty('Couldn’t open this contact', r.error); return; }
  const k = r.contact;
  dr.el.querySelector('.drawer-h h2').textContent = k.name || k.email || k.phone;
  dr.el.querySelector('.drawer-h h2').insertAdjacentHTML('afterend', '<div style="color:var(--ink-3);font-size:13px;margin-top:3px">' + esc([k.email, k.phone].filter(Boolean).join(' · ')) + '</div>');
  const tabs = [['msg', 'Messages'], ['info', 'Details'], ['notes', 'Notes'], ['tasks', 'Tasks'], ['more', 'Deals & bookings']];
  dr.body.innerHTML = '<div class="seg light" style="margin-bottom:16px;flex-wrap:wrap">' + tabs.map((t, i) => '<button type="button" data-t="' + t[0] + '"' + (i ? '' : ' class="on"') + '>' + t[1] + '</button>').join('') + '</div><div data-pane></div>';
  const pane = dr.body.querySelector('[data-pane]');
  const show = t => {
    dr.body.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    if (t === 'msg') {
      pane.innerHTML = '<div class="thread" style="max-height:46vh;overflow:auto;margin-bottom:12px" data-th>' + (r.messages.length ? r.messages.map(msgHtml).join('') : '<div class="empty">No messages yet.</div>') + '</div>' +
        '<form data-send><div class="seg light" style="margin-bottom:8px"><button type="button" data-ty="SMS" class="on"' + (k.phone ? '' : ' disabled') + '>Text</button><button type="button" data-ty="Email"' + (k.email ? '' : ' disabled') + '>Email</button></div><input class="input" name="subject" placeholder="Subject" hidden style="margin-bottom:8px"><textarea class="input" name="m" placeholder="Write a message"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn go">' + ic('send', 15) + ' Send</button></div></form>';
      const th = pane.querySelector('[data-th]'); th.scrollTop = th.scrollHeight;
      let type = k.phone ? 'SMS' : 'Email'; const f = pane.querySelector('form');
      const setT = t2 => { type = t2; f.querySelectorAll('[data-ty]').forEach(b => b.classList.toggle('on', b.dataset.ty === t2)); f.subject.hidden = t2 !== 'Email'; };
      setT(type); f.querySelectorAll('[data-ty]').forEach(b => b.addEventListener('click', () => setT(b.dataset.ty)));
      f.addEventListener('submit', async e => { e.preventDefault(); const b = f.querySelector('.go'); if (!f.m.value.trim()) return; b.classList.add('busy'); const x = await ghl('send', {contactId: id, type, message: f.m.value, subject: f.subject.value}); b.classList.remove('busy'); if (x.error) return LV.toast(x.error); r.messages.push({at: Date.now(), dir: 'outbound', body: f.m.value, type: type === 'SMS' ? 'sms' : 'email', subject: f.subject.value}); f.m.value = ''; LV.toast(type === 'SMS' ? 'Text sent' : 'Email sent'); show('msg'); });
    } else if (t === 'info') {
      pane.innerHTML = '<form data-info><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + [['firstName', 'First name', k.first], ['lastName', 'Last name', k.last], ['email', 'Email', k.email], ['phone', 'Phone', k.phone], ['companyName', 'Company', k.company], ['website', 'Website', k.website], ['address1', 'Address', k.address], ['city', 'City', k.city], ['state', 'Province / state', k.region], ['postalCode', 'Postal code', k.postal]].map(x => '<label class="field"><span>' + x[1] + '</span><input class="input" name="' + x[0] + '" value="' + esc(x[2] || '') + '"></label>').join('') + '</div>' +
        '<label class="field"><span>Tags</span><input class="input" name="tags" value="' + esc((k.tags || []).join(', ')) + '"><div class="hint">Separate tags with commas.</div></label><button class="btn go">Save details</button></form>';
      pane.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const f = e.target, b = f.querySelector('.go'); b.classList.add('busy'); const body = Object.fromEntries(new FormData(f)); body.tags = body.tags.split(',').map(s => s.trim()).filter(Boolean); body.id = id; const x = await ghl('contactSave', body); b.classList.remove('busy'); if (x.error) return LV.toast(x.error); Object.assign(k, x.contact); LV.toast('Details saved'); });
    } else if (t === 'notes') {
      pane.innerHTML = '<form style="margin-bottom:12px"><textarea class="input" name="n" placeholder="Write a note"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn go">Add note</button></div></form>' + (r.notes.length ? r.notes.map(n => '<div style="padding:10px 12px;border:1px solid var(--line-2);border-radius:10px;margin-bottom:8px"><div style="white-space:pre-wrap">' + esc(n.body) + '</div><small style="color:var(--ink-3)">' + esc(when(n.at)) + '</small></div>').join('') : '<div class="empty">No notes yet.</div>');
      pane.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const v = e.target.n.value.trim(); if (!v) return; const x = await ghl('note', {id, body: v}); if (x.error) return LV.toast(x.error); r.notes.unshift({at: Date.now(), body: v}); LV.toast('Note added'); show('notes'); });
    } else if (t === 'tasks') {
      pane.innerHTML = '<form style="display:grid;grid-template-columns:1fr 150px auto;gap:8px;margin-bottom:12px"><input class="input" name="t" placeholder="New task" required><input class="input" type="date" name="d" value="' + new Date(Date.now() + 864e5).toISOString().slice(0, 10) + '"><button class="btn go">Add</button></form>' + (r.tasks.length ? '<div class="rows">' + r.tasks.map((x, i) => '<label class="row" style="cursor:pointer"><input type="checkbox" data-i="' + i + '"' + (x.done ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--vault)"><div class="main"><b style="' + (x.done ? 'text-decoration:line-through;color:var(--ink-3)' : '') + '">' + esc(x.title) + '</b><small>Due ' + esc(LV.date(x.due)) + '</small></div></label>').join('') + '</div>' : '<div class="empty">No tasks.</div>');
      pane.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const f = e.target; const x = await ghl('task', {id, title: f.t.value, due: new Date(f.d.value + 'T09:00').getTime()}); if (x.error) return LV.toast(x.error); r.tasks.push({id: (x.task && x.task.task && x.task.task.id) || '', title: f.t.value, due: new Date(f.d.value).getTime(), done: false}); LV.toast('Task added'); show('tasks'); });
      pane.querySelectorAll('[data-i]').forEach(cb => cb.addEventListener('change', async () => { const x = r.tasks[Number(cb.dataset.i)]; const y = await ghl('taskDone', {contactId: id, id: x.id, done: cb.checked}); if (y.error) { cb.checked = !cb.checked; return LV.toast(y.error); } x.done = cb.checked; show('tasks'); }));
    } else {
      pane.innerHTML = '<div class="sec" style="margin-top:0">Deals</div>' + (r.opps.length ? r.opps.map(o => '<div class="row"><div class="main"><b>' + esc(o.name) + '</b><small>' + esc(o.status) + '</small></div><div class="end"><b class="num">' + money(o.value) + '</b></div></div>').join('') : '<div class="empty">No deals.</div>') +
        '<div class="sec">Bookings</div>' + (r.appts.length ? r.appts.map(a => '<div class="row"><div class="main"><b>' + esc(a.title) + '</b><small>' + new Date(a.start).toLocaleString('en-CA', {dateStyle: 'medium', timeStyle: 'short'}) + '</small></div><div class="end"><span class="pill">' + esc(a.status) + '</span></div></div>').join('') : '<div class="empty">No bookings.</div>') +
        '<button class="btn sm go" type="button" data-book style="margin-top:12px">' + ic('cal', 14) + ' Book an appointment</button>';
      pane.querySelector('[data-book]').addEventListener('click', () => bookFor(id, k.name));
    }
  };
  dr.body.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => show(b.dataset.t)));
  show('msg');
}
const msgHtml = m => '<div class="msg ' + (m.dir === 'outbound' ? 'out' : 'in') + '">' + (m.type === 'call' ? ic('phone', 13) + ' Call' + (m.call && m.call.duration ? ' · ' + LV.dur(m.call.duration) : '') : (m.subject ? '<b>' + esc(m.subject) + '</b>\n' : '') + esc(m.body)) + '<small>' + esc(m.type === 'email' ? 'Email · ' : m.type === 'sms' ? 'Text · ' : '') + esc(when(m.at)) + '</small></div>';
function bookFor(contactId, name) {
  LV.modal('<h2>Book ' + esc(name || 'an appointment') + '</h2><form style="margin-top:14px"><label class="field"><span>Calendar</span><select class="input" name="cal"><option>Loading…</option></select></label><label class="field"><span>Title</span><input class="input" name="title" value="Appointment' + (name ? ' with ' + esc(name) : '') + '"></label><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><label class="field"><span>Date</span><input class="input" type="date" name="d" required></label><label class="field"><span>Start</span><input class="input" type="time" name="t" value="10:00" required></label><label class="field"><span>Minutes</span><input class="input" type="number" name="m" value="60" min="15" step="15"></label></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Book</button></div></form>', async (m, close) => {
    const f = m.querySelector('form'), r = await ghl('calendars');
    f.cal.innerHTML = (r.calendars || []).map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('') || '<option value="">No calendars</option>';
    f.addEventListener('submit', async e => { e.preventDefault(); const st = new Date(f.d.value + 'T' + f.t.value).getTime(), b = f.querySelector('.go'); b.classList.add('busy'); const x = await ghl('apptNew', {calendarId: f.cal.value, contactId, title: f.title.value, start: st, end: st + Number(f.m.value) * 6e4}); b.classList.remove('busy'); if (x.error) return LV.toast(x.error); close(); LV.toast('Appointment booked'); });
  });
}

W.ghl_tasks = {g: 'Sales desk', t: 'Tasks due', d: 'Every open task: overdue, due today and coming up. Tick one off and it’s done in your CRM.', ic: 'task', tint: '#1F7A5A', c: 6, sk: 'list', ok: desk(1),
  async draw(el) {
    const r = await ghl('tasks'); if (r.error) return el.innerHTML = empty('Couldn’t load tasks', r.error);
    const sod = new Date().setHours(0, 0, 0, 0), eod = sod + 864e5 - 1;
    const g = (t, L, tone) => L.length ? '<div class="sec" style="margin-top:4px">' + t + ' <span class="pill ' + tone + '">' + L.length + '</span></div>' + L.map(x => '<label class="row" style="cursor:pointer"><input type="checkbox" data-id="' + x.id + '" data-c="' + x.contactId + '" style="width:18px;height:18px;accent-color:var(--vault)"><div class="main"><b>' + esc(x.title) + '</b><small>' + esc((x.contact ? x.contact + ' · ' : '') + 'due ' + LV.date(x.due)) + '</small></div></label>').join('') : '';
    const h = g('Overdue', r.tasks.filter(x => x.due && x.due < sod), 'bad') + g('Today', r.tasks.filter(x => x.due >= sod && x.due <= eod), 'warn') + g('Coming up', r.tasks.filter(x => !x.due || x.due > eod).slice(0, 20), '');
    el.innerHTML = h || empty('No open tasks', 'Nice work.');
    el.querySelectorAll('[data-id]').forEach(cb => cb.addEventListener('change', async () => { const row = cb.closest('.row'); row.style.opacity = .5; const x = await ghl('taskDone', {id: cb.dataset.id, contactId: cb.dataset.c, done: true}); if (x.error) { cb.checked = false; row.style.opacity = 1; return LV.toast(x.error); } row.remove(); LV.toast('Task done'); }));
  }};

W.ghl_appts = {g: 'Sales desk', t: 'Today’s bookings', d: 'Bookings on every calendar. Confirm, mark a no-show, move or cancel.', ic: 'cal', tint: '#B7791F', c: 6, sk: 'list', ok: desk(1),
  async draw(el, {it, acts}) {
    it.__day = it.__day || new Date().setHours(0, 0, 0, 0);
    acts.innerHTML = '<button class="btn sm ghost" type="button" data-p aria-label="Previous day">' + ic('left', 14) + '</button><span style="font-size:13px;font-weight:600;min-width:84px;text-align:center">' + (new Date(it.__day).toDateString() === new Date().toDateString() ? 'Today' : new Date(it.__day).toLocaleDateString('en-CA', {weekday: 'short', month: 'short', day: 'numeric'})) + '</span><button class="btn sm ghost" type="button" data-n aria-label="Next day">' + ic('right', 14) + '</button>';
    acts.querySelector('[data-p]').onclick = () => { it.__day -= 864e5; W.ghl_appts.draw(el, {it, acts}); };
    acts.querySelector('[data-n]').onclick = () => { it.__day += 864e5; W.ghl_appts.draw(el, {it, acts}); };
    el.innerHTML = LV.skel('list');
    const r = await ghl('appts', {from: it.__day, to: it.__day + 864e5 - 1}); if (r.error) return el.innerHTML = empty('Couldn’t load bookings', r.error);
    el.innerHTML = r.appts.length ? '<div class="rows">' + r.appts.map((a, i) => '<div class="row"><div style="flex:none;width:62px;font:600 14px var(--f-display)">' + new Date(a.start).toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit'}) + '</div><div class="main"><b>' + esc(a.contact || a.title) + '</b><small>' + esc(a.title + (a.calendar ? ' · ' + a.calendar : '')) + '</small></div><div class="end"><select class="input" style="height:30px;width:auto;font-size:12.5px" data-i="' + i + '" aria-label="Status">' + [['booked', 'Booked'], ['confirmed', 'Confirmed'], ['showed', 'Showed'], ['noshow', 'No-show'], ['cancelled', 'Cancelled']].map(s => '<option value="' + s[0] + '"' + (a.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select> <button class="btn sm ghost" type="button" data-mv="' + i + '" title="Move">' + ic('clock', 14) + '</button></div></div>').join('') + '</div>' : empty('No bookings this day');
    el.querySelectorAll('select[data-i]').forEach(s => s.addEventListener('change', async () => { const a = r.appts[Number(s.dataset.i)]; if (s.value === 'booked') return; const x = await ghl('apptStatus', {id: a.id, status: s.value}); LV.toast(x.error || 'Saved'); }));
    el.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => { const a = r.appts[Number(b.dataset.mv)], len = (a.end - a.start) || 36e5, loc = new Date(a.start - new Date(a.start).getTimezoneOffset() * 6e4).toISOString();
      LV.modal('<h2>Move booking</h2><form style="margin-top:14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="field"><span>Date</span><input class="input" type="date" name="d" value="' + loc.slice(0, 10) + '"></label><label class="field"><span>Start</span><input class="input" type="time" name="t" value="' + loc.slice(11, 16) + '"></label></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn go">Move booking</button></div></form>', (m, close) => {
        m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const st = new Date(e.target.d.value + 'T' + e.target.t.value).getTime(); const x = await ghl('apptMove', {id: a.id, start: st, end: st + len}); if (x.error) return LV.toast(x.error); close(); LV.toast('Booking moved'); W.ghl_appts.draw(el, {it, acts}); });
      }); }));
  }};

W.ghl_convs = {g: 'Sales desk', t: 'Conversations', d: 'The latest texts and emails. See who’s waiting and reply without leaving.', ic: 'chat', tint: '#3E7CB1', c: 12, sk: 'list', ok: desk(1),
  async draw(el, {it}) {
    it.__u = !!it.__u;
    el.innerHTML = '<div class="chips" style="margin-bottom:10px"><button class="chip' + (it.__u ? '' : ' on') + '" type="button" data-u="0">All</button><button class="chip' + (it.__u ? ' on' : '') + '" type="button" data-u="1">Waiting for a reply</button></div><div data-l>' + LV.skel('list') + '</div>';
    el.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { it.__u = b.dataset.u === '1'; W.ghl_convs.draw(el, {it}); }));
    const r = await ghl('convs', {unread: it.__u}), L = el.querySelector('[data-l]'); if (r.error) return L.innerHTML = empty('Couldn’t load conversations', r.error);
    L.innerHTML = r.convs.length ? '<div class="rows">' + r.convs.map(c => '<div class="row click" data-c="' + c.contactId + '">' + LV.av(c.name) + '<div class="main"><b>' + esc(c.name) + (c.unread ? ' <span class="pill brass">' + c.unread + ' new</span>' : '') + '</b><small>' + (c.dir === 'outbound' ? 'You: ' : '') + esc(c.last) + '</small></div><div class="end"><span class="pill">' + esc(c.type || 'message') + '</span><div><small style="color:var(--ink-3)">' + esc(when(c.at)) + '</small></div></div></div>').join('') + '</div>' : empty(it.__u ? 'Nobody is waiting' : 'No conversations yet');
    L.querySelectorAll('[data-c]').forEach(x => x.addEventListener('click', () => contactDrawer(x.dataset.c)));
  }};

W.ghl_camp = {g: 'Sales desk', t: 'Campaigns', d: 'Write a text or email, pick who gets it by tag, preview it and send.', ic: 'send', tint: '#D1495B', c: 12, sk: 'list', ok: desk(2),
  async draw(el) {
    el.innerHTML = '<form data-c style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:22px"><div>' +
      '<div class="seg light" style="margin-bottom:12px"><button type="button" data-ty="SMS" class="on">Text</button><button type="button" data-ty="Email">Email</button></div>' +
      '<label class="field"><span>Send to contacts tagged</span><div class="chips" data-tags><span class="hint">Loading tags…</span></div><div class="hint">No tag picked sends to everyone who can receive it.</div></label>' +
      '<label class="field" data-subj hidden><span>Subject</span><input class="input" name="subject"></label>' +
      '<label class="field"><span>Message</span><textarea class="input" name="m" rows="6" placeholder="Hi {{first_name}}, …"></textarea><div class="hint">Use {{first_name}}, {{last_name}} or {{company}} to personalize.</div></label>' +
      '<div style="display:flex;gap:8px"><button class="btn" type="button" data-prev>Preview recipients</button><button class="btn go" type="submit" disabled>Send campaign</button></div></div>' +
      '<div><div class="sec" style="margin-top:0">Preview</div><div data-out class="empty" style="border:1px dashed var(--line);border-radius:14px">Pick a tag and choose Preview recipients.</div></div></form>';
    const f = el.querySelector('form'), tagsEl = el.querySelector('[data-tags]'), out = el.querySelector('[data-out]'), send = f.querySelector('[type=submit]');
    let type = 'SMS', picked = new Set(), people = [];
    f.querySelectorAll('[data-ty]').forEach(b => b.addEventListener('click', () => { type = b.dataset.ty; f.querySelectorAll('[data-ty]').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('[data-subj]').hidden = type !== 'Email'; send.disabled = true; }));
    ghl('tags').then(r => { tagsEl.innerHTML = (r.tags || []).length ? r.tags.map(t => '<button class="chip" type="button" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') : '<span class="hint">No tags in your CRM yet.</span>'; tagsEl.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { b.classList.toggle('on'); b.classList.contains('on') ? picked.add(b.dataset.t) : picked.delete(b.dataset.t); send.disabled = true; })); });
    const merge = (t, p) => String(t || '').replace(/\{\{\s*first_?name\s*\}\}/gi, p.first || (p.name || '').split(' ')[0] || 'there').replace(/\{\{\s*last_?name\s*\}\}/gi, p.last || '').replace(/\{\{\s*company\s*\}\}/gi, p.company || '');
    f.querySelector('[data-prev]').addEventListener('click', async e => {
      const b = e.currentTarget; b.classList.add('busy'); const r = await ghl('campaignPreview', {tags: [...picked], type}); b.classList.remove('busy');
      if (r.error) return LV.toast(r.error); people = r.people;
      out.className = ''; out.innerHTML = '<p style="margin:0 0 10px"><b class="num">' + fmt(r.total) + '</b> people will get this ' + (type === 'SMS' ? 'text' : 'email') + '.</p>' + people.slice(0, 3).map(p => '<div class="msg out" style="max-width:100%;margin-bottom:8px">' + (type === 'Email' ? '<b>' + esc(merge(f.subject.value, p)) + '</b>\n' : '') + esc(merge(f.m.value, p) || '(empty message)') + '<small>to ' + esc(p.name || p.email || p.phone) + '</small></div>').join('');
      send.disabled = !people.length || !f.m.value.trim();
    });
    f.addEventListener('submit', async e => {
      e.preventDefault(); if (!people.length) return;
      if (!await LV.confirm('Send to ' + fmt(people.length) + ' people?', 'This sends right away through your CRM and can’t be undone.', 'Send campaign')) return;
      send.classList.add('busy'); const map = {}; people.forEach(p => { map[p.id] = {first: p.first, last: p.last, name: p.name, company: p.company, email: p.email}; });
      const r = await ghl('campaignSend', {type, message: f.m.value, subject: f.subject.value, contactIds: people.map(p => p.id), people: map});
      send.classList.remove('busy'); if (r.error) return LV.toast(r.error);
      LV.toast('Campaign sent to ' + fmt(r.sent) + (r.failed ? ' (' + r.failed + ' failed)' : '')); f.m.value = ''; send.disabled = true;
    });
  }};

/* ================= VAULT ASSISTANT ================= */
const bot = {open: false, msgs: [], domain: ''};
LV.botMount = function (c) {
  document.querySelectorAll('.bot-fab').forEach(x => x.remove());
  if (!c.bot) { document.querySelectorAll('.bot').forEach(x => x.remove()); return; }
  if (bot.domain !== c.domain) { bot.msgs = []; bot.domain = c.domain; document.querySelectorAll('.bot').forEach(x => x.remove()); bot.open = false; }
  const fab = document.createElement('button'); fab.className = 'bot-fab'; fab.type = 'button'; fab.innerHTML = '<span class="dot">' + ic('spark', 15) + '</span>Ask about your numbers';
  fab.addEventListener('click', () => { bot.open ? closeBot() : openBot(); });
  document.body.appendChild(fab);
  if (bot.open && !document.querySelector('.bot')) openBot();
  if (!bot.warm) { bot.warm = 1; api('portalChatWarm', {session: S().session}); }
};
function closeBot() { bot.open = false; document.querySelectorAll('.bot').forEach(x => x.remove()); }
function openBot() {
  bot.open = true; document.querySelectorAll('.bot').forEach(x => x.remove());
  const b = document.createElement('div'); b.className = 'bot'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Ask about your numbers');
  b.innerHTML = '<div class="bot-h"><span class="dot" style="width:30px;height:30px;border-radius:50%;background:var(--brass);display:grid;place-items:center;color:var(--vault-ink)">' + ic('spark', 16) + '</span><div style="flex:1"><b>Vault assistant</b><div style="font-size:12px;opacity:.7">Answers from your dashboard’s numbers</div></div><button class="iconbtn" type="button" data-x aria-label="Close" style="width:34px;height:34px">' + ic('x', 16) + '</button></div><div class="bot-b" data-b></div><form class="bot-f"><input class="input" name="q" placeholder="Ask anything about your leads" autocomplete="off"><button class="btn go" aria-label="Send">' + ic('send', 16) + '</button></form>';
  document.body.appendChild(b);
  b.querySelector('[data-x]').addEventListener('click', closeBot);
  const body = b.querySelector('[data-b]'), f = b.querySelector('form');
  const paint = (typing) => {
    body.innerHTML = (bot.msgs.length ? '' : '<div class="msg in">Hi! Ask me about your leads, calls, deals or website for the period you’ve picked.</div><div class="bot-q">' + ['How many leads did we get?', 'Which source brings the most leads?', 'How many calls did we miss?', 'What should we focus on this week?'].map(q => '<button class="chip" type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>') +
      bot.msgs.map(m => '<div class="msg ' + (m.role === 'user' ? 'out' : 'in') + '">' + esc(m.text) + '</div>').join('') + (typing ? '<div class="msg in typing" aria-label="Thinking"><span></span><span></span><span></span></div>' : '');
    body.scrollTop = body.scrollHeight;
    body.querySelectorAll('[data-q]').forEach(x => x.addEventListener('click', () => ask(x.dataset.q)));
  };
  const ask = async q => {
    bot.msgs.push({role: 'user', text: q}); paint(true);
    const r = await api('portalChat', {session: S().session, domain: S().domain, period: S().period, q, history: bot.msgs.slice(0, -1)});
    bot.msgs.push({role: 'assistant', text: r.error || r.answer}); paint(false);
  };
  f.addEventListener('submit', e => { e.preventDefault(); const q = f.q.value.trim(); if (!q) return; f.q.value = ''; ask(q); });
  paint(false); f.q.focus();
}
})();
