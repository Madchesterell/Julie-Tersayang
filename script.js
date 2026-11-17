/* =========================================================
MILOLOO & REROLL, Ruang Privat Berdua
Firebase v10 Modular SDK · Auth + onSnapshot · setDoc
========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/* ───── KONFIGURASI FIREBASE ASLI (julie-8159d) ───── */
const firebaseConfig = {
  apiKey: "AIzaSyAgqA4VRjyhtlWZbF7YvoTDes2phgYom4g",
  authDomain: "julie-8159d.firebaseapp.com",
  projectId: "julie-8159d",
  storageBucket: "julie-8159d.firebasestorage.app",
  messagingSenderId: "448862045718",
  appId: "1:448862045718:web:e2445770e02366655c1737",
  measurementId: "G-WRNMHM63ZJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ROOM_REF = doc(db, "couple_rooms", "miloloo_reroll");
const $ = (id) => document.getElementById(id);
const THEME_KEY = "jb.theme.v2";
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const NAMES = {
  julie:  { full: "Julie Cahya Karmila",  nick: "Miloloo" },
  abyant: { full: "Jalu Farrel Abyantara", nick: "Reroll" }
};

const MOODS = [
  { key: "happy",    emoji: "", label: "Happy",         msg: "Senyum terus hari ini! " },
  { key: "capek",    emoji: "", label: "Capek",         msg: "Istirahat dulu, jangan dipaksa. Peluk jauh. " },
  { key: "kangen",   emoji: "", label: "Kangen",        msg: "Sama. Ayo telepon sebentar nanti. " },
  { key: "sensitif", emoji: "", label: "Sensitif",      msg: "Pelan-pelan ya. Aku dengerin, nggak akan nyela. " },
  { key: "semangat", emoji: "", label: "Semangat",      msg: "Gas! Aku dukung penuh hari ini. " },
  { key: "pelukan",  emoji: "", label: "Butuh Pelukan", msg: "Anggap ini pelukan paling lama. " }
];

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)(\?|#|$)/i;

/* ───── HELPERS ───── */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const ICON_TEXT = { edit: "Ubah", trash: "Hapus", save: "Simpan", x: "Batalkan", undo: "", play: "Putar", check: "", link: "", pin: "" };
const icon = (name) => ICON_TEXT[name] ?? "";

function httpUrl(u) {
  try {
    const url = new URL(String(u || "").trim());
    return (url.protocol === "https:" || url.protocol === "http:") ? url.href : "";
  } catch { return ""; }
}
const fmtDay  = (isoDate) => { const d = new Date(isoDate + "T00:00:00"); return isNaN(d) ? isoDate : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }); };
const fmtFull = (isoDate) => { const d = new Date(isoDate + "T00:00:00"); return isNaN(d) ? isoDate : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); };
const fmtStamp = (ms) => ms ? new Date(ms).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const dayDiff = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 864e5);

function toast(msg, type = "info") {
  const c = $("toast-container"); if (!c) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ───── DIALOG (pengganti alert/confirm) ───── */
let dialogResolve = null;
function openDialog(o) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    $("dialog-title").textContent   = o.title || "Konfirmasi";
    $("dialog-message").textContent = o.message || "";
    $("dialog-cancel").classList.toggle("hidden", !!o.alertOnly);
    const ok = $("dialog-confirm");
    ok.textContent = o.confirmText || "Ya, lanjut";
    ok.className = "btn " + (o.danger ? "btn-danger" : "btn-primary-solid");
    lastTrigger = document.activeElement;
    $("app-dialog").classList.remove("hidden");
    syncInert();
    ok.focus();
  });
}
function closeDialog(val) {
  $("app-dialog").classList.add("hidden");
  syncInert();
  const r = dialogResolve; dialogResolve = null;
  if (r) r(val);
}
const showAlert  = (message, title = "Perhatian") => openDialog({ title, message, alertOnly: true, confirmText: "Mengerti" });
const askConfirm = (message, o = {}) => openDialog({ title: o.title || "Konfirmasi", message, confirmText: o.confirmText || "Ya, lanjut", danger: o.danger });
let lastTrigger = null;
function syncInert() {
  const anyOpen = document.querySelector(".modal:not(.hidden)") !== null;
  ["appRoot", "authGate"].forEach((id) => { const el = $(id); if (el) el.inert = anyOpen; });
  if (!anyOpen && lastTrigger?.isConnected) { lastTrigger.focus(); lastTrigger = null; }
}
function openModal(id) {
  const m = $(id); if (!m) return;
  lastTrigger = document.activeElement;
  m.classList.remove("hidden");
  syncInert();
  m.querySelector("input:not([type=hidden]), textarea, button")?.focus();
}
function closeModal(id) { $(id)?.classList.add("hidden"); syncInert(); }

/* ───── SOUND & CONFETTI ───── */
let audioCtx = null;
function pop(freq = 520) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.65, audioCtx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.16, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) { /* audio tidak tersedia */ }
}

