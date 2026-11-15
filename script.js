document.addEventListener('DOMContentLoaded', () => {
  // Global Score & Hug Count
  const globalScoreEl = document.getElementById('global-score');
  const energyCountEl = document.getElementById('energy-count');
  let globalScore = Number(localStorage.getItem('j-score') || 100);
  let hugCount = Number(localStorage.getItem('j-hugs') || 0);

  function updateScores() {
    globalScoreEl.textContent = globalScore;
    energyCountEl.textContent = hugCount;
    localStorage.setItem('j-score', globalScore);
    localStorage.setItem('j-hugs', hugCount);
  }
  updateScores();

  // Cute Pop Sound
  let audioCtx = null;
  function playCutePop(freq = 520) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.65, audioCtx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  }

  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  const htmlEl = document.documentElement;
  const savedTheme = localStorage.getItem('julie-theme') || 'light';
  htmlEl.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = htmlEl.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    htmlEl.setAttribute('data-theme', next);
    localStorage.setItem('julie-theme', next);
    playCutePop(440);
  });

  // Confetti System
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function launchConfetti(amount = 75) {
    const colors = ['#ff6b00', '#ff8c38', '#ffb380', '#ffffff', '#ffd6b8'];
    for (let i = 0; i < amount; i++) {
      particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 240,
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
  }

  function updateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.rotation += p.vRot;
      p.life -= 1.2;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 100);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();

      if (p.life <= 0) particles.splice(index, 1);
    });
    requestAnimationFrame(updateConfetti);
  }
  updateConfetti();

  // Hero Hug Button
  const btnHug = document.getElementById('btn-hug');
  btnHug.addEventListener('click', () => {
    hugCount++;
    globalScore += 15;
    updateScores();
    playCutePop(650);
    launchConfetti(85);
  });

  // Feature Tabs Navigation Switcher
  const featTabs = document.querySelectorAll('.feat-tab');
  const featPanels = document.querySelectorAll('.feat-panel');

  featTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      featTabs.forEach(t => t.classList.remove('active'));
      featPanels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPanel = document.getElementById(tab.getAttribute('data-target'));
      if (targetPanel) targetPanel.classList.add('active');
      playCutePop(500);
    });
  });

  // 1. Calendar & Red Day Tracker
  const anniversaryList = document.getElementById('anniversary-list');
  const addEventForm = document.getElementById('add-event-form');
  const redStartDate = document.getElementById('red-start-date');
  const redStatus = document.getElementById('red-status');
  const btnLogRed = document.getElementById('btn-log-red');

  let customEvents = JSON.parse(localStorage.getItem('j-events')) || [];
  function renderEvents() {
    anniversaryList.innerHTML = `
      <li><span>First Meet / Kenalan</span> <strong>12 Jan</strong></li>
      <li><span>Official Dating</span> <strong>25 Feb</strong></li>
    `;
    customEvents.forEach((ev, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${ev.name}</span> <strong>${ev.date}</strong> <button class="btn-del" data-idx="${idx}">×</button>`;
      anniversaryList.appendChild(li);
    });
  }
  renderEvents();

  addEventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('event-name').value;
    const date = document.getElementById('event-date').value;
    customEvents.push({ name, date });
    localStorage.setItem('j-events', JSON.stringify(customEvents));
    renderEvents();
    addEventForm.reset();
    playCutePop(600);
  });

  anniversaryList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-del')) {
      const idx = e.target.getAttribute('data-idx');
      customEvents.splice(idx, 1);
      localStorage.setItem('j-events', JSON.stringify(customEvents));
      renderEvents();
    }
  });

  // Red Day Simulation
  let lastRedDate = localStorage.getItem('j-red-date') || '2026-06-01';
  function updateRedTracker() {
    redStartDate.textContent = lastRedDate;
    redStatus.textContent = 'Perhatian & Sayang Ekstra 🍫';
  }
  updateRedTracker();

  btnLogRed.addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0];
    lastRedDate = today;
    localStorage.setItem('j-red-date', today);
    updateRedTracker();
    playCutePop(540);
    launchConfetti(40);
  });

  // 2. Mood Meter
  const moodBtns = document.querySelectorAll('.mood-btn');
  const currentMoodText = document.getElementById('current-mood-text');
  const moodAdvice = document.getElementById('mood-advice');

  moodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      moodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mood = btn.getAttribute('data-mood');
      const msg = btn.getAttribute('data-msg');
      currentMoodText.textContent = mood;
      moodAdvice.textContent = `Pesan otomatis: ${msg}`;
      playCutePop(580);
      globalScore += 5;
      updateScores();
    });
  });

  // 3. Gallery
  const galleryForm = document.getElementById('gallery-form');
  const galleryGrid = document.getElementById('gallery-grid');
  let galleryItems = JSON.parse(localStorage.getItem('j-gallery')) || [
    { title: 'Ngobrol Santai Sore Hari', img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80' },
    { title: 'Jajan Boba Bareng', img: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=600&q=80' }
  ];

  function renderGallery() {
    galleryGrid.innerHTML = '';
    galleryItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `<img src="${item.img}" alt="${item.title}" /><p>${item.title}</p>`;
      galleryGrid.appendChild(card);
    });
  }
  renderGallery();

  galleryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('gallery-title').value;
    const img = document.getElementById('gallery-img').value;
    galleryItems.unshift({ title, img });
    localStorage.setItem('j-gallery', JSON.stringify(galleryItems));
    renderGallery();
    galleryForm.reset();
    playCutePop(620);
    globalScore += 10;
    updateScores();
  });

  // 4. Reminders
  const reminderForm = document.getElementById('reminder-form');
  const reminderList = document.getElementById('reminder-list');
  let reminders = JSON.parse(localStorage.getItem('j-reminders')) || [
    { text: 'Minum air putih & istirahat sebentar', time: '14:00' }
  ];

  function renderReminders() {
    reminderList.innerHTML = '';
    reminders.forEach((rem, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>⏰ ${rem.text}</span> <strong>${rem.time}</strong> <button class="btn-del" data-idx="${idx}">×</button>`;
      reminderList.appendChild(li);
    });
  }
  renderReminders();

  reminderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('rem-text').value;
    const time = document.getElementById('rem-time').value;
    reminders.push({ text, time });
    localStorage.setItem('j-reminders', JSON.stringify(reminders));
    renderReminders();
    reminderForm.reset();
    playCutePop(550);
  });

  reminderList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-del')) {
      reminders.splice(e.target.getAttribute('data-idx'), 1);
      localStorage.setItem('j-reminders', JSON.stringify(reminders));
      renderReminders();
    }
  });

  // 5. To-Do List
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  let todos = JSON.parse(localStorage.getItem('j-todos')) || [
    { text: 'Selesaikan tugas sekolah tepat waktu', completed: false },
    { text: 'Rencana kencan akhir pekan', completed: true }
  ];

  function renderTodos() {
    todoList.innerHTML = '';
    todos.forEach((todo, idx) => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <span>${todo.text}</span>
        <div class="todo-actions">
          <button class="btn btn-secondary btn-sm" onclick="toggleTodo(${idx})">${todo.completed ? 'Batal' : 'Selesai'}</button>
          <button class="btn-del" onclick="deleteTodo(${idx})">×</button>
        </div>
      `;
      todoList.appendChild(li);
    });
  }
  renderTodos();

  window.toggleTodo = (idx) => {
    todos[idx].completed = !todos[idx].completed;
    localStorage.setItem('j-todos', JSON.stringify(todos));
    renderTodos();
    playCutePop(480);
    if (todos[idx].completed) {
      globalScore += 5;
      updateScores();
      launchConfetti(30);
    }
  };

  window.deleteTodo = (idx) => {
    todos.splice(idx, 1);
    localStorage.setItem('j-todos', JSON.stringify(todos));
    renderTodos();
  };

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    todos.push({ text: todoInput.value, completed: false });
    localStorage.setItem('j-todos', JSON.stringify(todos));
    renderTodos();
    todoInput.value = '';
    playCutePop(580);
  });

  // 6. Time Capsule
  const capsuleForm = document.getElementById('capsule-form');
  const capsuleGrid = document.getElementById('capsule-grid');
  let capsules = JSON.parse(localStorage.getItem('j-capsules')) || [
    { title: 'Untuk Julie di Ulang Tahun ke-17', msg: 'Semoga makin sukses dan bahagia selalu!', date: '2027-01-01' }
  ];

  function renderCapsules() {
    capsuleGrid.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    capsules.forEach(cap => {
      const isReady = today >= cap.date;
      const card = document.createElement('div');
      card.className = 'capsule-card';
      card.innerHTML = `
        <h4>🔒 ${cap.title}</h4>
        <p>Buka pada: ${cap.date}</p>
        <div class="capsule-content" style="font-weight:700; color:var(--accent);">
          ${isReady ? cap.msg : '🔒 Terkunci hingga tanggal tiba.'}
        </div>
      `;
      capsuleGrid.appendChild(card);
    });
  }
  renderCapsules();

  capsuleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    capsules.push({
      title: document.getElementById('capsule-title').value,
      msg: document.getElementById('capsule-msg').value,
      date: document.getElementById('capsule-date').value
    });
    localStorage.setItem('j-capsules', JSON.stringify(capsules));
    renderCapsules();
    capsuleForm.reset();
    playCutePop(620);
    launchConfetti(50);
  });

  // 7. Soundtrack Player
  const songList = document.getElementById('song-list');
  const audioPlayer = document.getElementById('audio-player');
  const nowPlayingTitle = document.getElementById('now-playing-title');
  const nowPlayingDesc = document.getElementById('now-playing-desc');

  songList.addEventListener('click', (e) => {
    const item = e.target.closest('.song-item');
    if (!item) return;
    document.querySelectorAll('.song-item').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    const src = item.getAttribute('data-src');
    const title = item.getAttribute('data-title');
    const desc = item.getAttribute('data-desc');

    nowPlayingTitle.textContent = title;
    nowPlayingDesc.textContent = `"${desc}"`;
    audioPlayer.src = src;
    audioPlayer.play().catch(() => {});
    playCutePop(500);
  });

  // 9. Love Coupons
  const couponsGrid = document.getElementById('coupons-grid');
  const couponsData = [
    { id: 1, title: '🎟️ Kupon Ditraktir Boba', desc: 'Tukarkan kapan saja saat kita jalan bareng!', used: false },
    { id: 2, title: '🎟️ Kupon Ditemenin Curhat', desc: 'Baginda siap mendengarkan cerita sampai ngantuk.', used: false },
    { id: 3, title: '🎟️ Kupon Bantuan Tugas', desc: 'Bantuan penuh buat ngerjain tugas sekolah / animasi.', used: false }
  ];

  function renderCoupons() {
    couponsGrid.innerHTML = '';
    couponsData.forEach(c => {
      const card = document.createElement('div');
      card.className = 'coupon-card';
      card.innerHTML = `
        <h4>${c.title}</h4>
        <p>${c.desc}</p>
        <button class="btn ${c.used ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="redeemCoupon(${c.id})">
          ${c.used ? '✓ Sudah Diklaim' : '🎁 Klaim Kupon'}
        </button>
      `;
      couponsGrid.appendChild(card);
    });
  }
  renderCoupons();

  window.redeemCoupon = (id) => {
    const target = couponsData.find(c => c.id === id);
    if (target && !target.used) {
      target.used = true;
      renderCoupons();
      playCutePop(750);
      launchConfetti(80);
      globalScore += 25;
      updateScores();
    }
  };

  // 10. Wishlist & Bucket List
  const dreamForm = document.getElementById('dream-form');
  const dreamInput = document.getElementById('dream-input');
  const dreamList = document.getElementById('dream-list');
  let dreams = JSON.parse(localStorage.getItem('j-dreams')) || [
    { text: 'Nonton konser musik bareng', completed: false },
    { text: 'Kuliah / sukses di bidang impian', completed: false }
  ];

  function renderDreams() {
    dreamList.innerHTML = '';
    dreams.forEach((dream, idx) => {
      const li = document.createElement('li');
      li.className = `todo-item ${dream.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <span>🎯 ${dream.text}</span>
        <div class="todo-actions">
          <button class="btn btn-secondary btn-sm" onclick="toggleDream(${idx})">${dream.completed ? 'Batal' : 'Terwujud'}</button>
          <button class="btn-del" onclick="deleteDream(${idx})">×</button>
        </div>
      `;
      dreamList.appendChild(li);
    });
  }
  renderDreams();

  window.toggleDream = (idx) => {
    dreams[idx].completed = !dreams[idx].completed;
    localStorage.setItem('j-dreams', JSON.stringify(dreams));
    renderDreams();
    playCutePop(520);
    if (dreams[idx].completed) {
      globalScore += 30;
      updateScores();
      launchConfetti(90);
    }
  };

  window.deleteDream = (idx) => {
    dreams.splice(idx, 1);
    localStorage.setItem('j-dreams', JSON.stringify(dreams));
    renderDreams();
  };

  dreamForm.addEventListener('submit', (e) => {
    e.preventDefault();
    dreams.push({ text: dreamInput.value, completed: false });
    localStorage.setItem('j-dreams', JSON.stringify(dreams));
    renderDreams();
    dreamInput.value = '';
    playCutePop(590);
  });
});
