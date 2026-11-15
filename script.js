document.addEventListener('DOMContentLoaded', () => {
  // 0. Global Score Helper
  const globalScoreEl = document.getElementById('global-score');
  let globalScore = 0;

  function addGlobalScore(pts) {
    globalScore += pts;
    globalScoreEl.textContent = globalScore;
  }

  // Cute Web Audio Pop Sound Generator (No external mp3 needed!)
  let audioCtx = null;
  function playCutePop(freq = 520) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
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
    } catch (e) {
      // Ignore audio block if autoplay restricted
    }
  }

  // 1. Dark / Light Mode Toggle
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

  // 2. Confetti System (Strictly Orange & White Shades)
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

  // 3. Hero Energy Button
  const btnHug = document.getElementById('btn-hug');
  const energyCountEl = document.getElementById('energy-count');
  let energyCount = 0;

  btnHug.addEventListener('click', () => {
    energyCount += 10;
    energyCountEl.textContent = energyCount;
    addGlobalScore(10);
    playCutePop(600);
    launchConfetti(80);
  });

  // =========================================================
  // 4. NEW REPLAYABLE GAME 1: TANGKAP CAMILAN MOCHI (ARCADE)
  // =========================================================
  const arcadeCanvas = document.getElementById('arcade-canvas');
  const aCtx = arcadeCanvas.getContext('2d');
  const arcadeOverlay = document.getElementById('arcade-overlay');
  const startArcadeBtn = document.getElementById('start-arcade-btn');
  const arcadeScoreEl = document.getElementById('arcade-score');
  const arcadeBestEl = document.getElementById('arcade-best');
  const arcadeTimeEl = document.getElementById('arcade-time');
  const overlayTitle = document.getElementById('arcade-overlay-title');
  const overlayDesc = document.getElementById('arcade-overlay-desc');

  let arcadeBest = Number(localStorage.getItem('julie-arcade-best') || 0);
  arcadeBestEl.textContent = arcadeBest;

  let arcadeRunning = false;
  let arcadeScore = 0;
  let arcadeTimeLeft = 25;
  let arcadeTimerInterval = null;
  let fallingItems = [];
  let floatingTexts = [];
  let basket = { x: 200, width: 96, height: 42 };

  function resizeArcade() {
    const rect = arcadeCanvas.parentElement.getBoundingClientRect();
    arcadeCanvas.width = rect.width;
    arcadeCanvas.height = rect.height;
    basket.x = arcadeCanvas.width / 2 - basket.width / 2;
  }
  window.addEventListener('resize', resizeArcade);
  resizeArcade();

  function moveBasket(clientX) {
    const rect = arcadeCanvas.getBoundingClientRect();
    const relX = clientX - rect.left;
    basket.x = Math.max(8, Math.min(arcadeCanvas.width - basket.width - 8, relX - basket.width / 2));
  }

  arcadeCanvas.addEventListener('mousemove', (e) => moveBasket(e.clientX));
  arcadeCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      moveBasket(e.touches[0].clientX);
    }
  }, { passive: true });

  function spawnArcadeItem() {
    const roll = Math.random();
    let type = { emoji: '🍡', pts: 10, speed: 3.2 + Math.random() * 1.8 };
    if (roll > 0.78) {
      type = { emoji: '⭐', pts: 25, speed: 4.5 + Math.random() * 1.5 };
    } else if (roll < 0.22) {
      type = { emoji: '💤', pts: -15, speed: 3.6 + Math.random() * 1.6 };
    }

    fallingItems.push({
      x: Math.random() * (arcadeCanvas.width - 48) + 24,
      y: -30,
      size: 30,
      ...type
    });
  }

  function startArcadeGame() {
    resizeArcade();
    arcadeRunning = true;
    arcadeScore = 0;
    arcadeTimeLeft = 25;
    fallingItems = [];
    floatingTexts = [];
    arcadeScoreEl.textContent = '0';
    arcadeTimeEl.textContent = '25s';
    arcadeOverlay.classList.add('hidden');
    playCutePop(560);

    clearInterval(arcadeTimerInterval);
    arcadeTimerInterval = setInterval(() => {
      arcadeTimeLeft--;
      arcadeTimeEl.textContent = `${arcadeTimeLeft}s`;
      if (arcadeTimeLeft <= 0) {
        endArcadeGame();
      }
    }, 1000);

    requestAnimationFrame(loopArcade);
  }

  function endArcadeGame() {
    arcadeRunning = false;
    clearInterval(arcadeTimerInterval);
    if (arcadeScore > arcadeBest) {
      arcadeBest = arcadeScore;
      localStorage.setItem('julie-arcade-best', arcadeBest);
      arcadeBestEl.textContent = arcadeBest;
    }
    overlayTitle.textContent = `Yeay! Skor Kamu: ${arcadeScore} Poin 🎉`;
    overlayDesc.textContent = arcadeScore >= 100
      ? 'Luar biasa! Refleks kamu cepet banget, Julie juara!'
      : 'Seru kan? Ayo main lagi buat pecahin rekor tertinggimu!';
    startArcadeBtn.textContent = '🔄 Main Lagi';
    arcadeOverlay.classList.remove('hidden');
    launchConfetti(90);
  }

  let frameTick = 0;
  function loopArcade() {
    if (!arcadeRunning) return;
    aCtx.clearRect(0, 0, arcadeCanvas.width, arcadeCanvas.height);

    frameTick++;
    if (frameTick % 28 === 0) {
      spawnArcadeItem();
    }

    // Draw Cute Basket (Orange pill with cute cat ears)
    const bx = basket.x;
    const by = arcadeCanvas.height - basket.height - 16;
    aCtx.fillStyle = '#ff6b00';
    aCtx.beginPath();
    aCtx.roundRect(bx, by, basket.width, basket.height, 18);
    aCtx.fill();

    // Cute face on basket
    aCtx.fillStyle = '#ffffff';
    aCtx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
    aCtx.textAlign = 'center';
    aCtx.fillText('• ᴥ •', bx + basket.width / 2, by + 26);

    // Update & Draw Falling Items
    aCtx.font = '28px sans-serif';
    for (let i = fallingItems.length - 1; i >= 0; i--) {
      const item = fallingItems[i];
      item.y += item.speed;
      aCtx.fillText(item.emoji, item.x, item.y);

      // Collision Check
      if (
        item.y + 10 >= by &&
        item.y - 16 <= by + basket.height &&
        item.x >= bx - 12 &&
        item.x <= bx + basket.width + 12
      ) {
        arcadeScore = Math.max(0, arcadeScore + item.pts);
        arcadeScoreEl.textContent = arcadeScore;
        if (item.pts > 0) {
          addGlobalScore(item.pts);
          playCutePop(680);
        } else {
          playCutePop(260);
        }
        floatingTexts.push({
          x: item.x,
          y: by - 8,
          text: item.pts > 0 ? `+${item.pts}` : `${item.pts}`,
          positive: item.pts > 0,
          alpha: 1
        });
        fallingItems.splice(i, 1);
        continue;
      }

      if (item.y > arcadeCanvas.height + 30) {
        fallingItems.splice(i, 1);
      }
    }

    // Floating Score Feedback
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 1.4;
      ft.alpha -= 0.025;
      aCtx.save();
      aCtx.globalAlpha = Math.max(0, ft.alpha);
      aCtx.font = '800 16px Plus Jakarta Sans, sans-serif';
      aCtx.fillStyle = ft.positive ? '#ff6b00' : '#71717a';
      aCtx.fillText(ft.text, ft.x, ft.y);
      aCtx.restore();
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }

    requestAnimationFrame(loopArcade);
  }

  startArcadeBtn.addEventListener('click', startArcadeGame);

  // =========================================================
  // 5. NEW REPLAYABLE GAME 2: BUBBLE WRAP POP-IT GEMOY
  // =========================================================
  const bubbleGrid = document.getElementById('bubble-grid');
  const resetBubblesBtn = document.getElementById('reset-bubbles-btn');
  const bubbleToast = document.getElementById('bubble-toast');

  const cuteIcons = ['🧡', '✨', '🍊', '⭐', '🧸', '🎀', '🌸', '🍭'];
  const cuteCompliments = [
    'Pop! Kamu manis banget hari ini! 🧡',
    'Pop! Semangat terus ya cantik! ✨',
    'Pop! Jangan lupa senyum lebar! 😊',
    'Pop! Kamu anak paling hebat! 🌟',
    'Pop! Istirahat bentar gapapa kok! 🧸',
    'Pop! Mood booster +100% buat Julie! 🍊',
    'Pop! Hari ini bakal berjalan lancar! 🎀',
    'Pop! Kamu selalu bikin bangga! 🏆'
  ];

  function buildBubbles() {
    bubbleGrid.innerHTML = '';
    const totalBubbles = 24;
    for (let i = 0; i < totalBubbles; i++) {
      const btn = document.createElement('button');
      btn.className = 'bubble-item';
      const icon = cuteIcons[i % cuteIcons.length];
      btn.textContent = icon;
      btn.setAttribute('aria-label', 'Gelembung lucu');

      btn.addEventListener('click', () => {
        if (btn.classList.contains('popped')) return;
        btn.classList.add('popped');
        btn.textContent = '✓';
        playCutePop(480 + Math.random() * 260);
        addGlobalScore(5);

        const randomMsg = cuteCompliments[Math.floor(Math.random() * cuteCompliments.length)];
        bubbleToast.textContent = randomMsg;
        bubbleToast.style.transform = 'scale(1.02)';
        setTimeout(() => (bubbleToast.style.transform = 'scale(1)'), 150);

        // Auto-refill celebration if all popped!
        const remaining = bubbleGrid.querySelectorAll('.bubble-item:not(.popped)').length;
        if (remaining === 0) {
          bubbleToast.textContent = '🎉 Semua gelembung meletup! Klik "Isi Ulang Gelembung" buat main lagi!';
          launchConfetti(85);
        }
      });

      bubbleGrid.appendChild(btn);
    }
  }

  resetBubblesBtn.addEventListener('click', () => {
    buildBubbles();
    playCutePop(620);
    bubbleToast.textContent = 'Gelembung baru siap dipencetin lagi! ✨';
  });

  buildBubbles();

  // =========================================================
  // 6. Mini Game: Runaway Button (Replayable with Random Quotes)
  // =========================================================
  const arena = document.getElementById('game-arena');
  const runawayBtn = document.getElementById('runaway-btn');
  const gameReward = document.getElementById('game-reward');
  const resetGameBtn = document.getElementById('reset-game');
  const rewardTitle = document.getElementById('reward-title');
  const rewardText = document.getElementById('reward-text');

  let dodgeCount = 0;
  const maxDodges = 4;

  const secretRewards = [
    {
      title: 'Kamu Keren Banget, Julie! 🏆',
      text: 'Gak peduli seberapa sibuk hari ini, senyum kamu selalu jadi hal paling juara. Jangan lupa minum air putih ya!'
    },
    {
      title: 'Refleks Super Cepat! ⚡',
      text: 'Tombol segesit ini aja ketangkep sama kamu! Semoga semua urusan dan tugas kamu hari ini juga beres secepat itu.'
    },
    {
      title: 'Hadiah Peluk Virtual! 🤗',
      text: 'Selamat! Kamu berhak dapet semangat ekstra dan traktiran jajan favorit kapan pun kamu lagi capek.'
    }
  ];

  function moveButton() {
    if (dodgeCount >= maxDodges) return;
    dodgeCount++;
    playCutePop(400 + dodgeCount * 60);

    const arenaRect = arena.getBoundingClientRect();
    const btnRect = runawayBtn.getBoundingClientRect();

    const maxX = arenaRect.width - btnRect.width - 24;
    const maxY = arenaRect.height - btnRect.height - 24;

    const randX = Math.max(16, Math.floor(Math.random() * maxX));
    const randY = Math.max(16, Math.floor(Math.random() * maxY));

    runawayBtn.style.left = `${randX}px`;
    runawayBtn.style.top = `${randY}px`;

    const taunts = [
      'Eits, gak kena! 😝',
      'Dikit lagi ayo! 🏃‍♀️',
      'Wlee, kejar terus! ✨',
      'Oke deh, klik aku sekarang! 🧡'
    ];
    runawayBtn.textContent = taunts[dodgeCount - 1] || 'Klik Aku! 🧡';
  }

  runawayBtn.addEventListener('mouseenter', moveButton);
  runawayBtn.addEventListener('touchstart', (e) => {
    if (dodgeCount < maxDodges) {
      e.preventDefault();
      moveButton();
    }
  });

  runawayBtn.addEventListener('click', () => {
    const pick = secretRewards[Math.floor(Math.random() * secretRewards.length)];
    rewardTitle.textContent = pick.title;
    rewardText.textContent = pick.text;
    runawayBtn.style.display = 'none';
    gameReward.classList.remove('hidden');
    addGlobalScore(30);
    playCutePop(720);
    launchConfetti(100);
  });

  resetGameBtn.addEventListener('click', () => {
    dodgeCount = 0;
    runawayBtn.style.display = 'inline-flex';
    runawayBtn.style.left = 'auto';
    runawayBtn.style.top = 'auto';
    runawayBtn.textContent = 'Klik Aku Dong! 😜';
    gameReward.classList.add('hidden');
    playCutePop(520);
  });

  // =========================================================
  // 7. Flip Cards
  // =========================================================
  const flipCards = document.querySelectorAll('.flip-card');
  flipCards.forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      playCutePop(540);
      if (card.classList.contains('flipped')) {
        addGlobalScore(15);
        launchConfetti(35);
      }
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('flipped');
      }
    });
  });

  // =========================================================
  // 8. Spin Wheel
  // =========================================================
  const spinBtn = document.getElementById('spin-btn');
  const wheelDisc = document.getElementById('wheel-disc');
  const wheelResult = document.getElementById('wheel-result');
  let currentRotation = 0;
  let isSpinning = false;

  const prizes = [
    '🧋 Waktunya jajan Boba atau minuman favorit!',
    '🎵 Putar playlist lagu kesukaanmu sekarang!',
    '😴 Ambil waktu istirahat & tidur siang sebentar!',
    '🍫 Makan coklat biar mood balik 100%!',
    '🎬 Nonton satu episode anime atau film seru!',
    '🤗 Dapat peluk & semangat penuh dari aku!'
  ];

  spinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    isSpinning = true;
    playCutePop(500);
    wheelResult.textContent = 'Roda sedang berputar... 🎡';

    const extraDeg = Math.floor(Math.random() * 360) + 1440;
    currentRotation += extraDeg;
    wheelDisc.style.transform = `rotate(${currentRotation}deg)`;

    setTimeout(() => {
      isSpinning = false;
      const normalized = currentRotation % 360;
      const sliceIndex = Math.floor(((360 - normalized + 60) % 360) / 60);
      wheelResult.textContent = `Hasil: ${prizes[sliceIndex]}`;
      addGlobalScore(20);
      playCutePop(700);
      launchConfetti(90);
    }, 3600);
  });
});
