/* ============================================================
   Doodle Jump Clone  -  Pure JS / Canvas / Web Audio
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

  const W = canvas.width;   // 400
  const H = canvas.height;  // 600

  /* ── Constants ── */
  const PLAYER_W = 30;
  const PLAYER_H = 30;
  const PLAYER_RADIUS = 15;
  const BOUNCE_VEL = -10;
  const SPRING_VEL = -18;
  const GRAVITY = 0.35;
  const MOVE_SPEED = 5;
  const MOVE_ACCEL = 0.6;
  const MOVE_FRICTION = 0.85;
  const PLATFORM_W = 60;
  const PLATFORM_H = 12;
  const MIN_PLAT_GAP = 60;
  const MAX_PLAT_GAP = 80;
  const STAR_COUNT = 80;

  /* ── Milestones ── */
  const MILESTONES = [
    { score: 500,   title: "Rookie",     color: "#33cc66" },
    { score: 1000,  title: "Climber",    color: "#00cccc" },
    { score: 2500,  title: "Skilled",    color: "#bb44ff" },
    { score: 5000,  title: "Expert",     color: "#ffd700" },
    { score: 10000, title: "Legendary",  color: "#ff3344" },
  ];
  let currentMilestoneIdx = -1;
  let milestoneFloats = [];

  /* ── Game state ── */
  let state = "start"; // start | playing | dead
  let player, platforms, particles, score, maxHeight, stars;
  let moveDir = 0; // -1 left, 0 none, 1 right
  let playerVX = 0;
  let keysDown = {};
  let deathFlashAlpha = 0;
  let frameId = null;
  let lastTime = 0;
  let cameraY = 0; // how far up we've scrolled
  let heightMarkers = [];

  /* ── Touch / tilt state ── */
  let touchStartX = null;
  let touchCurrentX = null;
  let tiltEnabled = false;
  let tiltX = 0; // device gamma value

  /* ── Audio (Web Audio API) ── */
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function isMuted() {
    return typeof GamePlatform !== "undefined" && GamePlatform.isMuted();
  }

  function playTone(freq, duration, type, vol, ramp) {
    if (!audioCtx || isMuted()) return;
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

  function sfxBounce() {
    playTone(400, 0.08, "sine", 0.1, 600);
  }

  function sfxSpring() {
    playTone(300, 0.15, "sine", 0.12, 900);
    setTimeout(() => playTone(600, 0.1, "sine", 0.1, 1200), 60);
  }

  function sfxBreak() {
    playTone(150, 0.2, "sawtooth", 0.08, 50);
  }

  function sfxGameOver() {
    playTone(300, 0.3, "sawtooth", 0.15, 80);
    playTone(150, 0.5, "square", 0.08, 30);
  }

  function sfxMilestone() {
    playTone(660, 0.1, "sine", 0.1);
    setTimeout(() => playTone(880, 0.1, "sine", 0.1), 100);
    setTimeout(() => playTone(1100, 0.15, "sine", 0.12), 200);
    setTimeout(() => playTone(1320, 0.25, "sine", 0.1), 300);
  }

  /* ── High scores (localStorage) ── */
  const LS_KEY = "doodlejump_highscores";

  function loadHighScores() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  }

  function saveHighScore(s) {
    if (s <= 0) return loadHighScores(); // don't save zero scores
    const scores = loadHighScores();
    scores.push(s);
    scores.sort((a, b) => b - a);
    const top5 = scores.slice(0, 5);
    try { localStorage.setItem(LS_KEY, JSON.stringify(top5)); }
    catch (e) { /* quota exceeded */ }
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
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.5 + 0.15,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
        depth: Math.random() * 0.5 + 0.1, // parallax depth
      });
    }
  }

  /* ── Particles ── */
  function spawnBreakParticles(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({
        x: x + Math.random() * PLATFORM_W,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: Math.random() * 0.03 + 0.02,
        r: Math.random() * 4 + 2,
        color: ["#cc8844", "#aa6633", "#886622", "#bb7744"][Math.floor(Math.random() * 4)],
      });
    }
  }

  function spawnSpringParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: x + Math.random() * 20 - 10,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -(Math.random() * 3 + 1),
        life: 1,
        decay: Math.random() * 0.04 + 0.02,
        r: Math.random() * 3 + 1,
        color: ["#ff4444", "#ff6644", "#ffaa00", "#ffffff"][Math.floor(Math.random() * 4)],
      });
    }
  }

  function spawnDeathBurst(x, y) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.02 + 0.01,
        r: Math.random() * 5 + 2,
        color: ["#ff3366", "#ff6633", "#ffd700", "#66ff66", "#ffffff"][Math.floor(Math.random() * 5)],
      });
    }
  }

  /* ── Platform type probabilities based on height ── */
  function getPlatformType(height) {
    const r = Math.random();
    if (height < 2000) {
      // Low: 80% normal, 10% moving, 10% fragile, 0% spring
      if (r < 0.8) return "normal";
      if (r < 0.9) return "moving";
      return "fragile";
    } else if (height < 6000) {
      // Medium: 50% normal, 25% moving, 15% fragile, 10% spring
      if (r < 0.5) return "normal";
      if (r < 0.75) return "moving";
      if (r < 0.9) return "fragile";
      return "spring";
    } else {
      // High: 30% normal, 30% moving, 25% fragile, 15% spring
      if (r < 0.3) return "normal";
      if (r < 0.6) return "moving";
      if (r < 0.85) return "fragile";
      return "spring";
    }
  }

  /* ── Platform gap increases with height ── */
  function getGapForHeight(height) {
    const base = MIN_PLAT_GAP;
    const extra = Math.min(height / 200, MAX_PLAT_GAP - MIN_PLAT_GAP);
    return base + extra + Math.random() * 20;
  }

  /* ── Create a platform ── */
  function createPlatform(x, y, type) {
    const plat = {
      x: x,
      y: y,
      w: PLATFORM_W,
      h: PLATFORM_H,
      type: type || "normal",
      broken: false,
      breakAnim: 0,
      // For moving platforms
      moveSpeed: (Math.random() * 1.5 + 0.5) * (Math.random() < 0.5 ? 1 : -1),
      // For spring platforms
      springBounce: false,
      springAnim: 0,
      // For fragile platforms: crack lines
      cracks: [],
    };

    if (type === "fragile") {
      // Pre-generate crack pattern
      for (let i = 0; i < 3; i++) {
        plat.cracks.push({
          x1: Math.random() * PLATFORM_W * 0.8 + PLATFORM_W * 0.1,
          y1: Math.random() * PLATFORM_H * 0.3,
          x2: Math.random() * PLATFORM_W * 0.8 + PLATFORM_W * 0.1,
          y2: PLATFORM_H * 0.7 + Math.random() * PLATFORM_H * 0.3,
        });
      }
    }

    return plat;
  }

  /* ── Generate initial platforms ── */
  function generateInitialPlatforms() {
    platforms = [];
    // Floor platform (wide)
    platforms.push({
      x: 0, y: H - 30, w: W, h: 14,
      type: "normal", broken: false, breakAnim: 0,
      moveSpeed: 0, springBounce: false, springAnim: 0, cracks: [],
    });

    // Starting platforms - ensure reachable
    let curY = H - 80;
    while (curY > -H) {
      const x = Math.random() * (W - PLATFORM_W);
      const type = curY > H - 300 ? "normal" : getPlatformType(H - curY);
      platforms.push(createPlatform(x, curY, type));
      curY -= getGapForHeight(H - curY);
    }
  }

  /* ── Generate platforms above current view ── */
  function generatePlatformsAbove() {
    // Find the highest platform
    let highestY = Infinity;
    for (const p of platforms) {
      if (p.y < highestY) highestY = p.y;
    }

    const targetY = cameraY - H; // generate one screen above camera
    while (highestY > targetY) {
      const gap = getGapForHeight(-highestY);
      highestY -= gap;
      const x = Math.random() * (W - PLATFORM_W);
      const height = -highestY; // convert to positive height value
      const type = getPlatformType(height);
      platforms.push(createPlatform(x, highestY, type));
    }
  }

  /* ── Init / Reset ── */
  function reset() {
    player = {
      x: W / 2 - PLAYER_W / 2,
      y: H - 70,
      vy: BOUNCE_VEL,
      facingRight: true,
    };
    playerVX = 0;
    particles = [];
    score = 0;
    maxHeight = 0;
    cameraY = 0;
    deathFlashAlpha = 0;
    heightMarkers = [];
    currentMilestoneIdx = -1;
    milestoneFloats = [];
    hudScore.textContent = "0";
    hudMilestone.textContent = "";
    hudMilestone.style.color = "";
    generateInitialPlatforms();
    initStars();
  }

  /* ── Input handlers ── */
  document.addEventListener("keydown", (e) => {
    keysDown[e.code] = true;
    if (e.code === "ArrowLeft" || e.code === "KeyA") e.preventDefault();
    if (e.code === "ArrowRight" || e.code === "KeyD") e.preventDefault();
  });

  document.addEventListener("keyup", (e) => {
    keysDown[e.code] = false;
  });

  // Clear stuck keys when window loses focus
  window.addEventListener("blur", () => {
    keysDown = {};
  });

  // Touch controls — listen on canvas-container so overlays don't block input
  const canvasContainer = document.getElementById("canvas-container");

  canvasContainer.addEventListener("touchstart", (e) => {
    if (e.target.closest("button, a, input, select, textarea")) return;
    e.preventDefault();
    if (state === "start") {
      startGame();
      return;
    }
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchCurrentX = touch.clientX;
  }, { passive: false });

  canvasContainer.addEventListener("touchmove", (e) => {
    if (e.target.closest("button, a, input, select, textarea")) return;
    e.preventDefault();
    if (e.touches.length > 0) {
      touchCurrentX = e.touches[0].clientX;
    }
  }, { passive: false });

  canvasContainer.addEventListener("touchend", (e) => {
    if (e.target.closest("button, a, input, select, textarea")) return;
    e.preventDefault();
    touchStartX = null;
    touchCurrentX = null;
  }, { passive: false });

  // Mouse/pointer click to start — on container so overlays don't block
  canvasContainer.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return; // handled by touch events
    e.preventDefault();
    if (state === "start") {
      startGame();
    }
  });

  // Keyboard start
  document.addEventListener("keydown", (e) => {
    if (state === "start" && (e.code === "Space" || e.code === "Enter")) {
      e.preventDefault();
      startGame();
    }
  });

  // Device orientation (tilt)
  function initTilt() {
    if (tiltEnabled) return;
    // iOS 13+ requires permission
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then(response => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
            tiltEnabled = true;
          }
        })
        .catch(() => {});
    } else if ("DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation);
      tiltEnabled = true;
    }
  }

  function handleOrientation(e) {
    if (e.gamma !== null) {
      tiltX = e.gamma; // -90 to 90 degrees
    }
  }

  // Play again button
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

  /* ── Start game ── */
  function startGame() {
    if (state !== "start") return;
    state = "playing";
    startOverlay.classList.add("hidden");
    ensureAudio();
    initTilt();
    reset();
    lastTime = performance.now();
    frameId = requestAnimationFrame(loop);
  }

  /* ── Die ── */
  function die() {
    state = "dead";
    sfxGameOver();
    deathFlashAlpha = 0.7;
    spawnDeathBurst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2);

    const top5 = saveHighScore(score);
    if (window.GamePlatform) {
      GamePlatform.recordGame("doodle-jump", score, 0);
      GamePlatform.updateScore(score);
    }
    finalScoreEl.textContent = score;
    renderHighScores(top5);

    setTimeout(() => {
      gameoverOverlay.classList.remove("hidden");
      setTimeout(() => {
        if (state === "dead" && frameId) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
      }, 400);
    }, 800);
  }

  /* ── Milestone check ── */
  function checkMilestones() {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (score >= MILESTONES[i].score && i > currentMilestoneIdx) {
        currentMilestoneIdx = i;
        const m = MILESTONES[i];
        hudMilestone.textContent = m.title;
        hudMilestone.style.color = m.color;
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

    // dt factor: normalize to 60fps baseline (16.67ms)
    const dtFactor = dt / 16.667;

    if (state === "playing") {
      // Horizontal movement from keyboard
      let inputDir = 0;
      if (keysDown["ArrowLeft"] || keysDown["KeyA"]) inputDir -= 1;
      if (keysDown["ArrowRight"] || keysDown["KeyD"]) inputDir += 1;

      // Touch drag — normalize sensitivity by canvas display width
      if (touchStartX !== null && touchCurrentX !== null) {
        const canvasRect = canvas.getBoundingClientRect();
        const canvasDisplayW = canvasRect.width || W;
        const dx = touchCurrentX - touchStartX;
        const normalizedDx = (dx / canvasDisplayW) * W; // map to internal coords
        if (Math.abs(normalizedDx) > 5) {
          inputDir = normalizedDx > 0 ? 1 : -1;
          const strength = Math.min(Math.abs(normalizedDx) / 60, 1);
          inputDir *= strength;
        }
      }

      // Tilt
      if (tiltEnabled && touchStartX === null) {
        const deadzone = 3;
        if (Math.abs(tiltX) > deadzone) {
          inputDir = Math.min(Math.max(tiltX / 30, -1), 1);
        }
      }

      // Apply horizontal velocity (dt-scaled)
      if (inputDir !== 0) {
        playerVX += inputDir * MOVE_ACCEL * dtFactor;
        playerVX = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, playerVX));
      } else {
        playerVX *= Math.pow(MOVE_FRICTION, dtFactor);
        if (Math.abs(playerVX) < 0.1) playerVX = 0;
      }

      // Update facing direction
      if (playerVX > 0.5) player.facingRight = true;
      if (playerVX < -0.5) player.facingRight = false;

      // Apply gravity (dt-scaled)
      player.vy += GRAVITY * dtFactor;
      player.y += player.vy * dtFactor;

      // Horizontal movement (dt-scaled)
      player.x += playerVX * dtFactor;

      // Screen wrapping
      if (player.x + PLAYER_W < 0) player.x = W;
      if (player.x > W) player.x = -PLAYER_W;

      // Camera follows player upward
      const screenY = player.y - cameraY;
      if (screenY < H * 0.4) {
        cameraY = player.y - H * 0.4;
      }

      // Update score based on height
      const currentHeight = Math.floor(-cameraY / 5);
      if (currentHeight > score) {
        score = currentHeight;
        hudScore.textContent = score;
        if (window.GamePlatform) GamePlatform.updateScore(score);
        checkMilestones();
      }

      // Platform collision (only when falling)
      if (player.vy > 0) {
        for (const plat of platforms) {
          if (plat.broken) continue;
          // Check if player's feet land on platform
          const playerBottom = player.y + PLAYER_H;
          const playerPrevBottom = playerBottom - player.vy;
          const playerCenterX = player.x + PLAYER_W / 2;

          if (playerBottom >= plat.y && playerPrevBottom <= plat.y + plat.h &&
              playerCenterX > plat.x && playerCenterX < plat.x + plat.w) {

            if (plat.type === "fragile") {
              // Bounce first, then break
              player.vy = BOUNCE_VEL;
              player.y = plat.y - PLAYER_H;
              plat.broken = true;
              plat.breakAnim = 1;
              spawnBreakParticles(plat.x, plat.y);
              sfxBreak();
            } else if (plat.type === "spring") {
              player.vy = SPRING_VEL;
              player.y = plat.y - PLAYER_H;
              plat.springBounce = true;
              plat.springAnim = 1;
              spawnSpringParticles(player.x + PLAYER_W / 2, plat.y);
              sfxSpring();
            } else {
              // Normal or moving platform
              player.vy = BOUNCE_VEL;
              player.y = plat.y - PLAYER_H;
              sfxBounce();
            }
          }
        }
      }

      // Update moving platforms (dt-scaled)
      for (const plat of platforms) {
        if (plat.type === "moving" && !plat.broken) {
          plat.x += plat.moveSpeed * dtFactor;
          if (plat.x <= 0 || plat.x + plat.w >= W) {
            plat.moveSpeed *= -1;
            plat.x = Math.max(0, Math.min(W - plat.w, plat.x));
          }
        }
      }

      // Generate new platforms above
      generatePlatformsAbove();

      // Remove platforms far below camera
      const removeThreshold = cameraY + H + 100;
      for (let i = platforms.length - 1; i >= 0; i--) {
        if (platforms[i].y > removeThreshold) {
          platforms.splice(i, 1);
        }
      }

      // Check death: player falls below screen bottom
      if (player.y - cameraY > H + PLAYER_H) {
        die();
      }
    } else {
      // Dead: player continues to fall briefly (dt-scaled)
      player.vy += GRAVITY * dtFactor;
      player.y += player.vy * dtFactor;
    }

    // Update particles (dt-scaled)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dtFactor;
      p.y += p.vy * dtFactor;
      p.vy += 0.1 * dtFactor; // particle gravity
      p.life -= p.decay * dtFactor;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update milestone floats (dt-scaled)
    for (let i = milestoneFloats.length - 1; i >= 0; i--) {
      const mf = milestoneFloats[i];
      mf.y -= 0.8 * dtFactor;
      mf.alpha -= 0.012 * dtFactor;
      mf.scale += 0.005 * dtFactor;
      if (mf.alpha <= 0) milestoneFloats.splice(i, 1);
    }

    // Update spring animations (dt-scaled)
    for (const plat of platforms) {
      if (plat.springAnim > 0) {
        plat.springAnim -= 0.05 * dtFactor;
        if (plat.springAnim < 0) {
          plat.springAnim = 0;
          plat.springBounce = false;
        }
      }
    }

    // Death flash fade (dt-scaled)
    if (deathFlashAlpha > 0) {
      deathFlashAlpha -= 0.025 * dtFactor;
      if (deathFlashAlpha < 0) deathFlashAlpha = 0;
    }
  }

  /* ── Draw functions ── */

  function drawBackground(time) {
    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1e");
    grad.addColorStop(0.5, "#0f0f2a");
    grad.addColorStop(1, "#141430");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars with parallax
    for (const s of stars) {
      const parallaxY = ((s.y - cameraY * s.depth) % H + H) % H;
      const twinkle = Math.sin(time * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
      ctx.globalAlpha = s.a * twinkle;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, parallaxY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHeightMarkers() {
    // Height markers every 1000 points
    const startH = Math.floor(score / 1000) * 1000;
    ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "right";

    for (let h = Math.max(1000, startH - 2000); h <= startH + 3000; h += 1000) {
      const worldY = -(h * 5); // convert score back to world Y
      const screenY = worldY - cameraY;
      if (screenY >= -20 && screenY <= H + 20) {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = "#4a4a6a";
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(W, screenY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#6a6a9a";
        ctx.fillText(h + "m", W - 8, screenY - 4);
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function drawPlatform(plat) {
    if (plat.broken && plat.breakAnim <= 0) return;

    const screenY = plat.y - cameraY;
    if (screenY < -30 || screenY > H + 30) return;

    ctx.save();

    if (plat.broken) {
      // Fade out broken platform
      ctx.globalAlpha = plat.breakAnim;
      plat.breakAnim -= 0.04;
    }

    const x = plat.x;
    const y = screenY;
    const w = plat.w;
    const h = plat.h;
    const r = 4; // corner radius

    // Platform body
    let color1, color2, color3;
    switch (plat.type) {
      case "normal":
        color1 = "#33cc55"; color2 = "#28a745"; color3 = "#1e8535";
        break;
      case "moving":
        color1 = "#4488ff"; color2 = "#3366dd"; color3 = "#2244aa";
        break;
      case "fragile":
        color1 = "#cc8844"; color2 = "#aa6633"; color3 = "#885522";
        break;
      case "spring":
        color1 = "#33cc55"; color2 = "#28a745"; color3 = "#1e8535";
        break;
      default:
        color1 = "#33cc55"; color2 = "#28a745"; color3 = "#1e8535";
    }

    // 3D effect: darker bottom edge
    ctx.fillStyle = color3;
    drawRoundRect(x, y + 3, w, h, r);
    ctx.fill();

    // Main body
    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    bodyGrad.addColorStop(0, color1);
    bodyGrad.addColorStop(1, color2);
    ctx.fillStyle = bodyGrad;
    drawRoundRect(x, y, w, h, r);
    ctx.fill();

    // Top highlight
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    drawRoundRect(x + 2, y + 1, w - 4, h * 0.4, r - 1);
    ctx.fill();

    // Fragile: draw cracks
    if (plat.type === "fragile") {
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      for (const crack of plat.cracks) {
        ctx.beginPath();
        ctx.moveTo(x + crack.x1, y + crack.y1);
        ctx.lineTo(x + crack.x2, y + crack.y2);
        ctx.stroke();
      }
    }

    // Spring: draw spring coil on top
    if (plat.type === "spring") {
      const springH = plat.springBounce ? 6 : 12;
      const springW = 14;
      const springX = x + w / 2 - springW / 2;
      const springY = y - springH;

      // Spring body (red)
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(springX + 4, springY, springW - 8, springH);

      // Spring coils
      ctx.strokeStyle = "#ff2222";
      ctx.lineWidth = 2;
      const coils = 3;
      const coilH = springH / coils;
      for (let i = 0; i < coils; i++) {
        const cy = springY + i * coilH + coilH / 2;
        ctx.beginPath();
        ctx.moveTo(springX + 2, cy - coilH / 3);
        ctx.lineTo(springX + springW - 2, cy);
        ctx.lineTo(springX + 2, cy + coilH / 3);
        ctx.stroke();
      }

      // Spring top cap
      ctx.fillStyle = "#ff6666";
      drawRoundRect(springX, springY - 3, springW, 5, 2);
      ctx.fill();

      // Spring glow when bouncing
      if (plat.springBounce) {
        ctx.globalAlpha = plat.springAnim * 0.5;
        ctx.fillStyle = "#ff4444";
        ctx.beginPath();
        ctx.arc(x + w / 2, y - 4, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  function drawPlayer() {
    const screenX = player.x;
    const screenY = player.y - cameraY;

    if (screenY < -50 || screenY > H + 50) return;

    ctx.save();
    const cx = screenX + PLAYER_W / 2;
    const cy = screenY + PLAYER_H / 2;

    // Body (circle)
    const bodyGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, PLAYER_RADIUS);
    bodyGrad.addColorStop(0, "#88ff88");
    bodyGrad.addColorStop(0.7, "#44dd44");
    bodyGrad.addColorStop(1, "#22aa22");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = "#1a8a1a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes
    const eyeDir = player.facingRight ? 1 : -1;
    const eyeSpacing = 6;
    const eyeOffsetX = eyeDir * 2;
    const eyeY = cy - 3;

    // Left eye white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing + eyeOffsetX, eyeY, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right eye white
    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing + eyeOffsetX, eyeY, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left pupil
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing + eyeOffsetX + eyeDir * 2, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Right pupil
    ctx.beginPath();
    ctx.arc(cx + eyeSpacing + eyeOffsetX + eyeDir * 2, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Feet / legs (small stubs at bottom)
    ctx.fillStyle = "#cc8844";
    // Left foot
    ctx.fillRect(cx - 8, cy + PLAYER_RADIUS - 2, 6, 5);
    // Right foot
    ctx.fillRect(cx + 2, cy + PLAYER_RADIUS - 2, 6, 5);

    // Glow when going up fast
    if (player.vy < -12) {
      ctx.globalAlpha = Math.min((-player.vy - 12) / 10, 0.5);
      ctx.fillStyle = "#66ff66";
      ctx.beginPath();
      ctx.arc(cx, cy, PLAYER_RADIUS + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawRoundRect(x, y, w, h, r) {
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
  }

  /* ── Main draw ── */
  function draw(time) {
    drawBackground(time);

    // Height markers
    drawHeightMarkers();

    // Platforms
    for (const plat of platforms) {
      drawPlatform(plat);
    }

    // Player
    drawPlayer();

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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

    // Death flash
    if (deathFlashAlpha > 0) {
      ctx.globalAlpha = deathFlashAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Score on canvas (in addition to HUD)
    ctx.save();
    ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("Height: " + score + "m", 10, 24);
    ctx.restore();
  }

  /* ── Game loop ── */
  function loop(timestamp) {
    const dt = Math.min(timestamp - lastTime, 33); // cap at ~30fps worth of dt
    lastTime = timestamp;

    update(dt);
    draw(timestamp);

    if (state === "playing" || state === "dead") {
      frameId = requestAnimationFrame(loop);
    }
  }

  /* ── Idle loop (for start screen) ── */
  function idleDraw(time) {
    // Just draw background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1e");
    grad.addColorStop(0.5, "#0f0f2a");
    grad.addColorStop(1, "#141430");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    if (stars) {
      for (const s of stars) {
        const twinkle = Math.sin(time * s.twinkleSpeed + s.twinkleOffset) * 0.3 + 0.7;
        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Draw some sample platforms for visual interest
    const sampleY = H - 120;
    // Green platform
    ctx.fillStyle = "#1e8535";
    drawRoundRect(60, sampleY + 3, PLATFORM_W, PLATFORM_H, 4);
    ctx.fill();
    const g1 = ctx.createLinearGradient(60, sampleY, 60, sampleY + PLATFORM_H);
    g1.addColorStop(0, "#33cc55"); g1.addColorStop(1, "#28a745");
    ctx.fillStyle = g1;
    drawRoundRect(60, sampleY, PLATFORM_W, PLATFORM_H, 4);
    ctx.fill();

    // Blue moving platform
    const blueX = 160 + Math.sin(time * 0.002) * 30;
    ctx.fillStyle = "#2244aa";
    drawRoundRect(blueX, sampleY - 60 + 3, PLATFORM_W, PLATFORM_H, 4);
    ctx.fill();
    const g2 = ctx.createLinearGradient(blueX, sampleY - 60, blueX, sampleY - 60 + PLATFORM_H);
    g2.addColorStop(0, "#4488ff"); g2.addColorStop(1, "#3366dd");
    ctx.fillStyle = g2;
    drawRoundRect(blueX, sampleY - 60, PLATFORM_W, PLATFORM_H, 4);
    ctx.fill();

    // Brown fragile platform
    ctx.fillStyle = "#885522";
    drawRoundRect(280, sampleY - 120 + 3, PLATFORM_W, PLATFORM_H, 4);
    ctx.fill();
    const g3 = ctx.createLinearGradient(280, sampleY - 120, 280, sampleY - 120 + PLATFORM_H);
    g3.addColorStop(0, "#cc8844"); g3.addColorStop(1, "#aa6633");
    ctx.fillStyle = g3;
    drawRoundRect(280, sampleY - 120, PLATFORM_W, PLATFORM_H, 4);
    ctx.fill();
  }

  function idleLoop(timestamp) {
    idleDraw(timestamp);
    if (state === "start") {
      requestAnimationFrame(idleLoop);
    }
  }

  /* ── Init ── */
  function init() {
    // Platform header
    if (window.GamePlatform) {
      GamePlatform.initHeader("Doodle Jump");
    }

    reset();
    requestAnimationFrame(idleLoop);
  }

  init();
})();
