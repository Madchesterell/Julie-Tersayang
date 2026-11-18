import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, getDocs, limit, serverTimestamp, arrayUnion, arrayRemove, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, updatePassword, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEZ_9ni_0u9WY5fQCSsHt8RZFlijetLgs",
  authDomain: "workspace-1146e.firebaseapp.com",
  projectId: "workspace-1146e",
  storageBucket: "workspace-1146e.firebasestorage.app",
  messagingSenderId: "617778820449",
  appId: "1:617778820449:web:8f239651dda6dfd0f8c120",
  measurementId: "G-YZGE0SBE5V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let state = {
  user: null, workspaceId: null, workspaceName: null, role: null, workerName: null,
  driveLink: '', members: [], tasks: [], divisions: []
};
let unsubscribers = [];
let dashboardWorkspaces = [];
let dashboardStatus = 'loading'; // loading | ready | error
let dashboardNotifications = [];
let heartbeatInterval = null;
let activities = [], announcements = [];
let notifications = [], notifUnsub = null;
let currentDetailId = null;
const autoStarted = new Set();
const $ = (id) => document.getElementById(id);

// Utilitas
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safeUrl(u) {
  try {
    const url = new URL(String(u || '').trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
  } catch { return ''; }
}
function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const daysLeft = t => !t.endDate ? null : Math.round((new Date(t.endDate + 'T00:00:00') - new Date(localDate() + 'T00:00:00')) / 864e5);
function dueLevel(t) {
  if (t.status === 'done') return null;
  const d = daysLeft(t);
  return d === null ? null : d < 0 ? 'overdue' : d <= 1 ? 'urgent' : d <= 3 ? 'soon' : null;
}
function dueLabel(t) {
  const d = daysLeft(t);
  return d < 0 ? `Terlambat ${-d} hari` : d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `H-${d}`;
}
const needsAction = (t, role, name) => role === 'mentor'
  ? t.status === 'review'
  : t.assignee === name && (t.status === 'todo' || (t.status === 'progress' && t.revisionNotes));
function statusInfo(t) {
  if (t.status === 'done') return ['Selesai', 's-done'];
  if (t.status === 'review') return ['Siap Dicek', 's-check'];
  if (t.status === 'progress') return t.revisionNotes ? ['Revisi', 's-review'] : ['Berjalan', 's-progress'];
  return ['Belum Dimulai', 's-todo'];
}
function toast(msg, type = 'info') {
  const c = $('toastContainer'); if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3000);
}
const fmtTime = ts => {
  const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  return d ? d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'baru saja';
};
function timeAgo(ts) {
  if (!ts) return '-';
  const t = ts?.toDate ? ts.toDate() : new Date(ts);
  const s = (Date.now() - t.getTime()) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}
function isOnline(lastActive) {
  if (!lastActive) return false;
  const t = lastActive?.toDate ? lastActive.toDate() : new Date(lastActive);
  return (Date.now() - t.getTime()) < 120000;
}
const newId = () => Math.random().toString(36).slice(2, 9);

// Dialog dalam aplikasi, pengganti alert, confirm, dan prompt
let dialogResolve = null, dialogValidator = null;
function openDialog(o) {
  return new Promise(resolve => {
    dialogResolve = resolve;
    dialogValidator = o.validate || null;
    $('appDialogTitle').textContent = o.title || 'Konfirmasi';
    $('appDialogMessage').textContent = o.message || '';
    $('appDialogMessage').classList.toggle('hidden', !o.message);
    $('appDialogFieldWrap').classList.toggle('hidden', !o.input);
    $('appDialogLabel').textContent = o.label || 'Nilai';
    const inp = $('appDialogInput');
    inp.value = o.value || ''; inp.placeholder = o.placeholder || '';
    inp.classList.toggle('code-field', !!o.code);
    inp.maxLength = o.code ? 6 : 500;
    $('appDialogError').classList.add('hidden');
    $('appDialogCancel').classList.toggle('hidden', !!o.alertOnly);
    const ok = $('appDialogConfirm');
    ok.textContent = o.confirmText || (o.input ? 'Simpan' : 'Ya, lanjut');
    ok.className = 'btn-sm ' + (o.danger ? 'btn-danger' : 'btn-solid');
    $('appDialog').dataset.mode = o.input ? 'input' : (o.alertOnly ? 'alert' : 'confirm');
    $('appDialog').classList.remove('hidden');
    setTimeout(() => (o.input ? inp : ok).focus(), 40);
  });
}
function closeDialog(val) {
  $('appDialog').classList.add('hidden');
  const r = dialogResolve; dialogResolve = null; dialogValidator = null;
  if (r) r(val);
}
function submitDialog() {
  const mode = $('appDialog').dataset.mode;
  if (mode === 'input') {
    const v = $('appDialogInput').value;
    if (dialogValidator) {
      const err = dialogValidator(v);
      if (err) { const e = $('appDialogError'); e.textContent = err; e.classList.remove('hidden'); return; }
    }
    closeDialog(v);
  } else closeDialog(true);
}
const showAlert = (message, title = 'Perhatian') => openDialog({ title, message, alertOnly: true, confirmText: 'Mengerti' });
const askConfirm = (message, o = {}) => openDialog({ title: o.title || 'Konfirmasi', message, confirmText: o.confirmText || 'Ya, lanjut', danger: o.danger });
const askText = o => openDialog({ ...o, input: true });

// Pilihan kustom (select)
function closeAllSelects(except) {
  document.querySelectorAll('.select-panel').forEach(p => {
    if (p === except) return;
    p.classList.add('hidden');
    p.previousElementSibling?.setAttribute('aria-expanded', 'false');
  });
}
function enhanceSelect(sel) {
  if (sel.dataset.enhanced) return;
  sel.dataset.enhanced = '1';
  sel.removeAttribute('required');
  const shell = document.createElement('div'); shell.className = 'select-shell';
  sel.parentNode.insertBefore(shell, sel);
  shell.appendChild(sel);
  sel.classList.add('select-native');
  sel.setAttribute('tabindex', '-1');
  sel.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
  const val = document.createElement('span'); val.className = 'select-value';
  const caret = document.createElement('span'); caret.className = 'select-caret'; caret.innerHTML = '<svg class="ic"><use href="#i-caret"/></svg>'; caret.setAttribute('aria-hidden', 'true');
  trigger.append(val, caret);

  const panel = document.createElement('div');
  panel.className = 'select-panel hidden'; panel.setAttribute('role', 'listbox');
  shell.append(trigger, panel);

  const labelFor = () => {
    const o = sel.options[sel.selectedIndex];
    val.textContent = o ? o.textContent.trim() : 'Pilih…';
    val.classList.toggle('placeholder', !o || !sel.value);
  };
  const build = () => {
    panel.innerHTML = '';
    const add = (opt) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'select-option'; b.setAttribute('role', 'option');
      b.dataset.value = opt.value; b.disabled = opt.disabled;
      b.setAttribute('aria-selected', String(opt.value === sel.value));
      const t = document.createElement('span'); t.textContent = opt.textContent.trim();
      b.appendChild(t);
      if (opt.value === sel.value) { const c = document.createElement('span'); c.className = 'select-check'; c.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>'; b.appendChild(c); }
      b.addEventListener('click', () => {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        closeAllSelects(); trigger.focus(); sync();
      });
      panel.appendChild(b);
    };
    Array.from(sel.children).forEach(n => {
      if (n.tagName === 'OPTGROUP') {
        const g = document.createElement('div'); g.className = 'select-group'; g.textContent = n.label;
        panel.appendChild(g);
        Array.from(n.children).forEach(add);
      } else if (n.tagName === 'OPTION') add(n);
    });
    labelFor();
  };
  const sync = () => { build(); };

  trigger.addEventListener('click', () => {
    const open = panel.classList.contains('hidden');
    closeAllSelects();
    panel.classList.toggle('hidden', !open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) (panel.querySelector('[aria-selected="true"]:not(:disabled)') || panel.querySelector('.select-option:not(:disabled)'))?.focus();
  });
  trigger.addEventListener('keydown', e => {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); trigger.click(); }
  });
  panel.addEventListener('keydown', e => {
    const items = Array.from(panel.querySelectorAll('.select-option:not(:disabled)'));
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(i - 1, 0)]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeAllSelects(); trigger.focus(); }
    else if (e.key === 'Tab') closeAllSelects();
  });
  sel.addEventListener('change', sync);
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
  sync();
}
function enhanceAllSelects() { document.querySelectorAll('select[data-enhance]').forEach(enhanceSelect); }

function startHeartbeat() {
  stopHeartbeat();
  const beat = async () => {
    if (!state.user || !state.workspaceId) return;
    try { await updateDoc(doc(db, 'workspaces', state.workspaceId, 'members', state.user.uid), { lastActive: serverTimestamp() }); }
    catch (e) { console.warn('Heartbeat gagal:', e); }
  };
  beat();
  heartbeatInterval = setInterval(beat, 60000);
}
function stopHeartbeat() { if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; } }

// Pergantian tampilan
function showAuthView() {
  $('authView').classList.remove('hidden');
  $('dashboardView').classList.add('hidden');
  $('workspaceView').classList.add('hidden');
}
function showDashboardView() {
  $('authView').classList.add('hidden');
  $('dashboardView').classList.remove('hidden');
  $('workspaceView').classList.add('hidden');
  dashboardStatus = 'loading';
  const name = state.user?.displayName || state.user?.email || 'Pengguna';
  const initials = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
  if ($('topbarUserName')) $('topbarUserName').textContent = name;
  if ($('topbarUserRole')) $('topbarUserRole').textContent = 'Member';
  if ($('topbarUserAvatar')) $('topbarUserAvatar').textContent = initials || 'A';
  renderGreeting();
  loadUserWorkspaces();
  switchDashboardSection('home');
}
function switchDashboardSection(section) {
  const panels = { home: 'dashboardHomePanel', workspaces: 'myWorkspacesPanel', notifications: 'notificationsPanel' };
  Object.entries(panels).forEach(([k, id]) => $(id)?.classList.toggle('hidden', k !== section));
  $('dashboardNavBtn')?.classList.toggle('active', section === 'home');
  $('myWorkspacesNavBtn')?.classList.toggle('active', section === 'workspaces');
  $('notificationsNavBtn')?.classList.toggle('active', section === 'notifications');
  $('dashboardPageTitle').textContent = ({ home: 'Dashboard', workspaces: 'Ruang Kerja Saya', notifications: 'Notifikasi' })[section] || 'Dashboard';
  if (section === 'notifications') renderFullNotifications();
}
function showWorkspaceView() {
  $('authView').classList.add('hidden');
  $('dashboardView').classList.add('hidden');
  $('workspaceView').classList.remove('hidden');
  $('workspaceTitle').textContent = state.workspaceName || 'Ruang Kerja';
  const isLead = state.role === 'mentor';
  $('tabDivisionView')?.classList.toggle('hidden', !isLead);
  $('tabTaskLabel').textContent = isLead ? 'Papan Tugas' : 'Tugas Saya';
  $('mentorPanel').classList.toggle('hidden', !isLead);
  $('mentorTaskCreator').classList.toggle('hidden', !isLead);
  $('announceCreator').classList.toggle('hidden', !isLead);
  $('dailyGoalSection')?.classList.toggle('hidden', isLead);
  $('roleControls').innerHTML = `<span>${isLead ? 'Lead' : 'Member'} · <strong>${escapeHtml(state.workerName)}</strong></span>`;
  startHeartbeat();
  switchWorkspaceTab('task');
}
const WS_TABS = {
  task: ['mainTaskContainer', 'tabTaskView'],
  calendar: ['calendarPanel', 'tabCalendarView'],
  activity: ['activityPanel', 'tabActivityView'],
  announce: ['announcementPanel', 'tabAnnouncementView'],
  division: ['divisionManagementPanel', 'tabDivisionView'],
  team: ['teamPanel', 'tabTeamView']
};
function switchWorkspaceTab(tab) {
  Object.entries(WS_TABS).forEach(([k, [p, b]]) => {
    $(p)?.classList.toggle('hidden', k !== tab);
    $(b)?.classList.toggle('active', k === tab);
  });
  if (tab === 'division') renderDivisionManagement();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'team') renderTeamPanel();
}

// Autentikasi
function toggleAuthMode() {
  const isLogin = !$('loginForm').classList.contains('hidden');
  $('loginForm').classList.toggle('hidden', isLogin);
  $('registerForm').classList.toggle('hidden', !isLogin);
  $('authTitle').innerHTML = isLogin ? 'Buat <span>Akun</span>' : 'Selamat <span>Datang</span>';
  $('authSubtitle').textContent = isLogin ? 'Daftar untuk membuat atau bergabung ke ruang kerja.' : 'Masuk untuk membuka ruang kerja Anda.';
}
async function handleLogin(e) {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const btn = $('loginBtn');
  btn.disabled = true; btn.textContent = 'Masuk…';
  try {
    await setPersistence(auth, $('rememberMe').checked ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) { await showAlert('Gagal masuk: ' + (err.code || err.message), 'Tidak bisa masuk'); }
  finally { btn.disabled = false; btn.textContent = 'Masuk ke ruang kerja'; }
}
async function handleRegister(e) {
  e.preventDefault();
  const name = $('registerName').value.trim();
  const email = $('registerEmail').value.trim();
  const password = $('registerPassword').value;
  const btn = $('registerBtn');
  btn.disabled = true; btn.textContent = 'Mendaftar…';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), { email, displayName: name, workspaceIds: [], createdAt: serverTimestamp() });
  } catch (err) { await showAlert('Gagal daftar: ' + (err.code || err.message), 'Tidak bisa mendaftar'); }
  finally { btn.disabled = false; btn.textContent = 'Buat akun'; }
}
async function handleLogout() {
  if (!await askConfirm('Keluar dari akun ini?', { title: 'Keluar', confirmText: 'Keluar', danger: true })) return;
  stopHeartbeat();
  unsubscribers.forEach(u => u()); unsubscribers = [];
  await signOut(auth);
}

