/* ================================================================
   SNAKE  –  Pure JS / Canvas
   ================================================================ */
(() => {
  "use strict";

  /* ── Constants ── */
  const CANVAS_SIZE = 600;
  const CELL        = 20;
  const COLS        = CANVAS_SIZE / CELL;   // 30
  const ROWS        = CANVAS_SIZE / CELL;   // 30
  const BASE_SPEED  = 130;   // ms per tick at start
  const MIN_SPEED   = 55;    // fastest possible tick
  const SPEED_STEP  = 2;     // ms shaved off per food eaten
  const LS_KEY      = "snake_highscores";
  const MAX_SCORES  = 5;

  /* ── Direction vectors ── */
  const DIR = {
    UP:    { x:  0, y: -1 },
    DOWN:  { x:  0, y:  1 },
    LEFT:  { x: -1, y:  0 },
    RIGHT: { x:  1, y:  0 },
  };

  /* ── DOM refs ── */
  const canvas       = document.getElementById("game-canvas");
  const ctx          = canvas.getContext("2d");
  const scoreEl      = document.getElementById("score");
  const highScoreEl  = document.getElementById("high-score");
  const startOverlay = document.getElementById("start-overlay");
  const overOverlay  = document.getElementById("gameover-overlay");
  const finalText    = document.getElementById("final-score-text");
  const scoreList    = document.getElementById("score-list");
  const startBtn     = document.getElementById("start-btn");
  const restartBtn   = document.getElementById("restart-btn");
  const container    = document.getElementById("canvas-container");

  /* ── Audio (Web Audio API) ── */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTone(freq, type, duration, vol) {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function sfxEat() {
    playTone(880, "square", 0.08, 0.15);
    setTimeout(() => playTone(1320, "square", 0.10, 0.12), 60);
  }

  function sfxDie() {
    playTone(220, "sawtooth", 0.35, 0.2);
    setTimeout(() => playTone(110, "sawtooth", 0.45, 0.18), 120);
  }

  function sfxWall() {
    playTone(90, "square", 0.15, 0.25);
  }

  /* ── Particles ── */
  let particles = [];

  function spawnParticles(cx, cy, color) {
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x    += p.vx;
      p.y    += p.vy;
      p.vx   *= 0.97;
      p.vy   *= 0.97;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── Game State ── */
  let snake, direction, nextDirection, food, score, speed, running, gameLoopTimer;
  let foodPulse = 0;   // animation counter for food glow

  function init() {
    const midX = Math.floor(COLS / 2);
    const midY = Math.floor(ROWS / 2);
    snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    direction     = DIR.RIGHT;
    nextDirection = DIR.RIGHT;
    score         = 0;
    speed         = BASE_SPEED;
    particles     = [];
    foodPulse     = 0;
    placeFood();
    updateHUD();
  }

  function placeFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  function updateHUD() {
    scoreEl.textContent     = score;
    highScoreEl.textContent = getTopScore();
  }

  /* ── Local-storage helpers ── */
  function loadScores() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  }
  function saveScores(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  }
  function getTopScore() {
    const s = loadScores();
    return s.length ? s[0] : 0;
  }
  function addScore(val) {
    const arr = loadScores();
    arr.push(val);
    arr.sort((a, b) => b - a);
    saveScores(arr.slice(0, MAX_SCORES));
  }

  function renderLeaderboard() {
    const scores = loadScores();
    scoreList.innerHTML = "";
    if (scores.length === 0) {
      scoreList.innerHTML = '<li style="justify-content:center;color:#556">No scores yet</li>';
      return;
    }
    scores.forEach((s, i) => {
      const li   = document.createElement("li");
      li.innerHTML = `<span class="rank">#${i + 1}</span><span class="pts">${s}</span>`;
      scoreList.appendChild(li);
    });
  }

  /* ── Tick / Update ── */
  function tick() {
    direction = nextDirection;

    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      return gameOver();
    }

    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      return gameOver();
    }

    snake.unshift(head);

    // Eat food?
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
      ensureAudio();
      sfxEat();
      spawnParticles(
        food.x * CELL + CELL / 2,
        food.y * CELL + CELL / 2,
        "#ff5555"
      );
      placeFood();
      updateHUD();
    } else {
      snake.pop();
    }
  }

  /* ── Draw ── */
  function draw() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, CANVAS_SIZE); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(CANVAS_SIZE, j * CELL); ctx.stroke();
    }

    // Food (glow + pulse)
    foodPulse += 0.06;
    const pulse = 1 + Math.sin(foodPulse) * 0.18;
    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    const fr = (CELL / 2 - 2) * pulse;

    // outer glow
    const glow = ctx.createRadialGradient(fx, fy, fr * 0.2, fx, fy, fr * 2.8);
    glow.addColorStop(0, "rgba(255, 85, 85, .35)");
    glow.addColorStop(1, "rgba(255, 85, 85, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // food body
    ctx.fillStyle = "#ff5555";
    ctx.shadowColor = "#ff5555";
    ctx.shadowBlur  = 14;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake
    const len = snake.length;
    for (let i = len - 1; i >= 0; i--) {
      const seg = snake[i];
      const t   = len > 1 ? i / (len - 1) : 0;   // 0 = head, 1 = tail

      // colour gradient: bright green head -> dark teal tail
      const r = Math.round(34  + (83  - 34)  * (1 - t));
      const g = Math.round(120 + (215 - 120) * (1 - t));
      const b = Math.round(60  + (105 - 60)  * (1 - t));

      const px = seg.x * CELL;
      const py = seg.y * CELL;
      const pad = 1;
      const rad = i === 0 ? 6 : 4;

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      if (i === 0) {
        ctx.shadowColor = "#53d769";
        ctx.shadowBlur  = 10;
      }
      roundRect(ctx, px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, rad);
      ctx.fill();
      ctx.shadowBlur = 0;

      // eyes on head
      if (i === 0) {
        drawEyes(seg, direction);
      }
    }

    // Particles on top
    drawParticles();
  }

  function drawEyes(head, dir) {
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const off = 4;
    let e1, e2;

    if (dir === DIR.RIGHT)     { e1 = { x: cx + 3, y: cy - off }; e2 = { x: cx + 3, y: cy + off }; }
    else if (dir === DIR.LEFT) { e1 = { x: cx - 3, y: cy - off }; e2 = { x: cx - 3, y: cy + off }; }
    else if (dir === DIR.UP)   { e1 = { x: cx - off, y: cy - 3 }; e2 = { x: cx + off, y: cy - 3 }; }
    else                       { e1 = { x: cx - off, y: cy + 3 }; e2 = { x: cx + off, y: cy + 3 }; }

    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(e1.x, e1.y, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2.x, e2.y, 2.6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(e1.x, e1.y, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2.x, e2.y, 1.1, 0, Math.PI * 2); ctx.fill();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  /* ── Animation frame loop (for particles + food pulse even between ticks) ── */
  let rafId = null;
  function renderLoop() {
    if (!running) return;
    updateParticles();
    draw();
    rafId = requestAnimationFrame(renderLoop);
  }

  /* ── Game loop (fixed-interval logic tick) ── */
  function startLoop() {
    running = true;
    scheduleNextTick();
    renderLoop();
  }

  function scheduleNextTick() {
    gameLoopTimer = setTimeout(() => {
      if (!running) return;
      tick();
      scheduleNextTick();
    }, speed);
  }

  function stopLoop() {
    running = false;
    clearTimeout(gameLoopTimer);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ── Game over ── */
  function gameOver() {
    stopLoop();
    ensureAudio();
    sfxWall();
    sfxDie();

    // screen shake
    container.classList.add("shake");
    setTimeout(() => container.classList.remove("shake"), 450);

    // final draw (so player sees the fatal position)
    draw();

    addScore(score);
    updateHUD();

    finalText.textContent = `Score: ${score}`;
    renderLeaderboard();

    setTimeout(() => {
      overOverlay.classList.remove("hidden");
    }, 500);
  }

  /* ── Start / Restart ── */
  function startGame() {
    ensureAudio();
    startOverlay.classList.add("hidden");
    overOverlay.classList.add("hidden");
    init();
    startLoop();
  }

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  /* ── Keyboard input ── */
  const KEY_MAP = {
    ArrowUp:    DIR.UP,    KeyW: DIR.UP,
    ArrowDown:  DIR.DOWN,  KeyS: DIR.DOWN,
    ArrowLeft:  DIR.LEFT,  KeyA: DIR.LEFT,
    ArrowRight: DIR.RIGHT, KeyD: DIR.RIGHT,
  };

  document.addEventListener("keydown", (e) => {
    // Start game on any mapped key if on start screen
    if (!startOverlay.classList.contains("hidden")) {
      if (KEY_MAP[e.code]) { startGame(); return; }
    }

    const nd = KEY_MAP[e.code];
    if (!nd || !running) return;

    // prevent 180-degree reversal
    if (nd.x + direction.x === 0 && nd.y + direction.y === 0) return;

    nextDirection = nd;
    e.preventDefault();
  });

  /* ── Touch / Swipe input ── */
  let touchStartX = 0, touchStartY = 0;

  canvas.addEventListener("touchstart", (e) => {
    if (!startOverlay.classList.contains("hidden")) { startGame(); return; }
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  canvas.addEventListener("touchend", (e) => {
    if (!running) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 20) return;   // too small

    let nd;
    if (absDx > absDy) {
      nd = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      nd = dy > 0 ? DIR.DOWN : DIR.UP;
    }

    if (nd.x + direction.x === 0 && nd.y + direction.y === 0) return;
    nextDirection = nd;
    e.preventDefault();
  }, { passive: false });

  /* ── Initial render ── */
  init();
  draw();
  updateHUD();
})();
