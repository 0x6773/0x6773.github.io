/* ================================================================
   SNAKE  –  Pure JS / Canvas
   ================================================================ */
(() => {
  "use strict";

  const { setTimeout, clearTimeout, requestAnimationFrame, performance } = GameEngine.clock;
  const Core = window.SnakeCore;
  const Sound = window.SnakeAudio;

  /* ── Constants ── */
  const CANVAS_SIZE = 600;
  const CELL        = 20;
  const COLS        = CANVAS_SIZE / CELL;   // 30
  const ROWS        = CANVAS_SIZE / CELL;   // 30
  const LS_KEY_PREFIX = "snake_highscores";
  const MAX_SCORES    = 5;
  const MODE_COLORS   = { classic: "#53d769", obstacle: "#e8a030", portal: "#60b0ff" };
  const POWER_STYLE = {
    gold:   { color: "#ffd34d", rgb: "255,211,77",  label: "+50 GOLD" },
    slow:   { color: "#5fb8ff", rgb: "95,184,255",  label: "SLOW-MO" },
    ghost:  { color: "#c08cff", rgb: "192,140,255", label: "GHOST" },
    shrink: { color: "#4ff0e0", rgb: "79,240,224",  label: "SHRINK!" }
  };
  const KEY_DIRS = {
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right"
  };

  /* ── DOM refs ── */
  const canvas       = document.getElementById("game-canvas");
  const ctx          = canvas.getContext("2d");
  GameEngine.sharpCanvas(canvas);
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
      modeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      gameMode = btn.dataset.mode;
      updateHUD();
      startDemo();
    });
  });

  /* ── Game State ── */
  let game = null;
  let prev = [];
  let phase = "demo";
  let acc = 0;
  let lastTime = performance.now();
  let fx = [];
  let bulges = [];
  let shakeTime = 0, shakeMax = 1, shakeAmp = 0;
  let flash = null;
  let death = null;
  let foodBorn = 0, powerBorn = 0;
  let lastEatAt = -1e9, streak = 0;
  let nextTongue = 2500, tongueUntil = 0, nextBlink = 3000, blinkUntil = 0;
  let overlayTimer = null;
  const bgCache = new Map();
  const spriteCache = new Map();

  function updateHUD() {
    scoreEl.textContent     = game && phase !== "demo" ? game.score : 0;
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
      scoreList.innerHTML = '<li class="empty">No scores yet</li>';
      return;
    }
    scores.forEach((s, i) => {
      const li   = document.createElement("li");
      li.innerHTML = `<span class="rank">#${i + 1}</span><span class="pts">${s}</span>`;
      scoreList.appendChild(li);
    });
  }

  function cellCenter(c) {
    return [c.x * CELL + CELL / 2, c.y * CELL + CELL / 2];
  }

  /* ── Particles ── */
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.5 + Math.random()) * (speed || 3);
      fx.push({ k: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 1.5 + Math.random() * 2.5, color, life: 400 + Math.random() * 400, max: 800 });
    }
  }

  /* ── Floating texts (for near-miss, etc.) ── */
  function popup(x, y, text, color, big) {
    fx.push({ k: "popup", x, y, text, color, big: !!big, life: 900, max: 900 });
  }

  function banner(text, color) {
    fx.push({ k: "banner", text, color, life: 1300, max: 1300 });
  }

  function shake(ms, amp) {
    if (ms >= shakeTime) { shakeTime = ms; shakeMax = ms; }
    shakeAmp = Math.max(amp, shakeTime > 0 ? shakeAmp : 0);
  }

  function demoTurn() {
    const head = game.snake[0];
    const options = Object.keys(Core.DIRS).filter(d => {
      const v = Core.DIRS[d], cur = Core.DIRS[game.dir];
      if (v.x + cur.x === 0 && v.y + cur.y === 0) return false;
      const nx = head.x + v.x, ny = head.y + v.y;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return false;
      return !game.snake.slice(0, -1).some(c => c.x === nx && c.y === ny) && !game.obstacles.some(c => c.x === nx && c.y === ny);
    });
    if (!options.length) return;
    const dist = d => Math.abs(head.x + Core.DIRS[d].x - game.food.x) + Math.abs(head.y + Core.DIRS[d].y - game.food.y);
    options.sort((a, b) => dist(a) - dist(b));
    const pick = Math.random() < 0.85 ? options[0] : options[options.length - 1];
    if (pick !== game.dir) Core.turn(game, pick);
  }

  function startDemo() {
    clearTimeout(overlayTimer);
    phase = "demo";
    game = Core.create({ mode: gameMode });
    game.speed = 110;
    prev = game.snake.map(c => ({ ...c }));
    acc = 0;
    fx = [];
    bulges = [];
    death = null;
    foodBorn = performance.now();
    updateHUD();
  }

  /* ── Start / Restart ── */
  function startGame() {
    GameEngine.audio();
    clearTimeout(overlayTimer);
    startOverlay.classList.add("hidden");
    overOverlay.classList.add("hidden");
    game = Core.create({ mode: gameMode });
    prev = game.snake.map(c => ({ ...c }));
    phase = "play";
    acc = 0;
    fx = [];
    bulges = [];
    death = null;
    flash = null;
    streak = 0;
    lastEatAt = -1e9;
    foodBorn = performance.now();
    updateHUD();
    if (window.GamePlatform) { GamePlatform.resetTimer(); GamePlatform.startTimer(); GamePlatform.updateScore(0); }
    Sound.setSpeed(game.speed);
    Sound.sfx("start");
    Sound.music.start();
  }

  function handle(events, now) {
    const audible = phase === "play";
    const sfx = (name, arg) => { if (audible) Sound.sfx(name, arg); };
    for (const e of events) {
      if (e.type === "eat") {
        const [x, y] = cellCenter(e);
        streak = now - lastEatAt < 2600 ? streak + 1 : 0;
        lastEatAt = now;
        burst(x, y, "#ff5f6d", 14, 3);
        burst(x, y, "#ffd0d4", 6, 2);
        popup(x, y - 6, "+10", "#ffb3ba");
        bulges.push({ i: 0 });
        foodBorn = now;
        sfx("eat", streak);
        if (audible) Sound.setSpeed(game.speed);
      } else if (e.type === "power") {
        const st = POWER_STYLE[e.kind];
        const [x, y] = cellCenter(e);
        burst(x, y, st.color, 22, 4);
        fx.push({ k: "ring", x, y, color: st.rgb, life: 500, max: 500 });
        banner(st.label, st.color);
        flash = { color: st.rgb, life: 260, max: 260 };
        if (e.kind === "gold") popup(x, y - 8, "+50", st.color, true);
        sfx(e.kind);
      } else if (e.type === "powerSpawn") {
        powerBorn = now;
        sfx("powerSpawn");
      } else if (e.type === "powerExpire") {
        const [x, y] = cellCenter(e.power);
        burst(x, y, POWER_STYLE[e.power.type].color, 8, 1.5);
        sfx("expire");
      } else if (e.type === "shrunk") {
        for (const c of e.cells) burst(c.x * CELL + CELL / 2, c.y * CELL + CELL / 2, "#4ff0e0", 6, 2.5);
      } else if (e.type === "near") {
        const [x, y] = cellCenter(e);
        popup(x, y - 10, "\u26A1 CLOSE! +2", "#ffee55");
        burst(x, y, "#ffee55", 8, 2);
        sfx("near");
      } else if (e.type === "wrap") {
        // If wrapped, spawn particles at exit and entry
        // exit point (where the snake left)
        burst(e.from.x * CELL + CELL / 2, e.from.y * CELL + CELL / 2, "#60b0ff", 10, 2.5);
        // entry point
        burst(e.to.x * CELL + CELL / 2, e.to.y * CELL + CELL / 2, "#60b0ff", 10, 2.5);
        sfx("wrap");
      } else if (e.type === "obstacles") {
        for (const c of e.cells) fx.push({ k: "grow", x: c.x, y: c.y, life: 400, max: 400 });
        shake(160, 2);
        sfx("obstacles");
      } else if (e.type === "die") {
        startDeath(now);
      }
    }
    if (phase === "play") {
      updateHUD();
      if (window.GamePlatform) GamePlatform.updateScore(game.score);
    }
  }

  function doStep(now) {
    if (phase === "demo") demoTurn();
    prev = game.snake.map(c => ({ ...c }));
    const events = Core.step(game);
    for (const b of bulges) b.i++;
    bulges = bulges.filter(b => b.i < game.snake.length);
    handle(events, now);
  }

  /* ── Game over ── */
  function startDeath(now) {
    if (phase === "demo") { startDemo(); return; }
    phase = "dying";
    death = { start: now, segments: game.snake.map(c => ({ ...c })), burst: 0 };
    bulges = [];
    // screen shake
    shake(450, 7);
    flash = { color: "255,80,90", life: 300, max: 300 };
    Sound.sfx("die");
    Sound.music.stop();
    const score = game.score;
    addScore(score);
    updateHUD();
    if (window.GamePlatform) {
      const t = GamePlatform.stopTimer();
      GamePlatform.recordGame('snake', score, t * 1000, { mode: gameMode });
      GamePlatform.updateScore(score);
    }
    const modeLabel = gameMode.charAt(0).toUpperCase() + gameMode.slice(1);
    finalModeEl.textContent = `${modeLabel} Mode`;
    finalModeEl.style.color = MODE_COLORS[gameMode];
    finalText.textContent = `Score: ${score}`;
    renderLeaderboard();
    overlayTimer = setTimeout(() => {
      phase = "over";
      overOverlay.classList.remove("hidden");
    }, 1100);
  }

  /* ── Draw ── */
  function background(mode, k) {
    const key = mode + "|" + k;
    let layer = bgCache.get(key);
    if (layer) return layer;
    layer = document.createElement("canvas");
    layer.width = layer.height = Math.round(CANVAS_SIZE * k);
    const g = layer.getContext("2d");
    g.scale(k, k);
    const bg = g.createLinearGradient(0, 0, 0, CANVAS_SIZE);
    bg.addColorStop(0, "#0b1530");
    bg.addColorStop(1, "#070c1d");
    g.fillStyle = bg;
    g.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const glow = g.createRadialGradient(CANVAS_SIZE / 2, CANVAS_SIZE / 2, 40, CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.75);
    glow.addColorStop(0, "rgba(40,120,140,0.16)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    // Grid lines (subtle)
    g.strokeStyle = "rgba(120,200,255,0.05)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < COLS; i++) { g.moveTo(i * CELL + 0.5, 0); g.lineTo(i * CELL + 0.5, CANVAS_SIZE); }
    for (let j = 1; j < ROWS; j++) { g.moveTo(0, j * CELL + 0.5); g.lineTo(CANVAS_SIZE, j * CELL + 0.5); }
    g.stroke();
    g.fillStyle = "rgba(140,220,255,0.22)";
    for (let i = 1; i < COLS; i++) for (let j = 1; j < ROWS; j++) g.fillRect(i * CELL - 0.75, j * CELL - 0.75, 1.5, 1.5);
    const vig = g.createRadialGradient(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.35, CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = vig;
    g.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bgCache.set(key, layer);
    return layer;
  }

  function orbSprite(color, rgb, r, k) {
    const key = color + "|" + r + "|" + k;
    let sp = spriteCache.get(key);
    if (sp) return sp;
    const pad = Math.ceil(r * 1.4);
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil((r + pad) * 2 * k);
    const g = c.getContext("2d");
    g.scale(k, k);
    const cx = r + pad;
    // outer glow
    g.shadowColor = "rgba(" + rgb + ",0.9)";
    g.shadowBlur = r * 1.4 * k;
    g.fillStyle = color;
    g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    // food body
    const grad = g.createRadialGradient(cx - r * 0.35, cx - r * 0.4, r * 0.1, cx, cx, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, "rgba(30,10,30,0.9)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.beginPath(); g.ellipse(cx - r * 0.32, cx - r * 0.42, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2); g.fill();
    sp = { canvas: c, half: r + pad };
    spriteCache.set(key, sp);
    return sp;
  }

  function drawSprite(sp, x, y, scale) {
    const s = scale || 1;
    ctx.drawImage(sp.canvas, x - sp.half * s, y - sp.half * s, sp.half * 2 * s, sp.half * 2 * s);
  }

  function unwrap(a, b, size) {
    let d = b - a;
    if (d > size / 2) d -= size;
    if (d < -size / 2) d += size;
    return d;
  }

  function bodyPoints(alpha) {
    const pts = [];
    for (let i = 0; i < game.snake.length; i++) {
      const cur = game.snake[i];
      const from = prev[i] || cur;
      const dx = game.mode === "portal" ? unwrap(from.x, cur.x, COLS) : cur.x - from.x;
      const dy = game.mode === "portal" ? unwrap(from.y, cur.y, ROWS) : cur.y - from.y;
      pts.push({ x: (from.x + dx * alpha) * CELL + CELL / 2, y: (from.y + dy * alpha) * CELL + CELL / 2 });
    }
    return pts;
  }

  // colour gradient: bright green head -> dark teal tail
  function snakeColor(t) {
    const r = Math.round(125 + (16 - 125) * t), g = Math.round(255 + (150 - 255) * t), b = Math.round(176 + (130 - 176) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawSnakeAt(pts, now, ox, oy) {
    const n = pts.length;
    if (!n) return;
    const ghost = game.effect && game.effect.type === "ghost";
    const slow = game.effect && game.effect.type === "slow";
    const W = CELL * 0.8;
    ctx.save();
    ctx.translate(ox, oy);
    if (ghost) ctx.globalAlpha = 0.55 + 0.15 * Math.sin(now * 0.012);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const runs = [];
    let run = [pts[0]];
    for (let i = 1; i < n; i++) {
      if (Math.abs(pts[i].x - pts[i - 1].x) > CELL * 1.5 || Math.abs(pts[i].y - pts[i - 1].y) > CELL * 1.5) { runs.push(run); run = []; }
      run.push(pts[i]);
    }
    runs.push(run);
    ctx.shadowColor = ghost ? "rgba(192,140,255,0.9)" : slow ? "rgba(95,184,255,0.9)" : "rgba(60,255,170,0.75)";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = "#0d6b5c";
    const full = Math.max(1, n - 3);
    let seen = 0;
    for (const r of runs) {
      const keep = Math.max(1, Math.min(r.length, full - seen + 1));
      seen += r.length;
      ctx.lineWidth = W;
      ctx.beginPath();
      ctx.moveTo(r[0].x, r[0].y);
      for (let i = 1; i < keep; i++) ctx.lineTo(r[i].x, r[i].y);
      if (keep === 1) ctx.lineTo(r[0].x + 0.01, r[0].y);
      ctx.stroke();
    }
    for (let i = Math.max(1, n - 3); i < n; i++) {
      const a = pts[i], b = pts[i - 1];
      if (Math.abs(a.x - b.x) > CELL * 1.5 || Math.abs(a.y - b.y) > CELL * 1.5) continue;
      ctx.lineWidth = W * Math.min(1, (n - 1 - i) / 3 + 0.45);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let i = n - 1; i > 0; i--) {
      const a = pts[i], b = pts[i - 1];
      if (Math.abs(a.x - b.x) > CELL * 1.5 || Math.abs(a.y - b.y) > CELL * 1.5) continue;
      const taper = Math.min(1, (n - 1 - i) / 3 + 0.45);
      ctx.strokeStyle = ghost ? "rgb(170,130,255)" : snakeColor(i / Math.max(1, n - 1));
      ctx.lineWidth = W * 0.94 * taper;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const bg of bulges) {
      const p = pts[Math.min(n - 1, bg.i)];
      if (!p) continue;
      ctx.fillStyle = snakeColor(bg.i / Math.max(1, n - 1));
      ctx.beginPath(); ctx.arc(p.x, p.y, CELL * 0.56, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = W * 0.22;
    seen = 0;
    for (const r of runs) {
      const keep = Math.min(r.length, n - 2 - seen);
      seen += r.length;
      if (keep < 2) continue;
      ctx.beginPath();
      ctx.moveTo(r[0].x - 2, r[0].y - 2.5);
      for (let i = 1; i < keep; i++) ctx.lineTo(r[i].x - 2, r[i].y - 2.5);
      ctx.stroke();
    }
    const h = pts[0];
    const d = Core.DIRS[game.dir];
    const hg = ctx.createRadialGradient(h.x - 3, h.y - 4, 2, h.x, h.y, CELL * 0.6);
    hg.addColorStop(0, ghost ? "#e6d8ff" : "#d9ffe9");
    hg.addColorStop(0.45, ghost ? "#b08cff" : "#7dffb0");
    hg.addColorStop(1, ghost ? "#6a4ab8" : "#18b98a");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(h.x, h.y, CELL * 0.56, 0, Math.PI * 2); ctx.fill();
    if (now < tongueUntil) {
      const tx = h.x + d.x * CELL * 0.55, ty = h.y + d.y * CELL * 0.55;
      const len = CELL * 0.5, px = -d.y, py = d.x;
      ctx.strokeStyle = "#ff4d6d";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + d.x * len, ty + d.y * len);
      ctx.lineTo(tx + d.x * len * 1.35 + px * 3, ty + d.y * len * 1.35 + py * 3);
      ctx.moveTo(tx + d.x * len, ty + d.y * len);
      ctx.lineTo(tx + d.x * len * 1.35 - px * 3, ty + d.y * len * 1.35 - py * 3);
      ctx.stroke();
    }
    // eyes on head
    const px = -d.y, py = d.x;
    const blink = now < blinkUntil;
    for (const side of [-1, 1]) {
      const ex = h.x + d.x * 3 + px * 4.5 * side, ey = h.y + d.y * 3 + py * 4.5 * side;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      if (blink) ctx.ellipse(ex, ey, 3, 0.8, Math.atan2(d.y, d.x) + Math.PI / 2, 0, Math.PI * 2);
      else ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = "#0b1020";
        ctx.beginPath(); ctx.arc(ex + d.x * 1.2, ey + d.y * 1.2, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPower(p, now, k) {
    const st = POWER_STYLE[p.type];
    const [x, y] = cellCenter(p);
    if (p.ttl < 2000 && Math.floor(now / 120) % 2 === 0) return;
    const born = Math.min(1, (now - powerBorn) / 300);
    const s = (born < 1 ? 1.2 * born : 1) * (1 + 0.08 * Math.sin(now * 0.008));
    drawSprite(orbSprite(st.color, st.rgb, CELL * 0.48, k), x, y, s);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = "rgba(10,12,30,0.85)";
    ctx.fillStyle = "rgba(10,12,30,0.85)";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    if (p.type === "gold") {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 0.4, b = a + Math.PI * 0.2;
        ctx.lineTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5);
        ctx.lineTo(Math.cos(b) * 2.4, Math.sin(b) * 2.4);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.type === "slow") {
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -3.5); ctx.moveTo(0, 0); ctx.lineTo(2.6, 1.2); ctx.stroke();
    } else if (p.type === "ghost") {
      ctx.beginPath();
      ctx.arc(0, -1, 4.5, Math.PI, 0);
      ctx.lineTo(4.5, 4.5); ctx.lineTo(2.2, 3); ctx.lineTo(0, 4.5); ctx.lineTo(-2.2, 3); ctx.lineTo(-4.5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-1.6, -1.2, 1.1, 0, Math.PI * 2); ctx.arc(1.6, -1.2, 1.1, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-5.5, 0); ctx.lineTo(-1.5, 0); ctx.moveTo(-3.5, -2); ctx.lineTo(-1.5, 0); ctx.lineTo(-3.5, 2);
      ctx.moveTo(5.5, 0); ctx.lineTo(1.5, 0); ctx.moveTo(3.5, -2); ctx.lineTo(1.5, 0); ctx.lineTo(3.5, 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── Obstacle drawing ── */
  function drawObstacle(c, scale) {
    const x = c.x * CELL, y = c.y * CELL;
    const s = scale === undefined ? 1 : scale;
    ctx.save();
    ctx.translate(x + CELL / 2, y + CELL / 2);
    ctx.scale(s, s);
    const g = ctx.createLinearGradient(-CELL / 2, -CELL / 2, CELL / 2, CELL / 2);
    g.addColorStop(0, "#ffd08a");
    g.addColorStop(0.5, "#e8902f");
    g.addColorStop(1, "#7a3d12");
    ctx.shadowColor = "rgba(255,160,60,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -CELL / 2 + 1); ctx.lineTo(CELL / 2 - 1, 0); ctx.lineTo(0, CELL / 2 - 1); ctx.lineTo(-CELL / 2 + 1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath(); ctx.moveTo(0, -CELL / 2 + 3); ctx.lineTo(CELL / 4, -1); ctx.lineTo(0, 0); ctx.lineTo(-CELL / 4, -1); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ── Portal edge glow ── */
  function drawPortalEdges(now) {
    const a = 0.18 + 0.08 * Math.sin(now * 0.003);
    const w = 16;
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
      [0, 0, w, 0, 0, 0, w, CANVAS_SIZE], [CANVAS_SIZE, 0, CANVAS_SIZE - w, 0, CANVAS_SIZE - w, 0, w, CANVAS_SIZE],
      [0, 0, 0, w, 0, 0, CANVAS_SIZE, w], [0, CANVAS_SIZE, 0, CANVAS_SIZE - w, 0, CANVAS_SIZE - w, CANVAS_SIZE, w]]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(96,176,255," + a + ")");
      g.addColorStop(1, "rgba(96,176,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.strokeStyle = "rgba(140,200,255,0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.lineDashOffset = -now * 0.05;
    ctx.strokeRect(1, 1, CANVAS_SIZE - 2, CANVAS_SIZE - 2);
    ctx.setLineDash([]);
  }

  function drawEffectPill(now) {
    if (!game.effect || phase !== "play") return;
    const st = POWER_STYLE[game.effect.type];
    const frac = Math.max(0, game.effect.ms / game.effect.max);
    const x = 12, y = 12, w = 128, h = 24;
    ctx.save();
    ctx.fillStyle = "rgba(8,12,28,0.72)";
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = "rgba(" + st.rgb + ",0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(" + st.rgb + ",0.85)";
    ctx.beginPath(); ctx.roundRect(x + 4, y + h - 7, (w - 8) * frac, 3, 2); ctx.fill();
    ctx.font = '800 11px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillStyle = st.color;
    ctx.fillText(st.label, x + 12, y + 10);
    ctx.restore();
  }

  function drawFx() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const f of fx) {
      if (f.k !== "spark") continue;
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.5);
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    }
    ctx.restore();
    for (const f of fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === "ring") {
        ctx.strokeStyle = "rgba(" + f.color + "," + a + ")";
        ctx.lineWidth = 3 * a + 0.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, CELL * (0.4 + (1 - a) * 2.4), 0, Math.PI * 2); ctx.stroke();
      } else if (f.k === "popup") {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = (f.big ? "900 18px" : "800 13px") + ' "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = "center";
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - (1 - a) * 26);
        ctx.restore();
      } else if (f.k === "banner") {
        const age = f.max - f.life;
        const s = age < 140 ? 0.6 + 0.5 * (age / 140) : age < 220 ? 1.1 - 0.1 * ((age - 140) / 80) : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life / 300);
        ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE * 0.3);
        ctx.scale(s, s);
        ctx.font = '900 34px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(5,8,20,0.85)";
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, 0, 0);
        ctx.restore();
      }
    }
  }

  function render(now, alpha) {
    const k = ctx.getTransform().a || 1;
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeAmp * (shakeTime / shakeMax);
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }
    ctx.drawImage(background(game.mode, k), 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    // Portal mode: edge glow
    if (game.mode === "portal") drawPortalEdges(now);
    // Obstacle mode: draw obstacles
    const growing = new Map(fx.filter(f => f.k === "grow").map(f => [f.x + "," + f.y, 1 - f.life / f.max]));
    for (const c of game.obstacles) drawObstacle(c, growing.has(c.x + "," + c.y) ? Math.min(1, growing.get(c.x + "," + c.y) * 1.3) : 1);
    // Food (glow + pulse)
    if (game.food && phase !== "dying") {
      const [fxp, fyp] = cellCenter(game.food);
      const born = Math.min(1, (now - foodBorn) / 260);
      const s = (born < 1 ? 1.25 * born : 1) * (1 + 0.1 * Math.sin(now * 0.006));
      drawSprite(orbSprite("#ff5f6d", "255,95,109", CELL * 0.42, k), fxp, fyp, s);
      ctx.fillStyle = "rgba(255,220,225,0.9)";
      for (let i = 0; i < 3; i++) {
        const a = now * 0.003 + i * Math.PI * 2 / 3;
        ctx.fillRect(fxp + Math.cos(a) * CELL * 0.75 - 1, fyp + Math.sin(a) * CELL * 0.75 - 1, 2, 2);
      }
    }
    if (game.power) drawPower(game.power, now, k);
    // Snake
    if (phase === "dying" && death) {
      const elapsed = now - death.start;
      const gone = Math.floor(Math.max(0, elapsed - 150) / 22);
      if (elapsed < 150 && Math.floor(elapsed / 50) % 2 === 0) ctx.globalAlpha = 0.5;
      const pts = death.segments.slice(gone).map(c => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 }));
      if (pts.length) drawSnakeAt(pts, now, 0, 0);
      ctx.globalAlpha = 1;
      while (death.burst < gone && death.burst < death.segments.length) {
        const c = death.segments[death.burst];
        burst(c.x * CELL + CELL / 2, c.y * CELL + CELL / 2, snakeColor(death.burst / Math.max(1, death.segments.length - 1)), 7, 3);
        death.burst++;
      }
    } else {
      const pts = bodyPoints(alpha);
      drawSnakeAt(pts, now, 0, 0);
      if (game.mode === "portal") {
        const h = pts[0];
        if (h.x < CELL) drawSnakeAt(pts, now, CANVAS_SIZE, 0);
        else if (h.x > CANVAS_SIZE - CELL) drawSnakeAt(pts, now, -CANVAS_SIZE, 0);
        if (h.y < CELL) drawSnakeAt(pts, now, 0, CANVAS_SIZE);
        else if (h.y > CANVAS_SIZE - CELL) drawSnakeAt(pts, now, 0, -CANVAS_SIZE);
      }
    }
    // Particles on top
    drawFx();
    drawEffectPill(now);
    if (flash) {
      ctx.fillStyle = "rgba(" + flash.color + "," + 0.28 * (flash.life / flash.max) + ")";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    ctx.restore();
  }

  function updateFx(dt, now) {
    const step = dt / 16.67;
    for (const f of fx) {
      f.life -= dt;
      if (f.k === "spark") {
        f.x += f.vx * step;
        f.y += f.vy * step;
        f.vx *= Math.pow(0.95, step);
        f.vy *= Math.pow(0.95, step);
      }
    }
    fx = fx.filter(f => f.life > 0);
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (flash && (flash.life -= dt) <= 0) flash = null;
    if (now > nextTongue) { tongueUntil = now + 200; nextTongue = now + 2200 + Math.random() * 2600; }
    if (now > nextBlink) { blinkUntil = now + 130; nextBlink = now + 2500 + Math.random() * 3500; }
  }

  /* ── Game loop (fixed-interval logic tick) ── */
  function frame(now) {
    const dt = Math.min(now - lastTime, 100);
    lastTime = now;
    if (phase === "play" || phase === "demo") {
      acc += dt;
      let guard = 0;
      while (game.alive && acc >= Core.tickMs(game) && guard++ < 6) {
        acc -= Core.tickMs(game);
        doStep(now);
        if (phase !== "play" && phase !== "demo") break;
      }
      if (guard >= 6) acc = 0;
    }
    updateFx(dt, now);
    const alpha = phase === "play" || phase === "demo" ? Math.min(1, acc / Core.tickMs(game)) : 1;
    render(now, alpha);
    Sound.update();
    requestAnimationFrame(frame);
  }

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  function syncMusicButton() {
    const btn = document.querySelector("#gp-header .gp-btn-music");
    if (!btn) return;
    const on = Sound.music.isEnabled();
    btn.classList.toggle("off", !on);
    btn.title = on ? "Music on (M)" : "Music off (M)";
    btn.setAttribute("aria-pressed", String(on));
  }

  function toggleMusic() {
    Sound.music.setEnabled(!Sound.music.isEnabled());
    syncMusicButton();
  }

  function addMusicButton() {
    const actions = document.querySelector("#gp-header .gp-header-actions");
    if (!actions || actions.querySelector(".gp-btn-music")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gp-btn-music";
    btn.textContent = "\u{1F3B5}";
    btn.addEventListener("click", event => {
      event.preventDefault();
      btn.blur();
      toggleMusic();
    });
    actions.insertBefore(btn, actions.querySelector(".gp-btn-sound"));
    syncMusicButton();
  }

  /* ── Keyboard input ── */
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyM") {
      if (!e.repeat) toggleMusic();
      return;
    }
    const dir = KEY_DIRS[e.code];
    if (!dir) return;
    e.preventDefault();
    // Start game on any mapped key if on start screen
    if (!startOverlay.classList.contains("hidden")) { startGame(); return; }
    if (phase === "play") Core.turn(game, dir);
  });

  /* ── Touch / Swipe input ── */
  let touchX = 0, touchY = 0;

  function trySwipe(cx, cy) {
    if (phase !== "play") return;
    const dx = cx - touchX, dy = cy - touchY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    Core.turn(game, dir);
    touchX = cx;
    touchY = cy;
  }

  canvas.addEventListener("touchstart", (e) => {
    if (!startOverlay.classList.contains("hidden")) { startGame(); return; }
    const t = e.touches[0];
    touchX = t.clientX;
    touchY = t.clientY;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const t = e.touches[0];
    trySwipe(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    trySwipe(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });

  /* ── Initial render ── */
  if (window.GamePlatform) {
    GamePlatform.initHeader('Snake');
  }
  addMusicButton();
  startDemo();
  lastTime = performance.now();
  requestAnimationFrame(frame);
  GameEngine.pausable({ isActive: () => phase === "play", container });
})();
