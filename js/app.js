(() => {
  'use strict';
  /* ---------- sample data ---------- */
  const SERVICES = [
    { id: 'cut',   name: 'Classic haircut',   mins: 30, price: 250, note: 'Wash, cut and style.' },
    { id: 'beard', name: 'Beard trim',        mins: 30, price: 150, note: 'Shape, line-up and hot towel.' },
    { id: 'combo', name: 'Cut and beard',     mins: 60, price: 350, note: 'The full tidy-up.' },
    { id: 'kids',  name: 'Kids haircut',      mins: 30, price: 180, note: 'Under 12 years old.' }
  ];
  const OPEN = 10, CLOSE = 19, STEP = 30, DAYS = 14, LEAD_MIN = 60;
  const KEY = 'bluebird.bookings', ENQ = 'bluebird.enquiries';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rupee = n => '₹' + n;

  /* ---------- storage (works even when blocked) ---------- */
  const mem = {};
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return mem[k] || []; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { mem[k] = v; } }
  };

  /* ---------- dates ---------- */
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const hm = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  const nice = s => fromIso(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const nowFn = () => (window.__now ? new Date(window.__now) : new Date());

  /* A fixed pseudo-random pattern so some slots are always "taken" for the same date. */
  function sampleTaken(dateStr, minute) {
    let h = 2166136261;
    for (const c of `${dateStr}|${minute}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100) < 32;
  }
  function slotBlocked(dateStr, minute, bookings) {
    if (sampleTaken(dateStr, minute)) return true;
    return bookings.some(b => b.status === 'active' && b.date === dateStr &&
      minute < b.start + b.mins && minute + STEP > b.start);
  }
  function tooSoon(dateStr, minute) {
    const t = fromIso(dateStr); t.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return t.getTime() < nowFn().getTime() + LEAD_MIN * 60000;
  }
  function freeStarts(dateStr, mins, bookings) {
    const out = [];
    for (let m = OPEN * 60; m + mins <= CLOSE * 60; m += STEP) {
      let ok = !tooSoon(dateStr, m);
      for (let x = m; ok && x < m + mins; x += STEP) if (slotBlocked(dateStr, x, bookings)) ok = false;
      out.push({ m, ok });
    }
    return out;
  }
  function openDates() {
    const out = []; const base = nowFn(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS + 7 && out.length < DAYS; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      if (d.getDay() !== 0) out.push(iso(d));
    }
    return out;
  }

  /* ---------- state ---------- */
  const state = { step: 1, svc: null, date: null, start: null, details: {} };
  const svcOf = id => SERVICES.find(s => s.id === id);

  /* ---------- helpers ---------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
  function say(msg) { const l = $('#live'); l.textContent = ''; setTimeout(() => l.textContent = msg, 30); }
  function setErr(id, msg, input) { const e = $('#' + id); e.textContent = msg || ''; if (input) { input.setAttribute('aria-invalid', msg ? 'true' : 'false'); } }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- services ---------- */
  $('#svcList').innerHTML = SERVICES.map(s => `<li><h3>${s.name}</h3><p>${s.note}</p><p>${s.mins} minutes</p><div class="price">${rupee(s.price)}</div></li>`).join('');
  $('#svcChoices').insertAdjacentHTML('beforeend', SERVICES.map(s =>
    `<label class="choice"><input type="radio" name="svc" value="${s.id}"><span class="t"><strong>${s.name}</strong><small>${s.mins} minutes · ${s.note}</small></span><span class="p">${rupee(s.price)}</span></label>`).join(''));

  /* ---------- wizard ---------- */
  function go(n, focus = true) {
    state.step = n;
    $$('.step').forEach(p => p.hidden = Number(p.dataset.panel) !== n);
    $$('#steps li').forEach(li => {
      const k = Number(li.dataset.step);
      li.classList.toggle('on', k === n); li.classList.toggle('done', k < n || n === 5);
      if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (n === 2) renderDates();
    if (n === 4) renderSummary();
    if (focus) { const h = $(`[data-panel="${n}"] h3`); if (h) { h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start', behavior: 'smooth' }); } say(h ? h.textContent : ''); }
  }

  function renderDates() {
    const bookings = store.get(KEY);
    const wrap = $('#dates');
    wrap.innerHTML = openDates().map(d => {
      const dt = fromIso(d);
      const any = freeStarts(d, state.svc.mins, bookings).some(x => x.ok);
      return `<button type="button" class="date" role="radio" aria-checked="${d === state.date}" data-date="${d}" ${any ? '' : 'disabled'} aria-label="${nice(d)}${any ? '' : ', fully booked'}"><span>${dt.toLocaleDateString('en-IN', { weekday: 'short' })}</span><b>${dt.getDate()}</b><span>${dt.toLocaleDateString('en-IN', { month: 'short' })}</span></button>`;
    }).join('');
    if (!state.date || $(`.date[data-date="${state.date}"]`).disabled) {
      const first = $('.date:not([disabled])'); state.date = first ? first.dataset.date : null; state.start = null;
      if (first) first.setAttribute('aria-checked', 'true');
    }
    renderSlots();
  }
  function renderSlots() {
    const box = $('#slots');
    if (!state.date) { box.innerHTML = '<p class="hint">No free times in the next two weeks. Please send an enquiry.</p>'; $('#slotsTitle').textContent = 'Available times'; return; }
    $('#slotsTitle').textContent = `Available times on ${nice(state.date)}`;
    const list = freeStarts(state.date, state.svc.mins, store.get(KEY));
    if (state.start !== null && !list.find(x => x.m === state.start && x.ok)) state.start = null;
    box.innerHTML = list.map(x => `<button type="button" class="slot" role="radio" aria-checked="${x.m === state.start}" data-m="${x.m}" ${x.ok ? '' : 'disabled'} aria-label="${hm(x.m)}${x.ok ? '' : ', not available'}">${hm(x.m)}</button>`).join('');
  }

  function validateDetails() {
    const n = $('#fName'), p = $('#fPhone'), e = $('#fEmail'); let ok = true, first = null;
    const bad = (id, input, msg) => { setErr(id, msg, input); ok = false; first = first || input; };
    n.value.trim().length >= 2 ? setErr('eName', '', n) : bad('eName', n, 'Enter your name (at least 2 letters).');
    const digits = p.value.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
    /^[6-9]\d{9}$/.test(digits) ? setErr('ePhone', '', p) : bad('ePhone', p, 'Enter a 10-digit Indian mobile number, for example 98765 43210.');
    (!e.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.value.trim())) ? setErr('eEmail', '', e) : bad('eEmail', e, 'That email looks incomplete. Use a format like name@example.com, or leave it empty.');
    if (first) { first.focus(); say('Please fix the highlighted fields.'); }
    else state.details = { name: n.value.trim(), phone: digits, email: e.value.trim(), note: $('#fNote').value.trim() };
    return ok;
  }
  function renderSummary() {
    const s = state.svc, d = state.details;
    const rows = [['Service', s.name], ['Date', nice(state.date)], ['Time', `${hm(state.start)} to ${hm(state.start + s.mins)}`], ['Price', rupee(s.price) + ' (pay in shop)'], ['Name', d.name], ['Mobile', d.phone]];
    if (d.email) rows.push(['Email', d.email]); if (d.note) rows.push(['Note', d.note]);
    $('#summary').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  }
  function newCode() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = '';
    const r = new Uint32Array(5); (crypto || window.crypto).getRandomValues(r); r.forEach(v => c += A[v % A.length]);
    return 'BB-' + c;
  }
  function confirm() {
    const bookings = store.get(KEY);
    // Re-check at the last moment so a slot can never be double-booked.
    const stillFree = freeStarts(state.date, state.svc.mins, bookings).find(x => x.m === state.start && x.ok);
    if (!stillFree) { setErr('e4', 'Sorry, that time was just taken. Please choose another one.'); go(2); return; }
    const b = { code: newCode(), svc: state.svc.id, svcName: state.svc.name, price: state.svc.price, mins: state.svc.mins, date: state.date, start: state.start, ...state.details, status: 'active', made: Date.now() };
    bookings.push(b); store.set(KEY, bookings);
    $('#doneCode').textContent = b.code;
    $('#doneText').textContent = `${b.svcName}, ${nice(b.date)} at ${hm(b.start)}. Show this code at the shop. You can cancel any time from My bookings.`;
    setErr('e4', ''); renderMine(); go(5);
  }

  /* ---------- my bookings ---------- */
  function renderMine() {
    const list = store.get(KEY).filter(b => b.status === 'active').sort((a, b) => (a.date + hm(a.start)).localeCompare(b.date + hm(b.start)));
    const nowT = nowFn().getTime();
    $('#mineList').innerHTML = list.map(b => {
      const t = fromIso(b.date); t.setHours(0, b.start, 0, 0); const past = t.getTime() < nowT;
      return `<li class="bk"><div><h3>${esc(b.svcName)} <span class="badge ${past ? 'past' : ''}">${past ? 'Past' : 'Upcoming'}</span></h3><p>${nice(b.date)} at ${hm(b.start)} · ${rupee(b.price)}</p><p>Code <strong>${b.code}</strong></p></div>${past ? '' : `<button class="btn ghost" type="button" data-cancel="${b.code}" aria-label="Cancel booking ${b.code}">Cancel booking</button>`}</li>`;
    }).join('');
    const c = $('#mineCount'); const up = list.length; c.textContent = up; c.hidden = !up;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.matches('[data-next]')) {
      if (state.step === 1) { if (!state.svc) { setErr('e1', 'Please choose a service to continue.'); return; } setErr('e1', ''); go(2); }
      else if (state.step === 2) { if (!state.date || state.start === null) { setErr('e2', 'Please choose a date and a time.'); return; } setErr('e2', ''); go(3); }
      else if (state.step === 3) { if (validateDetails()) go(4); }
    } else if (t.matches('[data-back]')) go(state.step - 1);
    else if (t.id === 'confirmBtn') confirm();
    else if (t.id === 'againBtn') { Object.assign(state, { svc: null, date: null, start: null, details: {} }); $$('input[name=svc]').forEach(i => i.checked = false); $('#detailsForm').reset(); go(1); }
    else if (t.classList.contains('date')) { state.date = t.dataset.date; state.start = null; $$('.date').forEach(d => d.setAttribute('aria-checked', d === t)); renderSlots(); }
    else if (t.classList.contains('slot')) { state.start = Number(t.dataset.m); setErr('e2', ''); $$('.slot').forEach(s => s.setAttribute('aria-checked', s === t)); say(`${hm(state.start)} selected`); }
    else if (t.dataset.cancel) {
      if (!window.confirm('Cancel this booking?')) return;
      const all = store.get(KEY); const b = all.find(x => x.code === t.dataset.cancel); if (b) b.status = 'cancelled';
      store.set(KEY, all); renderMine(); toast('Booking cancelled. The slot is free again.');
    }
  });
  $('#svcChoices').addEventListener('change', e => { state.svc = svcOf(e.target.value); state.start = null; setErr('e1', ''); });
  // arrow-key support for the radio-style date and slot groups
  ['#dates', '#slots'].forEach(sel => $(sel).addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const items = $$('button:not([disabled])', e.currentTarget); const i = items.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault(); const n = items[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + items.length) % items.length]; n.focus();
  }));
  $('#detailsForm').addEventListener('submit', e => e.preventDefault());

  /* ---------- enquiry (sample: nothing is sent) ---------- */
  $('#enqForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#enqForm [name=_gotcha]').value) return;
    const n = $('#qName'), m = $('#qEmail'), g = $('#qMsg'); let ok = true, first = null;
    const bad = (id, i, msg) => { setErr(id, msg, i); ok = false; first = first || i; };
    n.value.trim().length >= 2 ? setErr('eqName', '', n) : bad('eqName', n, 'Please enter your name.');
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.value.trim()) ? setErr('eqEmail', '', m) : bad('eqEmail', m, 'Enter a valid email so we can reply.');
    g.value.trim().length >= 10 ? setErr('eqMsg', '', g) : bad('eqMsg', g, 'Write at least a short sentence (10 characters).');
    if (!ok) { first.focus(); return; }
    const all = store.get(ENQ); all.push({ name: n.value.trim(), email: m.value.trim(), topic: $('#qTopic').value, msg: g.value.trim(), at: Date.now() }); store.set(ENQ, all);
    $('#enqStatus').textContent = 'Thanks! This is a sample shop, so your message was saved in this browser only and not sent.';
    e.target.reset();
  });

  renderMine(); go(1, false);
})();
