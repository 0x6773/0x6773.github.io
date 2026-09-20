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
  const LS_KEY_PREFIX = "snake_highscores";
  const MAX_SCORES    = 5;
  const MODE_COLORS   = { classic: "#53d769", obstacle: "#e8a030", portal: "#60b0ff" };

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
  const finalModeEl  = document.getElementById("final-mode-text");
  const modeBtns     = document.querySelectorAll(".smode-btn");

  /* ── Game mode ── */
  let gameMode = "classic";   // "classic" | "obstacle" | "portal"

  modeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      modeBtns.forEach(b => {
        b.classList.remove("active");
        b.style.borderColor = "#666";
        b.style.color       = "#666";
      });
      btn.classList.add("active");
      gameMode = btn.dataset.mode;
      const c  = MODE_COLORS[gameMode];
      btn.style.borderColor = c;
      btn.style.color       = c;
      updateHUD();
    });
  });

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

  function sfxNearMiss() {
    playTone(1400, "sine", 0.06, 0.13);
    setTimeout(() => playTone(1800, "sine", 0.08, 0.10), 40);
  }

  function sfxPortalWrap() {
    playTone(600, "sine", 0.10, 0.08);
    setTimeout(() => playTone(900, "sine", 0.08, 0.06), 50);
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

  /* ── Floating texts (for near-miss, etc.) ── */
  let floatingTexts = [];

  function spawnFloatingText(cx, cy, text, color) {
    floatingTexts.push({
      x: cx, y: cy,
      text,
      color,
      life: 1,
      decay: 0.018,
      vy: -1.5,
    });
  }

  function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y    += ft.vy;
      ft.vy   *= 0.97;
      ft.life -= ft.decay;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  function drawFloatingTexts() {
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.fillStyle   = ft.color;
      ctx.font        = "bold 14px sans-serif";
      ctx.textAlign   = "center";
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  /* ── Game State ── */
  let snake, direction, nextDirection, food, score, speed, running, gameLoopTimer;
  let foodPulse = 0;           // animation counter for food glow
  let nearMissCooldown = 0;    // ticks until next near-miss can trigger
  let obstacles = [];          // obstacle mode: [{x, y}, ...]
  let foodEatenCount = 0;      // track food eaten for obstacle spawning
  let portalGlowPhase = 0;     // animation phase for portal edge glow
  let portalParticles = [];    // brief particles for portal wrap effect

  function init() {
    const midX = Math.floor(COLS / 2);
    const midY = Math.floor(ROWS / 2);
    snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    direction        = DIR.RIGHT;
    nextDirection    = DIR.RIGHT;
    score            = 0;
    speed            = BASE_SPEED;
    particles        = [];
    floatingTexts    = [];
    foodPulse        = 0;
    nearMissCooldown = 0;
    obstacles        = [];
    foodEatenCount   = 0;
    portalGlowPhase  = 0;
    portalParticles  = [];
    placeFood();
    updateHUD();
  }

  function placeFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (
      snake.some(s => s.x === pos.x && s.y === pos.y) ||
      obstacles.some(o => o.x === pos.x && o.y === pos.y)
    );
    food = pos;
  }

  function updateHUD() {
    scoreEl.textContent     = score;
    highScoreEl.textContent = getTopScore();
  }

  /* ── Local-storage helpers (per-mode) ── */
  function lsKey(mode) {
    return mode ? `${LS_KEY_PREFIX}_${mode}` : `${LS_KEY_PREFIX}_classic`;
  }
  function loadScores(mode) {
    try {
      const data = JSON.parse(localStorage.getItem(lsKey(mode || gameMode)));
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
  function saveScores(arr, mode) {
    try { localStorage.setItem(lsKey(mode || gameMode), JSON.stringify(arr)); }
    catch { /* Safari private mode / quota error – silently ignore */ }
  }
  function getTopScore() {
    const s = loadScores(gameMode);
    return s.length ? s[0] : 0;
  }
  function addScore(val) {
    const arr = loadScores(gameMode);
    arr.push(val);
    arr.sort((a, b) => b - a);
    saveScores(arr.slice(0, MAX_SCORES), gameMode);
  }

  function renderLeaderboard() {
    const scores = loadScores(gameMode);
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

  /* ── Obstacle Mode helpers ── */
  function cellOccupied(x, y) {
    if (snake.some(s => s.x === x && s.y === y)) return true;
    if (food.x === x && food.y === y) return true;
    if (obstacles.some(o => o.x === x && o.y === y)) return true;
    return false;
  }

  function spawnObstacleCluster() {
    if (obstacles.length >= 30) return;  // ~10 clusters max (2-3 cells each)
    const len = 2 + Math.floor(Math.random() * 2); // 2 or 3 cells
    const horizontal = Math.random() > 0.5;
    let attempts = 0;
    while (attempts < 80) {
      attempts++;
      const sx = Math.floor(Math.random() * (COLS - 4)) + 2;
      const sy = Math.floor(Math.random() * (ROWS - 4)) + 2;
      const cells = [];
      let valid = true;
      for (let i = 0; i < len; i++) {
        const cx = horizontal ? sx + i : sx;
        const cy = horizontal ? sy : sy + i;
        if (cx < 1 || cx >= COLS - 1 || cy < 1 || cy >= ROWS - 1) { valid = false; break; }
        if (cellOccupied(cx, cy)) { valid = false; break; }
        // don't spawn adjacent to the snake head
        const hd = snake[0];
        if (Math.abs(cx - hd.x) <= 2 && Math.abs(cy - hd.y) <= 2) { valid = false; break; }
        cells.push({ x: cx, y: cy });
      }
      if (valid && cells.length === len) {
        obstacles.push(...cells);
        return;
      }
    }
  }

  /* ── Near-miss detection ── */
  function checkNearMiss() {
    if (nearMissCooldown > 0) { nearMissCooldown--; return; }
    const head = snake[0];
    // Skip first 5 segments: neck + recent turns are naturally adjacent
    for (let i = 5; i < snake.length; i++) {
      const dx = Math.abs(head.x - snake[i].x);
      const dy = Math.abs(head.y - snake[i].y);
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        nearMissCooldown = 8;
        score += 2;
        ensureAudio();
        sfxNearMiss();
        spawnFloatingText(
          head.x * CELL + CELL / 2,
          head.y * CELL - 4,
          "\u26a1 CLOSE!",
          "#ffee55"
        );
        updateHUD();
        if (window.GamePlatform) GamePlatform.updateScore(score);
        return;
      }
    }
  }

  /* ── Portal wrap particles ── */
  function spawnPortalParticles(cx, cy) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 1 + Math.random() * 2.5;
      portalParticles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        decay: 0.04 + Math.random() * 0.03,
        size: 2 + Math.random() * 2,
      });
    }
  }

  function updatePortalParticles() {
    for (let i = portalParticles.length - 1; i >= 0; i--) {
      const p = portalParticles[i];
      p.x    += p.vx;
      p.y    += p.vy;
      p.vx   *= 0.95;
      p.vy   *= 0.95;
      p.life -= p.decay;
      if (p.life <= 0) portalParticles.splice(i, 1);
    }
  }

  function drawPortalParticles() {
    for (const p of portalParticles) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.7;
      ctx.fillStyle   = "#60b0ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── Tick / Update ── */
  function tick() {
    direction = nextDirection;

    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    if (gameMode === "portal") {
      // Wrap coordinates
      const oldX = head.x, oldY = head.y;
      head.x = (head.x + COLS) % COLS;
      head.y = (head.y + ROWS) % ROWS;
      // If wrapped, spawn particles at exit and entry
      if (oldX !== head.x || oldY !== head.y) {
        ensureAudio();
        sfxPortalWrap();
        // exit point (where the snake left)
        const exitX = snake[0].x * CELL + CELL / 2;
        const exitY = snake[0].y * CELL + CELL / 2;
        spawnPortalParticles(exitX, exitY);
        // entry point
        const entryX = head.x * CELL + CELL / 2;
        const entryY = head.y * CELL + CELL / 2;
        spawnPortalParticles(entryX, entryY);
      }
    } else {
      // Wall collision (classic & obstacle modes)
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        return gameOver();
      }
    }

    // Obstacle collision (obstacle mode)
    if (gameMode === "obstacle") {
      if (obstacles.some(o => o.x === head.x && o.y === head.y)) {
        return gameOver();
      }
    }

    // Eat food?
    const eating = head.x === food.x && head.y === food.y;

    // Self collision (all modes)
    // When not eating, exclude the tail tip (last segment) because it will
    // vacate this tick — moving into that cell is safe.
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some(s => s.x === head.x && s.y === head.y)) {
      return gameOver();
    }

    snake.unshift(head);

    if (eating) {
      score += 10;
      foodEatenCount++;
      speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
      ensureAudio();
      sfxEat();
      spawnParticles(
        food.x * CELL + CELL / 2,
        food.y * CELL + CELL / 2,
        "#ff5555"
      );

      // Obstacle mode: spawn obstacles every 5 food eaten
      if (gameMode === "obstacle" && foodEatenCount % 5 === 0) {
        spawnObstacleCluster();
      }

      placeFood();
      updateHUD();
      if (window.GamePlatform) GamePlatform.updateScore(score);
    } else {
      snake.pop();
    }

    // Near-miss check (all modes)
    checkNearMiss();
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

    // Portal mode: edge glow
    if (gameMode === "portal") {
      drawPortalEdgeGlow();
    }

    // Obstacle mode: draw obstacles
    if (gameMode === "obstacle") {
      drawObstacles();
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
    drawPortalParticles();
    drawFloatingTexts();
  }

  /* ── Obstacle drawing ── */
  function drawObstacles() {
    for (const o of obstacles) {
      const px = o.x * CELL;
      const py = o.y * CELL;
      const pad = 0.5;

      // Main block
      ctx.fillStyle = "#5a4a3a";
      roundRect(ctx, px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 3);
      ctx.fill();

      // Brick pattern - horizontal line
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(px + 2, py + CELL / 2);
      ctx.lineTo(px + CELL - 2, py + CELL / 2);
      ctx.stroke();

      // Vertical mortar lines
      ctx.beginPath();
      ctx.moveTo(px + CELL / 2, py + 2);
      ctx.lineTo(px + CELL / 2, py + CELL / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px + CELL * 0.3, py + CELL / 2);
      ctx.lineTo(px + CELL * 0.3, py + CELL - 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px + CELL * 0.7, py + CELL / 2);
      ctx.lineTo(px + CELL * 0.7, py + CELL - 2);
      ctx.stroke();

      // Subtle highlight
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(px + 2, py + 2, CELL - 4, 3);
    }
  }

  /* ── Portal edge glow ── */
  function drawPortalEdgeGlow() {
    portalGlowPhase += 0.03;
    const alpha = 0.08 + Math.sin(portalGlowPhase) * 0.04;
    const shimmer = 0.12 + Math.sin(portalGlowPhase * 1.7) * 0.05;
    const glowWidth = 18;

    // Left edge
    let grad = ctx.createLinearGradient(0, 0, glowWidth, 0);
    grad.addColorStop(0, `rgba(96, 176, 255, ${shimmer})`);
    grad.addColorStop(1, `rgba(96, 176, 255, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, glowWidth, CANVAS_SIZE);

    // Right edge
    grad = ctx.createLinearGradient(CANVAS_SIZE, 0, CANVAS_SIZE - glowWidth, 0);
    grad.addColorStop(0, `rgba(96, 176, 255, ${shimmer})`);
    grad.addColorStop(1, `rgba(96, 176, 255, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(CANVAS_SIZE - glowWidth, 0, glowWidth, CANVAS_SIZE);

    // Top edge
    grad = ctx.createLinearGradient(0, 0, 0, glowWidth);
    grad.addColorStop(0, `rgba(96, 176, 255, ${alpha})`);
    grad.addColorStop(1, `rgba(96, 176, 255, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_SIZE, glowWidth);

    // Bottom edge
    grad = ctx.createLinearGradient(0, CANVAS_SIZE, 0, CANVAS_SIZE - glowWidth);
    grad.addColorStop(0, `rgba(96, 176, 255, ${alpha})`);
    grad.addColorStop(1, `rgba(96, 176, 255, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, CANVAS_SIZE - glowWidth, CANVAS_SIZE, glowWidth);
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
    updateFloatingTexts();
    updatePortalParticles();
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

  /* ── Visibility pause: stop ticking when the tab is hidden ── */
  let pausedByVisibility = false;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Only pause if the game is actively running
      if (running) {
        pausedByVisibility = true;
        stopLoop();
      }
    } else {
      // Resume only if we were the ones who paused it
      if (pausedByVisibility) {
        pausedByVisibility = false;
        startLoop();
      }
    }
  });

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

    if (window.GamePlatform) {
      GamePlatform.recordGame('snake', score, 0);
      GamePlatform.updateScore(score);
    }

    const modeLabel = gameMode.charAt(0).toUpperCase() + gameMode.slice(1);
    finalModeEl.textContent = `${modeLabel} Mode`;
    finalModeEl.style.color = MODE_COLORS[gameMode];
    finalText.textContent = `Score: ${score}`;
    renderLeaderboard();

    setTimeout(() => {
      overOverlay.classList.remove("hidden");
    }, 500);
  }

  /* ── Start / Restart ── */
  function startGame() {
    ensureAudio();
    pausedByVisibility = false;
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
  let swipeHandled = false;   // prevent re-processing the same gesture

  function tryProcessSwipe(cx, cy) {
    if (swipeHandled || !running) return false;
    const dx    = cx - touchStartX;
    const dy    = cy - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 20) return false;   // too small

    let nd;
    if (absDx > absDy) {
      nd = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      nd = dy > 0 ? DIR.DOWN : DIR.UP;
    }

    if (nd.x + direction.x === 0 && nd.y + direction.y === 0) return false;
    nextDirection = nd;
    swipeHandled  = true;
    return true;
  }

  canvas.addEventListener("touchstart", (e) => {
    if (!startOverlay.classList.contains("hidden")) { startGame(); return; }
    const t = e.touches[0];
    touchStartX  = t.clientX;
    touchStartY  = t.clientY;
    swipeHandled = false;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const t = e.touches[0];
    tryProcessSwipe(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    tryProcessSwipe(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });

  /* ── Initial render ── */
  init();
  draw();
  updateHUD();

  if (window.GamePlatform) {
    GamePlatform.initHeader('Snake');
  }
})();
