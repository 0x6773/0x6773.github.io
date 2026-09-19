(function() {
  'use strict';

  // ── DOM ──
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const p1ScoreEl = document.getElementById('p1-score');
  const p2ScoreEl = document.getElementById('p2-score');
  const roundInfoEl = document.getElementById('round-info');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start-btn');
  const overlaySub = document.getElementById('overlay-sub');
  const roundOverlay = document.getElementById('round-overlay');
  const roundTitle = document.getElementById('round-title');
  const roundMsg = document.getElementById('round-msg');

  // ── Constants ──
  const W = canvas.width;
  const H = canvas.height;
  const CELL = 6;
  const COLS = W / CELL;
  const ROWS = H / CELL;
  const TICK_MS = 55;
  const ROUNDS_TO_WIN = 5;
  const COUNTDOWN_SECS = 3;

  const P1_COLOR = '#00f0ff';
  const P1_TRAIL = 'rgba(0, 240, 255, 0.55)';
  const P2_COLOR = '#e040fb';
  const P2_TRAIL = 'rgba(224, 64, 251, 0.55)';

  const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  const OPPOSITE = { up:'down', down:'up', left:'right', right:'left' };

  // ── Audio ──
  let audioCtx;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function playTone(freq, dur, type = 'square', vol = 0.1) {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  }
  function sfxCountdown() { playTone(440, 0.15, 'triangle', 0.12); }
  function sfxGo()        { playTone(880, 0.2, 'triangle', 0.15); }
  function sfxCrash()     { playTone(120, 0.4, 'sawtooth', 0.15); setTimeout(() => playTone(80, 0.3, 'sawtooth', 0.1), 100); }
  function sfxWinRound()  { [660,880,1100].forEach((f,i) => setTimeout(() => playTone(f, 0.15, 'triangle', 0.12), i*80)); }
  function sfxMatchWin()  { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.2, 'triangle', 0.14), i*100)); }

  // ── Particles ──
  let particles = [];
  function spawnExplosion(x, y, color, count = 30) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 5;
      particles.push({
        x: x * CELL + CELL / 2, y: y * CELL + CELL / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 2 + Math.random() * 3, color, life: 1, decay: 0.015 + Math.random() * 0.02
      });
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Game State ──
  let grid, players, scores, round, tickInterval, gameRunning, animId;
  let p1NextDir = null, p2NextDir = null;

  // ── Input ──
  document.addEventListener('keydown', e => {
    // Player 1: WASD
    const p1Map = { w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right' };
    // Player 2: Arrow keys
    const p2Map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };

    if (p1Map[e.key]) {
      e.preventDefault();
      const dir = p1Map[e.key];
      if (players && players[0] && OPPOSITE[dir] !== players[0].dir) p1NextDir = dir;
    }
    if (p2Map[e.key]) {
      e.preventDefault();
      const dir = p2Map[e.key];
      if (players && players[1] && OPPOSITE[dir] !== players[1].dir) p2NextDir = dir;
    }
  });

  // ── Start ──
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('[TRON] Start button clicked');
    ensureAudio();
    scores = [0, 0];
    round = 1;
    updateHUD();
    overlay.classList.add('hidden');
    document.getElementById('controls-info').style.display = '';
    startRound();
  });

  // ── Game Init ──
  function initGrid() {
    grid = [];
    for (let y = 0; y < ROWS; y++) {
      grid[y] = [];
      for (let x = 0; x < COLS; x++) grid[y][x] = 0;
    }
  }

  function initPlayers() {
    players = [
      { x: Math.floor(COLS * 0.25), y: Math.floor(ROWS / 2), dir: 'right', alive: true },
      { x: Math.floor(COLS * 0.75), y: Math.floor(ROWS / 2), dir: 'left', alive: true }
    ];
    grid[players[0].y][players[0].x] = 1;
    grid[players[1].y][players[1].x] = 2;
    p1NextDir = null;
    p2NextDir = null;
  }

  function startRound() {
    initGrid();
    initPlayers();
    particles = [];
    gameRunning = false;
    updateHUD();
    render();

    // Countdown
    let count = COUNTDOWN_SECS;
    showRoundOverlay(count, '');
    sfxCountdown();

    const cdInterval = setInterval(() => {
      count--;
      if (count > 0) {
        showRoundOverlay(count, '');
        sfxCountdown();
      } else {
        clearInterval(cdInterval);
        sfxGo();
        hideRoundOverlay();
        gameRunning = true;
        startGameLoop();
        requestAnimationFrame(renderLoop);
      }
    }, 1000);
  }

  // ── Game Loop ──
  function startGameLoop() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(tick, TICK_MS);
  }

  function stopGame() {
    gameRunning = false;
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
  }

  function tick() {
    if (!gameRunning) return;

    // Apply buffered inputs
    if (p1NextDir) { players[0].dir = p1NextDir; p1NextDir = null; }
    if (p2NextDir) { players[1].dir = p2NextDir; p2NextDir = null; }

    // Move players
    for (let i = 0; i < 2; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const d = DIRS[p.dir];
      p.x += d.x;
      p.y += d.y;
    }

    // Check collisions
    let crashPositions = [];

    for (let i = 0; i < 2; i++) {
      const p = players[i];
      if (!p.alive) continue;
      if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS) {
        p.alive = false;
        crashPositions.push({ x: Math.max(0, Math.min(COLS - 1, p.x)), y: Math.max(0, Math.min(ROWS - 1, p.y)), player: i });
        continue;
      }
      if (grid[p.y][p.x] !== 0) {
        p.alive = false;
        crashPositions.push({ x: p.x, y: p.y, player: i });
        continue;
      }
      grid[p.y][p.x] = i + 1;
    }

    // Head-on collision
    if (players[0].alive && players[1].alive && players[0].x === players[1].x && players[0].y === players[1].y) {
      players[0].alive = false;
      players[1].alive = false;
      crashPositions.push({ x: players[0].x, y: players[0].y, player: 0 });
      crashPositions.push({ x: players[1].x, y: players[1].y, player: 1 });
    }

    const p1Dead = !players[0].alive;
    const p2Dead = !players[1].alive;

    if (p1Dead || p2Dead) {
      stopGame();

      let roundWinner = -1;
      if (p1Dead && p2Dead) roundWinner = -1;
      else if (p2Dead) roundWinner = 0;
      else roundWinner = 1;

      if (roundWinner >= 0) scores[roundWinner]++;
      updateHUD();

      // Explosions
      for (const cp of crashPositions) {
        spawnExplosion(cp.x, cp.y, cp.player === 0 ? P1_COLOR : P2_COLOR, 35);
      }
      sfxCrash();

      // Check match win
      if (scores[0] >= ROUNDS_TO_WIN || scores[1] >= ROUNDS_TO_WIN) {
        const matchWinner = scores[0] >= ROUNDS_TO_WIN ? 0 : 1;
        setTimeout(() => handleMatchEnd(matchWinner), 1500);
        return;
      }

      // Next round
      let msg;
      if (roundWinner === -1) msg = 'Draw!';
      else msg = 'Player ' + (roundWinner + 1) + ' wins!';
      const color = roundWinner === -1 ? '#ffd700' : (roundWinner === 0 ? P1_COLOR : P2_COLOR);

      setTimeout(() => {
        if (roundWinner >= 0) sfxWinRound();
        showRoundOverlay(msg, 'Next round in 2s...', color);
        setTimeout(() => {
          round++;
          updateHUD();
          startRound();
        }, 2000);
      }, 800);
    }
  }

  function handleMatchEnd(winner) {
    sfxMatchWin();
    if (window.GamePlatform) {
      GamePlatform.recordGame('tron', scores[0] + scores[1], 0, { win: winner === 0 });
    }
    const title = 'Player ' + (winner + 1) + ' Wins!';
    const sub = 'Final: ' + scores[0] + ' - ' + scores[1] + '  (First to ' + ROUNDS_TO_WIN + ')';
    const color = winner === 0 ? P1_COLOR : P2_COLOR;

    // Show on main overlay with replay button
    overlay.querySelector('h1').textContent = title;
    overlay.querySelector('h1').style.background = color;
    overlay.querySelector('h1').style['-webkit-background-clip'] = 'text';
    overlay.querySelector('.tagline').textContent = sub;
    startBtn.textContent = 'Play Again';
    overlaySub.textContent = '';
    document.getElementById('controls-info').style.display = 'none';
    overlay.classList.remove('hidden');
    hideRoundOverlay();
  }

  // ── HUD ──
  function updateHUD() {
    p1ScoreEl.textContent = 'P1: ' + (scores ? scores[0] : 0);
    p2ScoreEl.textContent = 'P2: ' + (scores ? scores[1] : 0);
    roundInfoEl.textContent = 'Round ' + (round || 1);
  }

  // ── Overlays ──
  function showRoundOverlay(title, msg, color) {
    roundTitle.textContent = title;
    roundTitle.style.color = color || '#fff';
    roundMsg.textContent = msg || '';
    roundOverlay.classList.remove('hidden');
  }
  function hideRoundOverlay() { roundOverlay.classList.add('hidden'); }

  // ── Rendering ──
  function renderLoop() {
    updateParticles();
    render();
    if (gameRunning || particles.length > 0) {
      requestAnimationFrame(renderLoop);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += CELL * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += CELL * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Trails
    if (grid) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = grid[y][x];
          if (v === 0) continue;
          ctx.fillStyle = v === 1 ? P1_TRAIL : P2_TRAIL;
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }

    // Player heads
    if (players) {
      for (let i = 0; i < 2; i++) {
        const p = players[i];
        if (!p.alive) continue;
        const px = p.x * CELL;
        const py = p.y * CELL;
        const color = i === 0 ? P1_COLOR : P2_COLOR;

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, CELL, CELL);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.restore();
      }
    }

    // Particles
    drawParticles();

    // Border glow
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.restore();
  }

  // Initial render
  render();

  if (window.GamePlatform) {
    GamePlatform.initHeader('Tron');
  }
})();