const canvas = $("confetti-canvas");
const ctx = canvas ? canvas.getContext("2d") : null;
let particles = [], rafId = null;
function resizeCanvas() { if (!canvas) return; canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function launchConfetti(amount = 70) {
  if (reduced || !ctx) return;
  const colors = ["#2B3FFF", "#FFD600", "#FF4FA3", "#0A0A0A", "#FFFFFF"];
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
  if (!ctx) return;
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

/* ───── THEME ───── */
let currentTheme = "light";
function applyTheme(t) {
  currentTheme = t;
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  const btn = $("theme-toggle");
  if (btn) { btn.textContent = t === "dark" ? "Mode siang" : "Mode malam"; btn.setAttribute("aria-pressed", String(t === "dark")); }
}
try { currentTheme = localStorage.getItem(THEME_KEY) || "light"; } catch {}
applyTheme(currentTheme);

/* ───── TABS ───── */
const featTabs   = () => Array.from(document.querySelectorAll(".feat-tab"));
const featPanels = () => Array.from(document.querySelectorAll(".feat-panel"));
function activateTab(tab, { focus = false, updateHash = true } = {}) {
  featTabs().forEach((t) => {
    const on = t === tab;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  featPanels().forEach((p) => p.classList.toggle("active", p.id === tab.dataset.target));
  if (focus) tab.focus();
  tab.scrollIntoView({ block: "nearest", inline: "center" });
  if (updateHash) history.replaceState(null, "", "#" + tab.dataset.target.replace("panel-", ""));
}
function tabFromHash() {
  const key = location.hash.slice(1);
  return featTabs().find((t) => t.dataset.target === "panel-" + key);
}
function onTabKey(e) {
  const tabs = featTabs(), i = tabs.indexOf(e.currentTarget);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  activateTab(tabs[(next + tabs.length) % tabs.length], { focus: true });
}

/* ───── STATUS SINKRON (memuat, siap, galat) ───── */
let syncState = "loading";
const SYNC_TEXT = {
  loading: "Memuat catatan dari Firestore…",
  error: "Tidak tersambung ke Firestore. Perubahan baru belum tersimpan di perangkat lain."
};
function setSync(state) {
  syncState = state;
  const el = $("sync-status");
  if (el) {
    el.textContent = state === "ready" ? "" : SYNC_TEXT[state];
    el.classList.toggle("is-error", state === "error");
  }
  applySyncHints();
}
function applySyncHints() {
  if (syncState === "ready") return;
  document.querySelectorAll(".empty-hint").forEach((el) => {
    el.classList.add("state");
    el.textContent = syncState === "loading" ? "Memuat…" : "Belum bisa memuat. Periksa koneksi lalu muat ulang halaman.";
  });
}

/* DEFAULT STATE (KOSONG, user mulai dari nol) */
function defaults() {
  return {
    version: 2,
    meta: { score: 100, hugs: 0 },
    events: [],
    redDay: { lastStart: iso(), cycleLength: 28, statusMode: "auto", manualStatus: "Perhatian & Sayang Ekstra" },
    moods: {
      julie:  { mood: "happy",    note: "", updatedAt: null, history: [] },
      abyant: { mood: "semangat", note: "", updatedAt: null, history: [] }
    },
    gallery: [],
    reminders: [],
    todos: [],
    capsules: [],
    songs: [],
    places: [],
    coupons: { available: [], claimed: [] },
    dreams: []
  };
}

function mergeState(parsed) {
  const base = defaults();
  if (!parsed || typeof parsed !== "object") return base;
  const merged = { ...base, ...parsed };
  merged.meta   = { ...base.meta, ...(parsed.meta || {}) };
  merged.redDay = { ...base.redDay, ...(parsed.redDay || {}) };
  merged.moods = {
    julie:  { ...base.moods.julie,  ...(parsed.moods?.julie  || {}) },
    abyant: { ...base.moods.abyant, ...(parsed.moods?.abyant || {}) }
  };
  merged.coupons = {
    available: Array.isArray(parsed.coupons?.available) ? parsed.coupons.available : [],
    claimed:   Array.isArray(parsed.coupons?.claimed)   ? parsed.coupons.claimed   : []
  };
  if (!Array.isArray(merged.events))    merged.events    = [];
  if (!Array.isArray(merged.gallery))   merged.gallery   = [];
  if (!Array.isArray(merged.reminders)) merged.reminders = [];
  if (!Array.isArray(merged.todos))     merged.todos     = [];
  if (!Array.isArray(merged.capsules))  merged.capsules  = [];
  if (!Array.isArray(merged.songs))     merged.songs     = [];
  if (!Array.isArray(merged.places))    merged.places    = [];
  if (!Array.isArray(merged.dreams))    merged.dreams    = [];
  return merged;
}

let S = defaults();
let lastSyncedFingerprint = "";
let reminderFiredToday = new Set();
let moodPerson = "julie";
let editingEventId = null;
let editingPlaceId = null;
let currentSongId = null;
let unsubRoom = null;

/* ───── QUOTA & SAVE ───── */
function docBytes() {
  try { return new Blob([JSON.stringify(S)]).size; } catch { return 0; }
}
function updateQuota() {
  const el = $("gallery-quota");
  if (!el) return;
  const kb = docBytes() / 1024;
  const warn = kb > 750;
  el.className = "text-sm " + (warn ? "quota-warn" : "text-muted");
  el.textContent = `Penyimpanan terpakai: ${kb.toFixed(1)} KB${warn ? ", mendekati batas 1 MB per dokumen Firestore" : ""}`;
}
async function save() {
  updateQuota();
  lastSyncedFingerprint = JSON.stringify(S);
  try {
    await setDoc(ROOM_REF, { ...S, updatedAt: serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.error("Gagal menyimpan ke Firestore:", e);
    toast("Gagal menyinkronkan ke Firestore. Periksa koneksi atau konfigurasi.", "warn");
    return false;
  }
}
function addScore(n) { S.meta.score += n; save(); renderScore(); }
function renderScore() {
  const gs = $("global-score"), ec = $("energy-count");
  if (gs) gs.textContent = S.meta.score;
  if (ec) ec.textContent = S.meta.hugs;
}

/* RENDER FITUR */

/* 01 EVENTS */
function nextOccurrence(isoDate) {
  const today = new Date(iso() + "T00:00:00");
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d)) return null;
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - today) / 864e5);
}
function renderEvents() {
  const ul = $("anniversary-list"); if (!ul) return;
  const cnt = $("events-count"); if (cnt) cnt.textContent = `${S.events.length} acara`;
  if (!S.events.length) {
    ul.innerHTML = `<li class="empty-hint">Belum ada hari spesial. Tambahkan di bawah.</li>`;
    return;
  }
  ul.innerHTML = S.events.map((ev) => {
    if (ev.id === editingEventId) {
      return `<li class="editing">
        <form class="edit-panel" data-form="event-edit" data-id="${ev.id}">
          <div class="field"><label>Nama acara</label><input type="text" id="ev-name-${ev.id}" value="${esc(ev.name)}" required /></div>
          <div class="field"><label>Tanggal</label><input type="date" id="ev-date-${ev.id}" value="${esc(ev.date)}" required /></div>
          <div class="edit-actions">
            <button class="btn btn-primary btn-sm" type="submit">${icon("save")} Simpan</button>
            <button class="btn btn-secondary btn-sm" type="button" data-act="event-cancel">Batal</button>
          </div>
        </form></li>`;
    }
    const days = nextOccurrence(ev.date);
    const chip = days === null ? "" : `<span class="chip-due">${days === 0 ? "Hari ini" : "H-" + days}</span>`;
    return `<li>
      <div class="row-main"><span class="row-title">${esc(ev.name)}</span><span class="row-sub">Berulang tiap tahun, ${esc(fmtFull(ev.date))}</span></div>
      <strong class="row-date">${esc(fmtDay(ev.date))}</strong>${chip}
      <div class="row-actions">
        <button class="btn-icon btn-sm" type="button" data-act="event-edit" data-id="${ev.id}" aria-label="Ubah">${icon("edit")}</button>
        <button class="btn-icon btn-sm" type="button" data-act="event-del" data-id="${ev.id}" aria-label="Hapus">${icon("trash")}</button>
      </div></li>`;
  }).join("");
}

/* 01 RED DAY */
function redComputed() {
  const r = S.redDay;
  const len = Math.min(45, Math.max(20, Number(r.cycleLength) || 28));
  const elapsed = dayDiff(iso(), r.lastStart);
  const cyclesPassed = elapsed >= 0 ? Math.floor(elapsed / len) : 0;
  const nextStart = new Date(r.lastStart + "T00:00:00");
  nextStart.setDate(nextStart.getDate() + (cyclesPassed + (elapsed >= 0 ? 1 : 0)) * len);
  const cycleDay = elapsed >= 0 ? (elapsed % len) + 1 : 1;
  const auto = cycleDay <= 5 ? "Perhatian & Sayang Ekstra" : "Normal";
  const status = r.statusMode === "manual" ? r.manualStatus : auto;
  return { len, nextStart: iso(nextStart), cycleDay, status };
}
function renderRed() {
  const c = redComputed();
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set("red-start-date", fmtFull(c.nextStart));
  set("red-cycle-day", `Hari ke-${c.cycleDay} dari ${c.len}`);
  set("red-cycle-len", `${c.len} hari`);
  set("red-status", c.status + (c.status === "Perhatian & Sayang Ekstra" ? " " : c.status === "Butuh Pelukan" ? " " : " "));
}
function openRedEdit() {
  const r = S.redDay;
  if ($("red-date-input"))   $("red-date-input").value   = r.lastStart;
  if ($("red-cycle-input"))  $("red-cycle-input").value  = r.cycleLength;
  if ($("red-mode-input"))   $("red-mode-input").value   = r.statusMode;
  if ($("red-manual-input")) $("red-manual-input").value = r.manualStatus;
  const mw = $("red-manual-wrap"); if (mw) mw.classList.toggle("hidden", r.statusMode !== "manual");
  $("red-view")?.classList.add("hidden");
  $("red-edit-form")?.classList.remove("hidden");
  $("red-date-input")?.focus();
}
function closeRedEdit() {
  $("red-edit-form")?.classList.add("hidden");
  $("red-view")?.classList.remove("hidden");
}

/* 02 MOOD */
function renderMoodTabs() {
  document.querySelectorAll(".sub-tab").forEach((t) => {
    const on = t.dataset.person === moodPerson;
    t.classList.toggle("active", on);
    t.setAttribute("aria-pressed", String(on));
  });
}
function renderMood() {
  const data = S.moods[moodPerson];
  const nick = NAMES[moodPerson].nick;
  if ($("mood-board-title")) $("mood-board-title").textContent = `Mood ${nick}`;
  if ($("mood-selector")) {
    $("mood-selector").innerHTML = MOODS.map((m) =>
      `<button class="mood-btn ${data.mood === m.key ? "active" : ""}" type="button" data-mood="${m.key}" aria-pressed="${data.mood === m.key}">${m.emoji} ${m.label}</button>`
    ).join("");
  }
  const cur = MOODS.find((m) => m.key === data.mood);
  if ($("current-mood-text")) $("current-mood-text").textContent = cur ? `${cur.emoji} ${cur.label}` : "Belum dipilih";
  if ($("mood-advice")) $("mood-advice").textContent = cur ? `Pesan otomatis: ${cur.msg}` : "Pilih salah satu mood di atas.";
  if ($("mood-note")) $("mood-note").textContent = data.note || "";
  if ($("mood-time")) $("mood-time").textContent = data.updatedAt ? `Diperbarui ${fmtStamp(data.updatedAt)}` : "";
  const noteInp = $("mood-note-input");
  if (noteInp && document.activeElement !== noteInp) noteInp.value = data.note || "";
  const hist = (data.history || []).slice(0, 14);
  if ($("mood-history-count")) $("mood-history-count").textContent = `${hist.length} hari`;
  const histEl = $("mood-history");
  if (histEl) {
    histEl.innerHTML = hist.length
      ? hist.map((h) => `<li><span class="history-date">${esc(fmtDay(h.date))}</span><div class="history-body"><strong>${esc(h.emoji)} ${esc(h.label)}</strong>${h.note ? `<span>: ${esc(h.note)}</span>` : ""}</div></li>`).join("")
      : `<li class="empty-hint">Belum ada riwayat mood.</li>`;
  }
  const jm = MOODS.find((m) => m.key === S.moods.julie.mood);
  const am = MOODS.find((m) => m.key === S.moods.abyant.mood);
  const setT = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  setT("hero-mood-julie", jm ? jm.label : "Belum diisi");
  setT("hero-mood-abyant", am ? am.label : "Belum diisi");
  setT("hero-note-julie", S.moods.julie.note || "Belum ada pesan hari ini.");
  setT("hero-note-abyant", S.moods.abyant.note || "Belum ada pesan hari ini.");
}
function pushMoodHistory(person) {
  const d = S.moods[person];
  const m = MOODS.find((x) => x.key === d.mood);
  const today = iso();
  const entry = { date: today, mood: d.mood, emoji: m ? m.emoji : "•", label: m ? m.label : "belum diisi", note: d.note || "" };
  d.history = [entry, ...(d.history || []).filter((h) => h.date !== today)].slice(0, 14);
}

/* 03 GALLERY */
function renderGallery() {
  const grid = $("gallery-grid"); if (!grid) return;
  if (!S.gallery.length) { grid.innerHTML = `<p class="empty-hint">Belum ada momen tersimpan.</p>`; return; }
  grid.innerHTML = S.gallery.map((g) => `<figure class="gallery-card">
    <img class="gallery-img" src="${esc(g.src)}" alt="${esc(g.title)}" width="480" height="360" loading="lazy" />
    <button class="gallery-del" type="button" data-act="gal-del" data-id="${g.id}" aria-label="Hapus">${icon("trash")}</button>
    <figcaption class="gallery-overlay">${esc(g.title)}</figcaption>
  </figure>`).join("");
}
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Berkas bukan gambar yang valid."));
      img.onload = () => {
        const max = 960;
        let { width, height } = img;
        if (width > max || height > max) {
          const scale = max / Math.max(width, height);
          width = Math.round(width * scale); height = Math.round(height * scale);
        }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        c.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/jpeg", 0.65));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* 04 TIME PICKER */
const tp = { hour: 8, minute: 0, open: false };
function buildTimePicker() {
  const h = $("tp-hours"), m = $("tp-minutes"); if (!h || !m) return;
  h.innerHTML = Array.from({ length: 24 }, (_, i) =>
    `<button class="tp-item" type="button" role="option" data-h="${i}">${pad(i)}</button>`).join("");
  m.innerHTML = Array.from({ length: 60 }, (_, i) =>
    `<button class="tp-item" type="button" role="option" data-m="${i}">${pad(i)}</button>`).join("");
}
function paintTimePicker() {
  $("tp-hours")?.querySelectorAll(".tp-item").forEach((b) => {
    const on = Number(b.dataset.h) === tp.hour;
    b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on));
  });
  $("tp-minutes")?.querySelectorAll(".tp-item").forEach((b) => {
    const on = Number(b.dataset.m) === tp.minute;
    b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on));
  });
}
function openTimePicker() {
  const cur = $("rem-time")?.value;
  if (/^\d{2}:\d{2}$/.test(cur || "")) { const [h, m] = cur.split(":").map(Number); tp.hour = h; tp.minute = m; }
  tp.open = true;
  $("timepicker-panel")?.classList.remove("hidden");
  $("rem-time-display")?.setAttribute("aria-expanded", "true");
  paintTimePicker();
  $("tp-hours")?.querySelector(".tp-item.active")?.scrollIntoView({ block: "center" });
  $("tp-minutes")?.querySelector(".tp-item.active")?.scrollIntoView({ block: "center" });
}
function closeTimePicker() {
  tp.open = false;
  $("timepicker-panel")?.classList.add("hidden");
  $("rem-time-display")?.setAttribute("aria-expanded", "false");
}
function applyTimePicker() {
  const val = `${pad(tp.hour)}:${pad(tp.minute)}`;
  if ($("rem-time")) $("rem-time").value = val;
  if ($("rem-time-label")) $("rem-time-label").textContent = val;
  closeTimePicker();
  $("rem-time-display")?.focus();
  pop(520);
}