// Data dashboard
function summarizeTasks(tasks, role, myName) {
  const mine = role === 'worker' ? tasks.filter(t => t.assignee === myName) : tasks;
  const c = { todo: 0, progress: 0, review: 0, done: 0, overdue: 0 };
  mine.forEach(t => {
    c[t.status] = (c[t.status] || 0) + 1;
    const d = daysLeft(t);
    if (t.status !== 'done' && d !== null && d < 0) c.overdue++;
  });
  return { c, total: mine.length, action: tasks.filter(t => needsAction(t, role, myName)).length };
}
async function loadUserWorkspaces() {
  const list = $('workspaceList');
  if (list) list.innerHTML = '<p class="empty-hint">Memuat daftar ruang kerja…</p>';
  try {
    const userSnap = await getDoc(doc(db, 'users', state.user.uid));
    const ids = userSnap.exists() ? (userSnap.data().workspaceIds || []) : [];
    if (!ids.length) {
      dashboardWorkspaces = [];
      dashboardStatus = 'ready';
      renderWorkspaceList([]); renderDashboardNotifications(); renderMiniCalendar(); renderDashboardSummary();
      return;
    }
    const workspaces = await Promise.all(ids.map(async id => {
      const wsSnap = await getDoc(doc(db, 'workspaces', id));
      if (!wsSnap.exists()) return null;
      const memberSnap = await getDoc(doc(db, 'workspaces', id, 'members', state.user.uid));
      if (!memberSnap.exists()) return null;
      const member = memberSnap.data();
      let tasks = [];
      try { tasks = (await getDocs(collection(db, 'workspaces', id, 'tasks'))).docs.map(d => ({ id: d.id, ...d.data() })); }
      catch (e) { console.warn('Ringkasan gagal:', e); }
      const role = member.role || 'worker';
      return { id, ...wsSnap.data(), role, workerName: member.name, tasks, stats: summarizeTasks(tasks, role, member.name) };
    }));
    dashboardWorkspaces = workspaces.filter(Boolean);
    dashboardStatus = 'ready';
    renderWorkspaceList(dashboardWorkspaces); renderDashboardNotifications(); renderMiniCalendar(); renderDashboardSummary();
  } catch (err) {
    console.error(err);
    dashboardStatus = 'error';
    renderGreeting();
    if (list) list.innerHTML = `<p class="empty-hint">Gagal memuat: ${escapeHtml(err.message)}</p>`;
  }
}
function renderWorkspaceList(workspaces) {
  const card = ws => {
    const code = ws.joinCode || '';
    const s = ws.stats || { c: {}, total: 0, action: 0 };
    const total = s.total || 0;
    const done = s.c?.done || 0;
    const progress = total ? Math.round((done / total) * 100) : 0;
    const waiting = s.action || 0;
    const roleLabel = ws.role === 'mentor' ? 'Mentor' : 'Member';
    const roleClass = ws.role === 'mentor' ? 'badge-role-mentor' : 'badge-role-member';
    return `<article class="ws-card-item">
      <div class="ws-card-top">
        <div>
          <div class="ws-card-name">${escapeHtml(ws.name)}</div>
          <div class="ws-card-meta">${escapeHtml(ws.role === 'mentor' ? 'Kamu pengelolanya' : 'Anggota')}</div>
        </div>
        <span class="${roleClass}">${roleLabel}</span>
      </div>
      <div>
        <div class="ws-progress-bar"><div class="ws-progress-fill" style="width:${progress}%"></div></div>
        <div class="ws-progress-text">${progress}% selesai · ${waiting} tugas menunggu kamu</div>
      </div>
      <div class="ws-card-foot">
        <span class="ws-code-label">KODE ${escapeHtml(code || '-')}</span>
        <button type="button" class="btn-sm btn-ghost ws-card-open" aria-label="Buka ruang ${escapeHtml(ws.name)}" onclick="openWorkspace('${ws.id}')">Buka ruang</button>
      </div>
    </article>`;
  };
  const empty = '<p class="empty-hint">Belum ada ruang kerja. Buat atau gabung dengan kode undangan.</p>';
  const joinCard = `<div class="ws-card-item ws-join-card-item">
    <h3 class="ws-card-name">Punya kode undangan?</h3>
    <p class="ws-card-meta">Masukkan 6 karakter dari mentormu.</p>
    <div class="ws-join-form">
      <input type="text" id="inlineJoinCode" aria-label="Kode undangan" maxlength="6" class="field code-field" placeholder="ABC123" />
      <button type="button" class="btn-sm btn-solid" id="inlineJoinBtn">Gabung</button>
    </div>
  </div>`;
  if ($('workspaceList')) {
    $('workspaceList').innerHTML = workspaces.length ? workspaces.map(card).join('') + joinCard : empty + joinCard;
    const btn = $('inlineJoinBtn');
    if (btn) btn.onclick = () => {
      const code = ($('inlineJoinCode')?.value || '').trim().toUpperCase();
      if (code.length === 6) { $('joinCodeInput').value = code; $('joinWorkspaceModal').classList.remove('hidden'); }
      else toast('Kode harus 6 karakter', 'info');
    };
  }
  if ($('dashboardWorkspacePreview')) {
    $('dashboardWorkspacePreview').innerHTML = workspaces.length
      ? workspaces.slice(0, 3).map(ws => {
          const s = ws.stats || { c: {}, total: 0 };
          const total = s.total || 0;
          const done = s.c?.done || 0;
          const progress = total ? Math.round((done / total) * 100) : 0;
          return `<button type="button" class="ws-card-item ws-preview" onclick="openWorkspace('${ws.id}')">
            <span class="ws-card-name">${escapeHtml(ws.name)}</span>
            <span class="ws-progress-bar"><span class="ws-progress-fill" style="width:${progress}%"></span></span>
            <span class="ws-progress-text">${progress}% · ${s.action || 0} menunggu</span>
          </button>`;
        }).join('')
      : '<p class="empty-hint">Belum ada ruang kerja.</p>';
  }
}
window.copyJoinCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code);
    toast(`Kode ${code} disalin`, 'success');
  } catch {
    await showAlert(`Kode undangan: ${code}`, 'Salin manual');
  }
};
function notifMarkup(item) {
  return `<button type="button" class="dashboard-notification-item" onclick="openWorkspace('${item.workspaceId}')">
    <span class="notification-status-dot ${item.kind === 'done' ? 'is-done' : 'is-action'}" aria-hidden="true"></span>
    <span class="dashboard-notification-copy">
      <strong>${escapeHtml(item.title || 'Tugas tanpa judul')}</strong>
      <span class="notif-sub">${escapeHtml(item.workspaceName)} · ${item.kind === 'done' ? 'Tugas selesai' : (item.role === 'mentor' ? 'Menunggu penilaian' : 'Perlu tindakan')}</span>
    </span>
    <span class="notification-kind ${item.kind}">${item.kind === 'done' ? 'Selesai' : 'Perlu tindakan'}</span>
  </button>`;
}
function renderDashboardNotifications() {
  dashboardNotifications = [];
  dashboardWorkspaces.forEach(ws => (ws.tasks || []).forEach(task => {
    if (!(ws.role === 'mentor' || task.assignee === ws.workerName)) return;
    if (needsAction(task, ws.role, ws.workerName)) dashboardNotifications.push({ ...task, workspaceId: ws.id, workspaceName: ws.name, kind: 'action', role: ws.role });
    if (task.status === 'done') dashboardNotifications.push({ ...task, workspaceId: ws.id, workspaceName: ws.name, kind: 'done', role: ws.role });
  }));
  dashboardNotifications.sort((a, b) => a.kind === b.kind ? String(b.endDate || '').localeCompare(String(a.endDate || '')) : a.kind === 'action' ? -1 : 1);
  const list = $('dashboardNotificationsList'); if (!list) return;
  list.innerHTML = dashboardNotifications.length
    ? dashboardNotifications.slice(0, 8).map(notifMarkup).join('')
    : '<p class="empty-hint">Belum ada notifikasi. Aktivitas tugas akan muncul di sini.</p>';
}
function renderFullNotifications() {
  const list = $('dashboardNotificationsListFull'); if (!list) return;
  list.innerHTML = dashboardNotifications.length ? dashboardNotifications.map(notifMarkup).join('') : '<p class="empty-hint">Belum ada notifikasi.</p>';
}
function renderMiniCalendar() {
  const el = $('miniCalendarList'); if (!el) return;
  const end = new Date(); end.setDate(end.getDate() + 7);
  const items = [];
  dashboardWorkspaces.forEach(ws => (ws.tasks || []).forEach(t => {
    if (t.status === 'done' || !t.endDate) return;
    if (ws.role !== 'mentor' && t.assignee !== ws.workerName) return;
    const d = new Date(t.endDate + 'T00:00:00');
    if (d >= new Date(localDate() + 'T00:00:00') && d <= end) items.push({ t, ws, date: d });
  }));
  items.sort((a, b) => a.date - b.date);
  if (!items.length) { el.innerHTML = '<div class="mini-cal-empty">Tidak ada tenggat dalam 7 hari ke depan.</div>'; return; }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  el.innerHTML = items.slice(0, 8).map(({ t, ws, date }) => {
    const lv = dueLevel(t);
    return `<button type="button" class="mini-cal-item ${lv ? 'due-' + lv : ''}" onclick="openWorkspace('${ws.id}')">
      <span class="mini-cal-date"><span class="day">${date.getDate()}</span><span class="mon">${months[date.getMonth()]}</span></span>
      <span class="mini-cal-info"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(ws.name)} · ${escapeHtml(t.assignee)}</small></span>
      ${lv ? `<span class="due-badge due-${lv}">${dueLabel(t)}</span>` : ''}
    </button>`;
  }).join('');
}
function renderDashboardSummary() {
  const el = $('dashboardSummary'); if (!el) return;
  let total = 0, done = 0, action = 0, overdue = 0, soon = 0;
  dashboardWorkspaces.forEach(ws => {
    const s = ws.stats || { c: {}, total: 0, action: 0 };
    total += s.total; done += (s.c.done || 0); action += s.action; overdue += (s.c.overdue || 0);
    (ws.tasks || []).forEach(t => {
      if (t.status === 'done') return;
      const d = daysLeft(t);
      if (d !== null && d >= 0 && d <= 7) soon++;
    });
  });
  el.innerHTML = `
    <div class="summary-item"><div class="num">${total}</div><div class="lbl">Total tugas</div></div>
    <div class="summary-item stat-success"><div class="num">${done}</div><div class="lbl">Selesai</div></div>
    <div class="summary-item stat-warning"><div class="num">${soon || action}</div><div class="lbl">Tenggat mendekat</div></div>
    <div class="summary-item stat-danger"><div class="num">${overdue}</div><div class="lbl">Terlambat</div></div>`;

  renderDashboardTaskList();
  renderHabits();
  renderMoodUI();
  renderGreeting();
}

function renderDashboardTaskList() {
  const el = $('dashboardTaskList'); if (!el) return;
  const items = [];
  dashboardWorkspaces.forEach(ws => (ws.tasks || []).forEach(t => {
    if (ws.role === 'worker' && t.assignee !== ws.workerName) return;
    items.push({ ...t, workspaceName: ws.name, workspaceId: ws.id });
  }));
  items.sort((a, b) => String(a.endDate || '9999').localeCompare(String(b.endDate || '9999')));
  const top = items.slice(0, 6);
  if (!top.length) {
    el.innerHTML = '<p class="empty-hint">Belum ada tugas untukmu. Buat ruang kerja atau gabung dengan kode undangan, lalu tugas dari mentor akan muncul di sini.</p>';
    return;
  }
  el.innerHTML = top.map(t => {
    const [label, cls] = statusInfo(t);
    const due = !t.endDate ? '-' : t.status === 'done' ? t.endDate : dueLabel(t);
    const dueCls = dueLevel(t);
    return `<button type="button" class="dash-task-row" onclick="openWorkspace('${t.workspaceId}')">
      <span class="dash-task-info">
        <span class="dash-task-title">${escapeHtml(t.title)}</span>
        <span class="dash-task-meta">${escapeHtml(t.workspaceName)}${t.assignee ? ', ' + escapeHtml(t.assignee) : ''}</span>
      </span>
      <span class="dash-task-badges">
        <span class="stat-pill ${cls}">${label}</span>
        ${dueCls ? `<span class="due-badge due-${dueCls}">${due}</span>` : `<span class="stat-pill s-todo">${due}</span>`}
      </span>
    </button>`;
  }).join('');
}

