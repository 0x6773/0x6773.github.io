/* ============================================================
   Flappy Bird Clone  -  Pure JS / Canvas / Web Audio
   ============================================================ */

(() => {
  "use strict";

  /* ── DOM refs ── */
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const hudScore = document.getElementById("hud-score");
  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const finalScoreEl = document.getElementById("final-score");
  const highscoreList = document.getElementById("highscore-list");
  const playAgainBtn = document.getElementById("play-again-btn");

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
    bird = {
      y: H / 2 - 40,
      vy: 0,
      rotation: 0,
    };
    pipes = [];
    particles = [];
    score = 0;
    groundX = 0;
    deathFlashAlpha = 0;
    hudScore.textContent = "0";
    initStars();
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
  function flap() {
    if (state === "start") {
      state = "playing";
      startOverlay.classList.add("hidden");
      ensureAudio();
      reset();
      bird.vy = FLAP_STRENGTH;
      sfxFlap();
      lastTime = performance.now();
      frameId = requestAnimationFrame(loop);
      return;
    }
    if (state === "playing") {
      bird.vy = FLAP_STRENGTH;
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
    const top5 = saveHighScore(score);
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

  /* ── Update ── */
  function update(dt) {
    if (state !== "playing" && state !== "dead") return;

    // Bird physics (keep updating briefly when dead for fall anim)
    if (state === "playing") {
      bird.vy += GRAVITY;
      bird.y += bird.vy;
    } else {
      // Dead: bird falls
      bird.vy += GRAVITY;
      bird.y += bird.vy;
      if (bird.y > H + 50) bird.y = H + 50; // clamp off screen
    }

    // Bird rotation
    const targetRot = state === "playing"
      ? Math.min(bird.vy * 0.06, Math.PI / 3)
      : Math.PI / 2;
    bird.rotation += (targetRot - bird.rotation) * 0.15;

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
          sfxScore();
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

    // Death flash fade
    if (deathFlashAlpha > 0) {
      deathFlashAlpha -= 0.025;
      if (deathFlashAlpha < 0) deathFlashAlpha = 0;
    }
  }

  /* ── Draw ── */
  function draw(time) {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H - GROUND_HEIGHT);
    skyGrad.addColorStop(0, "#0a0a2e");
    skyGrad.addColorStop(0.5, "#141450");
    skyGrad.addColorStop(1, "#1e3a6e");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H - GROUND_HEIGHT);

    // Stars
    for (const s of stars) {
      const twinkle = Math.sin(time * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
      ctx.globalAlpha = s.a * twinkle;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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

    // Bird
    drawBird();

    // Death flash
    if (deathFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 50, 80, ${deathFlashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawHills(time) {
    const scrollX = (state === "playing" || state === "dead") ? time * 0.01 : 0;
    ctx.fillStyle = "rgba(15, 20, 50, 0.5)";
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

    ctx.fillStyle = "rgba(20, 30, 60, 0.4)";
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
    // Ground base
    const gY = H - GROUND_HEIGHT;
    const groundGrad = ctx.createLinearGradient(0, gY, 0, H);
    groundGrad.addColorStop(0, "#3a2a1a");
    groundGrad.addColorStop(0.15, "#5c4a32");
    groundGrad.addColorStop(1, "#2a1e10");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, gY, W, GROUND_HEIGHT);

    // Grass strip
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(0, gY, W, 6);
    ctx.fillStyle = "#66cc66";
    ctx.fillRect(0, gY, W, 3);

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
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gY + 6);
    ctx.lineTo(W, gY + 6);
    ctx.stroke();
  }

  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rotation);

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

    // Body outline
    ctx.strokeStyle = "rgba(180, 120, 0, 0.5)";
    ctx.lineWidth = 1.5;
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
    bird.y = H / 2 - 40 + Math.sin(time * 0.003) * 15;
    bird.rotation = Math.sin(time * 0.004) * 0.1;
    draw(time);
    requestAnimationFrame(idleLoop);
  }

  /* ── Bootstrap ── */
  reset();
  requestAnimationFrame(idleLoop);
})();