/* 04 REMINDERS */
function renderReminders() {
  const ul = $("reminder-list"); if (!ul) return;
  const cnt = $("reminders-count"); if (cnt) cnt.textContent = S.reminders.length;
  if (!S.reminders.length) { ul.innerHTML = `<li class="empty-hint">Belum ada pengingat aktif.</li>`; return; }
  ul.innerHTML = [...S.reminders].sort((a, b) => a.time.localeCompare(b.time)).map((r) => `<li>
    <div class="row-main"><span class="row-title">${esc(r.text)}</span></div>
    <strong class="row-date">${esc(r.time)}</strong>
    <div class="row-actions">
      <button class="btn-icon btn-sm" type="button" data-act="rem-del" data-id="${r.id}" aria-label="Hapus">${icon("trash")}</button>
    </div></li>`).join("");
}

function wibClockHM() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utcMs + 7 * 3600 * 1000);
  return `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;
}

function startReminderScheduler() {
  setInterval(() => {
    const nowHM = wibClockHM();
    const todayKey = iso();
    S.reminders.forEach((r) => {
      if (r.time !== nowHM) return;
      const fireKey = `${todayKey}|${r.id}`;
      if (reminderFiredToday.has(fireKey)) return;
      reminderFiredToday.add(fireKey);
      toast(`${r.text}`, "info");
      pop(660);
      launchConfetti(24);
    });
    if (reminderFiredToday.size && ![...reminderFiredToday][0].startsWith(todayKey)) reminderFiredToday.clear();
  }, 30000);
}

/* 05 & 10 TASK LISTS */
function taskRow(item, kind) {
  const cls = item.state === "done" ? "is-done" : item.state === "cancelled" ? "is-cancelled" : "";
  const prefix = kind === "dream" ? "" : "";
  const checkIco = item.state === "done" ? icon("check") : "";
  const tag = item.state === "cancelled" ? `<span class="tag-cancelled">Dibatalkan</span>` : "";
  let actions = "";
  if (item.state === "active") {
    actions = `
      <button class="btn btn-primary btn-sm" type="button" data-act="${kind}-done" data-id="${item.id}">${kind === "dream" ? "Terwujud" : "Selesai"}</button>
      <button class="btn-icon btn-sm" type="button" data-act="${kind}-cancel" data-id="${item.id}" aria-label="Batalkan">${icon("x")}</button>
      <button class="btn-icon btn-sm" type="button" data-act="${kind}-del" data-id="${item.id}" aria-label="Hapus">${icon("trash")}</button>`;
  } else {
    actions = `
      <button class="btn btn-secondary btn-sm" type="button" data-act="${kind}-restore" data-id="${item.id}">${icon("undo")} Aktifkan lagi</button>
      <button class="btn-icon btn-sm" type="button" data-act="${kind}-del" data-id="${item.id}" aria-label="Hapus">${icon("trash")}</button>`;
  }
  return `<li class="todo-item ${cls}"><span class="todo-text">${checkIco}${prefix}${esc(item.text)} ${tag}</span><div class="todo-actions">${actions}</div></li>`;
}
function renderTodos() {
  const ul = $("todo-list"); if (!ul) return;
  ul.innerHTML = S.todos.length ? S.todos.map((t) => taskRow(t, "todo")).join("") : `<li class="empty-hint">Belum ada tugas.</li>`;
}
function renderDreams() {
  const ul = $("dream-list"); if (!ul) return;
  ul.innerHTML = S.dreams.length ? S.dreams.map((d) => taskRow(d, "dream")).join("") : `<li class="empty-hint">Belum ada impian tercatat.</li>`;
}
function bindTaskList(listId, getArr, kind, rerender) {
  const el = $(listId); if (!el) return;
  el.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const arr = getArr();
    const item = arr.find((x) => x.id === btn.dataset.id); if (!item) return;
    const act = btn.dataset.act;
    if (act === `${kind}-done`) {
      item.state = "done"; save(); rerender(); pop(480);
      launchConfetti(kind === "dream" ? 90 : 40);
      addScore(kind === "dream" ? 30 : 5);
      toast(kind === "dream" ? "Impian terwujud " : "Tugas selesai ", "success");
    } else if (act === `${kind}-cancel`) {
      item.state = "cancelled"; save(); rerender(); pop(400);
      toast("Dibatalkan, baris tetap tercatat");
    } else if (act === `${kind}-restore`) {
      item.state = "active"; save(); rerender(); pop(520);
    } else if (act === `${kind}-del`) {
      if (!await askConfirm(`Hapus permanen "${item.text}"?`, { title: "Hapus permanen", confirmText: "Hapus", danger: true })) return;
      const next = arr.filter((x) => x.id !== item.id);
      if (kind === "todo") S.todos = next; else S.dreams = next;
      save(); rerender(); toast("Dihapus permanen");
    }
  });
}

/* 06 CAPSULES */
function renderCapsules() {
  const grid = $("capsule-grid"); if (!grid) return;
  const cnt = $("capsules-count"); if (cnt) cnt.textContent = S.capsules.length;
  if (!S.capsules.length) { grid.innerHTML = `<p class="empty-hint">Belum ada kapsul tersimpan.</p>`; return; }
  const today = iso();
  grid.innerHTML = S.capsules.map((c) => {
    const open = today >= c.openDate;
    return `<article class="capsule-card ${open ? "is-open" : ""}">
      <h4>${open ? "" : ""} ${esc(c.title)}</h4>
      <span class="cap-date">${open ? "Terbuka sejak" : "Buka pada"} ${esc(fmtFull(c.openDate))}</span>
      <div class="capsule-content ${open ? "" : "locked"}">${open ? esc(c.msg) : "Terkunci sampai tanggalnya tiba."}</div>
      <div class="card-actions">
        <button class="btn-icon btn-sm" type="button" data-act="cap-edit" data-id="${c.id}" aria-label="Ubah">${icon("edit")}</button>
        <button class="btn-icon btn-sm" type="button" data-act="cap-del" data-id="${c.id}" aria-label="Hapus">${icon("trash")}</button>
      </div>
    </article>`;
  }).join("");
}

/* 07 SONGS */
function renderSongs() {
  const list = $("song-list"); if (!list) return;
  const cnt = $("songs-count"); if (cnt) cnt.textContent = `${S.songs.length} lagu`;
  if (!S.songs.length) { list.innerHTML = `<p class="empty-hint">Belum ada lagu.</p>`; return; }
  list.innerHTML = S.songs.map((s) => {
    const isAudio = s.kind === "audio";
    const main = isAudio
      ? `<button class="song-play" type="button" data-act="song-play" data-id="${s.id}" aria-label="Putar">${icon("play")}<span class="song-meta"><strong>${esc(s.title)}</strong>${s.note ? `<span>${esc(s.note)}</span>` : ""}</span></button>`
      : `<span class="song-play"><span class="song-meta"><strong>${esc(s.title)}</strong>${s.note ? `<span>${esc(s.note)}</span>` : ""}</span></span>`;
    const linkBtn = isAudio ? "" : `<a class="song-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon("link")} Buka</a>`;
    return `<div class="song-row ${currentSongId === s.id ? "active" : ""}">
      ${main}
      <span class="kind-tag">${isAudio ? "Audio" : "Tautan"}</span>
      ${linkBtn}
      <button class="btn-icon btn-sm" type="button" data-act="song-edit" data-id="${s.id}" aria-label="Ubah">${icon("edit")}</button>
      <button class="btn-icon btn-sm" type="button" data-act="song-del" data-id="${s.id}" aria-label="Hapus">${icon("trash")}</button>
    </div>`;
  }).join("");
}
function playSong(s) {
  currentSongId = s.id;
  if ($("now-playing-title")) $("now-playing-title").textContent = s.title;
  if ($("now-playing-desc")) $("now-playing-desc").textContent = s.note ? `"${s.note}"` : "Tidak ada catatan.";
  $("audio-error")?.classList.add("hidden");
  const player = $("audio-player");
  if (player) {
    player.src = s.url;
    player.play().catch(() => showAudioError("Tautan tidak bisa diputar langsung."));
  }
  renderSongs(); pop(500);
}
function showAudioError(msg) {
  const el = $("audio-error"); if (!el) return;
  el.textContent = msg; el.classList.remove("hidden");
  $("vinyl-disc")?.classList.remove("spinning");
}