// Ruang kerja
async function handleCreateWorkspace(e) {
  e.preventDefault();
  const name = $('newWorkspaceName').value.trim();
  const codeInput = ($('newWorkspaceCode')?.value || '').trim().toUpperCase();
  const drive = ($('newWorkspaceDrive')?.value || '').trim();
  if (!name || codeInput.length !== 6) return showAlert('Nama dan kode 6 karakter wajib diisi.');
  const btn = $('createWorkspaceSubmitBtn');
  btn.disabled = true; btn.textContent = 'Membuat…';
  try {
    if (!(await getDocs(query(collection(db, 'workspaces'), where('joinCode', '==', codeInput), limit(1)))).empty) {
      return showAlert('Kode undangan sudah digunakan. Pilih kode lain.');
    }
    const uid = state.user.uid;
    const mentorName = state.user.displayName || 'Lead';
    const wsRef = doc(collection(db, 'workspaces'));
    const batch = writeBatch(db);
    batch.set(wsRef, { name, ownerUid: uid, joinCode: codeInput, driveLink: drive ? safeUrl(drive) : '', createdAt: serverTimestamp() });
    batch.set(doc(db, 'workspaces', wsRef.id, 'members', uid), { uid, email: state.user.email, name: mentorName, role: 'mentor', division: 'Manajemen', joinedAt: serverTimestamp(), lastActive: serverTimestamp() });
    batch.set(doc(db, 'users', uid), { workspaceIds: arrayUnion(wsRef.id) }, { merge: true });
    await batch.commit();
    state.workspaceId = wsRef.id; state.workspaceName = name; state.role = 'mentor'; state.workerName = mentorName;
    $('createWorkspaceModal').classList.add('hidden');
    $('createWorkspaceForm').reset();
    showWorkspaceView(); subscribeToWorkspace();
  } catch (err) { await showAlert('Gagal membuat ruang kerja: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Buat ruang kerja'; }
}
async function handleJoinWorkspace(e) {
  e.preventDefault();
  const code = $('joinCodeInput').value.trim().toUpperCase();
  if (code.length !== 6) return showAlert('Kode harus 6 karakter.');
  const btn = $('joinWorkspaceSubmitBtn');
  btn.disabled = true; btn.textContent = 'Mencari…';
  try {
    const snap = await getDocs(query(collection(db, 'workspaces'), where('joinCode', '==', code), limit(1)));
    if (snap.empty) return showAlert('Kode undangan tidak valid.');
    const wsDoc = snap.docs[0], wsData = wsDoc.data(), uid = state.user.uid;
    const myMemberRef = doc(db, 'workspaces', wsDoc.id, 'members', uid);
    const existingMe = await getDoc(myMemberRef);
    const myName = state.user.displayName || state.user.email.split('@')[0];
    let justJoined = false;
    if (existingMe.exists()) {
      await setDoc(doc(db, 'users', uid), { workspaceIds: arrayUnion(wsDoc.id) }, { merge: true });
      state.role = existingMe.data().role || 'worker';
      state.workerName = existingMe.data().name || myName;
    } else {
      const membersSnap = await getDocs(collection(db, 'workspaces', wsDoc.id, 'members'));
      if (membersSnap.docs.filter(d => d.data().role === 'worker').length >= 20) return showAlert('Ruang kerja penuh (20 anggota).');
      const batch = writeBatch(db);
      batch.set(myMemberRef, { uid, email: state.user.email, name: myName, role: 'worker', division: 'Umum', joinedAt: serverTimestamp(), lastActive: serverTimestamp() });
      batch.set(doc(db, 'users', uid), { workspaceIds: arrayUnion(wsDoc.id) }, { merge: true });
      await batch.commit();
      state.role = 'worker'; state.workerName = myName; justJoined = true;
    }
    state.workspaceId = wsDoc.id; state.workspaceName = wsData.name;
    if (justJoined) logActivity('join', `${state.workerName} bergabung ke ruang kerja`);
    $('joinWorkspaceModal').classList.add('hidden');
    $('joinWorkspaceForm').reset();
    showWorkspaceView(); subscribeToWorkspace();
  } catch (err) { await showAlert('Gagal bergabung: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Gabung ruang kerja'; }
}
window.openWorkspace = async (workspaceId) => {
  try {
    const wsSnap = await getDoc(doc(db, 'workspaces', workspaceId));
    if (!wsSnap.exists()) return showAlert('Ruang kerja tidak ditemukan.');
    const memberSnap = await getDoc(doc(db, 'workspaces', workspaceId, 'members', state.user.uid));
    if (!memberSnap.exists()) return showAlert('Anda bukan anggota ruang kerja ini.');
    state.workspaceId = workspaceId;
    state.workspaceName = wsSnap.data().name;
    state.role = memberSnap.data().role;
    state.workerName = memberSnap.data().name || state.user.displayName || 'User';
    showWorkspaceView(); subscribeToWorkspace();
  } catch (err) { await showAlert('Gagal membuka ruang kerja: ' + err.message); }
};
function backToDashboard() {
  stopHeartbeat();
  unsubscribers.forEach(u => u()); unsubscribers = [];
  state.workspaceId = null; state.workspaceName = null; state.role = null;
  state.members = []; state.tasks = []; state.divisions = [];
  currentDetailId = null; activities = []; announcements = [];
  showDashboardView();
}

// Langganan data Firestore
function subscribeToWorkspace() {
  unsubscribers.forEach(u => u()); unsubscribers = [];
  const ws = state.workspaceId;
  unsubscribers.push(onSnapshot(collection(db, 'workspaces', ws, 'members'), snap => {
    state.members = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0));
    const me = state.members.find(m => m.id === state.user.uid);
    if (me) {
      state.workerName = me.name || state.workerName;
      if (me.role !== state.role) { state.role = me.role; showWorkspaceView(); }
    }
    renderTasks();
    if (!$('divisionManagementPanel').classList.contains('hidden')) renderDivisionManagement();
    if (!$('teamPanel').classList.contains('hidden')) renderTeamPanel();
    updateAssigneeSelect(); loadDailyGoal();
  }));
  unsubscribers.push(onSnapshot(collection(db, 'workspaces', ws, 'divisions'), snap => {
    state.divisions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDivisionOptions(); updateAssigneeSelect();
    if (!$('divisionManagementPanel').classList.contains('hidden')) renderDivisionManagement();
  }));
  unsubscribers.push(onSnapshot(query(collection(db, 'workspaces', ws, 'tasks'), orderBy('createdAt', 'desc')), snap => {
    state.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    afterTasksUpdate(); renderTasks();
  }));
  unsubscribers.push(onSnapshot(query(collection(db, 'workspaces', ws, 'activities'), orderBy('at', 'desc'), limit(100)), snap => {
    activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderActivities();
  }, err => console.warn('Aktivitas gagal dimuat:', err)));
  unsubscribers.push(onSnapshot(query(collection(db, 'workspaces', ws, 'announcements'), orderBy('createdAt', 'desc')), snap => {
    announcements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAnnouncements();
  }, err => console.warn('Pengumuman gagal dimuat:', err)));
  unsubscribers.push(onSnapshot(doc(db, 'workspaces', ws), snap => {
    if (snap.exists()) { state.driveLink = snap.data().driveLink || ''; updateDriveStatus(); }
  }));
}

// Penerima tugas dan tautan Drive
function updateAssigneeSelect() {
  const select = $('taskAssignee'); if (!select) return;
  const workers = state.members.filter(m => m.role === 'worker');
  const fa = $('filterAssignee');
  if (fa) {
    const pv = fa.value;
    fa.innerHTML = '<option value="">Semua anggota</option>' + workers.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
    fa.value = pv;
    fa.closest('.select-shell')?.classList.toggle('hidden', state.role !== 'mentor');
  }
  const prev = select.value;
  if (!workers.length) { select.innerHTML = '<option value="">Belum ada anggota</option>'; return; }
  const divNames = [...new Set(['Umum', ...state.divisions.map(d => d.name)])];
  const cnt = d => workers.filter(m => (m.division || 'Umum') === d).length;
  let html = `<option value="__all">Semua Member (${workers.length})</option><optgroup label="Per Divisi">`;
  divNames.forEach(d => { html += `<option value="__div:${escapeHtml(d)}" ${cnt(d) ? '' : 'disabled'}>Divisi ${escapeHtml(d)} (${cnt(d)})</option>`; });
  html += '</optgroup><optgroup label="Per Individu">';
  workers.forEach(m => { html += `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)} · ${escapeHtml(m.division || 'Umum')}</option>`; });
  html += '</optgroup>';
  select.innerHTML = html;
  select.value = (prev && [...select.options].some(o => o.value === prev)) ? prev : '__all';
  select.dispatchEvent(new Event('change'));
}
function updateDriveStatus(liveValue = null) {
  const statusEl = $('driveStatusText'), inputEl = $('driveLinkInput');
  if (!statusEl) return;
  const currentVal = liveValue !== null ? liveValue.trim() : (state.driveLink || '').trim();
  if (!currentVal) { statusEl.textContent = 'Belum ada folder yang tertaut.'; statusEl.classList.remove('linked'); }
  else {
    const href = safeUrl(currentVal);
    statusEl.innerHTML = href
      ? `Folder tertaut: <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${escapeHtml(currentVal)}</a>`
      : 'Tautan tidak valid: harus diawali http:// atau https://';
    statusEl.classList.toggle('linked', !!href);
  }
  if (liveValue === null && inputEl && document.activeElement !== inputEl) inputEl.value = (state.driveLink || '').trim();
}
function renderDivisionOptions() {
  const s = $('editMemberDivision'); if (!s) return;
  const prev = s.value;
  s.innerHTML = '<option value="Umum">Umum</option>' + state.divisions.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('');
  if (prev && [...s.options].some(o => o.value === prev)) s.value = prev;
  s.dispatchEvent(new Event('change'));
}

// Tugas
function applyTaskFilters(list) {
  const q = ($('taskSearch')?.value || '').trim().toLowerCase();
  const st = $('filterStatus')?.value, df = $('filterDifficulty')?.value, as = $('filterAssignee')?.value;
  return list.filter(t => {
    if (q && !((t.title || '') + ' ' + (t.desc || '')).toLowerCase().includes(q)) return false;
    if (st && t.status !== st) return false;
    if (df && (t.difficulty || 'sedang').toLowerCase() !== df) return false;
    if (as && t.assignee !== as) return false;
    return true;
  });
}
const subProgress = t => {
  const s = t.subtasks || []; if (!s.length) return null;
  const d = s.filter(x => x.done).length;
  return { done: d, total: s.length, pct: Math.round(d / s.length * 100) };
};
const progressBar = p => `<div class="progress-row"><div class="progress-track"><div class="progress-fill ${p.pct === 100 ? 'full' : ''}" style="width:${p.pct}%"></div></div><span>${p.pct}%</span></div>`;
function renderTasks() {
  const tbody = $('taskTableBody'); if (!tbody) return;
  let list = state.role === 'worker' ? state.tasks.filter(t => t.assignee === state.workerName) : [...state.tasks];
  renderDeadlineBanner(list);
  list = applyTaskFilters(list);
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Belum ada tugas dalam daftar.</td></tr>'; return; }
  tbody.innerHTML = list.map(task => {
    const lv = dueLevel(task), prog = subProgress(task);
    const overdue = task.endDate && new Date(task.endDate + 'T23:59:59') < new Date() && task.status !== 'done';
    const [statusText, statusClass] = statusInfo(task);
    const shortDesc = task.desc ? (task.desc.length > 60 ? task.desc.slice(0, 60) + '…' : task.desc) : '-';
    const diff = (task.difficulty || 'sedang').toLowerCase();
    return `<tr class="${lv ? 'row-due-' + lv : ''}" onclick="openTaskDetailModal('${task.id}')">
      <td data-label="Tugas"><div><button type="button" class="row-link">${escapeHtml(task.title)}</button>${(task.attachments || []).length ? `<span class="clip-count" title="Lampiran">Lampiran ${task.attachments.length}</span>` : ''}</div>${prog ? progressBar(prog) : ''}</td>
      <td data-label="Instruksi" class="task-desc-cell"><div class="task-desc" title="${escapeHtml(task.desc || '')}">${escapeHtml(shortDesc)}</div></td>
      <td data-label="Anggota" class="cell-sub">${escapeHtml(task.assignee)}</td>
      <td data-label="Kesulitan" class="col-center"><span class="stat-pill diff-${diff}">${diff.charAt(0).toUpperCase() + diff.slice(1)}</span></td>
      <td data-label="Status" class="col-center"><span class="stat-pill ${statusClass}">${statusText}${overdue ? ' · Terlambat' : ''}</span></td>
      <td data-label="Tenggat" class="cell-sub${overdue ? ' cell-late' : ''}">${escapeHtml(task.endDate || '-')}${lv ? `<span class="due-badge due-${lv}">${dueLabel(task)}</span>` : ''}</td>
    </tr>`;
  }).join('');
}
function renderDeadlineBanner(tasks) {
  const el = $('deadlineBanner'); if (!el) return;
  const o = tasks.filter(t => dueLevel(t) === 'overdue').length;
  const u = tasks.filter(t => ['urgent', 'soon'].includes(dueLevel(t))).length;
  if (!o && !u) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.className = 'deadline-banner ' + (o ? 'due-overdue' : 'due-urgent');
  el.textContent = [o ? `${o} tugas melewati tenggat` : '', u ? `${u} tugas mendekati tenggat (3 hari ke depan)` : ''].filter(Boolean).join(' dan ');
}

// Detail tugas
const taskRef = id => doc(db, 'workspaces', state.workspaceId, 'tasks', id);
window.openTaskDetailModal = (taskId) => {
  const task = state.tasks.find(t => t.id === taskId); if (!task) return;
  $('detailTaskTitle').textContent = task.title;
  $('detailTaskAssignee').textContent = task.assignee;
  const lv = dueLevel(task);
  $('detailTaskDates').innerHTML = `${escapeHtml(task.startDate || '?')} s/d ${escapeHtml(task.endDate || '?')}` + (lv ? `<span class="due-badge due-${lv}">${dueLabel(task)}</span>` : '');
  $('detailTaskDesc').textContent = task.desc || 'Tidak ada instruksi tambahan.';
  const [statusText, statusClass] = statusInfo(task);
  $('detailTaskStatus').className = `stat-pill ${statusClass}`;
  $('detailTaskStatus').textContent = statusText;
  const diff = (task.difficulty || 'sedang').toLowerCase();
  $('detailTaskDifficulty').className = `stat-pill diff-${diff}`;
  $('detailTaskDifficulty').textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
  const driveHref = safeUrl(task.reportFileLink || (task.driveSource === 'workspace' ? state.driveLink : ''));
  $('detailTaskDrive').innerHTML = driveHref
    ? `<a href="${escapeHtml(driveHref)}" target="_blank" rel="noopener noreferrer" class="btn-drive-modal">Buka tautan Drive</a>`
    : '<span class="status-text">Belum ada tautan</span>';
  const revBox = $('detailRevisionBox');
  if (task.revisionNotes) { revBox.classList.remove('hidden'); $('detailRevisionNotes').textContent = task.revisionNotes; }
  else revBox.classList.add('hidden');
  const history = task.history || [];
  const label = { laporan: 'Laporan', revisi: 'Revisi', selesai: 'Divalidasi' };
  $('detailHistoryList').innerHTML = history.length
    ? [...history].sort((a, b) => b.at - a.at).map(h => `<div class="hist-item hist-${escapeHtml(h.type)}"><div class="hist-head"><strong>${label[h.type] || h.type}</strong> · ${escapeHtml(h.by || '')} <span>${new Date(h.at).toLocaleString('id-ID')}</span></div>${h.text ? `<div style="margin-top:4px">${escapeHtml(h.text)}</div>` : ''}</div>`).join('')
    : '<p class="empty-hint">Belum ada riwayat.</p>';

  const isWorker = state.role === 'worker' && task.assignee === state.workerName;
  const isLead = state.role === 'mentor';
  if (isWorker && task.status === 'todo' && !autoStarted.has(task.id)) {
    autoStarted.add(task.id);
    updateDoc(taskRef(task.id), { status: 'progress', updatedAt: serverTimestamp() }).then(() => {
      logActivity('start', `${state.workerName} mulai mengerjakan "${task.title}"`, task.id);
      notify(mentorUids(), { kind: 'start', title: `${state.workerName} mulai mengerjakan`, body: task.title, taskId: task.id });
      toast('Tugas dimulai', 'info');
    }).catch(() => autoStarted.delete(task.id));
  }
  $('detailReportBox').classList.toggle('hidden', !(isWorker && ['todo', 'progress'].includes(task.status)));
  $('detailReviewBox').classList.toggle('hidden', !(isLead && task.status === 'review'));
  $('reportLink').value = task.reportFileLink || '';
  $('reportNotes').value = ''; $('reviewNotes').value = '';
  $('reportError').classList.add('hidden'); $('reviewError').classList.add('hidden');

  const ac = $('detailActionButtons');
  if (isWorker && ['todo', 'progress'].includes(task.status)) {
    ac.innerHTML = '<button class="btn-sm btn-solid" onclick="submitReport()">Kirim laporan</button>';
  } else if (isLead && task.status === 'review') {
    ac.innerHTML = '<div class="action-group"><button class="btn-sm btn-warning" onclick="submitReview(true)">Revisi</button><button class="btn-sm btn-success" onclick="submitReview(false)">Selesai</button></div>';
  } else if (isLead) {
    ac.innerHTML = `<div class="action-group"><button class="btn-sm btn-ghost" onclick="openEditTaskModal('${task.id}')">Edit</button><button class="btn-sm btn-warning" onclick="deleteTask('${task.id}')">Hapus</button></div>`;
  } else ac.innerHTML = '';

  currentDetailId = task.id;
  renderTaskExtras(task);
  $('taskDetailModal').classList.remove('hidden');
};
window.closeTaskDetailModal = () => { $('taskDetailModal').classList.add('hidden'); currentDetailId = null; };

