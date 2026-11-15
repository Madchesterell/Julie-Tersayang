/* =========================================================
   MILOLOO & REROLL — Ruang Privat Berdua
   Vanilla JS · localStorage (jb.state.v2) · nol dependensi
   ========================================================= */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const KEY = 'jb.state.v2';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NAMES = {
    julie: { full: 'Julie Cahya Karmila', nick: 'Miloloo' },
    abyant: { full: 'Jalu Farrel Abyantara', nick: 'Reroll' }
  };

  const MOODS = [
    { key: 'happy', emoji: '😊', label: 'Happy', msg: 'Senyum terus hari ini! 🌟' },
    { key: 'capek', emoji: '😴', label: 'Capek', msg: 'Istirahat dulu, jangan dipaksa. Peluk jauh. 🤍' },
    { key: 'kangen', emoji: '🥰', label: 'Kangen', msg: 'Sama. Ayo telepon sebentar nanti. 📞' },
    { key: 'sensitif', emoji: '🥺', label: 'Sensitif', msg: 'Pelan-pelan ya. Aku dengerin, nggak akan nyela. 🫂' },
    { key: 'semangat', emoji: '🔥', label: 'Semangat', msg: 'Gas! Aku dukung penuh hari ini. 💪' },
    { key: 'pelukan', emoji: '🫂', label: 'Butuh Pelukan', msg: 'Anggap ini pelukan paling lama. 🤗' }
  ];

  const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)(\?|#|$)/i;
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  function httpUrl(u) {
    try {
      const url = new URL(String(u || '').trim());
      return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
    } catch { return ''; }
  }
  const fmtDay = (isoDate) => {
    const d = new Date(isoDate + 'T00:00:00');
    return isNaN(d) ? isoDate : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };
  const fmtFull = (isoDate) => {
    const d = new Date(isoDate + 'T00:00:00');
    return isNaN(d) ? isoDate : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const fmtStamp = (ms) => ms ? new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 864e5);

  /* ═════════ STATE ═════════ */
  function defaults() {
    return {
      version: 2,
      meta: { score: 100, hugs: 0, theme: 'light' },
      events: [
        { id: uid(), name: 'First Meet / Kenalan', date: '2026-01-12' },
        { id: uid(), name: 'Official Dating', date: '2026-02-25' }
      ],
      redDay: { lastStart: '2026-06-01', cycleLength: 28, statusMode: 'auto', manualStatus: 'Perhatian & Sayang Ekstra' },
      moods: {
        julie: { mood: 'happy', note: '', updatedAt: null, history: [] },
        abyant: { mood: 'semangat', note: '', updatedAt: null, history: [] }
      },
      gallery: [
        { id: uid(), title: 'Ngobrol santai sore hari', src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80', standIn: true },
        { id: uid(), title: 'Jajan boba bareng', src: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=600&q=80', standIn: true }
      ],
      reminders: [{ id: uid(), text: 'Minum air putih & istirahat sebentar', time: '14:00' }],
      todos: [
        { id: uid(), text: 'Selesaikan tugas sekolah tepat waktu', state: 'active' },
        { id: uid(), text: 'Rencana kencan akhir pekan', state: 'done' }
      ],
      capsules: [{ id: uid(), title: 'Untuk Miloloo di ulang tahun', msg: 'Semoga makin sukses dan bahagia selalu!', openDate: '2027-01-01' }],
      songs: [
        { id: uid(), title: 'Lagu Kita — Indie Vibe', note: 'Satu lagu buat nemenin Miloloo nugas hari ini.', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', kind: 'audio' },
        { id: uid(), title: 'Semangat Pagi — Acoustic', note: 'Buat pembuka hari sebelum berangkat.', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', kind: 'audio' }
      ],
      places: [
        { id: uid(), name: 'Kafe Favorit', location: 'Jl. Merdeka, pusat kota', memory: 'Tempat pertama kali ngobrol sampai lupa waktu.' },
        { id: uid(), name: 'Sekolah Kita', location: 'Kawasan pendidikan', memory: 'Ketemu di koridor, pura-pura nggak sengaja.' },
        { id: uid(), name: 'Taman Sore', location: 'Taman kota', memory: 'Duduk berdua sambil lihat langit berubah oranye.' }
      ],
      coupons: {
        available: [
          { id: uid(), title: 'Kupon Ditraktir Boba', desc: 'Tukarkan kapan saja saat kita jalan bareng.' },
          { id: uid(), title: 'Kupon Ditemenin Curhat', desc: 'Reroll siap mendengarkan cerita sampai ngantuk.' },
          { id: uid(), title: 'Kupon Bantuan Tugas', desc: 'Bantuan penuh buat ngerjain tugas sekolah atau animasi.' }
        ],
        claimed: []
      },
      dreams: [
        { id: uid(), text: 'Nonton konser musik bareng', state: 'active' },
        { id: uid(), text: 'Kuliah dan sukses di bidang impian', state: 'active' }
      ]
    };
  }

  function migrate() {
    const s = defaults();
    const read = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };

    s.meta.score = Number(localStorage.getItem('j-score') || 100);
    s.meta.hugs = Number(localStorage.getItem('j-hugs') || 0);
    s.meta.theme = localStorage.getItem('julie-theme') || 'light';

    const oldEvents = read('j-events', []);
    if (Array.isArray(oldEvents) && oldEvents.length) {
      oldEvents.forEach((e) => {
        if (e && e.name) s.events.push({ id: uid(), name: String(e.name), date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : iso() });
      });
    }
    const oldRed = localStorage.getItem('j-red-date');
    if (oldRed) s.redDay.lastStart = oldRed;

    const oldGallery = read('j-gallery', null);
    if (Array.isArray(oldGallery) && oldGallery.length) {
      s.gallery = oldGallery.filter((g) => g && g.img).map((g) => ({ id: uid(), title: String(g.title || 'Momen'), src: String(g.img), standIn: /unsplash\.com/.test(g.img) }));
    }
    const oldRem = read('j-reminders', null);
    if (Array.isArray(oldRem) && oldRem.length) s.reminders = oldRem.filter((r) => r && r.text).map((r) => ({ id: uid(), text: String(r.text), time: /^\d{2}:\d{2}$/.test(r.time) ? r.time : '08:00' }));

    const oldTodos = read('j-todos', null);
    if (Array.isArray(oldTodos) && oldTodos.length) s.todos = oldTodos.filter((t) => t && t.text).map((t) => ({ id: uid(), text: String(t.text), state: t.completed ? 'done' : 'active' }));

    const oldCaps = read('j-capsules', null);
    if (Array.isArray(oldCaps) && oldCaps.length) s.capsules = oldCaps.filter((c) => c && c.title).map((c) => ({ id: uid(), title: String(c.title), msg: String(c.msg || ''), openDate: c.date || iso() }));

    const oldDreams = read('j-dreams', null);
    if (Array.isArray(oldDreams) && oldDreams.length) s.dreams = oldDreams.filter((d) => d && d.text).map((d) => ({ id: uid(), text: String(d.text), state: d.completed ? 'done' : 'active' }));

    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { const s = migrate(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
      const parsed = JSON.parse(raw);
      const base = defaults();
      const merged = Object.assign(base, parsed);
      merged.meta = Object.assign(base.meta, parsed.meta || {});
      merged.redDay = Object.assign(base.redDay, parsed.redDay || {});
      merged.moods = {
        julie: Object.assign(base.moods.julie, (parsed.moods || {}).julie || {}),
        abyant: Object.assign(base.moods.abyant, (parsed.moods || {}).abyant || {})
      };
      merged.coupons = Object.assign(base.coupons, parsed.coupons || {});
      if (!Array.isArray(merged.coupons.available)) merged.coupons.available = [];
      if (!Array.isArray(merged.coupons.claimed)) merged.coupons.claimed = [];
      return merged;
    } catch (e) {
      console.warn('State rusak, memakai default:', e);
      return defaults();
    }
  }

  let S = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      updateQuota();
      return true;
    } catch (e) {
      toast('Penyimpanan penuh. Hapus beberapa foto unggahan dulu.', 'warn');
      return false;
    }
  }

  function storageBytes() {
    try { return new Blob([localStorage.getItem(KEY) || '']).size; } catch { return 0; }
  }
  function updateQuota() {
    const el = $('gallery-quota');
    if (!el) return;
    const mb = storageBytes() / 1048576;
    const warn = mb > 3.5;
    el.className = 'text-sm ' + (warn ? 'quota-warn' : 'text-muted');
    el.textContent = `Penyimpanan terpakai: ${mb.toFixed(2)} MB${warn ? ' — hampir penuh, kuota browser sekitar 5 MB' : ''}`;
  }

  function addScore(n) { S.meta.score += n; save(); renderScore(); }
  function renderScore() {
    $('global-score').textContent = S.meta.score;
    $('energy-count').textContent = S.meta.hugs;
  }

  /* ═════════ TOAST ═════════ */
  function toast(msg, type = 'info') {
    const c = $('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
  }

  /* ═════════ DIALOG ═════════ */
  let dialogResolve = null;
  function openDialog(o) {
    return new Promise((resolve) => {
      dialogResolve = resolve;
      $('dialog-title').textContent = o.title || 'Konfirmasi';
      $('dialog-message').textContent = o.message || '';
      $('dialog-cancel').classList.toggle('hidden', !!o.alertOnly);
      const ok = $('dialog-confirm');
      ok.textContent = o.confirmText || 'Ya, lanjut';
      ok.className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary');
      $('app-dialog').classList.remove('hidden');
      setTimeout(() => ok.focus(), 40);
    });
  }
  function closeDialog(val) {
    $('app-dialog').classList.add('hidden');
    const r = dialogResolve; dialogResolve = null;
    if (r) r(val);
  }
  const showAlert = (message, title = 'Perhatian') => openDialog({ title, message, alertOnly: true, confirmText: 'Mengerti' });
  const askConfirm = (message, o = {}) => openDialog({ title: o.title || 'Konfirmasi', message, confirmText: o.confirmText || 'Ya, lanjut', danger: o.danger });

  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModal(id) { $(id).classList.add('hidden'); }

  /* ═════════ SOUND & CONFETTI ═════════ */
  let audioCtx = null;
  function pop(freq = 520) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.65, audioCtx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.16, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) { /* audio tidak tersedia */ }
  }

  const canvas = $('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [], rafId = null;
  function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function launchConfetti(amount = 70) {
    if (reduced) return;
    const colors = ['#ff6b00', '#ff8c38', '#ffb380', '#ffffff', '#ffd6b8', '#c2410c'];
    for (let i = 0; i < amount; i++) {
      particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 260,
        y: window.innerHeight * 0.45,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 1) * 14 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        life: 100
      });
    }
    if (!rafId) rafId = requestAnimationFrame(tickConfetti);
  }
  function tickConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.rotation += p.vRot; p.life -= 1.2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 100);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (particles.length) rafId = requestAnimationFrame(tickConfetti);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); rafId = null; }
  }

  /* ═════════ THEME ═════════ */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    S.meta.theme = t;
  }
  applyTheme(S.meta.theme);
  $('theme-toggle').addEventListener('click', () => {
    applyTheme(S.meta.theme === 'light' ? 'dark' : 'light');
    save(); pop(440);
  });

  /* ═════════ FEATURE TABS ═════════ */
  const featTabs = Array.from(document.querySelectorAll('.feat-tab'));
  const featPanels = Array.from(document.querySelectorAll('.feat-panel'));
  function activateTab(tab) {
    featTabs.forEach((t) => { const on = t === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
    featPanels.forEach((p) => p.classList.toggle('active', p.id === tab.dataset.target));
    pop(500);
  }
  featTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = featTabs[(i + (e.key === 'ArrowRight' ? 1 : featTabs.length - 1)) % featTabs.length];
      next.focus(); activateTab(next);
    });
  });

  /* ═════════ HUG ═════════ */
  $('btn-hug').addEventListener('click', () => {
    S.meta.hugs += 1; addScore(15); pop(650); launchConfetti(85);
    toast('Pelukan terkirim 🧡', 'success');
  });

  /* ═════════ 01 · EVENTS ═════════ */
  let editingEventId = null;

  function nextOccurrence(isoDate) {
    const today = new Date(iso() + 'T00:00:00');
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d)) return null;
    let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    return Math.round((next - today) / 864e5);
  }

  function renderEvents() {
    const ul = $('anniversary-list');
    $('events-count').textContent = `${S.events.length} acara`;
    if (!S.events.length) { ul.innerHTML = '<li class="empty-hint">Belum ada hari spesial. Tambahkan di bawah.</li>'; return; }
    ul.innerHTML = S.events.map((ev) => {
      if (ev.id === editingEventId) {
        return `<li class="editing">
          <form class="edit-panel" data-form="event-edit" data-id="${ev.id}">
            <div class="field"><label for="ev-name-${ev.id}">Nama acara</label><input type="text" id="ev-name-${ev.id}" value="${esc(ev.name)}" required /></div>
            <div class="field"><label for="ev-date-${ev.id}">Tanggal</label><input type="date" id="ev-date-${ev.id}" value="${esc(ev.date)}" required /></div>
            <div class="edit-actions">
              <button class="btn btn-primary btn-sm" type="submit">${icon('save')} Simpan</button>
              <button class="btn btn-secondary btn-sm" type="button" data-act="event-cancel">Batal</button>
            </div>
          </form></li>`;
      }
      const days = nextOccurrence(ev.date);
      const chip = days === null ? '' : `<span class="chip-due">${days === 0 ? 'Hari ini' : 'H-' + days}</span>`;
      return `<li>
        <div class="row-main"><span class="row-title">${esc(ev.name)}</span><span class="row-sub">Berulang tiap tahun · ${esc(fmtFull(ev.date))}</span></div>
        <strong class="row-date">${esc(fmtDay(ev.date))}</strong>${chip}
        <div class="row-actions">
          <button class="btn-icon btn-icon-sm" type="button" data-act="event-edit" data-id="${ev.id}" aria-label="Edit ${esc(ev.name)}" title="Edit">${icon('edit')}</button>
          <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="event-del" data-id="${ev.id}" aria-label="Hapus ${esc(ev.name)}" title="Hapus">${icon('trash')}</button>
        </div></li>`;
    }).join('');
  }

  $('add-event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('event-name').value.trim(), date = $('event-date').value;
    if (!name || !date) return;
    S.events.push({ id: uid(), name, date });
    save(); renderEvents(); e.target.reset(); pop(600); addScore(10);
    toast('Hari spesial ditambahkan', 'success');
  });

  $('anniversary-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act, id = btn.dataset.id;
    if (act === 'event-edit') { editingEventId = id; renderEvents(); $(`ev-name-${id}`)?.focus(); }
    else if (act === 'event-cancel') { editingEventId = null; renderEvents(); }
    else if (act === 'event-del') {
      const ev = S.events.find((x) => x.id === id);
      if (!await askConfirm(`Hapus "${ev?.name}" dari hari spesial?`, { title: 'Hapus acara', confirmText: 'Hapus', danger: true })) return;
      S.events = S.events.filter((x) => x.id !== id);
      save(); renderEvents(); toast('Acara dihapus');
    }
  });

  $('anniversary-list').addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="event-edit"]');
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.id;
    const name = $(`ev-name-${id}`).value.trim(), date = $(`ev-date-${id}`).value;
    if (!name || !date) return;
    const ev = S.events.find((x) => x.id === id);
    if (ev) { ev.name = name; ev.date = date; }
    editingEventId = null; save(); renderEvents(); pop(560);
    toast('Acara diperbarui', 'success');
  });
  $('anniversary-list').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editingEventId) { editingEventId = null; renderEvents(); }
  });

  /* ═════════ 01 · RED DAY ═════════ */
  function redComputed() {
    const r = S.redDay;
    const len = Math.min(45, Math.max(20, Number(r.cycleLength) || 28));
    const elapsed = dayDiff(iso(), r.lastStart);
    const cyclesPassed = elapsed >= 0 ? Math.floor(elapsed / len) : 0;
    const nextStart = new Date(r.lastStart + 'T00:00:00');
    nextStart.setDate(nextStart.getDate() + (cyclesPassed + (elapsed >= 0 ? 1 : 0)) * len);
    const cycleDay = elapsed >= 0 ? (elapsed % len) + 1 : 1;
    const auto = cycleDay <= 5 ? 'Perhatian & Sayang Ekstra' : 'Normal';
    const status = r.statusMode === 'manual' ? r.manualStatus : auto;
    return { len, nextStart: iso(nextStart), cycleDay, status };
  }

  function renderRed() {
    const c = redComputed();
    $('red-start-date').textContent = fmtFull(c.nextStart);
    $('red-cycle-day').textContent = `Hari ke-${c.cycleDay} dari ${c.len}`;
    $('red-cycle-len').textContent = `${c.len} hari`;
    $('red-status').textContent = c.status + (c.status === 'Perhatian & Sayang Ekstra' ? ' 🍫' : c.status === 'Butuh Pelukan' ? ' 🫂' : ' ✨');
  }

  function openRedEdit() {
    const r = S.redDay;
    $('red-date-input').value = r.lastStart;
    $('red-cycle-input').value = r.cycleLength;
    $('red-mode-input').value = r.statusMode;
    $('red-manual-input').value = r.manualStatus;
    $('red-manual-wrap').classList.toggle('hidden', r.statusMode !== 'manual');
    $('red-view').classList.add('hidden');
    $('red-edit-form').classList.remove('hidden');
    $('red-date-input').focus();
  }
  function closeRedEdit() {
    $('red-edit-form').classList.add('hidden');
    $('red-view').classList.remove('hidden');
  }

  document.querySelector('[data-act="red-edit"]').addEventListener('click', openRedEdit);
  document.querySelector('[data-act="red-cancel"]').addEventListener('click', closeRedEdit);
  $('red-mode-input').addEventListener('change', (e) => {
    $('red-manual-wrap').classList.toggle('hidden', e.target.value !== 'manual');
  });
  $('red-edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const len = Number($('red-cycle-input').value);
    if (!Number.isFinite(len) || len < 20 || len > 45) return showAlert('Panjang siklus harus antara 20 dan 45 hari.');
    S.redDay = {
      lastStart: $('red-date-input').value,
      cycleLength: Math.round(len),
      statusMode: $('red-mode-input').value,
      manualStatus: $('red-manual-input').value
    };
    save(); renderRed(); closeRedEdit(); pop(540);
    toast('Prediksi Red Day diperbarui', 'success');
  });
  $('btn-log-red').addEventListener('click', () => {
    S.redDay.lastStart = iso();
    save(); renderRed(); pop(540); launchConfetti(40);
    toast('Tanggal mulai dicatat hari ini', 'success');
  });

  /* ═════════ 02 · MOOD ═════════ */
  let moodPerson = 'julie';

  function renderMoodTabs() {
    document.querySelectorAll('.sub-tab').forEach((t) => {
      const on = t.dataset.person === moodPerson;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    $('mood-board').setAttribute('aria-labelledby', 'mood-tab-' + moodPerson);
  }

  function renderMood() {
    const data = S.moods[moodPerson];
    const nick = NAMES[moodPerson].nick;
    $('mood-board-title').textContent = `Indikator Mood Harian ${nick}`;
    $('mood-selector').innerHTML = MOODS.map((m) =>
      `<button class="mood-btn ${data.mood === m.key ? 'active' : ''}" type="button" data-mood="${m.key}" aria-pressed="${data.mood === m.key}">${m.emoji} ${m.label}</button>`
    ).join('');

    const cur = MOODS.find((m) => m.key === data.mood);
    $('current-mood-text').textContent = cur ? `${cur.emoji} ${cur.label}` : 'Belum dipilih';
    $('mood-advice').textContent = cur ? `Pesan otomatis: ${cur.msg}` : 'Pilih salah satu mood di atas.';
    $('mood-note').textContent = data.note || '';
    $('mood-time').textContent = data.updatedAt ? `Diperbarui ${fmtStamp(data.updatedAt)}` : '';
    $('mood-note-input').value = data.note || '';

    const hist = (data.history || []).slice(0, 14);
    $('mood-history-count').textContent = `${hist.length} hari`;
    $('mood-history').innerHTML = hist.length
      ? hist.map((h) => `<li><span class="history-date">${esc(fmtDay(h.date))}</span><div class="history-body"><strong>${esc(h.emoji)} ${esc(h.label)}</strong>${h.note ? `<span>${esc(h.note)}</span>` : ''}</div></li>`).join('')
      : '<li class="empty-hint">Belum ada riwayat mood.</li>';

    const jm = MOODS.find((m) => m.key === S.moods.julie.mood);
    const am = MOODS.find((m) => m.key === S.moods.abyant.mood);
    $('hero-mood-pill').textContent = `🌸 ${NAMES.julie.nick}: ${jm ? jm.label : '—'}`;
    document.querySelector('.pill-2').textContent = `☕ ${NAMES.abyant.nick}: ${am ? am.label : '—'}`;
  }

  function pushMoodHistory(person) {
    const d = S.moods[person];
    const m = MOODS.find((x) => x.key === d.mood);
    const today = iso();
    const entry = { date: today, mood: d.mood, emoji: m ? m.emoji : '•', label: m ? m.label : '—', note: d.note || '' };
    d.history = [entry, ...(d.history || []).filter((h) => h.date !== today)].slice(0, 14);
  }

  document.querySelectorAll('.sub-tab').forEach((t) => {
    t.addEventListener('click', () => { moodPerson = t.dataset.person; renderMoodTabs(); renderMood(); pop(500); });
  });

  $('mood-selector').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mood]');
    if (!btn) return;
    const d = S.moods[moodPerson];
    d.mood = btn.dataset.mood;
    d.updatedAt = Date.now();
    pushMoodHistory(moodPerson);
    save(); renderMood(); pop(580); addScore(5);
    toast(`Mood ${NAMES[moodPerson].nick} tersimpan otomatis`, 'success');
  });

  $('mood-note-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = S.moods[moodPerson];
    d.note = $('mood-note-input').value.trim();
    d.updatedAt = Date.now();
    pushMoodHistory(moodPerson);
    save(); renderMood(); pop(600);
    toast('Pesan harian disimpan', 'success');
  });

  /* ═════════ 03 · GALLERY ═════════ */
  function renderGallery() {
    const grid = $('gallery-grid');
    if (!S.gallery.length) { grid.innerHTML = '<p class="empty-hint">Belum ada momen tersimpan.</p>'; return; }
    grid.innerHTML = S.gallery.map((g) => `
      <figure class="gallery-card">
        <img src="${esc(g.src)}" alt="${esc(g.title)}" loading="lazy" />
        ${g.standIn ? '<span class="standin-tag">Foto contoh</span>' : ''}
        <button class="gallery-del" type="button" data-act="gal-del" data-id="${g.id}" aria-label="Hapus momen ${esc(g.title)}" title="Hapus momen">${icon('trash')}</button>
        <figcaption class="gallery-overlay">${esc(g.title)}</figcaption>
      </figure>`).join('');
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Berkas bukan gambar yang valid.'));
        img.onload = () => {
          const max = 1280;
          let { width, height } = img;
          if (width > max || height > max) {
            const scale = max / Math.max(width, height);
            width = Math.round(width * scale); height = Math.round(height * scale);
          }
          const c = document.createElement('canvas');
          c.width = width; c.height = height;
          c.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(c.toDataURL('image/jpeg', 0.75));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $('gallery-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('gallery-error');
    err.classList.add('hidden');
    const title = $('gallery-title').value.trim();
    const url = httpUrl($('gallery-img').value);
    const file = $('gallery-file').files[0];
    if (!title) { err.textContent = 'Judul momen wajib diisi.'; return err.classList.remove('hidden'); }
    if (!url && !file) { err.textContent = 'Isi URL gambar atau pilih berkas dari perangkat.'; return err.classList.remove('hidden'); }

    let src = url, standIn = /unsplash\.com/.test(url);
    if (file) {
      if (!file.type.startsWith('image/')) { err.textContent = 'Berkas harus berupa gambar.'; return err.classList.remove('hidden'); }
      try { src = await compressImage(file); standIn = false; }
      catch (ex) { err.textContent = ex.message; return err.classList.remove('hidden'); }
    }
    if (storageBytes() + src.length > 4.6 * 1048576) {
      err.textContent = 'Penyimpanan hampir penuh. Gunakan URL gambar, atau hapus momen lama dulu.';
      return err.classList.remove('hidden');
    }
    S.gallery.unshift({ id: uid(), title, src, standIn });
    if (!save()) { S.gallery.shift(); return; }
    renderGallery(); e.target.reset(); pop(620); addScore(10);
    toast('Momen tersimpan', 'success');
  });

  $('gallery-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act="gal-del"]');
    if (!btn) return;
    const g = S.gallery.find((x) => x.id === btn.dataset.id);
    if (!await askConfirm('Hapus momen ini?', { title: 'Hapus momen', confirmText: 'Hapus', danger: true })) return;
    S.gallery = S.gallery.filter((x) => x.id !== btn.dataset.id);
    save(); renderGallery(); toast('Momen dihapus');
  });

  /* ═════════ 04 · TIME PICKER ═════════ */
  const tp = { hour: 8, minute: 0, open: false };

  function buildTimePicker() {
    $('tp-hours').innerHTML = Array.from({ length: 24 }, (_, h) =>
      `<button class="tp-item" type="button" role="option" data-h="${h}" aria-selected="false">${pad(h)}</button>`).join('');
    $('tp-minutes').innerHTML = Array.from({ length: 60 }, (_, m) =>
      `<button class="tp-item" type="button" role="option" data-m="${m}" aria-selected="false">${pad(m)}</button>`).join('');
  }
  function paintTimePicker() {
    $('tp-hours').querySelectorAll('.tp-item').forEach((b) => {
      const on = Number(b.dataset.h) === tp.hour;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
    });
    $('tp-minutes').querySelectorAll('.tp-item').forEach((b) => {
      const on = Number(b.dataset.m) === tp.minute;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
    });
  }
  function openTimePicker() {
    const cur = $('rem-time').value;
    if (/^\d{2}:\d{2}$/.test(cur)) { const [h, m] = cur.split(':').map(Number); tp.hour = h; tp.minute = m; }
    tp.open = true;
    $('timepicker-panel').classList.remove('hidden');
    $('rem-time-display').setAttribute('aria-expanded', 'true');
    paintTimePicker();
    $('tp-hours').querySelector('.tp-item.active')?.scrollIntoView({ block: 'center' });
    $('tp-minutes').querySelector('.tp-item.active')?.scrollIntoView({ block: 'center' });
    $('tp-hours').querySelector('.tp-item.active')?.focus();
  }
  function closeTimePicker() {
    tp.open = false;
    $('timepicker-panel').classList.add('hidden');
    $('rem-time-display').setAttribute('aria-expanded', 'false');
  }
  function applyTimePicker() {
    const val = `${pad(tp.hour)}:${pad(tp.minute)}`;
    $('rem-time').value = val;
    $('rem-time-label').textContent = val;
    closeTimePicker();
    $('rem-time-display').focus();
    pop(520);
  }

  buildTimePicker();
  $('rem-time-display').addEventListener('click', () => tp.open ? closeTimePicker() : openTimePicker());
  $('tp-hours').addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (!b) return; tp.hour = Number(b.dataset.h); paintTimePicker(); });
  $('tp-minutes').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; tp.minute = Number(b.dataset.m); paintTimePicker(); });
  $('tp-apply').addEventListener('click', applyTimePicker);
  $('tp-cancel').addEventListener('click', () => { closeTimePicker(); $('rem-time-display').focus(); });
  $('tp-manual-apply').addEventListener('click', () => {
    const v = $('tp-manual-input').value.trim();
    const m = v.match(/^(\d{1,2})[:.](\d{1,2})$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return toast('Format waktu harus HH:MM, mis. 07:35', 'warn');
    tp.hour = Number(m[1]); tp.minute = Number(m[2]);
    $('tp-manual-input').value = '';
    applyTimePicker();
  });
  $('timepicker-panel').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeTimePicker(); $('rem-time-display').focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const col = e.target.closest('.tp-scroll');
    if (!col) return;
    e.preventDefault();
    const items = Array.from(col.querySelectorAll('.tp-item'));
    const i = items.indexOf(document.activeElement);
    const next = items[Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    next?.focus(); next?.click();
  });
  document.addEventListener('click', (e) => { if (tp.open && !e.target.closest('#timepicker')) closeTimePicker(); });

  /* ═════════ 04 · REMINDERS ═════════ */
  function renderReminders() {
    const ul = $('reminder-list');
    $('reminders-count').textContent = S.reminders.length;
    if (!S.reminders.length) { ul.innerHTML = '<li class="empty-hint">Belum ada pengingat aktif.</li>'; return; }
    ul.innerHTML = [...S.reminders].sort((a, b) => a.time.localeCompare(b.time)).map((r) => `
      <li>
        <div class="row-main"><span class="row-title">⏰ ${esc(r.text)}</span></div>
        <strong class="row-date">${esc(r.time)}</strong>
        <div class="row-actions">
          <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="rem-del" data-id="${r.id}" aria-label="Hapus pengingat ${esc(r.text)}" title="Hapus">${icon('trash')}</button>
        </div>
      </li>`).join('');
  }

  $('reminder-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('reminder-error');
    err.classList.add('hidden');
    const text = $('rem-text').value.trim(), time = $('rem-time').value;
    if (!text) { err.textContent = 'Isi pengingat wajib diisi.'; return err.classList.remove('hidden'); }
    if (!/^\d{2}:\d{2}$/.test(time)) { err.textContent = 'Pilih waktu lewat pemilih waktu di atas.'; return err.classList.remove('hidden'); }
    S.reminders.push({ id: uid(), text, time });
    save(); renderReminders();
    e.target.reset(); $('rem-time').value = ''; $('rem-time-label').textContent = 'Pilih waktu';
    pop(550); addScore(10); toast('Pengingat disimpan', 'success');
  });

  $('reminder-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act="rem-del"]');
    if (!btn) return;
    if (!await askConfirm('Hapus pengingat ini?', { title: 'Hapus pengingat', confirmText: 'Hapus', danger: true })) return;
    S.reminders = S.reminders.filter((x) => x.id !== btn.dataset.id);
    save(); renderReminders(); toast('Pengingat dihapus');
  });

  /* ═════════ 05 & 10 · TASK LISTS ═════════ */
  function taskRow(item, kind) {
    const cls = item.state === 'done' ? 'is-done' : item.state === 'cancelled' ? 'is-cancelled' : '';
    const prefix = kind === 'dream' ? '🎯 ' : '';
    const checkIco = item.state === 'done' ? icon('check') : '';
    const tag = item.state === 'cancelled' ? '<span class="tag-cancelled">Dibatalkan</span>' : '';
    let actions = '';
    if (item.state === 'active') {
      actions = `
        <button class="btn btn-primary btn-sm" type="button" data-act="${kind}-done" data-id="${item.id}">${kind === 'dream' ? 'Terwujud' : 'Selesai'}</button>
        <button class="btn-icon btn-icon-sm" type="button" data-act="${kind}-cancel" data-id="${item.id}" aria-label="Batalkan ${esc(item.text)}" title="Batalkan (tetap tercatat)">${icon('x')}</button>
        <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="${kind}-del" data-id="${item.id}" aria-label="Hapus permanen ${esc(item.text)}" title="Hapus permanen">${icon('trash')}</button>`;
    } else {
      actions = `
        <button class="btn btn-secondary btn-sm" type="button" data-act="${kind}-restore" data-id="${item.id}">${icon('undo')} Aktifkan lagi</button>
        <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="${kind}-del" data-id="${item.id}" aria-label="Hapus permanen ${esc(item.text)}" title="Hapus permanen">${icon('trash')}</button>`;
    }
    return `<li class="todo-item ${cls}"><span class="todo-text">${checkIco}${prefix}${esc(item.text)} ${tag}</span><div class="todo-actions">${actions}</div></li>`;
  }

  function renderTodos() {
    const ul = $('todo-list');
    ul.innerHTML = S.todos.length ? S.todos.map((t) => taskRow(t, 'todo')).join('') : '<li class="empty-hint">Belum ada tugas. Tambahkan di atas.</li>';
  }
  function renderDreams() {
    const ul = $('dream-list');
    ul.innerHTML = S.dreams.length ? S.dreams.map((d) => taskRow(d, 'dream')).join('') : '<li class="empty-hint">Belum ada impian tercatat.</li>';
  }

  function bindTaskList(listEl, getArr, kind, rerender) {
    listEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const arr = getArr();
      const item = arr.find((x) => x.id === btn.dataset.id);
      if (!item) return;
      const act = btn.dataset.act;
      if (act === `${kind}-done`) {
        item.state = 'done'; save(); rerender(); pop(480);
        launchConfetti(kind === 'dream' ? 90 : 40);
        addScore(kind === 'dream' ? 30 : 5);
        toast(kind === 'dream' ? 'Impian terwujud 🎯' : 'Tugas selesai 🎉', 'success');
      } else if (act === `${kind}-cancel`) {
        item.state = 'cancelled'; save(); rerender(); pop(400);
        toast('Dibatalkan — baris tetap tercatat');
      } else if (act === `${kind}-restore`) {
        item.state = 'active'; save(); rerender(); pop(520);
      } else if (act === `${kind}-del`) {
        if (!await askConfirm(`Hapus permanen "${item.text}"? Baris akan hilang sepenuhnya.`, { title: 'Hapus permanen', confirmText: 'Hapus', danger: true })) return;
        const next = arr.filter((x) => x.id !== item.id);
        if (kind === 'todo') S.todos = next; else S.dreams = next;
        save(); rerender(); toast('Dihapus permanen');
      }
    });
  }
  bindTaskList($('todo-list'), () => S.todos, 'todo', renderTodos);
  bindTaskList($('dream-list'), () => S.dreams, 'dream', renderDreams);

  $('todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('todo-input').value.trim();
    if (!text) return;
    S.todos.push({ id: uid(), text, state: 'active' });
    save(); renderTodos(); e.target.reset(); pop(580);
  });
  $('dream-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('dream-input').value.trim();
    if (!text) return;
    S.dreams.push({ id: uid(), text, state: 'active' });
    save(); renderDreams(); e.target.reset(); pop(590); addScore(10);
    toast('Impian ditambahkan', 'success');
  });

  /* ═════════ 06 · CAPSULES ═════════ */
  function renderCapsules() {
    const grid = $('capsule-grid');
    $('capsules-count').textContent = S.capsules.length;
    if (!S.capsules.length) { grid.innerHTML = '<p class="empty-hint">Belum ada kapsul tersimpan.</p>'; return; }
    const today = iso();
    grid.innerHTML = S.capsules.map((c) => {
      const open = today >= c.openDate;
      return `<article class="capsule-card ${open ? 'is-open' : ''}">
        <h4>${open ? '💌' : '🔒'} ${esc(c.title)}</h4>
        <span class="cap-date">${open ? 'Terbuka sejak' : 'Buka pada'} ${esc(fmtFull(c.openDate))}</span>
        <div class="capsule-content ${open ? '' : 'locked'}">${open ? esc(c.msg) : '🔒 Terkunci sampai tanggalnya tiba.'}</div>
        <div class="card-actions">
          <button class="btn-icon btn-icon-sm" type="button" data-act="cap-edit" data-id="${c.id}" aria-label="Edit kapsul ${esc(c.title)}" title="Edit">${icon('edit')}</button>
          <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="cap-del" data-id="${c.id}" aria-label="Hapus kapsul ${esc(c.title)}" title="Hapus">${icon('trash')}</button>
        </div>
      </article>`;
    }).join('');
  }

  $('capsule-form').addEventListener('submit', (e) => {
    e.preventDefault();
    S.capsules.push({ id: uid(), title: $('capsule-title').value.trim(), msg: $('capsule-msg').value.trim(), openDate: $('capsule-date').value });
    save(); renderCapsules(); e.target.reset(); pop(620); launchConfetti(50);
    toast('Kapsul waktu dikunci', 'success');
  });

  $('capsule-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const c = S.capsules.find((x) => x.id === btn.dataset.id);
    if (!c) return;
    if (btn.dataset.act === 'cap-edit') {
      $('capsule-edit-id').value = c.id;
      $('capsule-edit-title').value = c.title;
      $('capsule-edit-date').value = c.openDate;
      $('capsule-edit-msg').value = c.msg;
      openModal('capsule-modal');
    } else {
      if (!await askConfirm(`Hapus kapsul "${c.title}"?`, { title: 'Hapus kapsul', confirmText: 'Hapus', danger: true })) return;
      S.capsules = S.capsules.filter((x) => x.id !== c.id);
      save(); renderCapsules(); toast('Kapsul dihapus');
    }
  });

  $('capsule-edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = S.capsules.find((x) => x.id === $('capsule-edit-id').value);
    if (!c) return;
    c.title = $('capsule-edit-title').value.trim();
    c.openDate = $('capsule-edit-date').value;
    c.msg = $('capsule-edit-msg').value.trim();
    save(); renderCapsules(); closeModal('capsule-modal'); pop(560);
    toast('Kapsul diperbarui', 'success');
  });

  /* ═════════ 07 · SOUNDTRACK ═════════ */
  let currentSongId = null;
  const player = $('audio-player');
  const vinyl = $('vinyl-disc');

  function renderSongs() {
    const list = $('song-list');
    $('songs-count').textContent = `${S.songs.length} lagu`;
    if (!S.songs.length) { list.innerHTML = '<p class="empty-hint">Belum ada lagu. Tambahkan lewat formulir di atas.</p>'; return; }
    list.innerHTML = S.songs.map((s) => {
      const isAudio = s.kind === 'audio';
      const main = isAudio
        ? `<button class="song-play" type="button" data-act="song-play" data-id="${s.id}" aria-label="Putar ${esc(s.title)}">${icon('play')}<span class="song-meta"><strong>${esc(s.title)}</strong>${s.note ? `<span>${esc(s.note)}</span>` : ''}</span></button>`
        : `<span class="song-play"><span class="song-meta"><strong>${esc(s.title)}</strong>${s.note ? `<span>${esc(s.note)}</span>` : ''}</span></span>`;
      const linkBtn = isAudio ? '' : `<a class="song-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon('link')} Buka tautan</a>`;
      return `<div class="song-row ${currentSongId === s.id ? 'active' : ''}">
        ${main}
        <span class="kind-tag">${isAudio ? 'Audio' : 'Tautan'}</span>
        ${linkBtn}
        <button class="btn-icon btn-icon-sm" type="button" data-act="song-edit" data-id="${s.id}" aria-label="Edit lagu ${esc(s.title)}" title="Edit">${icon('edit')}</button>
        <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="song-del" data-id="${s.id}" aria-label="Hapus lagu ${esc(s.title)}" title="Hapus">${icon('trash')}</button>
      </div>`;
    }).join('');
  }

  function playSong(s) {
    currentSongId = s.id;
    $('now-playing-title').textContent = s.title;
    $('now-playing-desc').textContent = s.note ? `"${s.note}"` : 'Tidak ada catatan.';
    $('audio-error').classList.add('hidden');
    player.src = s.url;
    player.play().catch(() => showAudioError('Tautan ini tidak bisa diputar langsung. Periksa apakah berkasnya benar-benar file audio dan mengizinkan pemutaran dari situs lain.'));
    renderSongs(); pop(500);
  }
  function showAudioError(msg) {
    const el = $('audio-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    vinyl.classList.remove('spinning');
  }

  player.addEventListener('play', () => vinyl.classList.add('spinning'));
  player.addEventListener('pause', () => vinyl.classList.remove('spinning'));
  player.addEventListener('ended', () => vinyl.classList.remove('spinning'));
  player.addEventListener('error', () => { if (player.src) showAudioError('Gagal memuat audio. Tautan mungkin kedaluwarsa, diblokir, atau bukan file audio langsung.'); });

  $('vinyl-toggle').addEventListener('click', () => {
    if (player.paused) { if (player.src) player.play().catch(() => showAudioError('Tidak bisa memutar. Pilih lagu lain.')); }
    else player.pause();
  });

  $('song-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('song-error');
    err.classList.add('hidden');
    const title = $('song-title').value.trim();
    const url = httpUrl($('song-url').value);
    if (!title) { err.textContent = 'Judul lagu wajib diisi.'; return err.classList.remove('hidden'); }
    if (!url) { err.textContent = 'URL harus diawali http:// atau https://'; return err.classList.remove('hidden'); }
    const kind = AUDIO_EXT.test(url) ? 'audio' : 'link';
    S.songs.push({ id: uid(), title, note: $('song-note').value.trim(), url, kind });
    save(); renderSongs(); e.target.reset(); pop(620); addScore(10);
    toast(kind === 'audio' ? 'Lagu masuk daftar putar' : 'Disimpan sebagai tautan (bukan file audio langsung)', kind === 'audio' ? 'success' : 'warn');
  });

  $('song-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const s = S.songs.find((x) => x.id === btn.dataset.id);
    if (!s) return;
    const act = btn.dataset.act;
    if (act === 'song-play') playSong(s);
    else if (act === 'song-edit') {
      $('song-edit-id').value = s.id;
      $('song-edit-title').value = s.title;
      $('song-edit-note').value = s.note || '';
      $('song-edit-url').value = s.url;
      $('song-edit-error').classList.add('hidden');
      openModal('song-modal');
    } else if (act === 'song-del') {
      if (!await askConfirm(`Hapus "${s.title}" dari daftar putar?`, { title: 'Hapus lagu', confirmText: 'Hapus', danger: true })) return;
      S.songs = S.songs.filter((x) => x.id !== s.id);
      if (currentSongId === s.id) { player.pause(); player.removeAttribute('src'); currentSongId = null; $('now-playing-title').textContent = 'Belum ada lagu diputar'; $('now-playing-desc').textContent = 'Pilih lagu dari daftar putar di bawah.'; }
      save(); renderSongs(); toast('Lagu dihapus');
    }
  });

  $('song-edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('song-edit-error');
    err.classList.add('hidden');
    const s = S.songs.find((x) => x.id === $('song-edit-id').value);
    if (!s) return;
    const url = httpUrl($('song-edit-url').value);
    if (!url) { err.textContent = 'URL harus diawali http:// atau https://'; return err.classList.remove('hidden'); }
    s.title = $('song-edit-title').value.trim();
    s.note = $('song-edit-note').value.trim();
    s.url = url;
    s.kind = AUDIO_EXT.test(url) ? 'audio' : 'link';
    save(); renderSongs(); closeModal('song-modal'); pop(560);
    toast('Lagu diperbarui', 'success');
  });

  /* ═════════ 08 · PLACES ═════════ */
  let editingPlaceId = null;

  function renderPlaces() {
    const grid = $('places-grid');
    if (!S.places.length) { grid.innerHTML = '<p class="empty-hint">Belum ada tempat berkesan. Tambahkan di atas.</p>'; return; }
    grid.innerHTML = S.places.map((p) => {
      if (p.id === editingPlaceId) {
        return `<article class="place-card editing">
          <form class="stacked-form" data-form="place-edit" data-id="${p.id}">
            <div class="field"><label for="pl-name-${p.id}">Nama tempat</label><input type="text" id="pl-name-${p.id}" value="${esc(p.name)}" required /></div>
            <div class="field"><label for="pl-loc-${p.id}">Lokasi / alamat</label><input type="text" id="pl-loc-${p.id}" value="${esc(p.location)}" required /></div>
            <div class="field"><label for="pl-mem-${p.id}">Deskripsi kenangan</label><textarea id="pl-mem-${p.id}" rows="3" required>${esc(p.memory)}</textarea></div>
            <div class="edit-actions">
              <button class="btn btn-primary btn-sm" type="submit">${icon('save')} Simpan</button>
              <button class="btn btn-secondary btn-sm" type="button" data-act="place-cancel">Batal</button>
            </div>
          </form></article>`;
      }
      return `<article class="place-card">
        <div class="place-head">
          <span class="place-pin">${icon('pin')}</span>
          <div><div class="place-name">${esc(p.name)}</div><div class="place-loc">${esc(p.location)}</div></div>
        </div>
        <p class="place-memory">${esc(p.memory)}</p>
        <div class="card-actions">
          <button class="btn-icon btn-icon-sm" type="button" data-act="place-edit" data-id="${p.id}" aria-label="Edit tempat ${esc(p.name)}" title="Edit">${icon('edit')}</button>
          <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="place-del" data-id="${p.id}" aria-label="Hapus tempat ${esc(p.name)}" title="Hapus">${icon('trash')}</button>
        </div>
      </article>`;
    }).join('');
  }

  $('place-form').addEventListener('submit', (e) => {
    e.preventDefault();
    S.places.push({ id: uid(), name: $('place-name').value.trim(), location: $('place-location').value.trim(), memory: $('place-memory').value.trim() });
    save(); renderPlaces(); e.target.reset(); pop(620); addScore(10);
    toast('Tempat berkesan ditambahkan', 'success');
  });

  $('places-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'place-cancel') { editingPlaceId = null; renderPlaces(); return; }
    const p = S.places.find((x) => x.id === btn.dataset.id);
    if (!p) return;
    if (act === 'place-edit') { editingPlaceId = p.id; renderPlaces(); $(`pl-name-${p.id}`)?.focus(); }
    else if (act === 'place-del') {
      if (!await askConfirm(`Hapus "${p.name}" dari peta kenangan?`, { title: 'Hapus tempat', confirmText: 'Hapus', danger: true })) return;
      S.places = S.places.filter((x) => x.id !== p.id);
      save(); renderPlaces(); toast('Tempat dihapus');
    }
  });

  $('places-grid').addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="place-edit"]');
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.id;
    const p = S.places.find((x) => x.id === id);
    if (!p) return;
    p.name = $(`pl-name-${id}`).value.trim();
    p.location = $(`pl-loc-${id}`).value.trim();
    p.memory = $(`pl-mem-${id}`).value.trim();
    editingPlaceId = null; save(); renderPlaces(); pop(560);
    toast('Tempat diperbarui', 'success');
  });
  $('places-grid').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editingPlaceId) { editingPlaceId = null; renderPlaces(); }
  });

  /* ═════════ 09 · COUPONS ═════════ */
  function renderCoupons() {
    const avail = $('coupons-grid'), hist = $('coupons-history');
    $('coupons-available-count').textContent = S.coupons.available.length;
    $('coupons-claimed-count').textContent = S.coupons.claimed.length;

    avail.innerHTML = S.coupons.available.length ? S.coupons.available.map((c) => `
      <article class="coupon-card">
        <h4>🎟️ ${esc(c.title)}</h4>
        <p>${esc(c.desc)}</p>
        <div class="coupon-actions">
          <button class="btn btn-primary btn-sm" type="button" data-act="cp-claim" data-id="${c.id}">🎁 Klaim kupon</button>
          <button class="btn-icon btn-icon-sm" type="button" data-act="cp-edit" data-id="${c.id}" aria-label="Edit kupon ${esc(c.title)}" title="Edit">${icon('edit')}</button>
          <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="cp-del" data-id="${c.id}" aria-label="Hapus kupon ${esc(c.title)}" title="Hapus">${icon('trash')}</button>
        </div>
      </article>`).join('') : '<p class="empty-hint">Semua kupon sudah diklaim. Buat kupon baru di atas.</p>';

    hist.innerHTML = S.coupons.claimed.length ? [...S.coupons.claimed].sort((a, b) => (b.claimedAt || 0) - (a.claimedAt || 0)).map((c) => `
      <article class="coupon-card claimed">
        <span class="badge-claimed">${icon('check')} Sudah Diklaim</span>
        <h4>${esc(c.title)}</h4>
        <p>${esc(c.desc)}</p>
        <span class="claimed-at">Diklaim ${esc(fmtStamp(c.claimedAt))}</span>
        <div class="coupon-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-act="cp-undo" data-id="${c.id}">${icon('undo')} Batalkan klaim</button>
          <button class="btn-icon btn-icon-sm btn-icon-danger" type="button" data-act="cp-del-claimed" data-id="${c.id}" aria-label="Hapus kupon ${esc(c.title)}" title="Hapus">${icon('trash')}</button>
        </div>
      </article>`).join('') : '<p class="empty-hint">Belum ada kupon yang diklaim.</p>';
  }

  $('coupon-form').addEventListener('submit', (e) => {
    e.preventDefault();
    S.coupons.available.push({ id: uid(), title: $('coupon-title').value.trim(), desc: $('coupon-desc').value.trim() });
    save(); renderCoupons(); e.target.reset(); pop(620); addScore(10);
    toast('Kupon baru dibuat', 'success');
  });

  async function couponAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act, id = btn.dataset.id;
    if (act === 'cp-claim') {
      const i = S.coupons.available.findIndex((x) => x.id === id);
      if (i < 0) return;
      const [c] = S.coupons.available.splice(i, 1);
      S.coupons.claimed.push({ ...c, claimedAt: Date.now() });
      save(); renderCoupons(); pop(750); launchConfetti(80); addScore(25);
      toast('Kupon diklaim 🎁', 'success');
    } else if (act === 'cp-undo') {
      const i = S.coupons.claimed.findIndex((x) => x.id === id);
      if (i < 0) return;
      const [c] = S.coupons.claimed.splice(i, 1);
      delete c.claimedAt;
      S.coupons.available.push(c);
      save(); renderCoupons(); pop(500);
      toast('Klaim dibatalkan, kupon kembali tersedia');
    } else if (act === 'cp-edit') {
      const c = S.coupons.available.find((x) => x.id === id);
      if (!c) return;
      $('coupon-edit-id').value = c.id;
      $('coupon-edit-title').value = c.title;
      $('coupon-edit-desc').value = c.desc;
      openModal('coupon-modal');
    } else if (act === 'cp-del' || act === 'cp-del-claimed') {
      const pool = act === 'cp-del' ? S.coupons.available : S.coupons.claimed;
      const c = pool.find((x) => x.id === id);
      if (!await askConfirm(`Hapus kupon "${c?.title}"?`, { title: 'Hapus kupon', confirmText: 'Hapus', danger: true })) return;
      if (act === 'cp-del') S.coupons.available = pool.filter((x) => x.id !== id);
      else S.coupons.claimed = pool.filter((x) => x.id !== id);
      save(); renderCoupons(); toast('Kupon dihapus');
    }
  }
  $('coupons-grid').addEventListener('click', couponAction);
  $('coupons-history').addEventListener('click', couponAction);

  $('coupon-edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = S.coupons.available.find((x) => x.id === $('coupon-edit-id').value);
    if (!c) return;
    c.title = $('coupon-edit-title').value.trim();
    c.desc = $('coupon-edit-desc').value.trim();
    save(); renderCoupons(); closeModal('coupon-modal'); pop(560);
    toast('Kupon diperbarui', 'success');
  });

  /* ═════════ GLOBAL MODAL / DIALOG ═════════ */
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target !== m) return;
      if (m.id === 'app-dialog') closeDialog(false); else m.classList.add('hidden');
    });
  });
  $('dialog-confirm').addEventListener('click', () => closeDialog(true));
  $('dialog-cancel').addEventListener('click', () => closeDialog(false));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('app-dialog').classList.contains('hidden')) { closeDialog(false); return; }
    document.querySelectorAll('.modal:not(.hidden)').forEach((m) => m.classList.add('hidden'));
  });

  /* ═════════ INIT ═════════ */
  renderScore();
  renderEvents();
  renderRed();
  renderMoodTabs();
  renderMood();
  renderGallery();
  renderReminders();
  renderTodos();
  renderCapsules();
  renderSongs();
  renderPlaces();
  renderCoupons();
  renderDreams();
  updateQuota();
  save();
})();
