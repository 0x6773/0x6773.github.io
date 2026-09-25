(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const livesEl = document.getElementById('lives');
  const powerupStatusEl = document.getElementById('powerup-status');
  const overlay = document.getElementById('overlay');
  const overlayMessage = document.getElementById('overlay-message');
  const overlayButton = document.getElementById('overlay-button');
  const waveBanner = document.getElementById('wave-banner');
  const highscores = document.getElementById('highscores');

  const W = canvas.width;
  const H = canvas.height;
  const SCORE_KEY = 'asteroids_highscores';
  const ROTATION_SPEED = 3.8;
  const THRUST = 185;
  const MAX_SPEED = 275;
  const BULLET_SPEED = 430;
  const ASTEROID_SIZES = {
    large: { radius: 42, score: 20, next: 'medium' },
    medium: { radius: 25, score: 50, next: 'small' },
    small: { radius: 14, score: 100, next: null }
  };
  const POWERUP_TYPES = [
    { id: 'rapid', label: 'RAPID', color: '#ffd166', duration: 8000 },
    { id: 'spread', label: 'SPREAD', color: '#ff8c42', duration: 8000 },
    { id: 'piercing', label: 'PIERCE', color: '#d5a7ff', duration: 7000 },
    { id: 'shield', label: 'SHIELD', color: '#66e676', duration: 7000 }
  ];

  let audioCtx = null;
  let gameRunning = false;
  let animationId = null;
  let lastTime = 0;
  let score = 0;
  let wave = 1;
  let lives = 3;
  let player;
  let asteroids = [];
  let ufos = [];
  let bullets = [];
  let ufoShots = [];
  let powerups = [];
  let particles = [];
  let stars = [];
  let keys = {};
  let fireCooldown = 0;
  let hyperspaceCooldown = 0;
  let rapidTimer = 0;
  let spreadTimer = 0;
  let piercingTimer = 0;
  let shieldTimer = 0;
  let combo = 0;
  let maxCombo = 0;
  let lastKillAt = 0;
  let ufoSpawnTimer = 9000;
  let waveBannerTimer = null;

  function isMuted() {
    return window.GamePlatform && GamePlatform.isMuted();
  }

  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(frequency, duration, type, volume) {
    if (isMuted()) return;
    const audio = ensureAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type || 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume || 0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function sfxShoot() { tone(760, 0.06, 'square', 0.06); }
  function sfxBreak() { tone(150, 0.1, 'sawtooth', 0.07); }
  function sfxThrust() { tone(90, 0.05, 'sawtooth', 0.035); }
  function sfxPowerup() { tone(740, 0.08, 'triangle', 0.08); setTimeout(() => tone(1040, 0.12, 'triangle', 0.08), 70); }
  function sfxHyperspace() { [260, 520, 1040].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'sine', 0.08), i * 65)); }
  function sfxUfo() { tone(190, 0.16, 'square', 0.06); setTimeout(() => tone(140, 0.16, 'square', 0.06), 100); }
  function sfxWave() { [420, 620, 920].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.08), i * 70)); }
  function sfxGameOver() { [320, 230, 150].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.1), i * 100)); }

  function safeLoadScores() {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveScore(value) {
    const scores = safeLoadScores();
    scores.push(value);
    scores.sort((a, b) => b - a);
    const top = scores.slice(0, 5);
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(top)); }
    catch (e) { }
    return top;
  }

  function renderScores(scores) {
    highscores.innerHTML = '';
    scores.forEach((value, index) => {
      const item = document.createElement('li');
      item.textContent = (index + 1) + '. ' + value;
      highscores.appendChild(item);
    });
    highscores.classList.toggle('hidden', scores.length === 0);
  }

  function formatSeconds(milliseconds) {
    return Math.ceil(milliseconds / 1000) + 's';
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString();
    waveEl.textContent = wave;
    livesEl.textContent = lives;
    const active = [];
    if (rapidTimer > 0) active.push('RAPID ' + formatSeconds(rapidTimer));
    if (spreadTimer > 0) active.push('SPREAD ' + formatSeconds(spreadTimer));
    if (piercingTimer > 0) active.push('PIERCE ' + formatSeconds(piercingTimer));
    if (shieldTimer > 0) active.push('SHIELD ' + formatSeconds(shieldTimer));
    if (hyperspaceCooldown <= 0) active.push('JUMP READY');
    else active.push('JUMP ' + formatSeconds(hyperspaceCooldown));
    if (combo > 1) active.push('COMBO x' + Math.min(5, 1 + Math.floor((combo - 1) / 3)));
    powerupStatusEl.textContent = active.join('  |  ');
    if (window.GamePlatform) GamePlatform.updateScore(score);
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 1.6 + 0.3, alpha: Math.random() * 0.6 + 0.15 });
    }
  }

  function wrap(entity, padding) {
    if (entity.x < -padding) entity.x = W + padding;
    if (entity.x > W + padding) entity.x = -padding;
    if (entity.y < -padding) entity.y = H + padding;
    if (entity.y > H + padding) entity.y = -padding;
  }

  function createAsteroid(x, y, size, angle) {
    const config = ASTEROID_SIZES[size];
    const points = [];
    for (let i = 0; i < 9; i++) points.push(config.radius * (0.78 + Math.random() * 0.3));
    const speed = size === 'large' ? 35 + Math.random() * 35 : size === 'medium' ? 60 + Math.random() * 50 : 90 + Math.random() * 70;
    const direction = angle == null ? Math.random() * Math.PI * 2 : angle;
    return {
      x, y, size, radius: config.radius, points,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.8
    };
  }

  function createWave() {
    asteroids = [];
    const count = Math.min(16, 3 + wave * 2);
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0;
      for (let attempt = 0; attempt < 20; attempt++) {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { x = Math.random() * W; y = -50; }
        if (edge === 1) { x = W + 50; y = Math.random() * H; }
        if (edge === 2) { x = Math.random() * W; y = H + 50; }
        if (edge === 3) { x = -50; y = Math.random() * H; }
        if (Math.hypot(x - W / 2, y - H / 2) > 180) break;
      }
      asteroids.push(createAsteroid(x, y, 'large'));
    }
  }

  function resetPlayer() {
    player = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invincible: 2.2 };
  }

  function beginGame() {
    if (gameRunning) return;
    gameRunning = true;
    score = 0;
    wave = 1;
    lives = 3;
    bullets = [];
    ufoShots = [];
    ufos = [];
    powerups = [];
    particles = [];
    fireCooldown = 0;
    hyperspaceCooldown = 0;
    rapidTimer = 0;
    spreadTimer = 0;
    piercingTimer = 0;
    shieldTimer = 0;
    combo = 0;
    maxCombo = 0;
    lastKillAt = 0;
    ufoSpawnTimer = 9000;
    resetPlayer();
    createWave();
    createStars();
    overlay.classList.add('hidden');
    highscores.classList.add('hidden');
    if (window.GamePlatform) {
      GamePlatform.resetTimer();
      GamePlatform.startTimer();
    }
    updateHud();
    lastTime = performance.now();
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
  }

  function finishGame() {
    if (!gameRunning) return;
    gameRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    sfxGameOver();
    const topScores = saveScore(score);
    renderScores(topScores);
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('asteroids', score, elapsed * 1000, { maxWave: wave, maxCombo });
      GamePlatform.updateScore(score);
    }
    overlayMessage.textContent = 'Ship lost | Score: ' + score + ' | Wave: ' + wave;
    overlayButton.textContent = 'Play Again';
    overlay.classList.remove('hidden');
  }

  function nextWave() {
    wave += 1;
    score += 150;
    combo = 0;
    bullets = [];
    ufoShots = [];
    powerups = [];
    createWave();
    resetPlayer();
    waveBanner.textContent = 'WAVE ' + wave;
    waveBanner.classList.remove('hidden');
    clearTimeout(waveBannerTimer);
    waveBannerTimer = setTimeout(() => waveBanner.classList.add('hidden'), 900);
    sfxWave();
    updateHud();
  }

  function fire() {
    if (!gameRunning || fireCooldown > 0 || bullets.length >= 8) return;
    const angles = spreadTimer > 0 ? [-0.16, 0, 0.16] : [0];
    const speed = piercingTimer > 0 ? BULLET_SPEED + 80 : BULLET_SPEED;
    for (const offset of angles) {
      const angle = player.angle + offset;
      bullets.push({
        x: player.x + Math.cos(angle) * 19,
        y: player.y + Math.sin(angle) * 19,
        vx: player.vx + Math.cos(angle) * speed,
        vy: player.vy + Math.sin(angle) * speed,
        ttl: 1.3,
        piercing: piercingTimer > 0
      });
    }
    fireCooldown = rapidTimer > 0 ? 90 : 180;
    sfxShoot();
  }

  function spawnParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 120 + 35;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.7, color });
    }
  }

  function registerKill(baseScore) {
    const now = performance.now();
    combo = now - lastKillAt <= 2500 ? combo + 1 : 1;
    lastKillAt = now;
    maxCombo = Math.max(maxCombo, combo);
    const multiplier = Math.min(5, 1 + Math.floor((combo - 1) / 3));
    score += baseScore * multiplier;
  }

  function dropPowerup(x, y) {
    if (Math.random() > 0.13) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x: x - 13, y, w: 26, h: 18, vy: 65, pulse: 0, type });
  }

  function applyPowerup(powerup) {
    const type = powerup.type;
    if (type.id === 'rapid') rapidTimer = Math.max(rapidTimer, type.duration);
    if (type.id === 'spread') spreadTimer = Math.max(spreadTimer, type.duration);
    if (type.id === 'piercing') piercingTimer = Math.max(piercingTimer, type.duration);
    if (type.id === 'shield') shieldTimer = Math.max(shieldTimer, type.duration);
    spawnParticles(powerup.x, powerup.y, type.color, 18);
    sfxPowerup();
    updateHud();
  }

  function hyperspace() {
    if (!gameRunning || hyperspaceCooldown > 0) return;
    let x = W / 2, y = H / 2;
    for (let attempt = 0; attempt < 20; attempt++) {
      x = Math.random() * W;
      y = Math.random() * H;
      if (asteroids.every(asteroid => Math.hypot(asteroid.x - x, asteroid.y - y) > asteroid.radius + 70)) break;
    }
    spawnParticles(player.x, player.y, '#d5a7ff', 24);
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 0.8;
    hyperspaceCooldown = 6000;
    sfxHyperspace();
    updateHud();
  }

  function createUfo() {
    const fromLeft = Math.random() < 0.5;
    ufos.push({
      x: fromLeft ? -36 : W + 36,
      y: 70 + Math.random() * (H - 180),
      vx: fromLeft ? 85 + wave * 4 : -85 - wave * 4,
      vy: (Math.random() - 0.5) * 24,
      w: 32,
      h: 18,
      shootTimer: 900,
      phase: Math.random() * Math.PI * 2
    });
    sfxUfo();
  }

  function updateUfos(dt) {
    ufoSpawnTimer -= dt;
    if (ufoSpawnTimer <= 0 && ufos.length < 1) {
      createUfo();
      ufoSpawnTimer = Math.max(7000, 14000 - wave * 500);
    }
    for (let i = ufos.length - 1; i >= 0; i--) {
      const ufo = ufos[i];
      ufo.x += ufo.vx * dt / 1000;
      ufo.y += ufo.vy * dt / 1000;
      ufo.phase += dt * 0.004;
      ufo.y += Math.sin(ufo.phase) * 0.25;
      ufo.shootTimer -= dt;
      if (ufo.shootTimer <= 0) {
        const angle = Math.atan2(player.y - ufo.y, player.x - ufo.x);
        ufoShots.push({ x: ufo.x, y: ufo.y, vx: Math.cos(angle) * 180, vy: Math.sin(angle) * 180, ttl: 3 });
        ufo.shootTimer = Math.max(650, 1500 - wave * 35);
      }
      if (ufo.x < -70 || ufo.x > W + 70) ufos.splice(i, 1);
      if (player.invincible <= 0 && Math.hypot(player.x - ufo.x, player.y - ufo.y) < 28) hitPlayer();
    }
  }

  function hitPlayer() {
    if (player.invincible > 0) return;
    if (shieldTimer > 0) {
      shieldTimer = 0;
      player.invincible = 0.8;
      spawnParticles(player.x, player.y, '#66e676', 18);
      updateHud();
      return;
    }
    lives -= 1;
    combo = 0;
    player.invincible = 2.2;
    player.vx = 0;
    player.vy = 0;
    spawnParticles(player.x, player.y, '#ff6b9a', 22);
    resetPlayer();
    updateHud();
    if (lives <= 0) finishGame();
  }

  function destroyAsteroid(index) {
    const asteroid = asteroids[index];
    const config = ASTEROID_SIZES[asteroid.size];
    registerKill(config.score);
    spawnParticles(asteroid.x, asteroid.y, '#d5a7ff', asteroid.size === 'large' ? 24 : 12);
    sfxBreak();
    if (config.next) {
      const spread = Math.random() * Math.PI * 2;
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, config.next, spread));
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, config.next, spread + Math.PI));
    }
    dropPowerup(asteroid.x, asteroid.y);
    asteroids.splice(index, 1);
    updateHud();
  }

  function destroyUfo(index) {
    const ufo = ufos[index];
    registerKill(250);
    score += 100;
    spawnParticles(ufo.x, ufo.y, '#ff6b9a', 28);
    dropPowerup(ufo.x, ufo.y);
    ufos.splice(index, 1);
    sfxBreak();
    updateHud();
  }

  function updatePlayer(dt) {
    if (player.invincible > 0) player.invincible = Math.max(0, player.invincible - dt / 1000);
    hyperspaceCooldown = Math.max(0, hyperspaceCooldown - dt);
    rapidTimer = Math.max(0, rapidTimer - dt);
    spreadTimer = Math.max(0, spreadTimer - dt);
    piercingTimer = Math.max(0, piercingTimer - dt);
    shieldTimer = Math.max(0, shieldTimer - dt);
    const rotation = (keys.ArrowLeft || keys.KeyA ? -1 : 0) + (keys.ArrowRight || keys.KeyD ? 1 : 0);
    const thrusting = keys.ArrowUp || keys.KeyW;
    player.angle += rotation * ROTATION_SPEED * dt / 1000;
    if (thrusting) {
      player.vx += Math.cos(player.angle) * THRUST * dt / 1000;
      player.vy += Math.sin(player.angle) * THRUST * dt / 1000;
      if (Math.random() < 0.3) spawnParticles(player.x - Math.cos(player.angle) * 13, player.y - Math.sin(player.angle) * 13, '#ffd166', 1);
      if (Math.random() < 0.08) sfxThrust();
    }
    player.vx *= Math.pow(0.992, dt / 16.667);
    player.vy *= Math.pow(0.992, dt / 16.667);
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > MAX_SPEED) {
      player.vx = player.vx / speed * MAX_SPEED;
      player.vy = player.vy / speed * MAX_SPEED;
    }
    player.x += player.vx * dt / 1000;
    player.y += player.vy * dt / 1000;
    wrap(player, 18);
    if (combo && performance.now() - lastKillAt > 2500) combo = 0;
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.x += bullet.vx * dt / 1000;
      bullet.y += bullet.vy * dt / 1000;
      bullet.ttl -= dt / 1000;
      wrap(bullet, 2);
      if (bullet.ttl <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const asteroid = asteroids[j];
        if (Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) < asteroid.radius) {
          if (!bullet.piercing) bullets.splice(i, 1);
          destroyAsteroid(j);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (let j = ufos.length - 1; j >= 0; j--) {
        const ufo = ufos[j];
        if (Math.abs(bullet.x - ufo.x) < ufo.w / 2 && Math.abs(bullet.y - ufo.y) < ufo.h / 2) {
          if (!bullet.piercing) bullets.splice(i, 1);
          destroyUfo(j);
          break;
        }
      }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i];
      powerup.y += powerup.vy * dt / 1000;
      powerup.pulse += dt * 0.01;
      if (Math.hypot(powerup.x - player.x, powerup.y - player.y) < 25) {
        applyPowerup(powerup);
        powerups.splice(i, 1);
      } else if (powerup.y > H + 25) powerups.splice(i, 1);
    }

    for (let i = ufoShots.length - 1; i >= 0; i--) {
      const shot = ufoShots[i];
      shot.x += shot.vx * dt / 1000;
      shot.y += shot.vy * dt / 1000;
      shot.ttl -= dt / 1000;
      if (shot.ttl <= 0 || shot.x < -10 || shot.x > W + 10 || shot.y < -10 || shot.y > H + 10) {
        ufoShots.splice(i, 1);
        continue;
      }
      if (Math.hypot(shot.x - player.x, shot.y - player.y) < 14) {
        ufoShots.splice(i, 1);
        hitPlayer();
      }
    }
  }

  function updateAsteroids(dt) {
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      asteroid.x += asteroid.vx * dt / 1000;
      asteroid.y += asteroid.vy * dt / 1000;
      asteroid.rotation += asteroid.spin * dt / 1000;
      wrap(asteroid, asteroid.radius);
      if (player.invincible <= 0 && Math.hypot(player.x - asteroid.x, player.y - asteroid.y) < asteroid.radius + 12) {
        hitPlayer();
        break;
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx * dt / 1000;
      particle.y += particle.vy * dt / 1000;
      particle.life -= dt / 1000;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function update(dt) {
    fireCooldown = Math.max(0, fireCooldown - dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateAsteroids(dt);
    updateUfos(dt);
    if (!gameRunning) return;
    updateParticles(dt);
    updateHud();
    if (!asteroids.length && !ufos.length) nextWave();
  }

  function drawStars() {
    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = '#d6c6ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawAsteroid(asteroid) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.rotation);
    ctx.strokeStyle = '#d5a7ff';
    ctx.fillStyle = 'rgba(112, 75, 165, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    asteroid.points.forEach((radius, index) => {
      const angle = index / asteroid.points.length * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawUfo(ufo) {
    ctx.save();
    ctx.translate(ufo.x, ufo.y);
    ctx.strokeStyle = '#ff6b9a';
    ctx.fillStyle = 'rgba(255, 107, 154, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -3, 8, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerup(powerup) {
    const pulse = 1 + Math.sin(powerup.pulse) * 0.08;
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = powerup.type.color;
    ctx.shadowColor = powerup.type.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(-13, -9, 26, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#090713';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.type.label, 0, 1);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.strokeStyle = shieldTimer > 0 ? '#66e676' : '#fff';
    ctx.fillStyle = shieldTimer > 0 ? 'rgba(102,230,118,0.2)' : 'rgba(213, 167, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (keys.ArrowUp || keys.KeyW) {
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(-21 - Math.random() * 8, 0);
      ctx.lineTo(-11, 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05030b';
    ctx.fillRect(0, 0, W, H);
    drawStars();
    for (const asteroid of asteroids) drawAsteroid(asteroid);
    for (const ufo of ufos) drawUfo(ufo);
    for (const powerup of powerups) drawPowerup(powerup);
    for (const bullet of bullets) {
      ctx.fillStyle = bullet.piercing ? '#d5a7ff' : '#fff';
      ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
    }
    for (const shot of ufoShots) {
      ctx.fillStyle = '#ff6b9a';
      ctx.fillRect(shot.x - 2, shot.y - 2, 4, 4);
    }
    if (gameRunning) drawPlayer();
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / 0.7);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (!gameRunning) {
      render();
      return;
    }
    const dt = Math.min(40, now - lastTime);
    lastTime = now;
    update(dt);
    render();
    if (gameRunning) animationId = requestAnimationFrame(loop);
  }

  function startFromOverlay() {
    ensureAudio();
    beginGame();
  }

  overlayButton.addEventListener('click', event => {
    event.stopPropagation();
    startFromOverlay();
  });

  overlay.addEventListener('click', event => {
    if (event.target === overlay) startFromOverlay();
  });

  document.addEventListener('keydown', event => {
    if (!gameRunning) {
      if (event.key !== 'Tab') {
        event.preventDefault();
        startFromOverlay();
      }
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'A', 'd', 'D', 'w', 'W', ' ', 'h', 'H'].includes(event.key)) event.preventDefault();
    keys[event.code] = true;
    if (event.key === ' ') fire();
    if (event.key === 'h' || event.key === 'H') hyperspace();
  });

  document.addEventListener('keyup', event => {
    keys[event.code] = false;
  });

  window.addEventListener('blur', () => { keys = {}; });

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    if (event.pointerType === 'touch' || event.button === 0) fire();
    if (event.pointerType === 'touch' && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });

  document.querySelectorAll('.control-button').forEach(button => {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      if (!gameRunning) startFromOverlay();
      if (action === 'fire') fire();
      else if (action === 'jump') hyperspace();
      else keys[action === 'left' ? 'ArrowLeft' : action === 'right' ? 'ArrowRight' : 'ArrowUp'] = true;
      button.classList.add('pressed');
    });
    const release = event => {
      event.preventDefault();
      if (action !== 'fire' && action !== 'jump') keys[action === 'left' ? 'ArrowLeft' : action === 'right' ? 'ArrowRight' : 'ArrowUp'] = false;
      button.classList.remove('pressed');
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  });

  resetPlayer();
  createWave();
  createStars();
  renderScores(safeLoadScores());
  render();
  updateHud();

  if (window.GamePlatform) GamePlatform.initHeader('Asteroids');
})();