window.submitReport = async () => {
  const t = state.tasks.find(x => x.id === currentDetailId);
  if (!t || !(state.role === 'worker' && t.assignee === state.workerName)) return;
  const link = safeUrl($('reportLink').value), notes = $('reportNotes').value.trim(), err = $('reportError');
  if (!link) { err.textContent = 'Tautan wajib diisi dan harus diawali http:// atau https://'; return err.classList.remove('hidden'); }
  err.classList.add('hidden');
  try {
    await updateDoc(taskRef(t.id), {
      status: 'review', reportFileLink: link, reportNotes: notes, revisionNotes: '',
      history: arrayUnion({ type: 'laporan', by: state.workerName, text: notes, link, at: Date.now() }),
      updatedAt: serverTimestamp()
    });
    logActivity('report', `${state.workerName} mengirim laporan "${t.title}"`, t.id);
    notify(mentorUids(), { kind: 'report', title: `${state.workerName} mengirim laporan`, body: t.title, taskId: t.id });
    toast('Laporan terkirim ke Lead', 'success');
    window.closeTaskDetailModal();
  } catch (e) { err.textContent = 'Gagal: ' + e.message; err.classList.remove('hidden'); }
};
window.submitReview = async (isRevision) => {
  const t = state.tasks.find(x => x.id === currentDetailId);
  if (!t || state.role !== 'mentor' || t.status !== 'review') return;
  const notes = $('reviewNotes').value.trim(), err = $('reviewError');
  if (isRevision && !notes) { err.textContent = 'Catatan wajib diisi untuk revisi.'; return err.classList.remove('hidden'); }
  err.classList.add('hidden');
  const entry = arrayUnion({ type: isRevision ? 'revisi' : 'selesai', by: state.workerName, text: notes, at: Date.now() });
  try {
    await updateDoc(taskRef(t.id), isRevision
      ? { status: 'progress', revisionNotes: notes, history: entry, updatedAt: serverTimestamp() }
      : { status: 'done', revisionNotes: '', history: entry, updatedAt: serverTimestamp() });
    logActivity(isRevision ? 'revision' : 'done', `${state.workerName} ${isRevision ? 'meminta revisi' : 'menyelesaikan'} "${t.title}"`, t.id);
    notify([memberUid(t.assignee)], { kind: isRevision ? 'revision' : 'done', title: isRevision ? 'Tugas perlu revisi' : 'Tugas dinyatakan selesai', body: t.title, taskId: t.id });
    toast(isRevision ? 'Catatan revisi dikirim' : 'Tugas divalidasi selesai', 'success');
    window.closeTaskDetailModal();
  } catch (e) { err.textContent = 'Gagal: ' + e.message; err.classList.remove('hidden'); }
};
window.deleteTask = async (id) => {
  if (state.role !== 'mentor') return;
  const t = state.tasks.find(x => x.id === id);
  if (!await askConfirm(`Hapus tugas "${t?.title || ''}"? Tindakan ini tidak bisa dibatalkan.`, { title: 'Hapus tugas', confirmText: 'Hapus', danger: true })) return;
  try {
    await deleteDoc(taskRef(id));
    if (t) logActivity('delete', `${state.workerName} menghapus tugas "${t.title}"`);
    window.closeTaskDetailModal();
    toast('Tugas dihapus', 'info');
  } catch (err) { await showAlert('Gagal: ' + err.message); }
};
window.openEditTaskModal = (id) => {
  const t = state.tasks.find(x => x.id === id); if (!t || state.role !== 'mentor') return;
  $('editTaskId').value = t.id;
  $('editTaskTitleInput').value = t.title;
  $('editTaskDescInput').value = t.desc || '';
  window.closeTaskDetailModal();
  $('editTaskModal').classList.remove('hidden');
};

// Target harian
function loadDailyGoal() {
  const me = state.members.find(m => m.id === state.user?.uid);
  const d = $('dailyGoalDisplay'); if (!d) return;
  d.textContent = (me && me.goalDate === localDate() && me.dailyGoal) ? `${me.dailyGoal}` : '';
}
function setDefaultDates() {
  const s = $('startDate'), e = $('endDate');
  if (s) s.value = localDate();
  if (e) e.value = localDate(new Date(Date.now() + 7 * 864e5));
}

// Divisi dan anggota
function renderDivisionManagement() {
  const c = $('divisionListContainer');
  if (c) {
    c.innerHTML = state.divisions.length ? state.divisions.map(d => {
      const n = state.members.filter(m => m.division === d.name).length;
      return `<div class="div-row"><div><h3>${escapeHtml(d.name)}</h3><p>${escapeHtml(d.desc || 'Tidak ada deskripsi.')}</p></div><div class="div-row-side"><span class="div-count">${n} anggota</span><button class="btn-sm btn-warning" onclick="deleteDivision('${d.id}')">Hapus</button></div></div>`;
    }).join('') : '<p class="empty-hint">Belum ada divisi terdaftar.</p>';
  }
  const p = $('memberPresenceList');
  if (p) p.innerHTML = renderMembersGrid(state.members);
  const tb = $('memberSettingsTableBody');
  if (tb) {
    tb.innerHTML = state.members.map(m => `<tr>
      <td data-label="Nama"><strong>${escapeHtml(m.name)}</strong></td>
      <td data-label="Email" class="cell-sub">${escapeHtml(m.email)}</td>
      <td data-label="Peran" class="col-center"><span class="role-badge ${m.role}">${m.role === 'mentor' ? 'Lead' : 'Member'}</span></td>
      <td data-label="Divisi" class="col-divisi">${escapeHtml(m.division || 'Umum')}</td>
      <td data-label="Aksi" class="col-center"><div><button class="btn-sm" onclick="openEditMemberModal('${m.id}')">Edit</button>${m.id !== state.user.uid ? `<button class="btn-sm btn-warning" onclick="removeMember('${m.id}')">Keluarkan</button>` : ''}</div></td>
    </tr>`).join('');
  }
}
function renderTeamPanel() { const el = $('teamMembersList'); if (el) el.innerHTML = renderMembersGrid(state.members); }
function renderMembersGrid(members) {
  if (!members.length) return '<p class="empty-hint">Belum ada anggota.</p>';
  return members.map(m => {
    const initials = (m.name || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
    const online = isOnline(m.lastActive);
    return `<div class="team-member-card">
      <div class="team-avatar">${escapeHtml(initials)}<span class="presence-dot ${online ? 'online' : ''}"></span></div>
      <div class="team-info">
        <div class="name-row"><span class="name">${escapeHtml(m.name)}</span></div>
        <div class="meta"><span class="role-badge ${m.role}" style="font-size:.6rem;padding:1px 6px">${m.role === 'mentor' ? 'Lead' : 'Member'}</span> · ${escapeHtml(m.division || 'Umum')}</div>
        <div class="meta last-active">${online ? 'Aktif sekarang' : 'Terakhir aktif: ' + timeAgo(m.lastActive)}</div>
      </div>
    </div>`;
  }).join('');
}
window.deleteDivision = async (divId) => {
  const div = state.divisions.find(d => d.id === divId);
  if (!await askConfirm(`Hapus divisi "${div?.name || ''}"? Anggotanya dipindahkan ke "Umum".`, { title: 'Hapus divisi', confirmText: 'Hapus', danger: true })) return;
  try {
    const batch = writeBatch(db);
    if (div) state.members.filter(m => m.division === div.name).forEach(m => batch.update(doc(db, 'workspaces', state.workspaceId, 'members', m.id), { division: 'Umum' }));
    batch.delete(doc(db, 'workspaces', state.workspaceId, 'divisions', divId));
    await batch.commit();
    toast('Divisi dihapus', 'info');
  } catch (err) { await showAlert('Gagal: ' + err.message); }
};
window.openEditMemberModal = (memberId) => {
  const m = state.members.find(x => x.id === memberId); if (!m) return;
  $('editMemberId').value = m.id;
  $('editMemberNameDisplay').value = m.name;
  $('editMemberRole').value = m.role; $('editMemberRole').dispatchEvent(new Event('change'));
  renderDivisionOptions();
  $('editMemberDivision').value = m.division || 'Umum'; $('editMemberDivision').dispatchEvent(new Event('change'));
  $('editMemberModal').classList.remove('hidden');
};
window.removeMember = async (memberId) => {
  const m = state.members.find(x => x.id === memberId);
  if (!m || memberId === state.user.uid) return;
  if (!await askConfirm(`Keluarkan ${m.name} dari ruang kerja ini?`, { title: 'Keluarkan anggota', confirmText: 'Keluarkan', danger: true })) return;
  try { await deleteDoc(doc(db, 'workspaces', state.workspaceId, 'members', memberId)); toast('Anggota dikeluarkan', 'info'); }
  catch (err) { await showAlert('Gagal: ' + err.message); }
};
async function leaveWorkspace() {
  if (state.role === 'mentor' && state.members.filter(m => m.role === 'mentor').length <= 1) return showAlert('Anda mentor terakhir. Promosikan anggota lain atau hapus ruang kerja.');
  if (!await askConfirm('Keluar dari ruang kerja ini?', { title: 'Keluar ruang kerja', confirmText: 'Keluar', danger: true })) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'workspaces', state.workspaceId, 'members', state.user.uid));
    batch.set(doc(db, 'users', state.user.uid), { workspaceIds: arrayRemove(state.workspaceId) }, { merge: true });
    await batch.commit();
    backToDashboard();
  } catch (err) { await showAlert('Gagal: ' + err.message); }
}
async function changeJoinCode() {
  const input = await askText({
    title: 'Ganti kode undangan',
    message: 'Masukkan 6 huruf/angka, atau kosongkan untuk membuat kode acak.',
    label: 'Kode undangan baru', placeholder: 'ABC123', code: true, confirmText: 'Ganti kode',
    validate: v => (!v.trim() || /^[A-Za-z0-9]{6}$/.test(v.trim())) ? '' : 'Kode harus tepat 6 huruf/angka.'
  });
  if (input === null) return;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = (input.trim() || Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')).toUpperCase();
  try {
    if (!(await getDocs(query(collection(db, 'workspaces'), where('joinCode', '==', code), limit(1)))).empty) return showAlert('Kode sudah dipakai ruang lain.');
    await updateDoc(doc(db, 'workspaces', state.workspaceId), { joinCode: code });
    await showAlert(`Kode undangan baru: ${code}`, 'Kode diganti');
  } catch (err) { await showAlert('Gagal: ' + err.message); }
}
async function deleteWorkspace() {
  const typed = await askText({
    title: 'Hapus ruang kerja',
    message: `Semua tugas, divisi, anggota, aktivitas, dan pengumuman akan hilang permanen.\n\nKetik "${state.workspaceName}" untuk konfirmasi.`,
    label: 'Nama ruang kerja', placeholder: state.workspaceName, confirmText: 'Hapus permanen', danger: true,
    validate: v => v === state.workspaceName ? '' : 'Nama tidak cocok.'
  });
  if (typed === null) return;
  try {
    const refs = [];
    for (const sub of ['tasks', 'divisions', 'members', 'activities', 'announcements']) {
      (await getDocs(collection(db, 'workspaces', state.workspaceId, sub))).forEach(d => refs.push(d.ref));
    }
    refs.push(doc(db, 'workspaces', state.workspaceId));
    unsubscribers.forEach(u => u()); unsubscribers = [];
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
    await setDoc(doc(db, 'users', state.user.uid), { workspaceIds: arrayRemove(state.workspaceId) }, { merge: true });
    backToDashboard();
    toast('Ruang kerja dihapus', 'info');
  } catch (err) { await showAlert('Gagal: ' + err.message); }
}
async function renameUser(newName, oldName) {
  await updateProfile(auth.currentUser, { displayName: newName });
  const snap = await getDoc(doc(db, 'users', state.user.uid));
  const ids = snap.exists() ? (snap.data().workspaceIds || []) : [];
  await setDoc(doc(db, 'users', state.user.uid), { displayName: newName }, { merge: true });
  for (const id of ids) {
    const mRef = doc(db, 'workspaces', id, 'members', state.user.uid);
    if (!(await getDoc(mRef)).exists()) continue;
    const tasks = await getDocs(query(collection(db, 'workspaces', id, 'tasks'), where('assignee', '==', oldName)));
    const batch = writeBatch(db);
    batch.update(mRef, { name: newName });
    tasks.forEach(t => batch.update(t.ref, { assignee: newName }));
    await batch.commit();
  }
  state.user = auth.currentUser;
  $('topbarUserName').textContent = newName;
}

// Aktivitas dan notifikasi
const actIcon = id => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const ACT_SVG = {
  task: actIcon('plus'), start: actIcon('play'), report: actIcon('upload'), revision: actIcon('loop'),
  done: actIcon('check'), reopen: actIcon('loop'), delete: actIcon('trash'), file: actIcon('clip'),
  join: actIcon('enter'), announce: actIcon('horn'), subtask: actIcon('list')
};
function logActivity(type, text, taskId = null) {
  if (!state.workspaceId) return;
  addDoc(collection(db, 'workspaces', state.workspaceId, 'activities'), { type, text, taskId, by: state.workerName || '', uid: state.user.uid, at: serverTimestamp() })
    .catch(e => console.warn('Aktivitas gagal dicatat:', e));
}
function renderActivities() {
  const el = $('activityList'); if (!el) return;
  el.innerHTML = activities.length
    ? activities.map(a => `<div class="act-item act-${escapeHtml(a.type)}"><span class="act-icon">${ACT_SVG[a.type] || actIcon('dot')}</span><div><div>${escapeHtml(a.text)}</div><span class="act-time">${fmtTime(a.at)}</span></div></div>`).join('')
    : '<p class="empty-hint">Belum ada aktivitas.</p>';
}
const memberUid = name => state.members.find(m => m.name === name)?.id;
const mentorUids = () => state.members.filter(m => m.role === 'mentor').map(m => m.id);
function notify(uids, data) {
  [...new Set(uids)].filter(u => u && u !== state.user.uid).forEach(uid => {
    addDoc(collection(db, 'users', uid, 'notifications'), { ...data, workspaceId: state.workspaceId, workspaceName: state.workspaceName, read: false, createdAt: serverTimestamp() })
      .catch(e => console.warn('Notifikasi gagal dikirim:', e));
  });
}
function startNotifications() {
  stopNotifications();
  notifUnsub = onSnapshot(query(collection(db, 'users', state.user.uid, 'notifications'), orderBy('createdAt', 'desc'), limit(300)), snap => {
    notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderNotifBadge();
    if ($('dashboardNotificationsList')) renderDashboardNotifications();
    if ($('dashboardNotificationsListFull') && !$('notificationsPanel')?.classList.contains('hidden')) renderFullNotifications();
  }, err => console.warn('Notifikasi gagal dimuat:', err));
}
function stopNotifications() {
  if (notifUnsub) { notifUnsub(); notifUnsub = null; }
  notifications = [];
  renderNotifBadge();
}
function renderNotifBadge() {
  const unread = notifications.filter(n => !n.read).length;
  document.querySelectorAll('.nav-badge').forEach(b => {
    if (!unread) {
      b.classList.add('hidden');
      b.textContent = '';
      return;
    }
    b.classList.remove('hidden');
    b.textContent = unread >= 100 ? '99+' : String(unread);
  });
  const menu = $('notificationsNavBtn');
  if (menu) {
    menu.setAttribute('aria-label', unread
      ? `Notifikasi, ${unread >= 100 ? '99+' : unread} belum dibaca`
      : 'Notifikasi');
  }
  const top = $('notificationsNavBtnTop');
  if (top) {
    top.setAttribute('aria-label', unread
      ? `Notifikasi, ${unread >= 100 ? '99+' : unread} belum dibaca`
      : 'Notifikasi');
  }
}
async function markAllRead() {
  const un = notifications.filter(n => !n.read); if (!un.length) return;
  const b = writeBatch(db);
  un.forEach(n => b.update(doc(db, 'users', state.user.uid, 'notifications', n.id), { read: true }));
  try {
    await b.commit();
    notifications.forEach(n => { n.read = true; });
    renderNotifBadge();
    toast('Semua notifikasi dibaca', 'success');
  } catch (err) { await showAlert('Gagal: ' + err.message); }
}

// Sub-tugas dan lampiran
const parseSubtasks = text => text.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30).map(x => ({ id: newId(), text: x.slice(0, 120), done: false }));
const canEditTask = t => state.role === 'mentor' || (state.role === 'worker' && t.assignee === state.workerName);
window.toggleSubtask = async (taskId, subId, checked) => {
  const t = state.tasks.find(x => x.id === taskId); if (!t || !canEditTask(t)) return;
  const before = subProgress(t);
  const subtasks = (t.subtasks || []).map(s => s.id === subId ? { ...s, done: checked } : s);
  try {
    await updateDoc(taskRef(taskId), { subtasks, updatedAt: serverTimestamp() });
    if (checked && subtasks.every(s => s.done) && before && before.pct < 100) logActivity('subtask', `${state.workerName} menyelesaikan semua sub-tugas "${t.title}"`, taskId);
  } catch (err) { await showAlert('Gagal: ' + err.message); }
};
window.deleteSubtask = async (taskId, subId) => {
  const t = state.tasks.find(x => x.id === taskId); if (!t || state.role !== 'mentor') return;
  try { await updateDoc(taskRef(taskId), { subtasks: (t.subtasks || []).filter(s => s.id !== subId), updatedAt: serverTimestamp() }); }
  catch (err) { await showAlert('Gagal: ' + err.message); }
};
async function addSubtaskFromModal() {
  const t = state.tasks.find(x => x.id === currentDetailId);
  const input = $('subtaskInput'); const text = input.value.trim();
  if (!t || !text || state.role !== 'mentor') return;
  if ((t.subtasks || []).length >= 30) return showAlert('Maksimal 30 sub-tugas per tugas.');
  try {
    await updateDoc(taskRef(t.id), { subtasks: [...(t.subtasks || []), { id: newId(), text: text.slice(0, 120), done: false }], updatedAt: serverTimestamp() });
    input.value = '';
  } catch (err) { await showAlert('Gagal: ' + err.message); }
}
function renderTaskExtras(task) {
  const isLead = state.role === 'mentor', canEdit = canEditTask(task);
  const subs = task.subtasks || [], p = subProgress(task);
  $('detailSubtaskBox').classList.toggle('hidden', !subs.length && !isLead);
  $('detailProgressFill').style.width = (p ? p.pct : 0) + '%';
  $('detailProgressFill').classList.toggle('full', !!p && p.pct === 100);
  $('detailProgressText').textContent = p ? `${p.done}/${p.total} · ${p.pct}%` : '0%';
  $('detailSubtaskAdd').classList.toggle('hidden', !isLead);
  $('detailSubtaskList').innerHTML = subs.length
    ? subs.map(s => `<label class="subtask-item ${s.done ? 'done' : ''}"><input type="checkbox" ${s.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'} onchange="toggleSubtask('${task.id}','${s.id}',this.checked)" /><span>${escapeHtml(s.text)}</span>${isLead ? `<button type="button" class="icon-del" aria-label="Hapus sub-tugas" onclick="event.preventDefault();deleteSubtask('${task.id}','${s.id}')"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>` : ''}</label>`).join('')
    : '<p class="empty-hint">Belum ada sub-tugas.</p>';
  const files = task.attachments || [];
  $('attachUploader').classList.toggle('hidden', !canEdit);
  $('detailAttachList').innerHTML = files.length ? files.map(f => {
    const href = safeUrl(f.url), canDel = isLead || f.uid === state.user.uid;
    return `<div class="attach-item"><div class="attach-meta"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(f.name)}</a><small>${escapeHtml(f.by || '')} · ${fmtTime(f.at)}</small></div>${canDel ? `<button type="button" class="icon-del" aria-label="Hapus lampiran" onclick="deleteAttachment('${task.id}','${f.id}')"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>` : ''}</div>`;
  }).join('') : '<p class="empty-hint">Belum ada lampiran.</p>';
}
function afterTasksUpdate() {
  renderCalendar();
  if (currentDetailId && !$('taskDetailModal').classList.contains('hidden')) {
    if (state.tasks.some(t => t.id === currentDetailId)) window.openTaskDetailModal(currentDetailId);
    else window.closeTaskDetailModal();
  }
}
async function addAttachmentLink() {
  const t = state.tasks.find(x => x.id === currentDetailId); if (!t || !canEditTask(t)) return;
  const url = safeUrl($('attachUrl').value);
  if (!url) return showAlert('Tautan harus diawali http:// atau https://');
  if ((t.attachments || []).length >= 20) return showAlert('Maksimal 20 lampiran per tugas.');
  const name = ($('attachName').value.trim() || new URL(url).hostname).slice(0, 80);
  try {
    await updateDoc(taskRef(t.id), { attachments: arrayUnion({ id: newId(), name, url, by: state.workerName, uid: state.user.uid, at: Date.now() }), updatedAt: serverTimestamp() });
    $('attachUrl').value = ''; $('attachName').value = '';
    logActivity('file', `${state.workerName} menambahkan lampiran "${name}" pada "${t.title}"`, t.id);
    notify(state.role === 'mentor' ? [memberUid(t.assignee)] : mentorUids(), { kind: 'file', title: 'Lampiran baru', body: `${name} · ${t.title}`, taskId: t.id });
  } catch (err) { await showAlert('Gagal: ' + err.message); }
}
window.deleteAttachment = async (taskId, fid) => {
  const t = state.tasks.find(x => x.id === taskId);
  const f = (t?.attachments || []).find(x => x.id === fid); if (!f) return;
  if (!(state.role === 'mentor' || f.uid === state.user.uid)) return;
  if (!await askConfirm(`Hapus lampiran "${f.name}"?`, { title: 'Hapus lampiran', confirmText: 'Hapus', danger: true })) return;
  try { await updateDoc(taskRef(taskId), { attachments: arrayRemove(f), updatedAt: serverTimestamp() }); }
  catch (err) { await showAlert('Gagal: ' + err.message); }
};

