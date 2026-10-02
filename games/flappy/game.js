/* ============================================================
   Flappy Bird Clone  -  Pure JS / Canvas / Web Audio
   ============================================================ */

(() => {
  "use strict";

  const { setTimeout, clearTimeout, requestAnimationFrame, performance } = GameEngine.clock;
  const Sound = window.FlappyAudio;

  /* ── DOM refs ── */
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  GameEngine.sharpCanvas(canvas);
  const hudScore = document.getElementById("hud-score");
  const hudMilestone = document.getElementById("hud-milestone");
  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const finalScoreEl = document.getElementById("final-score");
  const finalBestEl = document.getElementById("final-best");
  const finalCoinsEl = document.getElementById("final-coins");
  const finalMedalEl = document.getElementById("final-medal");
  const highscoreList = document.getElementById("highscore-list");
  const playAgainBtn = document.getElementById("play-again-btn");
  const ghostCheckbox = document.getElementById("ghost-checkbox");
  const modeBtns = document.querySelectorAll(".mode-btn");
  const skinPicker = document.getElementById("skin-picker");
  const coinBankEl = document.getElementById("coin-bank");

  const W = canvas.width;   // 400
  const H = canvas.height;  // 600

  /* ── Constants ── */
  const GRAVITY = 0.45;
  const FLAP_STRENGTH = -7.5;
  const BIRD_X = 80;
  const BIRD_RADIUS = 15;
  const PIPE_WIDTH = 56;
  const PIPE_SPEED = 2.8;
  const BASE_GAP = 160;
  const MIN_GAP = 110;
  const GAP_SHRINK_PER_POINT = 1.2;
  const PIPE_SPAWN_DIST = 220;
  const GROUND_HEIGHT = 60;
  const STEP = 1000 / 60;
  const COIN_R = 9;
  const MOVING_FROM = 20;
  const SKINS = [
    { id: "sunny",  name: "Sunny",  cost: 0,   body: ["#fff27a", "#ffcf1f", "#e39b00"], wing: "#f2a900", belly: "#fff7cc" },
    { id: "cherry", name: "Cherry", cost: 25,  body: ["#ffb0bc", "#ff4d6d", "#c21d43"], wing: "#e0365a", belly: "#ffe0e5" },
    { id: "ocean",  name: "Ocean",  cost: 60,  body: ["#b5ebff", "#38b6ff", "#1774c9"], wing: "#2a8fe0", belly: "#e3f7ff" },
    { id: "mint",   name: "Mint",   cost: 120, body: ["#c8ffdc", "#3ddc84", "#17924f"], wing: "#22b366", belly: "#e8fff1" }
  ];
  const MEDALS = [
    { name: "Platinum", score: 50, cls: "platinum" },
    { name: "Gold",     score: 30, cls: "gold" },
    { name: "Silver",   score: 20, cls: "silver" },
    { name: "Bronze",   score: 10, cls: "bronze" }
  ];

  /* ── Mode state (per-session, not persisted) ── */
  let modeReverse = false;
  let modeNight = false;
  let showGhost = true;

  /* ── Milestones ── */
  const MILESTONES = [
    { score: 10,  title: "Rookie",     color: "#33cc66" },
    { score: 25,  title: "Skilled",    color: "#00cccc" },
    { score: 50,  title: "Expert",     color: "#bb44ff" },
    { score: 100, title: "Insane",     color: "#ffd700" },
    { score: 150, title: "Legendary",  color: "#ff3344" },
  ];
  let currentMilestoneIdx = -1;

  /* ── Ghost (previous best run) ── */
  const GHOST_LS_KEY = "flappy_ghost";
  let ghostRecording = [];   // {t, y, s} entries this run
  let ghostPlayback = null;  // {version, score, data:[{t,y,s}]} from best run or null
  let ghostVisible = true;
  let newRecordShown = false;
  let gameElapsed = 0;       // ms of play since the game started

  /* ── Game state ── */
  let state = "start"; // start | playing | dead
  let bird, pipes, fx, score, coins, scroll, prevScroll;
  let acc = 0, lastTime = performance.now(), clock = 0;
  let deathFlash = 0, shakeTime = 0, shakeMax = 1, shakeAmp = 0;
  let overlayTimer = null;
  let skin = SKINS[0];
  let stars = [];

  /* ── Ghost load/save ── */
  function loadGhost() {
    try {
      const raw = localStorage.getItem(GHOST_LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Version 2 format: { version: 2, score: N, data: [{t,y,s},...] }
      if (parsed && parsed.version === 2 && Array.isArray(parsed.data)) {
        return parsed;
      }
      // Old format (plain array of Y values) – discard and start fresh
      localStorage.removeItem(GHOST_LS_KEY);
      return null;
    } catch { return null; }
  }

  function saveGhost(recording, finalScore) {
    try {
      const ghost = {
        version: 2,
        score: finalScore,
        data: recording,
      };
      localStorage.setItem(GHOST_LS_KEY, JSON.stringify(ghost));
    } catch { /* quota exceeded, ignore */ }
  }

  /* ── Ghost time-based lookup ── */
  function ghostLookup(elapsed) {
    // Returns { y, s } interpolated from ghost data at the given elapsed time,
    // or null if elapsed is past the ghost's recording.
    if (!ghostPlayback || !ghostPlayback.data || ghostPlayback.data.length === 0) return null;
    const data = ghostPlayback.data;
    if (elapsed <= data[0].t) return { y: data[0].y, s: data[0].s };
    if (elapsed >= data[data.length - 1].t) return null; // past the ghost

    // Binary search for the bracket
    let lo = 0, hi = data.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (data[mid].t <= elapsed) lo = mid;
      else hi = mid;
    }
    const a = data[lo], b = data[hi];
    const frac = (b.t === a.t) ? 0 : (elapsed - a.t) / (b.t - a.t);
    return {
      y: a.y + (b.y - a.y) * frac,
      s: a.s, // score is a step function – use the earlier entry's score
    };
  }

  /* ── High scores (localStorage) ── */
  const LS_KEY = "flappybird_highscores";

  function loadHighScores() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LS_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHighScore(s) {
    const scores = loadHighScores();
    scores.push(s);
    scores.sort((a, b) => b - a);
    const top5 = scores.slice(0, 5);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(top5));
    } catch { /* storage full or unavailable, ignore */ }
    return top5;
  }

  function renderHighScores(scores) {
    highscoreList.innerHTML = "";
    scores.forEach((s, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="rank">${i + 1}.</span> ${s}`;
      highscoreList.appendChild(li);
    });
  }

  function lifetimeCoins() {
    try { return Number(localStorage.getItem("flappy_coins")) || 0; } catch { return 0; }
  }

  function addCoins(n) {
    try { localStorage.setItem("flappy_coins", String(lifetimeCoins() + n)); } catch { }
  }

  function loadSkin() {
    let id = "sunny";
    try { id = localStorage.getItem("flappy_skin") || "sunny"; } catch { }
    const s = SKINS.find(k => k.id === id);
    return s && s.cost <= lifetimeCoins() ? s : SKINS[0];
  }

  function renderSkins() {
    const bank = lifetimeCoins();
    coinBankEl.textContent = bank;
    skinPicker.innerHTML = "";
    for (const s of SKINS) {
      const b = document.createElement("button");
      b.type = "button";
      const locked = s.cost > bank;
      b.className = "skin-btn" + (s === skin ? " active" : "") + (locked ? " locked" : "");
      b.style.setProperty("--skin", s.body[1]);
      b.style.setProperty("--skin-light", s.body[0]);
      b.title = locked ? s.name + ": collect " + s.cost + " coins to unlock" : s.name;
      b.setAttribute("aria-label", b.title);
      b.innerHTML = locked ? "<span>" + s.cost + "</span>" : "";
      b.addEventListener("click", e => {
        e.stopPropagation();
        if (locked) return;
        skin = s;
        try { localStorage.setItem("flappy_skin", s.id); } catch { }
        renderSkins();
      });
      skinPicker.appendChild(b);
    }
  }

  /* ── Init / Reset ── */
  function reset() {
    const startY = modeReverse ? H - GROUND_HEIGHT - 100 : H / 2 - 40;
    bird = { y: startY, py: startY, vy: 0, rot: 0, prot: 0, flapT: 999, squash: 0 };
    pipes = [];
    fx = [];
    score = 0;
    coins = 0;
    scroll = prevScroll = 0;
    deathFlash = 0;
    hudScore.textContent = "0";
    hudMilestone.textContent = "";
    hudMilestone.style.color = "";
    currentMilestoneIdx = -1;
    ghostRecording = [];
    gameElapsed = 0;
    ghostVisible = true;
    newRecordShown = false;
    ghostPlayback = showGhost ? loadGhost() : null;
    stars = [];
    for (let i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * (H - GROUND_HEIGHT - 120), r: Math.random() * 1.6 + 0.4, tw: Math.random() * 6 });
  }

  /* ── Pipe creation ── */
  function currentGap() {
    return Math.max(MIN_GAP, BASE_GAP - score * GAP_SHRINK_PER_POINT);
  }

  function spawnPipe() {
    const gap = currentGap();
    const minTop = 60;
    const maxTop = H - GROUND_HEIGHT - gap - 60;
    const topH = Math.random() * (maxTop - minTop) + minTop;
    const p = { x: W + 20, px: W + 20, base: topH, topH, gap, scored: false, move: null, coin: null };
    const moveChance = score < MOVING_FROM ? 0 : Math.min(0.65, 0.3 + (score - MOVING_FROM) * 0.015);
    if (Math.random() < moveChance) {
      const amp = Math.min(46, (maxTop - minTop) / 2 - 4);
      p.move = { amp: amp * (0.6 + Math.random() * 0.4), speed: 0.018 + Math.random() * 0.014, phase: Math.random() * Math.PI * 2 };
      p.base = Math.min(maxTop - p.move.amp, Math.max(minTop + p.move.amp, topH));
    }
    if (Math.random() < 0.45) p.coin = { taken: false, bob: Math.random() * 6 };
    pipes.push(p);
  }

  function pipeTop(p) {
    return p.move ? p.base + Math.sin(p.move.phase) * p.move.amp : p.base;
  }

  /* ── Input ── */
  function getGravity() { return modeReverse ? -GRAVITY : GRAVITY; }
  function getFlapStrength() { return modeReverse ? -FLAP_STRENGTH : FLAP_STRENGTH; }

  /* ── Particles ── */
  function feathers(x, y, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * (speed || 1.6);
      fx.push({ k: "feather", x, y, vx: Math.cos(a) * sp - 1, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, color: Math.random() < 0.6 ? skin.body[1] : skin.belly, life: 700 + Math.random() * 500, max: 1200 });
    }
  }

  function sparkle(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
      fx.push({ k: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, size: 1.5 + Math.random() * 2.5, life: 400 + Math.random() * 300, max: 700 });
    }
  }

  function popup(x, y, text, color, size) {
    fx.push({ k: "popup", x, y, text, color, size: size || 16, life: 800, max: 800 });
  }

  function banner(text, color) {
    fx.push({ k: "banner", text, color, life: 1600, max: 1600 });
  }

  function shake(ms, amp) {
    if (ms >= shakeTime) { shakeTime = ms; shakeMax = ms; }
    shakeAmp = Math.max(amp, shakeTime > 0 ? shakeAmp : 0);
  }

  function flap() {
    if (state === "start") {
      GameEngine.audio();
      state = "playing";
      startOverlay.classList.add("hidden");
      reset();
      acc = 0;
      bird.vy = getFlapStrength();
      bird.flapT = 0;
      bird.squash = 1;
      Sound.sfx("start");
      Sound.sfx("flap");
      Sound.music.start();
      if (window.GamePlatform) { GamePlatform.resetTimer(); GamePlatform.startTimer(); GamePlatform.updateScore(0); }
      return;
    }
    if (state === "playing") {
      bird.vy = getFlapStrength();
      bird.flapT = 0;
      bird.squash = 1;
      Sound.sfx("flap");
      // Trail burst on flap
      feathers(BIRD_X - 8, bird.y, 2, 1.2);
    }
  }

  function handleInput(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.type === "keydown" && e.code === "KeyM") {
      if (!e.repeat) toggleMusic();
      return;
    }
    if (e.type === "keydown" && e.code !== "Space" && e.code !== "ArrowUp" && e.code !== "KeyW") return;
    if (e.type === "keydown") e.preventDefault();
    if (e.repeat) return;
    flap();
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  });
  document.addEventListener("keydown", handleInput);

  // Start overlay tap handler (canvas is behind overlay on mobile)
  startOverlay.addEventListener("pointerdown", (e) => {
    // Don't start if tapping mode buttons or ghost checkbox
    if (e.target.closest(".mode-btn") || e.target.closest(".ghost-toggle") || e.target.closest(".skin-btn")) return;
    e.preventDefault();
    flap();
  });

  playAgainBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(overlayTimer);
    gameoverOverlay.classList.add("hidden");
    state = "start";
    reset();
    renderSkins();
    startOverlay.classList.remove("hidden");
  });

  /* ── Collision ── */
  function checkCollision() {
    // Ground / ceiling
    if (bird.y + BIRD_RADIUS >= H - GROUND_HEIGHT) return true;
    if (bird.y - BIRD_RADIUS <= 0) return true;

    // Pipes
    for (const p of pipes) {
      const bLeft = BIRD_X - BIRD_RADIUS;
      const bRight = BIRD_X + BIRD_RADIUS;
      const bTop = bird.y - BIRD_RADIUS;
      const bBottom = bird.y + BIRD_RADIUS;

      if (bRight > p.x && bLeft < p.x + PIPE_WIDTH) {
        // Top pipe
        if (bTop < p.topH) return true;
        // Bottom pipe
        if (bBottom > p.topH + p.gap) return true;
      }
    }
    return false;
  }

  function medalFor(s) {
    return MEDALS.find(m => s >= m.score) || null;
  }

  /* ── Die ── */
  function die() {
    state = "dead";
    Sound.sfx("hit");
    Sound.sfx("fall");
    Sound.music.stop();
    deathFlash = 1;
    shake(380, 7);
    feathers(BIRD_X, bird.y, 18, 3);
    sparkle(BIRD_X, bird.y, "#ffffff", 10);
    // Save ghost if this is the best run (compare scores)
    const prevGhost = loadGhost();
    if (!prevGhost || score > (prevGhost.score || 0)) {
      saveGhost(ghostRecording, score);
    }
    const before = lifetimeCoins();
    addCoins(coins);
    const unlocked = SKINS.filter(s => s.cost > before && s.cost <= before + coins);
    const prevBest = loadHighScores()[0] || 0;
    const top5 = saveHighScore(score);
    if (window.GamePlatform) {
      const t = GamePlatform.stopTimer();
      GamePlatform.recordGame('flappy', score, t * 1000, { coins });
      GamePlatform.updateScore(score);
    }
    finalScoreEl.textContent = score;
    finalBestEl.textContent = Math.max(prevBest, score);
    finalCoinsEl.textContent = coins + (unlocked.length ? " \u00B7 " + unlocked.map(s => s.name).join(", ") + " unlocked!" : "");
    const medal = medalFor(score);
    finalMedalEl.className = "medal " + (medal ? medal.cls : "none");
    finalMedalEl.title = medal ? medal.name + " medal" : "Score 10 for a medal";
    finalMedalEl.querySelector("span").textContent = medal ? medal.name : "No medal";
    finalMedalEl.classList.toggle("new-best", score > prevBest && score > 0);
    renderHighScores(top5);
    overlayTimer = setTimeout(() => {
      gameoverOverlay.classList.remove("hidden");
      if (medal) Sound.sfx("medal");
      if (unlocked.length) Sound.sfx("unlock");
    }, 900);
  }

  /* ── Milestone check ── */
  function checkMilestones() {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (score >= MILESTONES[i].score && i > currentMilestoneIdx) {
        currentMilestoneIdx = i;
        const m = MILESTONES[i];
        hudMilestone.textContent = m.title;
        hudMilestone.style.color = m.color;
        // Spawn floating milestone text
        banner(m.title, m.color);
        for (let k = 0; k < 4; k++) sparkle(60 + Math.random() * (W - 120), 140 + Math.random() * 120, m.color, 8);
        Sound.sfx("milestone");
        break;
      }
    }
  }

  /* ── Update ── */
  function step() {
    bird.py = bird.y;
    bird.prot = bird.rot;
    prevScroll = scroll;
    for (const p of pipes) { p.px = p.x; p.ptop = p.topH; }
    bird.flapT++;
    bird.squash *= 0.86;
    const grav = getGravity();
    if (state === "start") {
      scroll += 0.6;
      return;
    }
    // Bird physics (keep updating briefly when dead for fall anim)
    bird.vy += grav;
    bird.y += bird.vy;
    if (state === "dead") {
      // Dead: bird falls
      if (modeReverse) { if (bird.y < -50) bird.y = -50; }
      else if (bird.y > H + 50) bird.y = H + 50;
    } else {
      // Update elapsed time
      gameElapsed += STEP;
      // Record ghost position with time and score
      ghostRecording.push({ t: gameElapsed, y: bird.y, s: score });
      // Ghost playback: check if we've surpassed the ghost's duration
      if (ghostPlayback && ghostVisible && ghostLookup(gameElapsed) === null) {
        ghostVisible = false;
        if (!newRecordShown && score > 0) {
          newRecordShown = true;
          banner("New Record!", "#ffd34d");
          Sound.sfx("record");
        }
      }
    }
    // Bird rotation
    const targetRot = state === "playing"
      ? (modeReverse ? Math.max(bird.vy * 0.06, -Math.PI / 3) : Math.min(bird.vy * 0.06, Math.PI / 3))
      : (modeReverse ? -Math.PI / 2 : Math.PI / 2);
    bird.rot += (targetRot - bird.rot) * 0.15;
    if (state !== "playing") return;
    // Ground scroll
    scroll += PIPE_SPEED;
    // Pipes
    // Spawn
    if (pipes.length === 0 || pipes[pipes.length - 1].x < W - PIPE_SPAWN_DIST) spawnPipe();
    // Move & score
    for (const p of pipes) {
      p.x -= PIPE_SPEED;
      if (p.move) p.move.phase += p.move.speed;
      p.topH = pipeTop(p);
      if (p.coin && !p.coin.taken) {
        const cx = p.x + PIPE_WIDTH / 2, cy = p.topH + p.gap / 2;
        const dx = cx - BIRD_X, dy = cy - bird.y;
        if (dx * dx + dy * dy < (BIRD_RADIUS + COIN_R) * (BIRD_RADIUS + COIN_R)) {
          p.coin.taken = true;
          coins++;
          sparkle(cx, cy, "#ffd34d", 12);
          popup(cx, cy - 12, "+1 coin", "#ffd34d", 13);
          Sound.sfx("coin");
        }
      }
      if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
        p.scored = true;
        score++;
        hudScore.textContent = score;
        hudScore.classList.remove("bump");
        void hudScore.offsetWidth;
        hudScore.classList.add("bump");
        if (window.GamePlatform) GamePlatform.updateScore(score);
        popup(p.x + PIPE_WIDTH, p.topH + p.gap / 2, "+1", "#ffffff", 18);
        Sound.sfx("score");
        checkMilestones();
      }
    }
    // Remove off-screen
    while (pipes.length && pipes[0].x + PIPE_WIDTH < -10) pipes.shift();
    // Collision
    if (checkCollision()) die();
  }

  function updateFx(dt) {
    const k = dt / 16.67;
    for (const f of fx) {
      f.life -= dt;
      if (f.k === "feather") {
        f.x += f.vx * k;
        f.y += f.vy * k;
        f.vy += 0.05 * k * (modeReverse ? -1 : 1);
        f.vx *= Math.pow(0.97, k);
        f.rot += f.vr * k;
      } else if (f.k === "spark") {
        f.x += f.vx * k;
        f.y += f.vy * k;
        f.vx *= Math.pow(0.94, k);
        f.vy *= Math.pow(0.94, k);
      }
    }
    fx = fx.filter(f => f.life > 0);
    // Death flash fade
    if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt / 450);
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
  }

  /* ── Draw ── */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function cloud(x, y, s, a) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, 18 * s, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + 16 * s, y - 14 * s, 18 * s, Math.PI, Math.PI * 1.85);
    ctx.arc(x + 40 * s, y - 12 * s, 22 * s, Math.PI * 1.15, Math.PI * 1.95);
    ctx.arc(x + 60 * s, y, 16 * s, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackdrop(sc, time) {
    const groundY = H - GROUND_HEIGHT;
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    if (modeNight) {
      sky.addColorStop(0, "#0a1440");
      sky.addColorStop(0.6, "#1d2f6b");
      sky.addColorStop(1, "#3b4f8f");
    } else {
      sky.addColorStop(0, "#3eb9ff");
      sky.addColorStop(0.6, "#8fd9ff");
      sky.addColorStop(1, "#d3f3ff");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY);
    // Stars (night mode uses brighter/more stars)
    if (modeNight) {
      for (const s of stars) {
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 0.002 + s.tw);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
      // Moon (night mode only)
      const mx = W - 70, my = 70;
      // Moon glow
      const glow = ctx.createRadialGradient(mx, my, 10, mx, my, 80);
      glow.addColorStop(0, "rgba(255,248,220,0.35)");
      glow.addColorStop(1, "rgba(255,248,220,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(mx - 80, my - 80, 160, 160);
      // Moon body
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath(); ctx.arc(mx, my, 24, 0, Math.PI * 2); ctx.fill();
      // Craters
      ctx.fillStyle = "rgba(200,190,160,0.4)";
      ctx.beginPath(); ctx.arc(mx - 7, my - 5, 5, 0, Math.PI * 2); ctx.arc(mx + 8, my + 7, 3.5, 0, Math.PI * 2); ctx.fill();
    } else {
      const sx = W - 72, sy = 72;
      const glow = ctx.createRadialGradient(sx, sy, 12, sx, sy, 110);
      glow.addColorStop(0, "rgba(255,247,190,0.85)");
      glow.addColorStop(0.35, "rgba(255,240,170,0.3)");
      glow.addColorStop(1, "rgba(255,240,170,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 110, sy - 110, 220, 220);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(time * 0.0002);
      ctx.fillStyle = "rgba(255,250,210,0.25)";
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(6, -64); ctx.lineTo(-6, -64); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#fff3a6";
      ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
    }
    // Distant clouds / hills (parallax, subtle)
    ctx.fillStyle = modeNight ? "rgba(170,190,255,0.25)" : "#ffffff";
    const farW = 520;
    for (let i = -1; i < 3; i++) {
      const x = ((i * farW - sc * 0.1) % (farW * 2) + farW * 2) % (farW * 2) - farW * 0.5;
      cloud(x, 120, 0.9, modeNight ? 0.5 : 0.75);
      cloud(x + 250, 70, 0.7, modeNight ? 0.4 : 0.6);
    }
    const hill = (speed, base, amp, len, color, off) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= W; x += 6) {
        const wx = x + sc * speed + off;
        ctx.lineTo(x, groundY - base - Math.sin(wx / len) * amp - Math.sin(wx / (len * 0.43)) * amp * 0.35);
      }
      ctx.lineTo(W, groundY);
      ctx.closePath();
      ctx.fill();
    };
    if (modeNight) {
      hill(0.15, 70, 26, 90, "#22336b", 0);
      ctx.fillStyle = "#18244f";
      const bw = 34;
      for (let i = -1; i < 16; i++) {
        const x = i * bw - ((sc * 0.32) % bw);
        const seed = Math.floor((sc * 0.32) / bw) + i;
        const h = 40 + ((seed * 9301 + 49297) % 233280) / 233280 * 80;
        ctx.fillRect(x, groundY - h, bw - 4, h);
        ctx.fillStyle = "rgba(255,220,120,0.75)";
        for (let wy = groundY - h + 8; wy < groundY - 10; wy += 12) {
          for (let wx = x + 5; wx < x + bw - 9; wx += 8) if (((seed * 31 + wy * 7 + wx) % 5) === 0) ctx.fillRect(wx, wy, 3, 4);
        }
        ctx.fillStyle = "#18244f";
      }
      hill(0.5, 18, 10, 60, "#1b3b3a", 400);
    } else {
      hill(0.15, 80, 28, 90, "#a6e3f2", 0);
      hill(0.3, 46, 22, 70, "#7fd3a0", 300);
      hill(0.55, 16, 10, 45, "#5cc276", 800);
    }
    ctx.fillStyle = modeNight ? "rgba(140,160,255,0.35)" : "#ffffff";
    for (let i = -1; i < 3; i++) {
      const x = ((i * 300 - sc * 0.25) % 600 + 600) % 600 - 150;
      cloud(x, 200, 0.55, modeNight ? 0.35 : 0.9);
    }
  }

  function drawPipe(x, topH, gap) {
    const groundY = H - GROUND_HEIGHT;
    const body = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
    const day = !modeNight;
    body.addColorStop(0, day ? "#3fae4f" : "#1e6e57");
    body.addColorStop(0.25, day ? "#86e889" : "#3aa585");
    body.addColorStop(0.55, day ? "#5ccf64" : "#2a8a6c");
    body.addColorStop(1, day ? "#2f8f3d" : "#145243");
    const capH = 24, over = 5;
    const outline = day ? "#1d5e28" : "#0b3329";
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline;
    // Top pipe body
    ctx.fillStyle = body;
    ctx.fillRect(x, -2, PIPE_WIDTH, topH - capH + 2);
    ctx.strokeRect(x, -2, PIPE_WIDTH, topH - capH + 2);
    // Bottom pipe body
    ctx.fillRect(x, topH + gap + capH, PIPE_WIDTH, groundY - topH - gap - capH);
    ctx.strokeRect(x, topH + gap + capH, PIPE_WIDTH, groundY - topH - gap - capH + 2);
    const cap = ctx.createLinearGradient(x - over, 0, x + PIPE_WIDTH + over, 0);
    cap.addColorStop(0, day ? "#47b957" : "#22795f");
    cap.addColorStop(0.25, day ? "#9cf29c" : "#47b896");
    cap.addColorStop(0.55, day ? "#65d86d" : "#2f9576");
    cap.addColorStop(1, day ? "#349a43" : "#175a4a");
    // Top pipe cap
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.roundRect(x - over, topH - capH, PIPE_WIDTH + over * 2, capH, 5); ctx.fill(); ctx.stroke();
    // Bottom pipe cap
    ctx.beginPath(); ctx.roundRect(x - over, topH + gap, PIPE_WIDTH + over * 2, capH, 5); ctx.fill(); ctx.stroke();
    // Pipe highlight
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x + 7, 0, 5, topH - capH - 2);
    ctx.fillRect(x + 7, topH + gap + capH + 2, 5, groundY - topH - gap - capH - 4);
    ctx.fillRect(x - over + 6, topH - capH + 4, 5, capH - 8);
    ctx.fillRect(x - over + 6, topH + gap + 4, 5, capH - 8);
  }

  function drawCoin(x, y, time) {
    const spin = Math.abs(Math.sin(time * 0.006));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.max(0.25, spin), 1);
    ctx.shadowColor = "rgba(255,210,60,0.8)";
    ctx.shadowBlur = 10;
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, COIN_R);
    g.addColorStop(0, "#fff7b0");
    g.addColorStop(0.5, "#ffd23d");
    g.addColorStop(1, "#c98a00");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, COIN_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#a86f00";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, COIN_R - 3, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawGround(sc) {
    const gY = H - GROUND_HEIGHT;
    const day = !modeNight;
    const dirt = ctx.createLinearGradient(0, gY, 0, H);
    dirt.addColorStop(0, day ? "#e9c27a" : "#5b4a33");
    dirt.addColorStop(1, day ? "#c99350" : "#3b2f20");
    ctx.fillStyle = dirt;
    ctx.fillRect(0, gY, W, GROUND_HEIGHT);
    // Ground texture lines
    const off = sc % 24;
    ctx.fillStyle = day ? "rgba(160,100,40,0.25)" : "rgba(0,0,0,0.2)";
    for (let x = -off - 24; x < W + 24; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, gY + 14); ctx.lineTo(x + 12, gY + 14); ctx.lineTo(x + 2, H); ctx.lineTo(x - 10, H); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = day ? "#78d64b" : "#2f6a3a";
    ctx.fillRect(0, gY, W, 12);
    ctx.fillStyle = day ? "#9cec6a" : "#3d8249";
    ctx.fillRect(0, gY, W, 4);
    ctx.fillStyle = day ? "#5bb53a" : "#24532d";
    const goff = sc % 12;
    for (let x = -goff; x < W + 12; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, gY + 12); ctx.lineTo(x + 6, gY + 18); ctx.lineTo(x + 12, gY + 12); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, gY + 18, W, 2);
  }

  function drawBird(y, rot, s, ghost) {
    ctx.save();
    ctx.translate(BIRD_X, y);
    ctx.rotate(rot);
    if (modeReverse) ctx.scale(1, -1);
    const sq = ghost ? 0 : bird.squash;
    ctx.scale(1 - sq * 0.12, 1 + sq * 0.14);
    if (ghost) ctx.globalAlpha = 0.28;
    const R = BIRD_RADIUS;
    if (!ghost) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath(); ctx.ellipse(1, R - 1, R * 0.8, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Body
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, R + 1);
    g.addColorStop(0, s.body[0]);
    g.addColorStop(0.55, s.body[1]);
    g.addColorStop(1, s.body[2]);
    ctx.fillStyle = ghost ? "#cfd6e6" : g;
    ctx.beginPath(); ctx.ellipse(0, 0, R + 1.5, R, 0, 0, Math.PI * 2); ctx.fill();
    // Body outline
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(60,30,0,0.35)";
    ctx.stroke();
    ctx.fillStyle = ghost ? "#e8ecf5" : s.belly;
    ctx.beginPath(); ctx.ellipse(1, 6, R * 0.68, R * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    // Wing
    const flapping = bird.flapT < 12;
    const wingA = ghost ? 0 : flapping ? Math.sin(bird.flapT * 0.9) * 0.9 : Math.sin(clock * 0.004) * 0.25;
    ctx.save();
    ctx.translate(-5, 2);
    ctx.rotate(-0.4 + wingA);
    ctx.fillStyle = ghost ? "#bfc7d8" : s.wing;
    ctx.beginPath(); ctx.ellipse(-4, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(60,30,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // Eye white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(7, -5, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(60,30,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const blink = !ghost && Math.floor(clock / 140) % 30 === 0;
    if (blink) {
      ctx.strokeStyle = "#2a1a10";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(11, -5); ctx.stroke();
    } else {
      // Eye pupil
      ctx.fillStyle = "#1c1430";
      ctx.beginPath(); ctx.arc(9, -4.5, 3.2, 0, Math.PI * 2); ctx.fill();
      // Eye highlight
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(10.2, -6, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    if (!ghost) {
      ctx.fillStyle = "rgba(255,120,140,0.45)";
      ctx.beginPath(); ctx.ellipse(4, 4, 3.2, 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Beak
    ctx.fillStyle = ghost ? "#d9c3b4" : "#ff8a3d";
    ctx.beginPath(); ctx.moveTo(12, -1); ctx.quadraticCurveTo(24, 0, 23, 3); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ghost ? "#cfb3a1" : "#e8611f";
    ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(22, 3); ctx.quadraticCurveTo(19, 7, 12, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFx() {
    for (const f of fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === "feather") {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (f.k === "spark") {
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
        ctx.globalAlpha = 1;
      } else if (f.k === "popup") {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = "900 " + f.size + "px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(20,40,70,0.55)";
        ctx.strokeText(f.text, f.x, f.y - (1 - a) * 30);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - (1 - a) * 30);
        ctx.restore();
      } else if (f.k === "banner") {
        const age = f.max - f.life;
        const s = age < 160 ? 0.5 + 0.6 * (age / 160) : age < 260 ? 1.1 - 0.1 * ((age - 160) / 100) : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life / 350);
        ctx.translate(W / 2, H * 0.3);
        ctx.scale(s, s);
        ctx.font = "900 38px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 7;
        ctx.strokeStyle = "rgba(20,30,60,0.75)";
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, 0, 0);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText(f.text, 0, -2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw(time, alpha) {
    const sc = lerp(prevScroll, scroll, alpha);
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeAmp * (shakeTime / shakeMax);
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }
    drawBackdrop(sc, time);
    // Pipes
    for (const p of pipes) {
      const x = lerp(p.px, p.x, alpha);
      const top = lerp(p.ptop === undefined ? p.topH : p.ptop, p.topH, alpha);
      drawPipe(x, top, p.gap);
      if (p.coin && !p.coin.taken) drawCoin(x + PIPE_WIDTH / 2, top + p.gap / 2 + Math.sin(time * 0.005 + p.coin.bob) * 3, time);
    }
    // Ground
    drawGround(sc);
    // Ghost bird (rendered before real bird so it appears behind)
    if (ghostPlayback && ghostVisible && state === "playing") {
      const ghostInfo = ghostLookup(gameElapsed);
      if (ghostInfo) drawBird(ghostInfo.y, 0, skin, true);
    }
    // Bird
    const by = state === "start" ? bird.y : lerp(bird.py, bird.y, alpha);
    drawBird(by, lerp(bird.prot, bird.rot, alpha), skin, false);
    drawFx();
    // Ghost delta display (how far ahead/behind the ghost)
    if (ghostPlayback && state === "playing") {
      const ghostInfo = ghostLookup(gameElapsed);
      // Ghost has ended – show we're ahead
      const delta = ghostInfo ? score - ghostInfo.s : (newRecordShown ? score - (ghostPlayback.score || 0) : null);
      if (delta !== null && (ghostInfo || delta > 0)) {
        const txt = delta > 0 ? "+" + delta : delta < 0 ? String(delta) : "\u00B10";
        ctx.save();
        ctx.font = "800 14px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = "center";
        const w = ctx.measureText("vs best " + txt).width + 20;
        ctx.fillStyle = "rgba(20,40,80,0.45)";
        ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 14, w, 24, 12); ctx.fill();
        ctx.fillStyle = delta > 0 ? "#7dff9a" : delta < 0 ? "#ff8a96" : "#ffffff";
        ctx.fillText("vs best " + txt, W / 2, 31);
        ctx.restore();
      }
    }
    // Death flash
    if (deathFlash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + deathFlash * 0.85 + ")";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /* ── Main Loop ── */
  function loop(time) {
    const dt = Math.min(time - lastTime, 100);
    lastTime = time;
    clock += dt;
    /* ── Idle animation for start screen ── */
    if (state === "start") {
      // Idle bird bobbing
      const baseY = modeReverse ? H - GROUND_HEIGHT - 100 : H / 2 - 40;
      bird.y = baseY + Math.sin(time * 0.003) * 15;
      bird.rot = Math.sin(time * 0.004) * 0.1;
    }
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 8) {
      acc -= STEP;
      step();
    }
    if (guard >= 8) acc = 0;
    updateFx(dt);
    draw(time, Math.min(1, acc / STEP));
    Sound.update();
    requestAnimationFrame(loop);
  }

  /* ── Mode button handlers ── */
  modeBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = btn.dataset.mode;
      if (mode === "classic") {
        // Classic deselects others, selects itself
        modeReverse = false;
        modeNight = false;
        modeBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      } else if (mode === "reverse") {
        btn.classList.toggle("active");
        modeReverse = btn.classList.contains("active");
        // Deselect classic if a special mode is on
        const classicBtn = document.querySelector('.mode-btn[data-mode="classic"]');
        if (modeReverse || modeNight) {
          classicBtn.classList.remove("active");
        } else {
          classicBtn.classList.add("active");
        }
      } else if (mode === "night") {
        btn.classList.toggle("active");
        modeNight = btn.classList.contains("active");
        const classicBtn = document.querySelector('.mode-btn[data-mode="classic"]');
        if (modeReverse || modeNight) {
          classicBtn.classList.remove("active");
        } else {
          classicBtn.classList.add("active");
        }
      }
      // Re-reset for idle display
      reset();
    });
  });

  ghostCheckbox.addEventListener("change", () => {
    showGhost = ghostCheckbox.checked;
  });

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

  /* ── Bootstrap ── */
  skin = loadSkin();
  reset();
  renderSkins();
  if (window.GamePlatform) {
    GamePlatform.initHeader('Flappy Bird');
  }
  addMusicButton();
  lastTime = performance.now();
  requestAnimationFrame(loop);
  GameEngine.pausable({ isActive: () => state === "playing", container: "#canvas-container" });
})();