/* 08 PLACES */
function renderPlaces() {
  const grid = $("places-grid"); if (!grid) return;
  if (!S.places.length) { grid.innerHTML = `<p class="empty-hint">Belum ada tempat berkesan.</p>`; return; }
  grid.innerHTML = S.places.map((p) => {
    if (p.id === editingPlaceId) {
      return `<article class="place-card editing">
        <form class="stacked-form" data-form="place-edit" data-id="${p.id}">
          <div class="field"><label>Nama tempat</label><input type="text" id="pl-name-${p.id}" value="${esc(p.name)}" required /></div>
          <div class="field"><label>Lokasi / alamat</label><input type="text" id="pl-loc-${p.id}" value="${esc(p.location)}" required /></div>
          <div class="field"><label>Deskripsi kenangan</label><textarea id="pl-mem-${p.id}" rows="3" required>${esc(p.memory)}</textarea></div>
          <div class="edit-actions">
            <button class="btn btn-primary btn-sm" type="submit">${icon("save")} Simpan</button>
            <button class="btn btn-secondary btn-sm" type="button" data-act="place-cancel">Batal</button>
          </div>
        </form></article>`;
    }
    return `<article class="place-card">
      <div class="place-head">
        <span class="place-pin">${icon("pin")}</span>
        <div><div class="place-name">${esc(p.name)}</div><div class="place-loc">${esc(p.location)}</div></div>
      </div>
      <p class="place-memory">${esc(p.memory)}</p>
      <div class="card-actions">
        <button class="btn-icon btn-sm" type="button" data-act="place-edit" data-id="${p.id}" aria-label="Ubah">${icon("edit")}</button>
        <button class="btn-icon btn-sm" type="button" data-act="place-del" data-id="${p.id}" aria-label="Hapus">${icon("trash")}</button>
      </div>
    </article>`;
  }).join("");
}