// Kalender
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1), calExpanded = null;
const chipClass = t => t.status === 'done' ? 'chip-done' : ({ overdue: 'due-overdue', urgent: 'due-urgent', soon: 'due-soon' }[dueLevel(t)] || 'chip-normal');
window.expandCalDay = k => { calExpanded = calExpanded === k ? null : k; renderCalendar(); };
function renderCalendar() {
  const grid = $('calGrid');
  if (!grid || $('calendarPanel').classList.contains('hidden')) return;
  const y = calMonth.getFullYear(), m = calMonth.getMonth(), today = localDate();
  $('calTitle').textContent = calMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const offset = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const tasks = (state.role === 'worker' ? state.tasks.filter(t => t.assignee === state.workerName) : state.tasks).filter(t => t.endDate);
  const byDay = {}; tasks.forEach(t => (byDay[t.endDate] = byDay[t.endDate] || []).push(t));
  let html = '<div class="cal-cell empty"></div>'.repeat(offset);
  for (let d = 1; d <= days; d++) {
    const key = localDate(new Date(y, m, d)), list = byDay[key] || [], max = key === calExpanded ? 99 : 3;
    html += `<div class="cal-cell ${key === today ? 'today' : ''}"><span class="cal-day">${d}</span>`
      + list.slice(0, max).map(t => `<button type="button" class="cal-chip ${chipClass(t)}" onclick="openTaskDetailModal('${t.id}')" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</button>`).join('')
      + (list.length > 3 ? `<button type="button" class="cal-more" onclick="expandCalDay('${key}')">${key === calExpanded ? 'Ringkas' : `+${list.length - 3} lagi`}</button>` : '')
      + '</div>';
  }
  grid.innerHTML = html;
}

