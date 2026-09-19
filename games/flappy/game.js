/* ============================================================
   Flappy Bird Clone  -  Pure JS / Canvas / Web Audio
   ============================================================ */

(() => {
  "use strict";

  /* ── DOM refs ── */
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const hudScore = document.getElementById("hud-score");
  const hudMilestone = document.getElementById("hud-milestone");
  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const finalScoreEl = document.getElementById("final-score");
  const highscoreList = document.getElementById("highscore-list");
  const playAgainBtn = document.getElementById("play-again-btn");
  const ghostCheckbox = document.getElementById("ghost-checkbox");
  const modeBtns = document.querySelectorAll(".mode-btn");

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
  const STAR_COUNT = 60;

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
  let milestoneFloats = [];  // {text, color, y, alpha, scale}

  /* ── Ghost (previous best run) ── */
  const GHOST_LS_KEY = "flappy_ghost";
  let ghostRecording = [];   // Y positions this run
  let ghostPlayback = null;  // Y positions from best run (array or null)
  let ghostFrame = 0;
  let ghostVisible = true;
  let newRecordShown = false;
  let newRecordAlpha = 0;

  /* ── Night-mode stars (separate from default stars) ── */
  let nightStars = [];

  /* ── Game state ── */
  let state = "start"; // start | playing | dead
  let bird, pipes, particles, score, groundX, stars;
  let deathFlashAlpha = 0;
  let frameId = null;
  let lastTime = 0;

  /* ── Audio (Web Audio API) ── */
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTone(freq, duration, type, vol, ramp) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (ramp) osc.frequency.linearRampToValueAtTime(ramp, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol || 0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function sfxFlap() {
    playTone(500, 0.1, "sine", 0.12, 700);
  }

  function sfxScore() {
    playTone(880, 0.08, "sine", 0.08);
    setTimeout(() => playTone(1100, 0.12, "sine", 0.08), 80);
  }

  function sfxCrash() {
    playTone(200, 0.3, "sawtooth", 0.15, 50);
    playTone(120, 0.4, "square", 0.08, 30);
  }

  function sfxMilestone() {
    playTone(660, 0.1, "sine", 0.1);
    setTimeout(() => playTone(880, 0.1, "sine", 0.1), 100);
    setTimeout(() => playTone(1100, 0.15, "sine", 0.12), 200);
    setTimeout(() => playTone(1320, 0.25, "sine", 0.1), 300);
  }

  /* ── Ghost load/save ── */
  function loadGhost() {
    try {
      const data = localStorage.getItem(GHOST_LS_KEY);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }

  function saveGhost(recording) {
    try {
      localStorage.setItem(GHOST_LS_KEY, JSON.stringify(recording));
    } catch { /* quota exceeded, ignore */ }
  }

  /* ── High scores (localStorage) ── */
  const LS_KEY = "flappybird_highscores";

  function loadHighScores() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveHighScore(s) {
    const scores = loadHighScores();
    scores.push(s);
    scores.sort((a, b) => b - a);
    const top5 = scores.slice(0, 5);
    localStorage.setItem(LS_KEY, JSON.stringify(top5));
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

  /* ── Stars (background) ── */
  function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * (H - GROUND_HEIGHT - 80),
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  function initNightStars() {
    nightStars = [];
    for (let i = 0; i < 100; i++) {
      nightStars.push({
        x: Math.random() * W,
        y: Math.random() * (H - GROUND_HEIGHT - 40),
        r: Math.random() * 1.8 + 0.3,
        a: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  /* ── Particles ── */
  function spawnParticle(x, y) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 1.5 - 1,
      vy: (Math.random() - 0.5) * 1.5,
      life: 1,
      decay: Math.random() * 0.03 + 0.02,
      r: Math.random() * 3 + 1.5,
      color: Math.random() > 0.5 ? "#ffd700" : "#ff9500",
    });
  }

  function spawnDeathBurst(x, y) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.02 + 0.01,
        r: Math.random() * 4 + 2,
        color: ["#ff3366", "#ff6633", "#ffd700", "#ffffff"][Math.floor(Math.random() * 4)],
      });
    }
  }

  /* ── Init / Reset ── */
  function reset() {
    const startY = modeReverse ? H - GROUND_HEIGHT - 100 : H / 2 - 40;
    bird = {
      y: startY,
      vy: 0,
      rotation: 0,
    };
    pipes = [];
    particles = [];
    score = 0;
    groundX = 0;
    deathFlashAlpha = 0;
    hudScore.textContent = "0";
    hudMilestone.textContent = "";
    hudMilestone.style.color = "";
    currentMilestoneIdx = -1;
    milestoneFloats = [];
    ghostRecording = [];
    ghostFrame = 0;
    ghostVisible = true;
    newRecordShown = false;
    newRecordAlpha = 0;
    if (showGhost) {
      ghostPlayback = loadGhost();
    } else {
      ghostPlayback = null;
    }
    initStars();
    initNightStars();
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
    pipes.push({
      x: W + 20,
      topH: topH,
      gap: gap,
      scored: false,
    });
  }

  /* ── Input ── */
  function getGravity() { return modeReverse ? -GRAVITY : GRAVITY; }
  function getFlapStrength() { return modeReverse ? -FLAP_STRENGTH : FLAP_STRENGTH; }

  function flap() {
    if (state === "start") {
      state = "playing";
      startOverlay.classList.add("hidden");
      ensureAudio();
      reset();
      bird.vy = getFlapStrength();
      sfxFlap();
      lastTime = performance.now();
      frameId = requestAnimationFrame(loop);
      return;
    }
    if (state === "playing") {
      bird.vy = getFlapStrength();
      sfxFlap();
      // Trail burst on flap
      for (let i = 0; i < 3; i++) spawnParticle(BIRD_X - BIRD_RADIUS, bird.y);
    }
  }

  function handleInput(e) {
    if (e.type === "keydown" && e.code !== "Space") return;
    if (e.type === "keydown") e.preventDefault();
    flap();
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  });
  document.addEventListener("keydown", handleInput);

  playAgainBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    gameoverOverlay.classList.add("hidden");
    state = "start";
    reset();
    startOverlay.classList.remove("hidden");
    if (frameId) cancelAnimationFrame(frameId);
    frameId = null;
    requestAnimationFrame(idleLoop);
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

  /* ── Die ── */
  function die() {
    state = "dead";
    sfxCrash();
    deathFlashAlpha = 0.7;
    spawnDeathBurst(BIRD_X, bird.y);
    // Save ghost if this is the best run
    const prevGhost = loadGhost();
    if (!prevGhost || ghostRecording.length > prevGhost.length) {
      saveGhost(ghostRecording);
    }
    const top5 = saveHighScore(score);
    if (window.GamePlatform) {
      GamePlatform.recordGame('flappy', score, 0);
      GamePlatform.updateScore(score);
    }
    finalScoreEl.textContent = score;
    renderHighScores(top5);
    // Small delay before showing overlay, then stop the loop
    setTimeout(() => {
      gameoverOverlay.classList.remove("hidden");
      // Stop the animation loop once overlay is shown
      setTimeout(() => {
        if (state === "dead" && frameId) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
      }, 400);
    }, 600);
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
        milestoneFloats.push({
          text: m.title,
          color: m.color,
          y: H / 2 - 40,
          alpha: 1.4,
          scale: 1.5,
        });
        sfxMilestone();
        break;
      }
    }
  }

  /* ── Update ── */
  function update(dt) {
    if (state !== "playing" && state !== "dead") return;

    const grav = getGravity();

    // Bird physics (keep updating briefly when dead for fall anim)
    if (state === "playing") {
      bird.vy += grav;
      bird.y += bird.vy;
      // Record ghost position
      ghostRecording.push(bird.y);
      // Ghost playback: check if we've surpassed the ghost
      if (ghostPlayback && ghostVisible && ghostFrame >= ghostPlayback.length) {
        ghostVisible = false;
        if (!newRecordShown) {
          newRecordShown = true;
          newRecordAlpha = 2.0;
        }
      }
      ghostFrame++;
    } else {
      // Dead: bird falls
      bird.vy += grav;
      bird.y += bird.vy;
      if (modeReverse) {
        if (bird.y < -50) bird.y = -50;
      } else {
        if (bird.y > H + 50) bird.y = H + 50;
      }
    }

    // Bird rotation
    if (modeReverse) {
      const targetRot = state === "playing"
        ? Math.max(bird.vy * 0.06, -Math.PI / 3)
        : -Math.PI / 2;
      bird.rotation += (targetRot - bird.rotation) * 0.15;
    } else {
      const targetRot = state === "playing"
        ? Math.min(bird.vy * 0.06, Math.PI / 3)
        : Math.PI / 2;
      bird.rotation += (targetRot - bird.rotation) * 0.15;
    }

    // Ground scroll
    groundX -= PIPE_SPEED;
    if (groundX <= -40) groundX += 40;

    // Pipes
    if (state === "playing") {
      // Spawn
      if (pipes.length === 0 || pipes[pipes.length - 1].x < W - PIPE_SPAWN_DIST) {
        spawnPipe();
      }

      // Move & score
      for (const p of pipes) {
        p.x -= PIPE_SPEED;
        if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
          p.scored = true;
          score++;
          hudScore.textContent = score;
          if (window.GamePlatform) GamePlatform.updateScore(score);
          sfxScore();
          checkMilestones();
        }
      }

      // Remove off-screen
      while (pipes.length && pipes[0].x + PIPE_WIDTH < -10) pipes.shift();

      // Particles (trail)
      if (Math.random() > 0.5) spawnParticle(BIRD_X - BIRD_RADIUS, bird.y);

      // Collision
      if (checkCollision()) die();
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update milestone floats
    for (let i = milestoneFloats.length - 1; i >= 0; i--) {
      const mf = milestoneFloats[i];
      mf.y -= 0.8;
      mf.alpha -= 0.012;
      mf.scale += 0.005;
      if (mf.alpha <= 0) milestoneFloats.splice(i, 1);
    }

    // Update new record text
    if (newRecordAlpha > 0) {
      newRecordAlpha -= 0.008;
      if (newRecordAlpha < 0) newRecordAlpha = 0;
    }

    // Death flash fade
    if (deathFlashAlpha > 0) {
      deathFlashAlpha -= 0.025;
      if (deathFlashAlpha < 0) deathFlashAlpha = 0;
    }
  }

  /* ── Draw ── */
  function draw(time) {
    const night = modeNight;
    const reverse = modeReverse;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H - GROUND_HEIGHT);
    if (night) {
      if (reverse) {
        skyGrad.addColorStop(0, "#1a2a4a");
        skyGrad.addColorStop(1, "#0a1628");
      } else {
        skyGrad.addColorStop(0, "#0a1628");
        skyGrad.addColorStop(1, "#1a2a4a");
      }
    } else {
      if (reverse) {
        skyGrad.addColorStop(0, "#1e3a6e");
        skyGrad.addColorStop(0.5, "#141450");
        skyGrad.addColorStop(1, "#0a0a2e");
      } else {
        skyGrad.addColorStop(0, "#0a0a2e");
        skyGrad.addColorStop(0.5, "#141450");
        skyGrad.addColorStop(1, "#1e3a6e");
      }
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H - GROUND_HEIGHT);

    // Stars (night mode uses brighter/more stars)
    const starList = night ? nightStars : stars;
    for (const s of starList) {
      const twinkle = Math.sin(time * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
      ctx.globalAlpha = s.a * twinkle * (night ? 1.2 : 1);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon (night mode only)
    if (night) {
      drawMoon(time);
    }

    // Distant clouds / hills (parallax, subtle)
    drawHills(time);

    // Pipes
    for (const p of pipes) {
      drawPipe(p);
    }

    // Ground
    drawGround();

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ghost bird (rendered before real bird so it appears behind)
    if (ghostPlayback && ghostVisible && state === "playing") {
      const gi = ghostFrame - 1;
      if (gi >= 0 && gi < ghostPlayback.length) {
        drawGhostBird(ghostPlayback[gi]);
      }
    }

    // Bird
    drawBird();

    // Milestone floating texts
    for (const mf of milestoneFloats) {
      ctx.save();
      ctx.globalAlpha = Math.min(mf.alpha, 1);
      ctx.font = `800 ${Math.round(28 * mf.scale)}px 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = mf.color;
      ctx.shadowColor = mf.color;
      ctx.shadowBlur = 20;
      ctx.fillText(mf.text, W / 2, mf.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // "New Record!" text
    if (newRecordAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(newRecordAlpha, 1);
      ctx.font = "900 32px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd700";
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 25;
      ctx.fillText("New Record!", W / 2, H / 2 - 80);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Death flash
    if (deathFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 50, 80, ${deathFlashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawMoon(time) {
    ctx.save();
    const mx = W - 60, my = 55, mr = 28;
    // Moon glow
    const glowGrad = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 2.5);
    glowGrad.addColorStop(0, "rgba(200, 210, 240, 0.08)");
    glowGrad.addColorStop(1, "rgba(200, 210, 240, 0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Moon body
    const moonGrad = ctx.createRadialGradient(mx - 6, my - 6, 2, mx, my, mr);
    moonGrad.addColorStop(0, "#e8e8f0");
    moonGrad.addColorStop(0.7, "#c8c8d8");
    moonGrad.addColorStop(1, "#a0a0b8");
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // Craters
    ctx.fillStyle = "rgba(140, 140, 160, 0.3)";
    ctx.beginPath(); ctx.arc(mx - 8, my - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 6, my + 8, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 2, my - 10, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawHills(time) {
    const scrollX = (state === "playing" || state === "dead") ? time * 0.01 : 0;
    const c1 = modeNight ? "rgba(8, 12, 30, 0.6)" : "rgba(15, 20, 50, 0.5)";
    const c2 = modeNight ? "rgba(12, 18, 40, 0.5)" : "rgba(20, 30, 60, 0.4)";

    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND_HEIGHT);
    for (let x = 0; x <= W; x += 5) {
      const y = H - GROUND_HEIGHT - 20
        - Math.sin((x + scrollX * 30) * 0.015) * 18
        - Math.sin((x + scrollX * 20) * 0.025) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H - GROUND_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND_HEIGHT);
    for (let x = 0; x <= W; x += 5) {
      const y = H - GROUND_HEIGHT - 10
        - Math.sin((x + scrollX * 50 + 100) * 0.02) * 12
        - Math.sin((x + scrollX * 40) * 0.035) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H - GROUND_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  function drawPipe(p) {
    if (modeNight) {
      drawPipeNight(p);
    } else {
      drawPipeClassic(p);
    }
  }

  function drawPipeClassic(p) {
    const pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
    pipeGrad.addColorStop(0, "#2ecc71");
    pipeGrad.addColorStop(0.3, "#3ddc84");
    pipeGrad.addColorStop(0.7, "#2ecc71");
    pipeGrad.addColorStop(1, "#1a9c54");

    // Top pipe body
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topH);

    // Top pipe cap
    const capOverhang = 6;
    const capH = 22;
    const capGrad = ctx.createLinearGradient(p.x - capOverhang, 0, p.x + PIPE_WIDTH + capOverhang, 0);
    capGrad.addColorStop(0, "#34d880");
    capGrad.addColorStop(0.3, "#4ae896");
    capGrad.addColorStop(0.7, "#34d880");
    capGrad.addColorStop(1, "#1fa85e");
    ctx.fillStyle = capGrad;
    roundRect(p.x - capOverhang, p.topH - capH, PIPE_WIDTH + capOverhang * 2, capH, 4);

    // Pipe highlight
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(p.x + 6, 0, 6, p.topH - capH);

    // Bottom pipe body
    const bottomY = p.topH + p.gap;
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(p.x, bottomY, PIPE_WIDTH, H - GROUND_HEIGHT - bottomY);

    // Bottom pipe cap
    ctx.fillStyle = capGrad;
    roundRect(p.x - capOverhang, bottomY, PIPE_WIDTH + capOverhang * 2, capH, 4);

    // Pipe highlight bottom
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(p.x + 6, bottomY + capH, 6, H - GROUND_HEIGHT - bottomY - capH);

    // Dark edge lines
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, 0, PIPE_WIDTH, p.topH);
    ctx.strokeRect(p.x, bottomY, PIPE_WIDTH, H - GROUND_HEIGHT - bottomY);
  }

  function drawPipeNight(p) {
    const pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
    pipeGrad.addColorStop(0, "#1a6b3a");
    pipeGrad.addColorStop(0.3, "#228844");
    pipeGrad.addColorStop(0.7, "#1a6b3a");
    pipeGrad.addColorStop(1, "#0e4d28");

    // Glow behind pipe
    ctx.save();
    ctx.shadowColor = "rgba(30, 180, 80, 0.15)";
    ctx.shadowBlur = 12;

    // Top pipe body
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topH);

    // Top pipe cap
    const capOverhang = 6;
    const capH = 22;
    const capGrad = ctx.createLinearGradient(p.x - capOverhang, 0, p.x + PIPE_WIDTH + capOverhang, 0);
    capGrad.addColorStop(0, "#1e7a40");
    capGrad.addColorStop(0.3, "#268e4c");
    capGrad.addColorStop(0.7, "#1e7a40");
    capGrad.addColorStop(1, "#126030");
    ctx.fillStyle = capGrad;
    roundRect(p.x - capOverhang, p.topH - capH, PIPE_WIDTH + capOverhang * 2, capH, 4);

    // Bottom pipe body
    const bottomY = p.topH + p.gap;
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(p.x, bottomY, PIPE_WIDTH, H - GROUND_HEIGHT - bottomY);

    // Bottom pipe cap
    ctx.fillStyle = capGrad;
    roundRect(p.x - capOverhang, bottomY, PIPE_WIDTH + capOverhang * 2, capH, 4);

    ctx.restore();

    // Dark edge lines
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, 0, PIPE_WIDTH, p.topH);
    ctx.strokeRect(p.x, bottomY, PIPE_WIDTH, H - GROUND_HEIGHT - bottomY);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    const gY = H - GROUND_HEIGHT;

    if (modeNight) {
      // Night ground
      const groundGrad = ctx.createLinearGradient(0, gY, 0, H);
      groundGrad.addColorStop(0, "#1e1a10");
      groundGrad.addColorStop(0.15, "#2e2818");
      groundGrad.addColorStop(1, "#141008");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, gY, W, GROUND_HEIGHT);

      // Darker grass strip
      ctx.fillStyle = "#2a5a2a";
      ctx.fillRect(0, gY, W, 6);
      ctx.fillStyle = "#336633";
      ctx.fillRect(0, gY, W, 3);
    } else {
      // Classic ground
      const groundGrad = ctx.createLinearGradient(0, gY, 0, H);
      groundGrad.addColorStop(0, "#3a2a1a");
      groundGrad.addColorStop(0.15, "#5c4a32");
      groundGrad.addColorStop(1, "#2a1e10");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, gY, W, GROUND_HEIGHT);

      ctx.fillStyle = "#4caf50";
      ctx.fillRect(0, gY, W, 6);
      ctx.fillStyle = "#66cc66";
      ctx.fillRect(0, gY, W, 3);
    }

    // Ground texture lines
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let x = groundX; x < W + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, gY + 10);
      ctx.lineTo(x - 10, H);
      ctx.stroke();
    }

    // Top edge highlight
    ctx.strokeStyle = modeNight ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gY + 6);
    ctx.lineTo(W, gY + 6);
    ctx.stroke();
  }

  function drawGhostBird(ghostY) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.translate(BIRD_X, ghostY);
    if (modeReverse) ctx.scale(1, -1);

    // Desaturated body
    ctx.fillStyle = "#999977";
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(6, -5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(50,50,50,0.5)";
    ctx.beginPath();
    ctx.arc(8, -5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "rgba(200,120,80,0.4)";
    ctx.beginPath();
    ctx.moveTo(12, -1);
    ctx.lineTo(20, 2);
    ctx.lineTo(12, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rotation);
    if (modeReverse) ctx.scale(1, -1);

    // Bird glow in night mode
    if (modeNight) {
      ctx.save();
      ctx.shadowColor = "rgba(255, 200, 50, 0.3)";
      ctx.shadowBlur = 18;
    }

    // Wing
    const wingFlap = Math.sin(performance.now() * 0.015) * 6;
    ctx.fillStyle = "#e6a800";
    ctx.beginPath();
    ctx.ellipse(-4, 2, 10, 5 + wingFlap * 0.3, -0.3 + wingFlap * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, BIRD_RADIUS);
    bodyGrad.addColorStop(0, "#ffe066");
    bodyGrad.addColorStop(0.7, "#ffc800");
    bodyGrad.addColorStop(1, "#e6a800");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    if (modeNight) ctx.restore();

    // Body outline
    ctx.strokeStyle = "rgba(180, 120, 0, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Eye white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(6, -5, 6, 0, Math.PI * 2);
    ctx.fill();

    // Eye pupil
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.arc(8, -5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlight
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(9, -6.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "#ff6b35";
    ctx.beginPath();
    ctx.moveTo(12, -1);
    ctx.lineTo(22, 2);
    ctx.lineTo(12, 5);
    ctx.closePath();
    ctx.fill();

    // Beak line
    ctx.strokeStyle = "#cc4400";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(21, 2);
    ctx.stroke();

    ctx.restore();
  }

  /* ── Main Loop ── */
  function loop(time) {
    const dt = Math.min(time - lastTime, 32); // cap at ~30fps min to prevent spiral
    lastTime = time;

    update(dt);
    draw(time);

    if (state === "playing" || state === "dead") {
      frameId = requestAnimationFrame(loop);
    }
  }

  /* ── Idle animation for start screen ── */
  function idleLoop(time) {
    if (state !== "start") return;
    // Idle bird bobbing
    const baseY = modeReverse ? H - GROUND_HEIGHT - 100 : H / 2 - 40;
    bird.y = baseY + Math.sin(time * 0.003) * 15;
    bird.rotation = Math.sin(time * 0.004) * 0.1;
    draw(time);
    requestAnimationFrame(idleLoop);
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

  /* ── Bootstrap ── */
  reset();
  requestAnimationFrame(idleLoop);

  if (window.GamePlatform) {
    GamePlatform.initHeader('Flappy Bird');
  }
})();