/* 09 COUPONS */
function renderCoupons() {
  const avail = $("coupons-grid"), hist = $("coupons-history");
  if ($("coupons-available-count")) $("coupons-available-count").textContent = S.coupons.available.length;
  if ($("coupons-claimed-count"))   $("coupons-claimed-count").textContent   = S.coupons.claimed.length;
  if (avail) {
    avail.innerHTML = S.coupons.available.length
      ? S.coupons.available.map((c) => `<article class="coupon-card">
          <h4>${esc(c.title)}</h4>
          <p>${esc(c.desc)}</p>
          <div class="coupon-actions">
            <button class="btn btn-primary btn-sm" type="button" data-act="cp-claim" data-id="${c.id}">Klaim kupon</button>
            <button class="btn-icon btn-sm" type="button" data-act="cp-edit" data-id="${c.id}" aria-label="Ubah">${icon("edit")}</button>
            <button class="btn-icon btn-sm" type="button" data-act="cp-del" data-id="${c.id}" aria-label="Hapus">${icon("trash")}</button>
          </div>
        </article>`).join("")
      : `<p class="empty-hint">Semua kupon sudah diklaim. Buat kupon baru di atas.</p>`;
  }
  if (hist) {
    hist.innerHTML = S.coupons.claimed.length
      ? [...S.coupons.claimed].sort((a, b) => (b.claimedAt || 0) - (a.claimedAt || 0)).map((c) => `<article class="coupon-card claimed">
          <span class="badge-claimed">${icon("check")} Sudah diklaim</span>
          <h4>${esc(c.title)}</h4>
          <p>${esc(c.desc)}</p>
          <span class="claimed-at">Diklaim ${esc(fmtStamp(c.claimedAt))}</span>
          <div class="coupon-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-act="cp-undo" data-id="${c.id}">${icon("undo")} Batalkan klaim</button>
            <button class="btn-icon btn-sm" type="button" data-act="cp-del-claimed" data-id="${c.id}" aria-label="Hapus">${icon("trash")}</button>
          </div>
        </article>`).join("")
      : `<p class="empty-hint">Belum ada kupon yang diklaim.</p>`;
  }
}
async function couponAction(e) {
  const btn = e.target.closest("[data-act]"); if (!btn) return;
  const act = btn.dataset.act, id = btn.dataset.id;
  if (act === "cp-claim") {
    const i = S.coupons.available.findIndex((x) => x.id === id); if (i < 0) return;
    const [c] = S.coupons.available.splice(i, 1);
    S.coupons.claimed.push({ ...c, claimedAt: Date.now() });
    save(); renderCoupons(); pop(750); launchConfetti(80); addScore(25);
    toast("Kupon diklaim ", "success");
  } else if (act === "cp-undo") {
    const i = S.coupons.claimed.findIndex((x) => x.id === id); if (i < 0) return;
    const [c] = S.coupons.claimed.splice(i, 1);
    delete c.claimedAt;
    S.coupons.available.push(c);
    save(); renderCoupons(); pop(500);
    toast("Klaim dibatalkan, kupon kembali tersedia");
  } else if (act === "cp-edit") {
    const c = S.coupons.available.find((x) => x.id === id); if (!c) return;
    if ($("coupon-edit-id"))    $("coupon-edit-id").value    = c.id;
    if ($("coupon-edit-title")) $("coupon-edit-title").value = c.title;
    if ($("coupon-edit-desc"))  $("coupon-edit-desc").value  = c.desc;
    openModal("coupon-modal");
  } else if (act === "cp-del" || act === "cp-del-claimed") {
    const pool = act === "cp-del" ? S.coupons.available : S.coupons.claimed;
    const c = pool.find((x) => x.id === id);
    if (!await askConfirm(`Hapus kupon "${c?.title}"?`, { title: "Hapus kupon", confirmText: "Hapus", danger: true })) return;
    if (act === "cp-del") S.coupons.available = pool.filter((x) => x.id !== id);
    else                  S.coupons.claimed   = pool.filter((x) => x.id !== id);
    save(); renderCoupons(); toast("Kupon dihapus");
  }
}

/* ───── RENDER ALL ───── */
function renderAll() {
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
  applySyncHints();
}

/* ───── FIRESTORE SYNC ───── */
async function initFirestoreSync() {
  try {
    const snap = await getDoc(ROOM_REF);
    if (!snap.exists()) {
      await setDoc(ROOM_REF, { ...S, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  } catch (err) {
    console.warn("Inisialisasi dokumen Firestore:", err);
    setSync("error");
  }
  if (unsubRoom) unsubRoom();
  unsubRoom = onSnapshot(ROOM_REF, (docSnap) => {
    if (!docSnap.exists()) return;
    setSync("ready");
    const data = docSnap.data();
    const incoming = JSON.stringify(data);
    if (incoming === lastSyncedFingerprint) return;
    S = mergeState(data);
    lastSyncedFingerprint = incoming;
    renderAll();
  }, (err) => {
    console.error("Listener real-time terganggu:", err);
    setSync("error");
    toast("Koneksi real-time terganggu. Periksa konfigurasi Firebase.", "warn");
  });
}

/* AUTH (seperti Akasha) */
let currentUser = null;

function showAuthError(msg) {
  const el = $("authError"); if (!el) return;
  el.textContent = msg; el.classList.remove("hidden");
}
function clearAuthError() { $("authError")?.classList.add("hidden"); }

function toggleAuthMode() {
  const isLogin = !$("loginForm")?.classList.contains("hidden");
  $("loginForm")?.classList.toggle("hidden", isLogin);
  $("registerForm")?.classList.toggle("hidden", !isLogin);
  if ($("authTitle"))    $("authTitle").innerHTML    = isLogin ? 'Buat akun' : 'Masuk';
  if ($("authSubtitle")) $("authSubtitle").textContent = isLogin ? "Daftar dengan email yang akan kalian pakai bersama." : "Pakai email yang kalian daftarkan.";
  if ($("authToggleText")) $("authToggleText").textContent = isLogin ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar";
  clearAuthError();
}

async function handleLogin(e) {
  e.preventDefault(); clearAuthError();
  const email = $("loginEmail")?.value.trim() || "";
  const pw    = $("loginPassword")?.value || "";
  const btn   = $("loginBtn");
  if (!email || !pw) return showAuthError("Email dan kata sandi wajib diisi.");
  if (btn) { btn.disabled = true; btn.textContent = "Memeriksa…"; }
  try {
    await setPersistence(auth, $("rememberMe")?.checked ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, pw);
  } catch (err) {
    const msg = {
      "auth/invalid-credential": "Email atau kata sandi salah.",
      "auth/invalid-email": "Format email tidak valid.",
      "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
      "auth/user-disabled": "Akun ini dinonaktifkan.",
      "auth/user-not-found": "Akun tidak ditemukan."
    }[err.code] || "Gagal masuk: " + (err.message || err.code);
    showAuthError(msg);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Buka buku"; }
  }
}

async function handleRegister(e) {
  e.preventDefault(); clearAuthError();
  const name  = $("registerName")?.value.trim() || "";
  const email = $("registerEmail")?.value.trim() || "";
  const pw    = $("registerPassword")?.value || "";
  const btn   = $("registerBtn");
  if (!name || !email || !pw) return showAuthError("Semua field wajib diisi.");
  if (pw.length < 6) return showAuthError("Kata sandi minimal 6 karakter.");
  if (btn) { btn.disabled = true; btn.textContent = "Mendaftarkan…"; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    if (name) await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      email, displayName: name, createdAt: serverTimestamp()
    });
  } catch (err) {
    const msg = {
      "auth/email-already-in-use": "Email sudah terdaftar. Silakan masuk.",
      "auth/invalid-email": "Format email tidak valid.",
      "auth/weak-password": "Kata sandi terlalu lemah."
    }[err.code] || "Gagal daftar: " + (err.message || err.code);
    showAuthError(msg);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Buat akun"; }
  }
}

async function handleLogout() {
  if (!await askConfirm("Keluar dari ruang privat ini?", { title: "Keluar", confirmText: "Keluar", danger: true })) return;
  try { await signOut(auth); } catch (e) { console.warn(e); }
}

async function handleGoogleLogin() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      await showAlert("Gagal: " + (err.code || err.message), "Login Google gagal");
    }
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = $("loginEmail")?.value.trim();
  if (!email) return showAlert("Isi alamat email terlebih dahulu.", "Lupa sandi");
  try {
    await sendPasswordResetEmail(auth, email);
    await showAlert("Tautan reset kata sandi sudah dikirim ke email Anda.", "Email terkirim");
  } catch (err) {
    await showAlert("Gagal: " + (err.code || err.message), "Lupa sandi");
  }
}