// Pengumuman
function renderAnnouncements() {
  const el = $('announceList'); if (!el) return;
  const isLead = state.role === 'mentor';
  const list = [...announcements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  el.innerHTML = list.length ? list.map(a => `<article class="announce-item ${a.pinned ? 'pinned' : ''}">
    <div class="announce-head"><h3>${a.pinned ? 'Disematkan: ' : ''}${escapeHtml(a.title)}</h3>
    ${isLead ? `<div class="announce-actions"><button type="button" class="btn-sm btn-ghost" onclick="togglePinAnnouncement('${a.id}')">${a.pinned ? 'Lepas pin' : 'Sematkan'}</button><button type="button" class="btn-sm btn-ghost" onclick="editAnnouncement('${a.id}')">Edit</button><button type="button" class="btn-sm btn-warning" onclick="deleteAnnouncement('${a.id}')">Hapus</button></div>` : ''}</div>
    <p>${escapeHtml(a.body)}</p><small>${escapeHtml(a.by || 'Lead')} · ${fmtTime(a.createdAt)}</small></article>`).join('')
    : '<p class="empty-hint">Belum ada pengumuman dari mentor.</p>';
}
const annRef = id => doc(db, 'workspaces', state.workspaceId, 'announcements', id);
window.togglePinAnnouncement = async (id) => {
  const a = announcements.find(x => x.id === id);
  if (a && state.role === 'mentor') { try { await updateDoc(annRef(id), { pinned: !a.pinned }); } catch (e) { await showAlert('Gagal: ' + e.message); } }
};
window.editAnnouncement = (id) => {
  const a = announcements.find(x => x.id === id); if (!a || state.role !== 'mentor') return;
  $('editAnnounceId').value = a.id;
  $('editAnnounceTitle').value = a.title;
  $('editAnnounceBody').value = a.body;
  $('editAnnounceModal').classList.remove('hidden');
};
window.deleteAnnouncement = async (id) => {
  if (state.role !== 'mentor') return;
  if (!await askConfirm('Hapus pengumuman ini?', { title: 'Hapus pengumuman', confirmText: 'Hapus', danger: true })) return;
  try { await deleteDoc(annRef(id)); toast('Pengumuman dihapus', 'info'); }
  catch (e) { await showAlert('Gagal: ' + e.message); }
};
async function postAnnouncement(e) {
  e.preventDefault(); if (state.role !== 'mentor') return;
  const title = $('announceTitle').value.trim(), body = $('announceBody').value.trim();
  if (!title || !body) return;
  try {
    await addDoc(collection(db, 'workspaces', state.workspaceId, 'announcements'), {
      title, body, pinned: $('announcePinned').checked, by: state.workerName, uid: state.user.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    e.target.reset();
    logActivity('announce', `${state.workerName} memposting pengumuman "${title}"`);
    notify(state.members.map(m => m.id), { kind: 'announce', title: 'Pengumuman baru', body: title });
    toast('Pengumuman terkirim', 'success');
  } catch (err) { await showAlert('Gagal: ' + err.message); }
}

// Pendengar event
function setupEventListeners() {
  $('loginForm').addEventListener('submit', handleLogin);
  $('registerForm').addEventListener('submit', handleRegister);
  $('authToggleLink').addEventListener('click', e => { e.preventDefault(); toggleAuthMode(); });
  $('authToggleLink2')?.addEventListener('click', e => { e.preventDefault(); toggleAuthMode(); });
  $('logoutBtn').addEventListener('click', handleLogout);
  $('googleLoginBtn').addEventListener('click', async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (err) { if (err.code !== 'auth/popup-closed-by-user') await showAlert('Gagal: ' + err.code); }
  });
  $('forgotPasswordLink').addEventListener('click', async e => {
    e.preventDefault();
    const email = $('loginEmail').value.trim();
    if (!email) return showAlert('Isi alamat email terlebih dahulu.');
    try { await sendPasswordResetEmail(auth, email); await showAlert('Tautan reset kata sandi sudah dikirim ke email Anda.', 'Email terkirim'); }
    catch (err) { await showAlert('Gagal: ' + err.code); }
  });

  $('createWorkspaceBtn').addEventListener('click', () => $('createWorkspaceModal').classList.remove('hidden'));
  $('joinWorkspaceBtn').addEventListener('click', () => $('joinWorkspaceModal').classList.remove('hidden'));
  const openAccount = () => {
    $('accountName').value = state.user?.displayName || state.user?.email.split('@')[0] || '';
    $('accountPassword').value = '';
    $('accountModal').classList.remove('hidden');
  };
  $('accountBtn').addEventListener('click', openAccount);
  $('accountBtnTop')?.addEventListener('click', openAccount);
  $('dashboardNavBtn').addEventListener('click', () => switchDashboardSection('home'));
  $('myWorkspacesNavBtn').addEventListener('click', () => switchDashboardSection('workspaces'));
  $('notificationsNavBtn').addEventListener('click', () => switchDashboardSection('notifications'));
  $('notificationsNavBtnTop')?.addEventListener('click', () => switchDashboardSection('notifications'));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => switchDashboardSection(b.dataset.goto)));

  $('createWorkspaceForm').addEventListener('submit', handleCreateWorkspace);
  $('joinWorkspaceForm').addEventListener('submit', handleJoinWorkspace);
  $('backToDashboardBtn').addEventListener('click', backToDashboard);
  $('tabTaskView').addEventListener('click', () => switchWorkspaceTab('task'));
  $('tabCalendarView').addEventListener('click', () => switchWorkspaceTab('calendar'));
  $('tabActivityView').addEventListener('click', () => switchWorkspaceTab('activity'));
  $('tabAnnouncementView').addEventListener('click', () => switchWorkspaceTab('announce'));
  $('tabDivisionView').addEventListener('click', () => switchWorkspaceTab('division'));
  $('tabTeamView').addEventListener('click', () => switchWorkspaceTab('team'));

  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => $(btn.dataset.close).classList.add('hidden')));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target !== m) return;
    if (m.id === 'appDialog') closeDialog($('appDialog').dataset.mode === 'input' ? null : false);
    else m.classList.add('hidden');
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeAllSelects();
    if (!$('appDialog').classList.contains('hidden')) { closeDialog($('appDialog').dataset.mode === 'input' ? null : false); return; }
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
  });
  document.addEventListener('click', e => { if (!e.target.closest('.select-shell')) closeAllSelects(); });

  $('appDialogConfirm').addEventListener('click', submitDialog);
  $('appDialogCancel').addEventListener('click', () => closeDialog($('appDialog').dataset.mode === 'input' ? null : false));
  $('appDialogInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitDialog(); } });

  $('saveDriveBtn')?.addEventListener('click', async () => {
    const link = ($('driveLinkInput')?.value || '').trim();
    if (state.role !== 'mentor') return;
    if (link && !safeUrl(link)) return showAlert('Tautan harus diawali http:// atau https://');
    try {
      await updateDoc(doc(db, 'workspaces', state.workspaceId), { driveLink: link });
      state.driveLink = link; updateDriveStatus();
      toast(link ? 'Tautan Drive disimpan' : 'Tautan Drive dihapus', 'success');
    } catch (err) { await showAlert('Gagal: ' + err.message); }
  });
  $('driveLinkInput')?.addEventListener('input', e => updateDriveStatus(e.target.value));

  function toggleWorkspaceDriveGroup() {
    const g = $('workspaceDriveGroup'), s = $('taskDriveSource');
    if (g && s) g.classList.toggle('hidden', s.value !== 'workspace');
  }
  $('taskDriveSource')?.addEventListener('change', toggleWorkspaceDriveGroup);
  toggleWorkspaceDriveGroup();

  function syncEndDateMin() {
    const s = $('startDate'), e = $('endDate');
    if (s && e && s.value) { e.min = s.value; if (e.value && e.value < s.value) e.value = s.value; }
  }
  $('startDate')?.addEventListener('change', syncEndDateMin);

  $('createTaskForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (state.role !== 'mentor') return;
    const startDate = $('startDate').value, endDate = $('endDate').value;
    if (startDate && endDate && endDate < startDate) return showAlert('Tenggat tidak boleh lebih awal dari tanggal mulai.');
    const target = $('taskAssignee').value;
    const workers = state.members.filter(m => m.role === 'worker');
    const isDiv = target.startsWith('__div:');
    const targets = target === '__all' ? workers : isDiv ? workers.filter(m => (m.division || 'Umum') === target.slice(6)) : workers.filter(m => m.name === target);
    if (!targets.length) return showAlert('Tidak ada anggota pada target penugasan ini.');
    const taskTitle = $('taskTitle').value.trim();
    if (!taskTitle) return showAlert('Judul tugas wajib diisi.');
    const subText = $('taskSubtasks').value;
    const label = target === '__all' ? 'semua anggota' : isDiv ? `divisi ${target.slice(6)}` : targets[0].name;
    try {
      const batch = writeBatch(db), refs = [];
      targets.forEach(m => {
        const ref = doc(collection(db, 'workspaces', state.workspaceId, 'tasks')); refs.push(ref);
        batch.set(ref, {
          title: taskTitle, assignee: m.name, difficulty: $('taskDifficulty').value, startDate, endDate,
          desc: $('taskDesc').value.trim(), driveSource: $('taskDriveSource').value,
          status: 'todo', reportNotes: '', reportFileLink: '', revisionNotes: '',
          subtasks: parseSubtasks(subText), attachments: [],
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      e.target.reset();
      $('taskDifficulty').value = 'sedang'; $('taskDifficulty').dispatchEvent(new Event('change'));
      logActivity('task', `${state.workerName} membuat tugas "${taskTitle}" untuk ${label}`, refs[0].id);
      targets.forEach((m, i) => notify([m.id], { kind: 'task', title: 'Tugas baru untuk Anda', body: taskTitle, taskId: refs[i].id }));
      setDefaultDates(); toggleWorkspaceDriveGroup(); updateAssigneeSelect();
      toast(`Tugas dibagikan ke ${targets.length} anggota`, 'success');
    } catch (err) { await showAlert('Gagal: ' + err.message); }
  });

  ['taskSearch', 'filterStatus', 'filterDifficulty', 'filterAssignee'].forEach(id =>
    $(id)?.addEventListener(id === 'taskSearch' ? 'input' : 'change', renderTasks));

  $('leaveWorkspaceBtn').addEventListener('click', leaveWorkspace);
  $('changeCodeBtn').addEventListener('click', changeJoinCode);
  $('deleteWorkspaceBtn').addEventListener('click', deleteWorkspace);

  $('editMemberForm').addEventListener('submit', async e => {
    e.preventDefault();
    const memId = $('editMemberId').value;
    const target = state.members.find(m => m.id === memId);
    if (target?.role === 'mentor' && $('editMemberRole').value !== 'mentor' && state.members.filter(m => m.role === 'mentor').length <= 1) {
      return showAlert('Tidak bisa menurunkan mentor terakhir.');
    }
    try {
      await updateDoc(doc(db, 'workspaces', state.workspaceId, 'members', memId), { role: $('editMemberRole').value, division: $('editMemberDivision').value });
      $('editMemberModal').classList.add('hidden');
      toast('Data anggota diperbarui', 'success');
    } catch (err) { await showAlert('Gagal: ' + err.message); }
  });

  $('editTaskForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (state.role !== 'mentor') return;
    const id = $('editTaskId').value, title = $('editTaskTitleInput').value.trim();
    if (!title) return showAlert('Judul tugas wajib diisi.');
    try {
      await updateDoc(taskRef(id), { title, desc: $('editTaskDescInput').value.trim(), updatedAt: serverTimestamp() });
      $('editTaskModal').classList.add('hidden');
      toast('Tugas diperbarui', 'success');
    } catch (err) { await showAlert('Gagal: ' + err.message); }
  });

  $('editAnnounceForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (state.role !== 'mentor') return;
    const id = $('editAnnounceId').value, title = $('editAnnounceTitle').value.trim(), body = $('editAnnounceBody').value.trim();
    if (!title || !body) return showAlert('Judul dan isi wajib diisi.');
    try {
      await updateDoc(annRef(id), { title, body, updatedAt: serverTimestamp() });
      $('editAnnounceModal').classList.add('hidden');
      toast('Pengumuman diperbarui', 'success');
    } catch (err) { await showAlert('Gagal: ' + err.message); }
  });

  $('accountForm').addEventListener('submit', async e => {
    e.preventDefault();
    const newName = $('accountName').value.trim(), newPw = $('accountPassword').value;
    const oldName = state.user.displayName || state.user.email.split('@')[0];
    try {
      if (newPw) await updatePassword(auth.currentUser, newPw);
      if (newName && newName !== oldName) await renameUser(newName, oldName);
      $('accountModal').classList.add('hidden');
      toast('Akun diperbarui', 'success');
    } catch (err) {
      await showAlert(err.code === 'auth/requires-recent-login' ? 'Keluar lalu masuk lagi untuk mengganti kata sandi.' : 'Gagal: ' + err.message);
    }
  });

  $('createDivisionForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('newDivisionName').value.trim();
    if (!name || name.toLowerCase() === 'umum' || state.divisions.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      return showAlert('Nama divisi tidak valid atau sudah ada.');
    }
    try {
      await addDoc(collection(db, 'workspaces', state.workspaceId, 'divisions'), { name, desc: $('newDivisionDesc').value.trim(), createdAt: serverTimestamp() });
      e.target.reset();
      toast('Divisi dibuat', 'success');
    } catch (err) { await showAlert('Gagal: ' + err.message); }
  });

  $('saveDailyGoalBtn').addEventListener('click', async () => {
    const goal = $('dailyGoalInput').value.trim();
    if (!goal) return showAlert('Tulis target Anda terlebih dahulu.');
    try {
      await updateDoc(doc(db, 'workspaces', state.workspaceId, 'members', state.user.uid), { dailyGoal: goal, goalDate: localDate() });
      $('dailyGoalInput').value = ''; loadDailyGoal();
      toast('Target hari ini disimpan', 'success');
    } catch (err) { await showAlert('Gagal: ' + err.message); }
  });

  $('markAllReadBtn')?.addEventListener('click', markAllRead);
  $('calPrev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); calExpanded = null; renderCalendar(); });
  $('calNext').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); calExpanded = null; renderCalendar(); });
  $('calToday').addEventListener('click', () => { calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); calExpanded = null; renderCalendar(); });
  $('addSubtaskBtn').addEventListener('click', addSubtaskFromModal);
  $('subtaskInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubtaskFromModal(); } });
  $('addAttachBtn').addEventListener('click', addAttachmentLink);
  $('announceForm').addEventListener('submit', postAnnouncement);
}

// Sapaan dashboard. Angka hanya dari data nyata (tugas, kebiasaan). Tiga status: memuat, siap, gagal.
function renderGreeting() {
  const title = $('greetTitle'); if (!title) return;
  const text = $('welcomeText'), facts = $('greetFacts'), ring = $('greetRing');
  const first = ((state.user?.displayName || '').trim().split(/\s+/)[0]) || '';
  const hr = new Date().getHours();
  const sapa = hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 18 ? 'Selamat sore' : 'Selamat malam';
  title.textContent = first ? `${sapa}, ${first}` : sapa;

  if (dashboardStatus === 'error') {
    text.textContent = 'Ringkasan gagal dimuat. Periksa koneksi, lalu buka ulang Dashboard.';
    facts.innerHTML = ''; ring.innerHTML = ''; return;
  }
  const habits = (prodData?.habits || []).filter(x => !x.archived);
  const done = habits.filter(x => x.doneToday).length;
  const pct = habits.length ? Math.round(done / habits.length * 100) : 0;
  const best = habits.reduce((m, x) => Math.max(m, x.streak || 0), 0);
  let soon = 0, late = 0;
  dashboardWorkspaces.forEach(ws => {
    late += ws.stats?.c?.overdue || 0;
    (ws.tasks || []).forEach(t => {
      if (t.status === 'done') return;
      const d = daysLeft(t);
      if (d !== null && d >= 0 && d <= 7) soon++;
    });
  });

  let msg;
  if (dashboardStatus === 'loading') msg = 'Memuat ringkasan tugas dan kebiasaanmu.';
  else if (late) msg = `${late} tugas sudah lewat tenggat. Mulai dari yang paling lama.`;
  else if (soon) msg = `${soon} tugas jatuh tempo dalam 7 hari ke depan.`;
  else if (habits.length && done < habits.length) msg = `Tinggal ${habits.length - done} kebiasaan lagi untuk hari ini.`;
  else if (habits.length) msg = 'Semua kebiasaan hari ini sudah tercentang.';
  else msg = 'Belum ada kebiasaan. Tambah satu di bawah untuk mulai mencatat.';
  text.textContent = msg;

  const items = [];
  if (best) items.push(`Streak terpanjang ${best} hari`);
  if (dashboardStatus === 'ready' && soon) items.push(`${soon} tenggat minggu ini`);
  if (habits.length) items.push(`${done} dari ${habits.length} kebiasaan`);
  facts.innerHTML = items.map(i => `<li>${i}</li>`).join('');

  if (!habits.length) { ring.innerHTML = ''; ring.classList.add('hidden'); return; }
  ring.classList.remove('hidden');
  const C = 2 * Math.PI * 34;
  ring.setAttribute('aria-label', `Progres kebiasaan hari ini: ${pct} persen`);
  ring.innerHTML = `<svg viewBox="0 0 80 80" width="96" height="96" aria-hidden="true"><circle class="ring-bg" cx="40" cy="40" r="34"/><circle class="ring-fg" cx="40" cy="40" r="34" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/></svg><span class="ring-num" aria-hidden="true">${pct}%</span>`;
}

// Produktivitas pribadi: kebiasaan, mood, insight
const PROD_KEY = 'akasha_productivity_v3';
const PROD_KEY_V2 = 'akasha_productivity_v2';
const MOOD_LABEL = { 1: 'Sangat buruk', 2: 'Buruk', 3: 'Biasa', 4: 'Baik', 5: 'Sangat baik' };
const moodFace = n => { const k = MOOD_LABEL[n] ? n : 3; return `<svg class="face" role="img" aria-label="${MOOD_LABEL[k]}"><use href="#f${k}"/></svg>`; };
const CAT_ICONS = { sehat: '', kerja: '', belajar: '' }; // tanpa emoji: ikon kebiasaan memakai huruf awal nama
const MILESTONES = [7, 21, 30, 66, 100];
let prodData = null;
let selectedMood = null;
let selectedMoodTags = [];
let habitCatFilter = 'all';
let expandedHabitId = null;
let moodMonthCursor = null; // Date at month start
let moodEditSelected = null;
let prodSyncTimer = null;
let prodCloudUnsub = null;

function emptyProd() {
  return {
    habits: [],
    habitHistory: [],
    moodToday: null,
    moodNote: '',
    moodHistory: [],
    lastRollDate: localDate(),
    moodStreak: 0,
    celebratedMilestones: {}
  };
}

function migrateProdV2toV3(v2) {
  const d = emptyProd();
  d.habits = (v2.habits || []).map(h => ({
    id: h.id || newId(),
    name: h.name || 'Kebiasaan',
    streak: h.streak || 0,
    longest: h.longest || 0,
    doneToday: !!h.doneToday,
    history: h.history || {},
    schedule: h.schedule || { type: 'daily' },
    icon: h.icon || '',
    category: h.category || 'kerja',
    archived: !!h.archived,
    freezes: typeof h.freezes === 'number' ? h.freezes : 1,
    freezeUsedMonth: h.freezeUsedMonth || ''
  }));
  d.habitHistory = Array.isArray(v2.habitHistory) ? v2.habitHistory : [];
  d.moodToday = v2.moodToday ?? null;
  d.moodNote = v2.moodNote || '';
  d.moodHistory = (v2.moodHistory || []).map(m => ({
    date: m.date, mood: m.mood, note: m.note || '', tags: m.tags || []
  }));
  d.lastRollDate = v2.lastRollDate || localDate();
  return d;
}

function loadProdLocal() {
  try {
    const raw = localStorage.getItem(PROD_KEY);
    if (raw) {
      prodData = JSON.parse(raw);
      normalizeProd();
      return true;
    }
    const v2 = localStorage.getItem(PROD_KEY_V2);
    if (v2) {
      prodData = migrateProdV2toV3(JSON.parse(v2));
      localStorage.removeItem(PROD_KEY_V2);
      saveProdLocal();
      return true;
    }
  } catch (_) {}
  prodData = emptyProd();
  saveProdLocal();
  return false;
}

function normalizeProd() {
  if (!prodData) prodData = emptyProd();
  if (!Array.isArray(prodData.habits)) prodData.habits = [];
  if (!Array.isArray(prodData.habitHistory)) prodData.habitHistory = [];
  if (!Array.isArray(prodData.moodHistory)) prodData.moodHistory = [];
  if (!prodData.celebratedMilestones) prodData.celebratedMilestones = {};
  prodData.habits.forEach(h => {
    if (!h.history) h.history = {};
    if (!h.schedule) h.schedule = { type: 'daily' };
    if (!h.category) h.category = 'kerja';
    if (typeof h.freezes !== 'number') h.freezes = 1;
    if (!h.freezeUsedMonth) h.freezeUsedMonth = '';
    if (typeof h.archived !== 'boolean') h.archived = false;
  });
  prodData.moodHistory.forEach(m => { if (!Array.isArray(m.tags)) m.tags = []; if (!m.note) m.note = ''; });
  if (!prodData.lastRollDate) prodData.lastRollDate = localDate();
}

function saveProdLocal() {
  try { localStorage.setItem(PROD_KEY, JSON.stringify(prodData)); } catch (_) {}
}

function saveProd() {
  normalizeProd();
  saveProdLocal();
  scheduleProdCloudSave();
}

