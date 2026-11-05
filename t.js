/* Leadvault website snippet
   Sends two things to the business's Leadvault dashboard: form submissions and taps on a phone
   number. No cookies, no tracking across sites, never passwords or payment fields. The last way
   the visitor arrived (Google, an ad, social, an AI assistant, another site, direct) is remembered
   on this site only, so each lead shows where it came from.

   <script src="https://haytham-mahir.github.io/leadvault/t.js" data-site="example.com" data-key="..." async></script> */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[data-key][src*="/t.js"]');
  if (!me || window.__leadvault) return;
  window.__leadvault = 1;
  var SITE = me.getAttribute('data-site'), KEY = me.getAttribute('data-key');
  var API = me.getAttribute('data-api') || 'https://script.google.com/macros/s/AKfycbzm_yKlKiclz8c2eEQ9PFSGWPKSH9-PvIgeOYJ6QokJpgZaYVm3jJZ9yyjEBQLk-uNjPA/exec';
  if (!SITE || !KEY) return;

  /* ---------- where the visitor came from ---------- */
  function arrival() {
    var q = {}, ref = '', host = '';
    try { location.search.replace(/^\?/, '').split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) q[decodeURIComponent(kv[0]).toLowerCase()] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); }); } catch (e) {}
    try { ref = document.referrer; host = ref ? new URL(ref).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (host && host === location.hostname.replace(/^www\./, '')) host = '';
    var m = (q.utm_medium || '').toLowerCase(), so = (q.utm_source || '').toLowerCase(), ch;
    var AI = /chatgpt|openai|perplexity|gemini\.google|bard\.google|copilot\.microsoft|claude\.ai|meta\.ai|deepseek|grok\.com|mistral\.ai|you\.com|phind/;
    if (q.gclid || q.gbraid || q.wbraid || q.msclkid || /cpc|ppc|paid/.test(m)) ch = 'Paid search';
    else if (q.fbclid || /social/.test(m)) ch = 'Social';
    else if (/e-?mail|newsletter/.test(m)) ch = 'Email';
    else if (AI.test(host) || AI.test(so)) ch = 'AI assistant';
    else if (so) ch = 'Campaign';
    else if (/(^|\.)(google|bing|yahoo|duckduckgo|ecosia|baidu|yandex)\./.test(host)) ch = 'Organic search';
    else if (/facebook|instagram|linkedin|twitter|^t\.co$|tiktok|pinterest|youtube|reddit/.test(host)) ch = 'Social';
    else if (host) ch = 'Referral';
    else ch = 'Direct';
    var med = m || (ch === 'Organic search' ? 'organic' : ch === 'Paid search' ? 'cpc' : host ? 'referral' : '(none)');
    return { ch: ch, s: (so || host || (q.gclid ? 'google' : '(direct)')) + ' / ' + med };
  }
  var came = null;
  try { came = JSON.parse(localStorage.getItem('lv_came') || 'null'); } catch (e) {}
  var now = arrival();
  if (!came || now.ch !== 'Direct') { came = now; try { localStorage.setItem('lv_came', JSON.stringify(came)); } catch (e) {} }

  function send(o) {
    o.action = 'siteHit'; o.d = SITE; o.k = KEY; o.p = location.pathname.slice(0, 250); o.ch = came.ch; o.s = came.s;
    o.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var body = JSON.stringify(o);
    try { if (navigator.sendBeacon && navigator.sendBeacon(API, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return; } catch (e) {}
    try { fetch(API, { method: 'POST', body: body, mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }); } catch (e) {}
  }

  /* A heartbeat at most every 12 hours per visitor, so the console can show the snippet is
     installed before the first lead. It carries no visitor details. */
  try { var lp = Number(localStorage.getItem('lv_ping') || 0); if (Date.now() - lp > 432e5) { localStorage.setItem('lv_ping', String(Date.now())); setTimeout(function () { send({ t: 'ping' }); }, 1500); } } catch (e) {}

  /* ---------- forms ---------- */
  var SKIP = /pass|card|cc-?num|cvv|cvc|expir|ssn|social.?ins|sin\b|iban|routing|account.?num|security|captcha|recaptcha|token|nonce|honeypot|_wp|g-recaptcha/i;
  function labelOf(el) {
    var t = '';
    try { if (el.id) { var l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]'); if (l) t = l.textContent; } } catch (e) {}
    if (!t && el.closest) { var w = el.closest('label'); if (w) t = w.textContent; }
    t = t || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || '';
    return String(t).replace(/\s+/g, ' ').replace(/[*:\s]+$/, '').trim().slice(0, 60);
  }
  function grab(form) {
    var f = {}, n = 0, trap = false;
    Array.prototype.forEach.call(form.elements || [], function (el) {
      var type = (el.type || '').toLowerCase(), name = el.name || el.id || '';
      if (!name || el.disabled) return;
      if (/^(submit|button|reset|file|image|password|hidden)$/.test(type)) return;
      if ((type === 'checkbox' || type === 'radio') && !el.checked) return;
      var label = labelOf(el);
      if (SKIP.test(name) || SKIP.test(label) || /cc-/.test(el.getAttribute('autocomplete') || '')) return;
      var v = String(el.value || '').trim();
      if (!v) return;
      if (el.offsetParent === null && type !== 'checkbox' && type !== 'radio' && !/select/.test(el.tagName.toLowerCase())) { if (/hp|honey|website|url|trap/i.test(name)) trap = true; return; }
      var k = label || name;
      f[k] = f[k] ? f[k] + ', ' + v.slice(0, 1000) : v.slice(0, 1000);
      n++;
    });
    return trap || !n ? null : f;
  }
  var GENERIC = /^(form|forms?\s*\d*|contact|contact\s*form\s*\d*|new form|untitled( form)?|wpforms-form-\d+|gform_\d+|elementor-form|\d+)$/i;
  function txt(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100) : ''; }
  function okName(t) { return t && t.length > 1 && t.length <= 90 && !GENERIC.test(t) ? t : ''; }
  function formName(form) {
    var t = okName(form.getAttribute('aria-label') || '') || okName(form.getAttribute('data-name') || '') || okName(form.getAttribute('data-form-name') || '') || okName(form.getAttribute('name') || '');
    if (!t) t = okName(txt(form.querySelector('legend, h1, h2, h3, h4, .gform_title, .wpforms-title, .et_pb_contact_main_title')));
    for (var el = form, i = 0; !t && el && el !== document.body && i < 4; i++, el = el.parentElement) {
      for (var s = el.previousElementSibling; s && !t; s = s.previousElementSibling) {
        if (s.tagName === 'FORM' || (s.querySelector && s.querySelector('form'))) { i = 9; break; }
        var h = /^H[1-4]$/.test(s.tagName) ? s : (s.querySelectorAll ? s.querySelectorAll('h1, h2, h3, h4') : []);
        if (h && h.length !== undefined) h = h[h.length - 1];
        t = okName(txt(h));
      }
    }
    return t || okName(String(document.title || '').split(/\s+[|–—-]\s+/)[0].trim()) || 'Website form';
  }
  function rejected(form) {
    if (!form.isConnected) return false;
    return !!form.querySelector('[aria-invalid="true"], .wpcf7-not-valid, .gfield_error, .wpforms-error, .is-invalid, .has-error');
  }
  function onForm(form) {
    var f = grab(form); if (!f) return;
    var email = '', phone = '', name = '', first = '', last = '';
    Object.keys(f).forEach(function (k) {
      var v = f[k];
      if (!email && (/e-?mail/i.test(k) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))) email = v;
      else if (!phone && /phone|tel|mobile|cell/i.test(k)) phone = v;
      else if (!first && /first|given/i.test(k) && /name/i.test(k)) first = v;
      else if (!last && /last|sur|family/i.test(k) && /name/i.test(k)) last = v;
      else if (!name && /name/i.test(k) && !/company|business|organi/i.test(k)) name = v;
    });
    if (first || last) name = (first + ' ' + last).trim();
    if (!email && !phone) return;
    var dk = 'lv_sent_' + (email + '|' + phone).toLowerCase().replace(/[^a-z0-9@|.+-]/g, '').slice(0, 80);
    try { if (Date.now() - Number(sessionStorage.getItem(dk) || 0) < 18e5) return; } catch (e) {}
    var hit = { t: 'form', form: formName(form).slice(0, 100), f: f, email: email, phone: phone, name: name };
    var done = false;
    function go() { if (done) return; done = true; window.removeEventListener('pagehide', go); try { sessionStorage.setItem(dk, String(Date.now())); } catch (e) {} send(hit); }
    window.addEventListener('pagehide', go);
    setTimeout(function () { if (done) return; if (rejected(form)) { done = true; window.removeEventListener('pagehide', go); return; } go(); }, 1800);
  }
  document.addEventListener('submit', function (e) { var t = e.target; if (t && t.tagName === 'FORM') { try { onForm(t); } catch (err) {} } }, true);

  /* ---------- phone taps ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
    if (!a) return;
    var num = ''; try { num = decodeURIComponent(a.getAttribute('href').slice(4)); } catch (err) { num = a.getAttribute('href').slice(4); }
    send({ t: 'tap', phone: num.replace(/[^\d+()\-.\s]/g, '').slice(0, 40) });
  }, true);
})();