async function handleAccountUpdate(e) {
  e.preventDefault();
  const newName = $("accountName")?.value.trim();
  const newPw   = $("accountPassword")?.value;
  if (!currentUser) return;
  try {
    if (newPw) await updatePassword(currentUser, newPw);
    if (newName && newName !== currentUser.displayName) {
      await updateProfile(currentUser, { displayName: newName });
      await setDoc(doc(db, "users", currentUser.uid), { displayName: newName }, { merge: true });
    }
    $("accountModal")?.classList.add("hidden");
    toast("Akun diperbarui", "success");
  } catch (err) {
    await showAlert(err.code === "auth/requires-recent-login" ? "Keluar lalu masuk lagi untuk mengganti kata sandi." : "Gagal: " + err.message);
  }
}

function updateTopbarUser(user) {
  if (!user) return;
  const name = user.displayName || user.email?.split("@")[0] || "Pengguna";
  const initials = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("");
  if ($("topbarUserName"))   $("topbarUserName").textContent   = name;
  if ($("topbarUserAvatar")) $("topbarUserAvatar").textContent = initials || "MR";
}

/* SETUP LISTENERS */
function on(id, ev, fn) {
  const el = typeof id === "string" ? $(id) : id;
  if (!el) { console.warn("[on] Elemen tidak ditemukan:", id); return null; }
  el.addEventListener(ev, fn);
  return el;
}