function scheduleProdCloudSave() {
  if (!state.user) return;
  clearTimeout(prodSyncTimer);
  prodSyncTimer = setTimeout(() => persistProdToCloud(), 600);
}

async function persistProdToCloud() {
  if (!state.user || !prodData) return;
  try {
    await setDoc(doc(db, 'users', state.user.uid, 'productivity', 'data'), {
      ...prodData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) { console.warn('Gagal sync produktivitas:', e); }
}

async function loadProdFromCloud() {
  if (!state.user) return;
  try {
    const snap = await getDoc(doc(db, 'users', state.user.uid, 'productivity', 'data'));
    if (snap.exists()) {
      const cloud = snap.data();
      delete cloud.updatedAt;
      const localTs = 0;
      prodData = cloud;
      normalizeProd();
      saveProdLocal();
    }
  } catch (e) { console.warn('Gagal muat produktivitas cloud:', e); }
}

function isScheduledDay(h, dateStr) {
  const sch = h.schedule || { type: 'daily' };
  if (sch.type === 'daily') return true;
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0 Sun
  if (sch.type === 'days') return (sch.days || []).map(Number).includes(dow);
  if (sch.type === 'weekly') return true; // any day can count toward weekly target
  return true;
}

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 864e5) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + week;
}

function weeklyDoneCount(h, dateStr) {
  const wk = weekKey(dateStr);
  let n = 0;
  Object.keys(h.history || {}).forEach(dt => {
    if (weekKey(dt) === wk && h.history[dt]) n++;
  });
  return n;
}

function rollOverDay() {
  if (!prodData) return;
  const today = localDate();
  if (prodData.lastRollDate === today) return;

  let cursor = new Date(prodData.lastRollDate + 'T12:00:00');
  const end = new Date(today + 'T12:00:00');
  end.setDate(end.getDate() - 1);

  while (cursor <= end) {
    const ds = localDate(cursor);
    const monthKey = ds.slice(0, 7);
    prodData.habits.forEach(h => {
      // record previous doneToday only for lastRollDate itself already done; for intermediate days treat as missed
      const wasDone = (ds === prodData.lastRollDate) ? !!h.doneToday : !!h.history?.[ds];
      if (!h.history) h.history = {};
      if (wasDone) h.history[ds] = true;

      if (isScheduledDay(h, ds) && !wasDone) {
        // try freeze
        if (h.freezes > 0 && h.freezeUsedMonth !== monthKey) {
          h.freezes -= 1;
          h.freezeUsedMonth = monthKey;
          h.history[ds] = true; // freeze counts as protected
          h._lastFreeze = ds;
        } else {
          h.streak = 0;
        }
      }
      h.doneToday = false;
    });
    let cell = prodData.habitHistory.find(c => c.date === ds);
    if (!cell) { cell = { date: ds, level: 0 }; prodData.habitHistory.push(cell); }
    const active = prodData.habits.filter(x => !x.archived);
    const done = active.filter(x => x.history?.[ds]).length;
    cell.level = active.length ? Math.min(4, Math.ceil((done / active.length) * 4)) : 0;

    cursor.setDate(cursor.getDate() + 1);
  }

  // mood streak break if yesterday missing
  const y = new Date(); y.setDate(y.getDate() - 1);
  const ys = localDate(y);
  if (!prodData.moodHistory.some(m => m.date === ys) && prodData.moodToday == null) {
    // only break if we rolled past yesterday without entry
  }
  // reset today mood flags if lastRoll was not today
  if (prodData.lastRollDate !== today) {
    // keep moodToday only if it was for today (it's not, so clear)
    const lastMood = prodData.moodHistory.find(m => m.date === prodData.lastRollDate);
    if (prodData.moodToday != null && prodData.lastRollDate !== today) {
      // already in history presumably
      prodData.moodToday = null;
      prodData.moodNote = '';
    }
    // recompute mood streak
    prodData.moodStreak = computeMoodStreak();
  }

  prodData.lastRollDate = today;
  prodData.habits.forEach(h => { h.doneToday = !!h.history?.[today]; });
  saveProd();
}

