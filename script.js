document.addEventListener('DOMContentLoaded', () => {
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
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
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
      p.vy += 0.35; // gravity
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
    launchConfetti(80);
  });

  // 4. Mini Game: Runaway Button (Playful Dodge 4 times, then Catchable)
  const arena = document.getElementById('game-arena');
  const runawayBtn = document.getElementById('runaway-btn');
  const gameReward = document.getElementById('game-reward');
  const resetGameBtn = document.getElementById('reset-game');
  let dodgeCount = 0;
  const maxDodges = 4;

  function moveButton() {
    if (dodgeCount >= maxDodges) return;
    dodgeCount++;

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
    runawayBtn.style.display = 'none';
    gameReward.classList.remove('hidden');
    launchConfetti(100);
  });

  resetGameBtn.addEventListener('click', () => {
    dodgeCount = 0;
    runawayBtn.style.display = 'inline-flex';
    runawayBtn.style.left = 'auto';
    runawayBtn.style.top = 'auto';
    runawayBtn.textContent = 'Klik Aku Dong! 😜';
    gameReward.classList.add('hidden');
  });

  // 5. Flip Cards
  const flipCards = document.querySelectorAll('.flip-card');
  flipCards.forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      if (card.classList.contains('flipped')) {
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

  // 6. Spin Wheel
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
    wheelResult.textContent = 'Roda sedang berputar... 🎡';

    const extraDeg = Math.floor(Math.random() * 360) + 1440; // min 4 spins
    currentRotation += extraDeg;
    wheelDisc.style.transform = `rotate(${currentRotation}deg)`;

    setTimeout(() => {
      isSpinning = false;
      const normalized = currentRotation % 360;
      // Pointer is at top (270deg in standard CSS rotation offset)
      const sliceIndex = Math.floor(((360 - normalized + 60) % 360) / 60);
      wheelResult.textContent = `Hasil: ${prizes[sliceIndex]}`;
      launchConfetti(90);
    }, 3600);
  });
});