function setupEventListeners() {
  // Auth
  on("loginForm",          "submit", handleLogin);
  on("registerForm",       "submit", handleRegister);
  on("authToggleLink",     "click",  (e) => { e.preventDefault(); toggleAuthMode(); });
  on("googleLoginBtn",     "click",  handleGoogleLogin);
  on("forgotPasswordLink", "click",  handleForgotPassword);
  on("btn-logout",         "click",  handleLogout);
  on("accountBtn",         "click",  () => {
    if (!currentUser) return;
    if ($("accountName"))     $("accountName").value     = currentUser.displayName || currentUser.email?.split("@")[0] || "";
    if ($("accountPassword")) $("accountPassword").value = "";
    openModal("accountModal");
  });
  on("accountForm", "submit", handleAccountUpdate);

  on("btn-hug", "click", () => {
    S.meta.hugs += 1;
    addScore(15);
    pop(650);
    launchConfetti(85);
    toast("Pelukan terkirim secara real-time ", "success");
  });

  on("theme-toggle", "click", () => {
    applyTheme(currentTheme === "light" ? "dark" : "light");
    pop(440);
  });

  // Tab navigasi
  document.querySelectorAll(".feat-tab").forEach((tab) => {
    on(tab, "click", () => activateTab(tab));
    tab.addEventListener("keydown", onTabKey);
  });
  window.addEventListener("hashchange", () => { const t = tabFromHash(); if (t) activateTab(t, { updateHash: false }); });

  // EVENTS
  on("add-event-form", "submit", (e) => {
    e.preventDefault();
    const name = $("event-name")?.value.trim(), date = $("event-date")?.value;
    if (!name || !date) return;
    S.events.push({ id: uid(), name, date });
    save(); renderEvents(); e.target.reset(); pop(600); addScore(10);
    toast("Hari spesial ditambahkan", "success");
  });
  on("anniversary-list", "click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const act = btn.dataset.act, id = btn.dataset.id;
    if (act === "event-edit") { editingEventId = id; renderEvents(); $(`ev-name-${id}`)?.focus(); }
    else if (act === "event-cancel") { editingEventId = null; renderEvents(); }
    else if (act === "event-del") {
      const ev = S.events.find((x) => x.id === id);
      if (!await askConfirm(`Hapus "${ev?.name}"?`, { title: "Hapus acara", confirmText: "Hapus", danger: true })) return;
      S.events = S.events.filter((x) => x.id !== id);
      save(); renderEvents(); toast("Acara dihapus");
    }
  });
  on("anniversary-list", "submit", (e) => {
    const form = e.target.closest('[data-form="event-edit"]'); if (!form) return;
    e.preventDefault();
    const id = form.dataset.id;
    const name = $(`ev-name-${id}`)?.value.trim(), date = $(`ev-date-${id}`)?.value;
    if (!name || !date) return;
    const ev = S.events.find((x) => x.id === id);
    if (ev) { ev.name = name; ev.date = date; }
    editingEventId = null; save(); renderEvents(); pop(560);
    toast("Acara diperbarui", "success");
  });

  // RED DAY
  on(document.querySelector('[data-act="red-edit"]'),   "click", openRedEdit);
  on(document.querySelector('[data-act="red-cancel"]'), "click", closeRedEdit);
  on("red-mode-input", "change", (e) => {
    $("red-manual-wrap")?.classList.toggle("hidden", e.target.value !== "manual");
  });
  on("red-edit-form", "submit", (e) => {
    e.preventDefault();
    const len = Number($("red-cycle-input")?.value);
    if (!Number.isFinite(len) || len < 20 || len > 45) return showAlert("Panjang siklus harus antara 20 dan 45 hari.");
    S.redDay = {
      lastStart:    $("red-date-input")?.value,
      cycleLength:  Math.round(len),
      statusMode:   $("red-mode-input")?.value,
      manualStatus: $("red-manual-input")?.value
    };
    save(); renderRed(); closeRedEdit(); pop(540);
    toast("Catatan siklus diperbarui", "success");
  });
  on("btn-log-red", "click", () => {
    S.redDay.lastStart = iso();
    save(); renderRed(); pop(540); launchConfetti(40);
    toast("Tanggal mulai dicatat hari ini", "success");
  });

  // MOOD tabs & selector
  document.querySelectorAll(".sub-tab").forEach((t) => {
    on(t, "click", () => { moodPerson = t.dataset.person; renderMoodTabs(); renderMood(); pop(500); });
  });
  on("mood-selector", "click", (e) => {
    const btn = e.target.closest("[data-mood]"); if (!btn) return;
    const d = S.moods[moodPerson];
    d.mood = btn.dataset.mood;
    d.updatedAt = Date.now();
    pushMoodHistory(moodPerson);
    save(); renderMood(); pop(580); addScore(5);
    toast(`Mood ${NAMES[moodPerson].nick} tersinkronisasi real-time`, "success");
  });
  on("mood-note-form", "submit", (e) => {
    e.preventDefault();
    const d = S.moods[moodPerson];
    d.note = $("mood-note-input")?.value.trim() || "";
    d.updatedAt = Date.now();
    pushMoodHistory(moodPerson);
    save(); renderMood(); pop(600);
    toast("Pesan harian disimpan", "success");
  });

  // GALLERY
  on("gallery-form", "submit", async (e) => {
    e.preventDefault();
    const err = $("gallery-error"); err?.classList.add("hidden");
    const title = $("gallery-title")?.value.trim();
    const url = httpUrl($("gallery-img")?.value);
    const file = $("gallery-file")?.files[0];
    if (!title) { if (err) { err.textContent = "Judul momen wajib diisi."; err.classList.remove("hidden"); } return; }
    if (!url && !file) { if (err) { err.textContent = "Isi URL gambar atau pilih berkas."; err.classList.remove("hidden"); } return; }
    let src = url;
    if (file) {
      if (!file.type.startsWith("image/")) { if (err) { err.textContent = "Berkas harus gambar."; err.classList.remove("hidden"); } return; }
      try { src = await compressImage(file); }
      catch (ex) { if (err) { err.textContent = ex.message; err.classList.remove("hidden"); } return; }
    }
    if (docBytes() + src.length > 900 * 1024) {
      if (err) { err.textContent = "Ukuran dokumen mendekati 1 MB. Gunakan URL atau hapus foto lama."; err.classList.remove("hidden"); }
      return;
    }
    S.gallery.unshift({ id: uid(), title, src, standIn: /unsplash\.com/.test(url) });
    if (!await save()) { S.gallery.shift(); return; }
    renderGallery(); e.target.reset(); pop(620); addScore(10);
    toast("Momen tersimpan secara real-time", "success");
  });
  on("gallery-grid", "click", async (e) => {
    const btn = e.target.closest('[data-act="gal-del"]'); if (!btn) return;
    if (!await askConfirm("Hapus momen ini?", { title: "Hapus", confirmText: "Hapus", danger: true })) return;
    S.gallery = S.gallery.filter((x) => x.id !== btn.dataset.id);
    save(); renderGallery(); toast("Momen dihapus");
  });

  // TIME PICKER
  buildTimePicker();
  on("rem-time-display", "click", () => tp.open ? closeTimePicker() : openTimePicker());
  on("tp-hours",   "click", (e) => { const b = e.target.closest("[data-h]"); if (b) { tp.hour   = Number(b.dataset.h); paintTimePicker(); } });
  on("tp-minutes", "click", (e) => { const b = e.target.closest("[data-m]"); if (b) { tp.minute = Number(b.dataset.m); paintTimePicker(); } });
  on("tp-apply",   "click", applyTimePicker);
  on("tp-cancel",  "click", () => { closeTimePicker(); $("rem-time-display")?.focus(); });
  on("tp-manual-apply", "click", () => {
    const v = $("tp-manual-input")?.value.trim();
    const m = v?.match(/^(\d{1,2})[:.](\d{1,2})$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return toast("Format waktu HH:MM, mis. 07:35", "warn");
    tp.hour = Number(m[1]); tp.minute = Number(m[2]);
    if ($("tp-manual-input")) $("tp-manual-input").value = "";
    applyTimePicker();
  });
  document.addEventListener("click", (e) => { if (tp.open && !e.target.closest("#timepicker")) closeTimePicker(); });

  // REMINDERS
  on("reminder-form", "submit", (e) => {
    e.preventDefault();
    const err = $("reminder-error"); err?.classList.add("hidden");
    const text = $("rem-text")?.value.trim(), time = $("rem-time")?.value;
    if (!text) { if (err) { err.textContent = "Isi pengingat wajib diisi."; err.classList.remove("hidden"); } return; }
    if (!/^\d{2}:\d{2}$/.test(time || "")) { if (err) { err.textContent = "Pilih waktu lewat pemilih waktu."; err.classList.remove("hidden"); } return; }
    S.reminders.push({ id: uid(), text, time });
    save(); renderReminders();
    e.target.reset();
    if ($("rem-time")) $("rem-time").value = "";
    if ($("rem-time-label")) $("rem-time-label").textContent = "Pilih waktu";
    pop(550); addScore(10); toast("Pengingat disimpan", "success");
  });
  on("reminder-list", "click", async (e) => {
    const btn = e.target.closest('[data-act="rem-del"]'); if (!btn) return;
    if (!await askConfirm("Hapus pengingat ini?", { title: "Hapus", confirmText: "Hapus", danger: true })) return;
    S.reminders = S.reminders.filter((x) => x.id !== btn.dataset.id);
    save(); renderReminders(); toast("Pengingat dihapus");
  });

  // TODOS & DREAMS
  bindTaskList("todo-list",  () => S.todos,  "todo",  renderTodos);
  bindTaskList("dream-list", () => S.dreams, "dream", renderDreams);
  on("todo-form",  "submit", (e) => {
    e.preventDefault();
    const text = $("todo-input")?.value.trim(); if (!text) return;
    S.todos.push({ id: uid(), text, state: "active" });
    save(); renderTodos(); e.target.reset(); pop(580);
  });
  on("dream-form", "submit", (e) => {
    e.preventDefault();
    const text = $("dream-input")?.value.trim(); if (!text) return;
    S.dreams.push({ id: uid(), text, state: "active" });
    save(); renderDreams(); e.target.reset(); pop(590); addScore(10);
    toast("Impian ditambahkan", "success");
  });

  // CAPSULES
  on("capsule-form", "submit", (e) => {
    e.preventDefault();
    const title = $("capsule-title")?.value.trim(), msg = $("capsule-msg")?.value.trim(), openDate = $("capsule-date")?.value;
    if (!title || !msg || !openDate) return;
    S.capsules.push({ id: uid(), title, msg, openDate });
    save(); renderCapsules(); e.target.reset(); pop(620); launchConfetti(50);
    toast("Kapsul waktu dikunci", "success");
  });
  on("capsule-grid", "click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const c = S.capsules.find((x) => x.id === btn.dataset.id); if (!c) return;
    if (btn.dataset.act === "cap-edit") {
      if ($("capsule-edit-id"))    $("capsule-edit-id").value    = c.id;
      if ($("capsule-edit-title")) $("capsule-edit-title").value = c.title;
      if ($("capsule-edit-date"))  $("capsule-edit-date").value  = c.openDate;
      if ($("capsule-edit-msg"))   $("capsule-edit-msg").value   = c.msg;
      openModal("capsule-modal");
    } else {
      if (!await askConfirm(`Hapus kapsul "${c.title}"?`, { title: "Hapus", confirmText: "Hapus", danger: true })) return;
      S.capsules = S.capsules.filter((x) => x.id !== c.id);
      save(); renderCapsules(); toast("Kapsul dihapus");
    }
  });
  on("capsule-edit-form", "submit", (e) => {
    e.preventDefault();
    const c = S.capsules.find((x) => x.id === $("capsule-edit-id")?.value); if (!c) return;
    c.title    = $("capsule-edit-title")?.value.trim();
    c.openDate = $("capsule-edit-date")?.value;
    c.msg      = $("capsule-edit-msg")?.value.trim();
    save(); renderCapsules(); closeModal("capsule-modal"); pop(560);
    toast("Kapsul diperbarui", "success");
  });

  // SONGS
  const player = $("audio-player"), vinyl = $("vinyl-disc");
  if (player) {
    const setPlaying = (on) => {
      vinyl?.classList.toggle("spinning", on);
      const b = $("vinyl-toggle"); if (b) { b.textContent = on ? "Jeda" : "Putar"; b.setAttribute("aria-pressed", String(on)); }
    };
    player.addEventListener("play",  () => setPlaying(true));
    player.addEventListener("pause", () => setPlaying(false));
    player.addEventListener("ended", () => setPlaying(false));
    player.addEventListener("error", () => { if (player.src) showAudioError("Gagal memuat audio."); });
  }
  on("vinyl-toggle", "click", () => {
    if (!player) return;
    if (player.paused) { if (player.src) player.play().catch(() => showAudioError("Pilih lagu lain.")); }
    else player.pause();
  });
  on("song-form", "submit", (e) => {
    e.preventDefault();
    const err = $("song-error"); err?.classList.add("hidden");
    const title = $("song-title")?.value.trim(), url = httpUrl($("song-url")?.value);
    if (!title) { if (err) { err.textContent = "Judul lagu wajib diisi."; err.classList.remove("hidden"); } return; }
    if (!url)   { if (err) { err.textContent = "URL harus diawali http:// atau https://"; err.classList.remove("hidden"); } return; }
    const kind = AUDIO_EXT.test(url) ? "audio" : "link";
    S.songs.push({ id: uid(), title, note: $("song-note")?.value.trim() || "", url, kind });
    save(); renderSongs(); e.target.reset(); pop(620); addScore(10);
    toast(kind === "audio" ? "Lagu masuk daftar putar" : "Disimpan sebagai tautan", kind === "audio" ? "success" : "warn");
  });
  on("song-list", "click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const s = S.songs.find((x) => x.id === btn.dataset.id); if (!s) return;
    const act = btn.dataset.act;
    if (act === "song-play") playSong(s);
    else if (act === "song-edit") {
      if ($("song-edit-id"))    $("song-edit-id").value    = s.id;
      if ($("song-edit-title")) $("song-edit-title").value = s.title;
      if ($("song-edit-note"))  $("song-edit-note").value  = s.note || "";
      if ($("song-edit-url"))   $("song-edit-url").value   = s.url;
      $("song-edit-error")?.classList.add("hidden");
      openModal("song-modal");
    } else if (act === "song-del") {
      if (!await askConfirm(`Hapus "${s.title}"?`, { title: "Hapus lagu", confirmText: "Hapus", danger: true })) return;
      S.songs = S.songs.filter((x) => x.id !== s.id);
      if (currentSongId === s.id) {
        player?.pause(); player?.removeAttribute("src"); currentSongId = null;
        if ($("now-playing-title")) $("now-playing-title").textContent = "Belum ada lagu diputar";
        if ($("now-playing-desc"))  $("now-playing-desc").textContent  = "Pilih lagu dari daftar putar.";
      }
      save(); renderSongs(); toast("Lagu dihapus");
    }
  });
  on("song-edit-form", "submit", (e) => {
    e.preventDefault();
    const err = $("song-edit-error"); err?.classList.add("hidden");
    const s = S.songs.find((x) => x.id === $("song-edit-id")?.value); if (!s) return;
    const url = httpUrl($("song-edit-url")?.value);
    if (!url) { if (err) { err.textContent = "URL harus diawali http:// atau https://"; err.classList.remove("hidden"); } return; }
    s.title = $("song-edit-title")?.value.trim();
    s.note  = $("song-edit-note")?.value.trim();
    s.url   = url;
    s.kind  = AUDIO_EXT.test(url) ? "audio" : "link";
    save(); renderSongs(); closeModal("song-modal"); pop(560);
    toast("Lagu diperbarui", "success");
  });

  // PLACES
  on("place-form", "submit", (e) => {
    e.preventDefault();
    const name = $("place-name")?.value.trim(), location = $("place-location")?.value.trim(), memory = $("place-memory")?.value.trim();
    if (!name || !location || !memory) return;
    S.places.push({ id: uid(), name, location, memory });
    save(); renderPlaces(); e.target.reset(); pop(620); addScore(10);
    toast("Tempat berkesan ditambahkan", "success");
  });
  on("places-grid", "click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const act = btn.dataset.act;
    if (act === "place-cancel") { editingPlaceId = null; renderPlaces(); return; }
    const p = S.places.find((x) => x.id === btn.dataset.id); if (!p) return;
    if (act === "place-edit") { editingPlaceId = p.id; renderPlaces(); $(`pl-name-${p.id}`)?.focus(); }
    else if (act === "place-del") {
      if (!await askConfirm(`Hapus "${p.name}"?`, { title: "Hapus", confirmText: "Hapus", danger: true })) return;
      S.places = S.places.filter((x) => x.id !== p.id);
      save(); renderPlaces(); toast("Tempat dihapus");
    }
  });
  on("places-grid", "submit", (e) => {
    const form = e.target.closest('[data-form="place-edit"]'); if (!form) return;
    e.preventDefault();
    const id = form.dataset.id;
    const p = S.places.find((x) => x.id === id); if (!p) return;
    p.name     = $(`pl-name-${id}`)?.value.trim();
    p.location = $(`pl-loc-${id}`)?.value.trim();
    p.memory   = $(`pl-mem-${id}`)?.value.trim();
    editingPlaceId = null; save(); renderPlaces(); pop(560);
    toast("Tempat diperbarui", "success");
  });

  // COUPONS
  on("coupon-form", "submit", (e) => {
    e.preventDefault();
    const title = $("coupon-title")?.value.trim(), desc = $("coupon-desc")?.value.trim();
    if (!title || !desc) return;
    S.coupons.available.push({ id: uid(), title, desc });
    save(); renderCoupons(); e.target.reset(); pop(620); addScore(10);
    toast("Kupon baru dibuat", "success");
  });
  on("coupons-grid",    "click", couponAction);
  on("coupons-history", "click", couponAction);
  on("coupon-edit-form", "submit", (e) => {
    e.preventDefault();
    const c = S.coupons.available.find((x) => x.id === $("coupon-edit-id")?.value); if (!c) return;
    c.title = $("coupon-edit-title")?.value.trim();
    c.desc  = $("coupon-edit-desc")?.value.trim();
    save(); renderCoupons(); closeModal("coupon-modal"); pop(560);
    toast("Kupon diperbarui", "success");
  });

  // MODAL / DIALOG
  document.querySelectorAll("[data-close]").forEach((b) => on(b, "click", () => closeModal(b.dataset.close)));
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target !== m) return;
      if (m.id === "app-dialog") closeDialog(false); else closeModal(m.id);
    });
  });
  on("dialog-confirm", "click", () => closeDialog(true));
  on("dialog-cancel",  "click", () => closeDialog(false));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("app-dialog")?.classList.contains("hidden")) { closeDialog(false); return; }
    document.querySelectorAll(".modal:not(.hidden)").forEach((m) => closeModal(m.id));
    if (tp.open) closeTimePicker();
  });
}

/* INIT */
function init() {
  setupEventListeners();
  startReminderScheduler();
  const dateEl = $("hero-date");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if ($("footer-julie"))  $("footer-julie").textContent  = NAMES.julie.nick;
  if ($("footer-reroll")) $("footer-reroll").textContent = NAMES.abyant.nick;
  const initial = tabFromHash(); if (initial) activateTab(initial, { updateHash: false });
  // Gambar yang gagal dimuat diganti keterangan teks (event error tidak menggelembung).
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("gallery-img")) return;
    const msg = document.createElement("div");
    msg.className = "img-fail"; msg.textContent = "Gambar tidak bisa dimuat.";
    img.replaceWith(msg);
  }, true);

  // Auth state listener, gerbang utama
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Login berhasil
      currentUser = user;
      $("authGate")?.classList.add("hidden");
      $("appRoot")?.classList.remove("hidden");
      updateTopbarUser(user);
      setSync("loading");
      renderAll();
      initFirestoreSync();
    } else {
      // Logout / belum login
      currentUser = null;
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      $("appRoot")?.classList.add("hidden");
      $("authGate")?.classList.remove("hidden");
    }
  });
}

init();