function computeMoodStreak() {
  let streak = 0;
  const d = new Date();
  for (;;) {
    const ds = localDate(d);
    if (prodData.moodHistory.some(m => m.date === ds) || (ds === localDate() && prodData.moodToday)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function ensureProdToday() {
  if (!prodData) loadProdLocal();
  rollOverDay();
}

function activeHabits() {
  return (prodData.habits || []).filter(h => !h.archived && (habitCatFilter === 'all' || h.category === habitCatFilter));
}

function renderHabits() {
  ensureProdToday();
  const list = $('habitList');
  if (!list) return;
  const habits = activeHabits();
  if (!habits.length) {
    list.innerHTML = '<p class="empty-hint" style="padding:.5rem 0">Belum ada kebiasaan. Tekan “Tambah kebiasaan” untuk mulai.</p>';
  } else {
    list.innerHTML = habits.map(h => {
      const icon = h.icon || (h.name || '#').trim().charAt(0).toUpperCase();
      const milestone = MILESTONES.filter(m => h.streak >= m).pop();
      const celebrated = milestone && (prodData.celebratedMilestones[h.id] || []).includes(milestone);
      let progress = '';
      if (h.schedule?.type === 'weekly') {
        const t = h.schedule.target || 3;
        const n = weeklyDoneCount(h, localDate());
        progress = `<span class="habit-progress">${n}/${t} minggu ini</span>`;
      }
      const open = expandedHabitId === h.id;
      const cells = [];
      for (let i = 55; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = localDate(d);
        const on = !!h.history?.[ds];
        cells.push(`<div class="contrib-cell ${on ? 'lv3' : 'lv0'}" title="${ds}"></div>`);
      }
      let done30 = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if (h.history?.[localDate(d)]) done30++;
      }
      return `
      <div class="habit-block" data-id="${h.id}">
        <div class="habit-item ${h.doneToday ? 'done' : ''}" data-id="${h.id}">
          <button type="button" class="habit-check" data-toggle="${h.id}" aria-pressed="${h.doneToday}" aria-label="Tandai ${escapeHtml(h.name)} selesai hari ini">${h.doneToday ? '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' : ''}</button>
          <span class="habit-icon">${escapeHtml(icon)}</span>
          <button type="button" class="habit-name" aria-expanded="${open}">${escapeHtml(h.name)}</button>
          ${progress}
          <span class="habit-days">${h.streak} hari${milestone ? ' <span class="milestone-pill">Milestone ' + milestone + '</span>' : ''}</span>
          <button type="button" class="habit-edit-btn" data-edit="${h.id}" aria-label="Edit ${escapeHtml(h.name)}">Edit</button>
        </div>
        <div class="habit-detail ${open ? '' : 'hidden'}" data-detail="${h.id}">
          <div class="habit-detail-stats">
            <span>${done30}/30 hari · ${Math.round(done30 / 30 * 100)}%</span>
            <span>Streak ${h.streak} · terpanjang ${h.longest}</span>
            <span>Freeze: ${h.freezes}</span>
          </div>
          <div class="contrib-graph habit-mini-graph">${cells.join('')}</div>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); toggleHabit(el.dataset.toggle); });
    });
    list.querySelectorAll('.habit-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-toggle]') || e.target.closest('[data-edit]')) return;
        const id = el.dataset.id;
        expandedHabitId = expandedHabitId === id ? null : id;
        renderHabits();
      });
    });
    list.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openHabitModal(btn.dataset.edit);
      });
    });
  }

  const top = habits.length ? habits.reduce((a, b) => (a.streak >= b.streak ? a : b), habits[0]) : null;
  const info = $('habitStreakInfo');
  if (info) info.textContent = top && top.streak > 0
    ? `${top.name} · ${top.streak} hari beruntun · terpanjang ${top.longest}`
    : (habits.length ? 'Belum ada streak. Centang kebiasaan hari ini.' : '');

  const graph = $('contribGraph');
  if (graph) {
    let recent = (prodData.habitHistory || []).slice(-105);
    if (recent.length < 105) {
      const pad = 105 - recent.length;
      const filled = [];
      for (let i = pad - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - (recent.length + i));
        filled.push({ date: localDate(d), level: 0 });
      }
      recent = filled.concat(recent);
    }
    graph.innerHTML = recent.map(c => `<div class="contrib-cell lv${c.level || 0}" title="${c.date || ''}"></div>`).join('');
  }
  renderReminderBanner();
  renderInsight();
}

function toggleHabit(id) {
  const h = prodData.habits.find(x => x.id === id);
  if (!h) return;
  const today = localDate();
  if (!isScheduledDay(h, today) && h.schedule?.type === 'days') {
    toast('Hari ini tidak terjadwal untuk kebiasaan ini', 'info');
    return;
  }
  h.doneToday = !h.doneToday;
  if (!h.history) h.history = {};
  if (h.doneToday) {
    h.history[today] = true;
    h.streak += 1;
    if (h.streak > h.longest) h.longest = h.streak;
    MILESTONES.forEach(m => {
      if (h.streak === m) {
        if (!prodData.celebratedMilestones[h.id]) prodData.celebratedMilestones[h.id] = [];
        if (!prodData.celebratedMilestones[h.id].includes(m)) {
          prodData.celebratedMilestones[h.id].push(m);
          toast(`Streak ${m} hari: ${h.name}!`, 'success');
        }
      }
    });
  } else {
    delete h.history[today];
    h.streak = Math.max(0, h.streak - 1);
  }
  let cell = prodData.habitHistory.find(c => c.date === today);
  if (!cell) { cell = { date: today, level: 0 }; prodData.habitHistory.push(cell); }
  const active = prodData.habits.filter(x => !x.archived);
  const doneCount = active.filter(x => x.doneToday).length;
  cell.level = Math.min(4, Math.ceil((doneCount / Math.max(1, active.length)) * 4));
  saveProd();
  renderHabits();
  renderGreeting();
  toast(h.doneToday ? `Selesai: ${h.name}` : `Dibatalkan: ${h.name}`, 'success');
}

function openHabitModal(id) {
  const isEdit = !!id;
  $('habitModalTitle').textContent = isEdit ? 'Edit kebiasaan' : 'Tambah kebiasaan';
  $('habitEditId').value = id || '';
  const h = id ? prodData.habits.find(x => x.id === id) : null;
  $('habitNameInput').value = h ? h.name : '';
  if ($('habitCategory')) $('habitCategory').value = h?.category || 'kerja';
  if ($('habitIcon')) $('habitIcon').value = h?.icon || '';
  if ($('habitScheduleType')) $('habitScheduleType').value = h?.schedule?.type || 'daily';
  if ($('habitWeeklyTarget')) $('habitWeeklyTarget').value = h?.schedule?.target || 3;
  if ($('habitArchived')) $('habitArchived').checked = !!h?.archived;
  const days = h?.schedule?.days || [];
  document.querySelectorAll('#habitDaysPicker input').forEach(cb => {
    cb.checked = days.map(Number).includes(Number(cb.value));
  });
  toggleHabitScheduleFields();
  $('habitDeleteBtn').classList.toggle('hidden', !isEdit);
  $('habitModal').classList.remove('hidden');
  setTimeout(() => $('habitNameInput').focus(), 40);
}

function toggleHabitScheduleFields() {
  const t = $('habitScheduleType')?.value || 'daily';
  $('habitWeeklyTargetWrap')?.classList.toggle('hidden', t !== 'weekly');
  $('habitDaysWrap')?.classList.toggle('hidden', t !== 'days');
}

function renderMoodUI() {
  ensureProdToday();
  selectedMood = prodData.moodToday;
  document.querySelectorAll('#moodPicker .mood-btn').forEach(b => {
    b.classList.toggle('selected', Number(b.dataset.mood) === selectedMood);
  });
  if ($('moodNote')) $('moodNote').value = prodData.moodNote || '';

  selectedMoodTags = [];
  const todayEntry = prodData.moodHistory.find(m => m.date === localDate());
  if (todayEntry?.tags) selectedMoodTags = [...todayEntry.tags];
  document.querySelectorAll('#moodTagRow .mood-tag-chip[data-tag]').forEach(c => {
    c.classList.toggle('selected', selectedMoodTags.includes(c.dataset.tag));
  });

  const streak = computeMoodStreak();
  prodData.moodStreak = streak;
  const pill = $('moodStreakPill');
  if (pill) {
    if (streak > 0) { pill.textContent = `Streak ${streak} hari beruntun`; pill.classList.remove('hidden'); }
    else pill.classList.add('hidden');
  }

  renderMoodMonthChart();
  renderMoodJournal();
  renderReminderBanner();
  renderInsight();
}

function renderMoodMonthChart() {
  const chart = $('moodChart');
  if (!chart) return;
  if (!moodMonthCursor) {
    const n = new Date();
    moodMonthCursor = new Date(n.getFullYear(), n.getMonth(), 1);
  }
  const y = moodMonthCursor.getFullYear();
  const m = moodMonthCursor.getMonth();
  const label = $('moodMonthLabel');
  if (label) label.textContent = moodMonthCursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const entries = {};
  (prodData.moodHistory || []).forEach(e => {
    if (e.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)) entries[e.date] = e.mood;
  });
  if (localDate().startsWith(`${y}-${String(m + 1).padStart(2, '0')}`) && prodData.moodToday) {
    entries[localDate()] = prodData.moodToday;
  }

  const moods = Object.values(entries);
  const avg = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length) : 0;
  const dist = [0, 0, 0, 0, 0];
  moods.forEach(v => { if (v >= 1 && v <= 5) dist[v - 1]++; });
  const stats = $('moodMonthStats');
  if (stats) {
    stats.innerHTML = moods.length
      ? `<span class="mood-avg">${moodFace(Math.round(avg))} ${avg.toFixed(1)}</span>
         <span class="mood-dist">${[1,2,3,4,5].map(i => `<span>${moodFace(i)} ${dist[i-1]}</span>`).join('')}</span>`
      : '<span class="empty-hint">Belum ada data bulan ini</span>';
  }

  const w = Math.max(280, daysInMonth * 10), h = 72, pad = 4;
  let bars = '';
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mood = entries[ds] || 0;
    const bh = mood ? ((mood / 5) * (h - pad * 2)) : 2;
    const x = pad + ((day - 1) / daysInMonth) * (w - pad * 2);
    const bw = Math.max(4, (w - pad * 2) / daysInMonth - 2);
    bars += `<rect x="${x.toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" class="${mood ? 'mb' : 'mb-empty'}"/>`;
  }
  chart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="72">${bars}</svg>`;
}

function renderMoodJournal() {
  const el = $('moodJournalList');
  if (!el) return;
  const items = [...(prodData.moodHistory || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (!items.length) {
    el.innerHTML = '<p class="empty-hint">Belum ada jurnal mood.</p>';
    return;
  }
  const isMobile = window.innerWidth <= 768;
  const show = isMobile ? items.slice(0, 5) : items;
  el.innerHTML = show.map(m => {
    const d = new Date(m.date + 'T12:00:00');
    const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const tags = (m.tags || []).map(t => `<span class="mood-tag-chip mini">${escapeHtml(t)}</span>`).join('');
    return `<button type="button" class="mood-journal-item" data-date="${m.date}">
      <span class="mj-emoji">${moodFace(m.mood)}</span>
      <span class="mj-body"><span class="mj-date">${label}</span>
      ${m.note ? `<span class="mj-note">${escapeHtml(m.note)}</span>` : ''}
      <span class="mj-tags">${tags}</span></span>
    </button>`;
  }).join('') + (isMobile && items.length > 5 ? '<button type="button" class="btn-sm btn-ghost" id="moodJournalMore">Lihat semua</button>' : '');

  el.querySelectorAll('.mood-journal-item').forEach(btn => {
    btn.addEventListener('click', () => openMoodEdit(btn.dataset.date));
  });
}

function openMoodEdit(date) {
  const m = prodData.moodHistory.find(x => x.date === date);
  if (!m) return;
  $('moodEditDate').value = date;
  moodEditSelected = m.mood;
  document.querySelectorAll('#moodEditPicker .mood-btn').forEach(b => {
    b.classList.toggle('selected', Number(b.dataset.mood) === m.mood);
  });
  $('moodEditNote').value = m.note || '';
  $('moodEditTags').value = (m.tags || []).join(', ');
  $('moodEditModal').classList.remove('hidden');
}

function renderInsight() {
  const body = $('insightBody');
  if (!body) return;
  const hist = prodData.habitHistory || [];
  const moods = {};
  (prodData.moodHistory || []).forEach(m => { moods[m.date] = m.mood; });
  let high = [], low = [];
  hist.forEach(c => {
    if (moods[c.date] == null) return;
    if (c.level >= 3) high.push(moods[c.date]);
    else if (c.level <= 2) low.push(moods[c.date]);
  });
  if (high.length + low.length < 6) {
    body.innerHTML = '<p class="empty-hint">Belum cukup data</p>';
    return;
  }
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const ah = avg(high), al = avg(low);
  const diff = ah - al;
  if (Math.abs(diff) < 0.15) {
    body.innerHTML = '<p>Belum terlihat pola kuat antara kebiasaan dan mood.</p>';
  } else if (diff > 0) {
    body.innerHTML = `<p>Saat kamu menuntaskan kebiasaan, mood-mu rata-rata <strong>${diff.toFixed(1)} poin lebih tinggi</strong>.</p>`;
  } else {
    body.innerHTML = `<p>Menarik: mood-mu justru lebih tinggi di hari dengan kebiasaan lebih longgar (selisih ${Math.abs(diff).toFixed(1)} poin).</p>`;
  }
}

function renderReminderBanner() {
  const ban = $('prodReminderBanner');
  const txt = $('prodReminderText');
  if (!ban || !txt) return;
  const hour = new Date().getHours();
  if (hour < 19) { ban.classList.add('hidden'); return; }
  ensureProdToday();
  const pending = (prodData.habits || []).filter(h => !h.archived && isScheduledDay(h, localDate()) && !h.doneToday);
  const noMood = prodData.moodToday == null && !prodData.moodHistory.some(m => m.date === localDate());
  if (!pending.length && !noMood) { ban.classList.add('hidden'); return; }
  const parts = [];
  if (pending.length) parts.push(`${pending.length} kebiasaan belum dicentang`);
  if (noMood) parts.push('kamu belum check-in mood');
  txt.textContent = parts.join(' · ');
  ban.classList.remove('hidden');
}

function openRecapModal() {
  const body = $('recapBody');
  if (!body) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const moods = (prodData.moodHistory || []).filter(e => e.date.startsWith(prefix));
  const avg = moods.length ? moods.reduce((a, b) => a + b.mood, 0) / moods.length : 0;
  let best = null, worst = null;
  moods.forEach(e => {
    if (!best || e.mood > best.mood) best = e;
    if (!worst || e.mood < worst.mood) worst = e;
  });
  const tagCount = {};
  moods.forEach(e => (e.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];
  let habitDone = 0, habitTotal = 0;
  (prodData.habits || []).forEach(h => {
    Object.keys(h.history || {}).forEach(ds => {
      if (ds.startsWith(prefix)) { habitTotal++; if (h.history[ds]) habitDone++; }
    });
  });
  // recount properly: per habit scheduled days in month
  habitDone = 0; habitTotal = 0;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  (prodData.habits || []).filter(h => !h.archived).forEach(h => {
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${prefix}-${String(d).padStart(2, '0')}`;
      if (ds > localDate()) continue;
      if (!isScheduledDay(h, ds)) continue;
      habitTotal++;
      if (h.history?.[ds]) habitDone++;
    }
  });
  const longest = (prodData.habits || []).reduce((mx, h) => Math.max(mx, h.longest || 0), 0);
  const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  body.innerHTML = `
    <p class="recap-month">${escapeHtml(monthName)}</p>
    <ul class="recap-list">
      <li>Rata-rata mood: <strong>${moods.length ? avg.toFixed(1) + ' ' + moodFace(Math.round(avg)) : '-'}</strong></li>
      <li>Hari terbaik: <strong>${best ? best.date + ' ' + moodFace(best.mood) : '-'}</strong></li>
      <li>Hari terendah: <strong>${worst ? worst.date + ' ' + moodFace(worst.mood) : '-'}</strong></li>
      <li>Tag tersering: <strong>${topTag ? escapeHtml(topTag[0]) + ' (' + topTag[1] + ')' : '-'}</strong></li>
      <li>Penyelesaian kebiasaan: <strong>${habitTotal ? Math.round(habitDone / habitTotal * 100) + '%' : '-'} (${habitDone}/${habitTotal})</strong></li>
      <li>Streak terpanjang: <strong>${longest} hari</strong></li>
    </ul>`;
  window.__recapText = `Rekap ${monthName}\nMood rata-rata: ${avg.toFixed(1)}\nHari terbaik: ${best ? best.date : '-'}\nHari terendah: ${worst ? worst.date : '-'}\nTag: ${topTag ? topTag[0] : '-'}\nKebiasaan: ${habitDone}/${habitTotal}\nStreak terpanjang: ${longest} hari`;
  $('recapModal').classList.remove('hidden');
}

function setupProductivityEvents() {
  $('addHabitBtn')?.addEventListener('click', () => openHabitModal(null));
  $('habitScheduleType')?.addEventListener('change', toggleHabitScheduleFields);

  $('habitForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('habitNameInput').value.trim();
    if (!name) return;
    const id = $('habitEditId').value;
    const category = $('habitCategory')?.value || 'kerja';
    const icon = ($('habitIcon')?.value || '').trim() || '';
    const st = $('habitScheduleType')?.value || 'daily';
    let schedule = { type: 'daily' };
    if (st === 'weekly') schedule = { type: 'weekly', target: Number($('habitWeeklyTarget')?.value || 3) };
    if (st === 'days') {
      const days = Array.from(document.querySelectorAll('#habitDaysPicker input:checked')).map(c => Number(c.value));
      schedule = { type: 'days', days };
    }
    const archived = !!$('habitArchived')?.checked;
    if (id) {
      const h = prodData.habits.find(x => x.id === id);
      if (h) { h.name = name; h.category = category; h.icon = icon; h.schedule = schedule; h.archived = archived; }
      toast('Kebiasaan diperbarui', 'success');
    } else {
      prodData.habits.push({
        id: newId(), name, streak: 0, longest: 0, doneToday: false,
        history: {}, schedule, icon, category, archived, freezes: 1, freezeUsedMonth: ''
      });
      toast('Kebiasaan ditambahkan', 'success');
    }
    saveProd();
    $('habitModal').classList.add('hidden');
    renderHabits();
  });

  $('habitDeleteBtn')?.addEventListener('click', async () => {
    const id = $('habitEditId').value;
    if (!id) return;
    if (!await askConfirm('Hapus kebiasaan ini?', { title: 'Hapus', confirmText: 'Hapus', danger: true })) return;
    prodData.habits = prodData.habits.filter(h => h.id !== id);
    saveProd();
    $('habitModal').classList.add('hidden');
    renderHabits();
    toast('Kebiasaan dihapus', 'info');
  });

  document.querySelectorAll('#habitCatFilters .habit-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      habitCatFilter = btn.dataset.cat;
      document.querySelectorAll('#habitCatFilters .habit-cat-chip').forEach(b => b.classList.toggle('active', b === btn));
      renderHabits();
    });
  });

  document.querySelectorAll('#moodPicker .mood-btn').forEach(b => {
    b.addEventListener('click', () => {
      selectedMood = Number(b.dataset.mood);
      document.querySelectorAll('#moodPicker .mood-btn').forEach(x => x.classList.toggle('selected', Number(x.dataset.mood) === selectedMood));
    });
  });

  document.querySelectorAll('#moodTagRow .mood-tag-chip[data-tag]').forEach(c => {
    c.addEventListener('click', () => {
      const t = c.dataset.tag;
      if (selectedMoodTags.includes(t)) selectedMoodTags = selectedMoodTags.filter(x => x !== t);
      else selectedMoodTags.push(t);
      c.classList.toggle('selected', selectedMoodTags.includes(t));
    });
  });

  $('moodTagCustomBtn')?.addEventListener('click', async () => {
    const t = await askText({ title: 'Tag kustom', message: 'Nama tag baru', label: 'Tag', placeholder: 'Misal: Olahraga' });
    if (!t || !String(t).trim()) return;
    const tag = String(t).trim().slice(0, 20);
    if (!selectedMoodTags.includes(tag)) selectedMoodTags.push(tag);
    toast('Tag ditambahkan', 'success');
  });

  $('saveMoodBtn')?.addEventListener('click', () => {
    if (!selectedMood && !prodData.moodToday) { toast('Pilih mood dulu', 'info'); return; }
    const mood = selectedMood || prodData.moodToday;
    const note = ($('moodNote')?.value || '').trim();
    const today = localDate();
    prodData.moodToday = mood;
    prodData.moodNote = note;
    const existing = prodData.moodHistory.find(m => m.date === today);
    if (existing) { existing.mood = mood; existing.note = note; existing.tags = [...selectedMoodTags]; }
    else prodData.moodHistory.push({ date: today, mood, note, tags: [...selectedMoodTags] });
    prodData.moodStreak = computeMoodStreak();
    saveProd();
    renderMoodUI();
    toast('Mood hari ini disimpan', 'success');
  });

  document.querySelectorAll('#moodEditPicker .mood-btn').forEach(b => {
    b.addEventListener('click', () => {
      moodEditSelected = Number(b.dataset.mood);
      document.querySelectorAll('#moodEditPicker .mood-btn').forEach(x => x.classList.toggle('selected', Number(x.dataset.mood) === moodEditSelected));
    });
  });

  $('moodEditForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const date = $('moodEditDate').value;
    const m = prodData.moodHistory.find(x => x.date === date);
    if (!m) return;
    m.mood = moodEditSelected || m.mood;
    m.note = ($('moodEditNote').value || '').trim();
    m.tags = ($('moodEditTags').value || '').split(',').map(s => s.trim()).filter(Boolean);
    if (date === localDate()) {
      prodData.moodToday = m.mood;
      prodData.moodNote = m.note;
    }
    saveProd();
    $('moodEditModal').classList.add('hidden');
    renderMoodUI();
    toast('Jurnal diperbarui', 'success');
  });

  $('moodDeleteBtn')?.addEventListener('click', async () => {
    const date = $('moodEditDate').value;
    if (!await askConfirm('Hapus entri mood ini?', { title: 'Hapus', confirmText: 'Hapus', danger: true })) return;
    prodData.moodHistory = prodData.moodHistory.filter(m => m.date !== date);
    if (date === localDate()) { prodData.moodToday = null; prodData.moodNote = ''; }
    saveProd();
    $('moodEditModal').classList.add('hidden');
    renderMoodUI();
    toast('Entri dihapus', 'info');
  });

  $('moodMonthPrev')?.addEventListener('click', () => {
    if (!moodMonthCursor) moodMonthCursor = new Date();
    moodMonthCursor = new Date(moodMonthCursor.getFullYear(), moodMonthCursor.getMonth() - 1, 1);
    renderMoodMonthChart();
  });
  $('moodMonthNext')?.addEventListener('click', () => {
    if (!moodMonthCursor) moodMonthCursor = new Date();
    moodMonthCursor = new Date(moodMonthCursor.getFullYear(), moodMonthCursor.getMonth() + 1, 1);
    renderMoodMonthChart();
  });

  $('openRecapBtn')?.addEventListener('click', openRecapModal);
  $('copyRecapBtn')?.addEventListener('click', async () => {
    const t = window.__recapText || '';
    try {
      await navigator.clipboard.writeText(t);
      toast('Rekap disalin', 'success');
    } catch {
      await showAlert(t || 'Tidak ada teks');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      rollOverDay();
      renderHabits();
      renderMoodUI();
    }
  });
}

function refreshProductivityUI() {
  if (!prodData) return;
  renderHabits();
  renderMoodUI();
}


// Inisialisasi
const THEME_COLORS = { light: '#E9F0EF', dark: '#0A1413', playful: '#BCD3FA' };
function initTheme() {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const t = localStorage.getItem('akasha_theme') || (localStorage.getItem('darkMode') === 'true' || prefersDark ? 'dark' : 'light');
  applyTheme(t, false);
  document.querySelectorAll('#themePicker .theme-opt').forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));
}
function applyTheme(t, persist = true) {
  document.body.classList.remove('dark-mode', 'theme-playful');
  if (t === 'dark') document.body.classList.add('dark-mode');
  if (t === 'playful') document.body.classList.add('theme-playful');
  if (persist) localStorage.setItem('akasha_theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[t] || THEME_COLORS.light);
  document.querySelectorAll('#themePicker .theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
}

// Status tombol toggle (aria-pressed) mengikuti kelas selected/active, supaya pembaca layar ikut tahu
new MutationObserver(list => list.forEach(({ target: el }) => {
  if (el.hasAttribute?.('aria-pressed') && !el.classList.contains('habit-check')) {
    el.setAttribute('aria-pressed', String(el.classList.contains('selected') || el.classList.contains('active')));
  }
})).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

function init() {
  setDefaultDates();
  initTheme();
  enhanceAllSelects();
  loadProdLocal();
  setupEventListeners();
  setupProductivityEvents();
  onAuthStateChanged(auth, async user => {
    if (user) {
      state.user = user;
      startNotifications();
      const ref = doc(db, 'users', user.uid);
      getDoc(ref).then(snap => {
        if (!snap.exists()) setDoc(ref, { email: user.email, displayName: user.displayName || user.email.split('@')[0], workspaceIds: [], createdAt: serverTimestamp() });
      });
      await loadProdFromCloud();
      rollOverDay();
      showDashboardView();
      refreshProductivityUI();
    } else {
      stopHeartbeat();
      unsubscribers.forEach(u => u()); unsubscribers = [];
      stopNotifications();
      state = { user: null, workspaceId: null, workspaceName: null, role: null, workerName: null, driveLink: '', members: [], tasks: [], divisions: [] };
      showAuthView();
    }
  });
}
init();
