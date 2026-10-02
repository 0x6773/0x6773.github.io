(function () {
  'use strict';

  const { setTimeout, clearTimeout, requestAnimationFrame, performance } = GameEngine.clock;
  const Sound = window.AsteroidsAudio;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  GameEngine.sharpCanvas(canvas);
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
  const STEP = 1000 / 120;
  const EXTRA_LIFE_EVERY = 10000;
  const ASTEROID_SIZES = {
    large: { radius: 42, score: 20, next: 'medium' },
    medium: { radius: 25, score: 50, next: 'small' },
    small: { radius: 14, score: 100, next: null }
  };
  const ROCK_COLORS = { large: '#c084fc', medium: '#e879f9', small: '#f472b6' };
  const KIND_COLORS = { iron: '#93c5fd', crystal: '#67e8f9' };
  const POWERUP_TYPES = [
    { id: 'rapid', label: 'RAPID', color: '#ffd166', duration: 8000 },
    { id: 'spread', label: 'SPREAD', color: '#ff8c42', duration: 8000 },
    { id: 'piercing', label: 'PIERCE', color: '#d5a7ff', duration: 7000 },
    { id: 'shield', label: 'SHIELD', color: '#66e676', duration: 7000 }
  ];
  const SHIP_PATH = new Path2D('M20 0 L-14 -12 L-8 0 L-14 12 Z');
  const SHIP_EDGES = [[20, 0, -14, -12], [-14, -12, -8, 0], [-8, 0, -14, 12], [-14, 12, 20, 0]];

  let gameRunning = false;
  let lastTime = 0;
  let acc = 0;
  let simTime = 0;
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
  let fragments = [];
  let fx = [];
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
  let endedAt = 0;
  let nextLifeAt = EXTRA_LIFE_EVERY;
  let wavePieces = 1;
  let waveKills = 0;
  let fireHeld = false;
  let thrusting = false;
  let shakeTime = 0, shakeMax = 1, shakeAmp = 0;
  let flash = null;
  let bgLayer = null;
  let firstFrame = true;

  function ensureAudio() {
    return GameEngine.audio();
  }

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
    bgLayer = null;
  }

  function wrap(entity, padding) {
    if (entity.x < -padding) entity.x = W + padding;
    if (entity.x > W + padding) entity.x = -padding;
    if (entity.y < -padding) entity.y = H + padding;
    if (entity.y > H + padding) entity.y = -padding;
  }

  function createAsteroid(x, y, size, angle, kind) {
    const config = ASTEROID_SIZES[size];
    const points = [];
    for (let i = 0; i < 10; i++) points.push(config.radius * (0.74 + Math.random() * 0.34));
    const speed = size === 'large' ? 35 + Math.random() * 35 : size === 'medium' ? 60 + Math.random() * 50 : 90 + Math.random() * 70;
    const direction = angle == null ? Math.random() * Math.PI * 2 : angle;
    const path = new Path2D();
    points.forEach((radius, index) => {
      const a = index / points.length * Math.PI * 2;
      if (index === 0) path.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
      else path.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    });
    path.closePath();
    const rotation = Math.random() * Math.PI * 2;
    const k = kind || 'rock';
    return {
      x, y, px: x, py: y, size, radius: config.radius, points, path,
      kind: k, hp: k === 'iron' ? 3 : 1, flash: 0,
      color: KIND_COLORS[k] || ROCK_COLORS[size],
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      rotation, prot: rotation,
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
      const roll = Math.random();
      const kind = wave >= 3 && roll < 0.18 ? 'iron' : wave >= 2 && roll < 0.3 ? 'crystal' : 'rock';
      asteroids.push(createAsteroid(x, y, 'large', null, kind));
    }
    wavePieces = count * 7;
    waveKills = 0;
  }

  function resetPlayer() {
    player = { x: W / 2, y: H / 2, px: W / 2, py: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, pangle: -Math.PI / 2, invincible: 2.2 };
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
    fragments = [];
    fx = [];
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
    nextLifeAt = EXTRA_LIFE_EVERY;
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
    acc = 0;
    firstFrame = true;
    Sound.sfx('start');
    Sound.setPace(1);
    Sound.music.start();
  }

  function finishGame() {
    if (!gameRunning) return;
    gameRunning = false;
    endedAt = performance.now();
    Sound.thrust(false);
    Sound.ufo(false);
    Sound.music.stop();
    Sound.sfx('gameover');
    const topScores = saveScore(score);
    renderScores(topScores);
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('asteroids', score, elapsed * 1000, { maxWave: wave, maxCombo });
      GamePlatform.updateScore(score);
    }
    overlayMessage.textContent = 'Ship lost | Score: ' + score + ' | Wave: ' + wave;
    overlayButton.textContent = 'Play Again';
    setTimeout(() => {
      if (gameRunning) return;
      endedAt = performance.now();
      overlay.classList.remove('hidden');
    }, 1000);
  }

  function showBanner(text, ms) {
    waveBanner.textContent = text;
    waveBanner.classList.remove('hidden');
    clearTimeout(waveBannerTimer);
    waveBannerTimer = setTimeout(() => waveBanner.classList.add('hidden'), ms || 900);
  }

  function nextWave() {
    wave += 1;
    addScore(150);
    combo = 0;
    bullets = [];
    ufoShots = [];
    powerups = [];
    createWave();
    resetPlayer();
    showBanner('WAVE ' + wave);
    Sound.sfx('wave');
    updateHud();
  }

  function fire() {
    if (!gameRunning || fireCooldown > 0 || bullets.length >= 8) return;
    const angles = spreadTimer > 0 ? [-0.16, 0, 0.16] : [0];
    const speed = piercingTimer > 0 ? BULLET_SPEED + 80 : BULLET_SPEED;
    for (const offset of angles) {
      const angle = player.angle + offset;
      const x = player.x + Math.cos(angle) * 19, y = player.y + Math.sin(angle) * 19;
      bullets.push({
        x, y, px: x, py: y,
        vx: player.vx + Math.cos(angle) * speed,
        vy: player.vy + Math.sin(angle) * speed,
        ttl: 1.3,
        piercing: piercingTimer > 0,
        hits: []
      });
    }
    fireCooldown = rapidTimer > 0 ? 90 : 180;
    Sound.sfx('fire', piercingTimer > 0);
  }

  function spawnParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 120 + 35;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.7, max: 0.7, color });
    }
  }

  function shatter(edges, x, y, rotation, color, speed) {
    for (const [ax, ay, bx, by] of edges) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const c = Math.cos(rotation), s = Math.sin(rotation);
      const wx = mx * c - my * s, wy = mx * s + my * c;
      const len = Math.hypot(wx, wy) || 1;
      const sp = speed * (0.5 + Math.random());
      fragments.push({
        x: x + wx, y: y + wy,
        vx: wx / len * sp + (Math.random() - 0.5) * 30, vy: wy / len * sp + (Math.random() - 0.5) * 30,
        ax: (ax - mx), ay: (ay - my), bx: (bx - mx), by: (by - my),
        rot: rotation, vr: (Math.random() - 0.5) * 6,
        life: 0.9 + Math.random() * 0.5, max: 1.4, color
      });
    }
  }

  function ring(x, y, color, r, ms) {
    fx.push({ k: 'ring', x, y, color, r, life: ms || 450, max: ms || 450 });
  }

  function popup(x, y, text, color) {
    fx.push({ k: 'popup', x, y, text, color, life: 900, max: 900 });
  }

  function shake(ms, amp) {
    if (ms >= shakeTime) { shakeTime = ms; shakeMax = ms; }
    shakeAmp = Math.max(amp, shakeTime > 0 ? shakeAmp : 0);
  }

  function addScore(points) {
    score += points;
    while (score >= nextLifeAt) {
      nextLifeAt += EXTRA_LIFE_EVERY;
      lives = Math.min(6, lives + 1);
      showBanner('EXTRA SHIP', 1200);
      Sound.sfx('extraLife');
    }
  }

  function registerKill(baseScore) {
    const now = simTime;
    combo = now - lastKillAt <= 2500 ? combo + 1 : 1;
    lastKillAt = now;
    maxCombo = Math.max(maxCombo, combo);
    const multiplier = Math.min(5, 1 + Math.floor((combo - 1) / 3));
    addScore(baseScore * multiplier);
    return baseScore * multiplier;
  }

  function dropPowerup(x, y, always) {
    if (!always && Math.random() > 0.13) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x, y, px: x, py: y, w: 26, h: 18, vy: 65, pulse: 0, type });
  }

  function applyPowerup(powerup) {
    const type = powerup.type;
    if (type.id === 'rapid') rapidTimer = Math.max(rapidTimer, type.duration);
    if (type.id === 'spread') spreadTimer = Math.max(spreadTimer, type.duration);
    if (type.id === 'piercing') piercingTimer = Math.max(piercingTimer, type.duration);
    if (type.id === 'shield') shieldTimer = Math.max(shieldTimer, type.duration);
    spawnParticles(powerup.x, powerup.y, type.color, 18);
    ring(powerup.x, powerup.y, type.color, 40);
    popup(powerup.x, powerup.y - 14, type.label, type.color);
    Sound.sfx('powerup');
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
    ring(player.x, player.y, '#d5a7ff', 46);
    player.x = player.px = x;
    player.y = player.py = y;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 0.8;
    ring(x, y, '#5ff6ff', 46);
    hyperspaceCooldown = 6000;
    Sound.sfx('hyperspace');
    updateHud();
  }

  function createUfo() {
    const fromLeft = Math.random() < 0.5;
    const small = wave >= 4 && Math.random() < 0.4;
    const x = fromLeft ? -36 : W + 36, y = 70 + Math.random() * (H - 180);
    const speed = (small ? 120 : 85) + wave * 4;
    ufos.push({
      x, y, px: x, py: y,
      vx: fromLeft ? speed : -speed,
      vy: (Math.random() - 0.5) * 24,
      w: small ? 22 : 32,
      h: small ? 12 : 18,
      small,
      shootTimer: small ? 700 : 900,
      phase: Math.random() * Math.PI * 2
    });
    Sound.ufo(true, small);
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
      ufo.y += Math.sin(ufo.phase) * 0.125;
      ufo.shootTimer -= dt;
      if (ufo.shootTimer <= 0) {
        let tx = player.x, ty = player.y;
        if (ufo.small) {
          const t = Math.hypot(player.x - ufo.x, player.y - ufo.y) / 220;
          tx += player.vx * t;
          ty += player.vy * t;
        }
        const spread = ufo.small ? Math.max(0.04, 0.3 - wave * 0.02) : 0.25;
        const angle = Math.atan2(ty - ufo.y, tx - ufo.x) + (Math.random() - 0.5) * spread;
        const sp = ufo.small ? 220 : 180;
        ufoShots.push({ x: ufo.x, y: ufo.y, px: ufo.x, py: ufo.y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, ttl: 3 });
        ufo.shootTimer = Math.max(ufo.small ? 500 : 650, (ufo.small ? 1100 : 1500) - wave * 35);
      }
      if (ufo.x < -70 || ufo.x > W + 70) {
        ufos.splice(i, 1);
        if (!ufos.length) Sound.ufo(false);
        continue;
      }
      if (player.invincible <= 0 && Math.hypot(player.x - ufo.x, player.y - ufo.y) < 28) hitPlayer();
    }
  }

  function hitPlayer() {
    if (player.invincible > 0) return;
    if (shieldTimer > 0) {
      shieldTimer = 0;
      player.invincible = 0.8;
      spawnParticles(player.x, player.y, '#66e676', 18);
      ring(player.x, player.y, '#66e676', 50);
      Sound.sfx('shield');
      updateHud();
      return;
    }
    lives -= 1;
    combo = 0;
    shatter(SHIP_EDGES, player.x, player.y, player.angle, '#5ff6ff', 60);
    spawnParticles(player.x, player.y, '#ff6b9a', 22);
    ring(player.x, player.y, '#ff6b9a', 80, 650);
    shake(500, 8);
    flash = { color: '255,107,154', life: 300, max: 300 };
    Sound.sfx('shipDown');
    resetPlayer();
    updateHud();
    if (lives <= 0) finishGame();
  }

  function destroyAsteroid(index) {
    const asteroid = asteroids[index];
    const config = ASTEROID_SIZES[asteroid.size];
    const gained = registerKill(config.score * (asteroid.kind === 'iron' ? 3 : 1));
    waveKills++;
    const edges = asteroid.points.map((radius, i) => {
      const a = i / asteroid.points.length * Math.PI * 2, b = (i + 1) / asteroid.points.length * Math.PI * 2;
      const r2 = asteroid.points[(i + 1) % asteroid.points.length];
      return [Math.cos(a) * radius, Math.sin(a) * radius, Math.cos(b) * r2, Math.sin(b) * r2];
    });
    shatter(edges, asteroid.x, asteroid.y, asteroid.rotation, asteroid.color, asteroid.size === 'large' ? 50 : 70);
    spawnParticles(asteroid.x, asteroid.y, asteroid.color, asteroid.size === 'large' ? 18 : 10);
    ring(asteroid.x, asteroid.y, asteroid.color, asteroid.radius * 1.8);
    if (asteroid.size === 'large') shake(160, 3);
    if (combo > 3 || asteroid.kind !== 'rock') popup(asteroid.x, asteroid.y - asteroid.radius, '+' + gained, asteroid.color);
    Sound.sfx('bang', asteroid.size);
    if (asteroid.kind === 'crystal') Sound.sfx('crystal');
    if (config.next) {
      const spread = Math.random() * Math.PI * 2;
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, config.next, spread));
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, config.next, spread + Math.PI));
    }
    dropPowerup(asteroid.x, asteroid.y, asteroid.kind === 'crystal');
    asteroids.splice(index, 1);
    updateHud();
  }

  function hitAsteroid(index) {
    const asteroid = asteroids[index];
    if (asteroid.hp > 1) {
      asteroid.hp--;
      asteroid.flash = 120;
      spawnParticles(asteroid.x, asteroid.y, '#ffffff', 6);
      Sound.sfx('clank');
      return false;
    }
    destroyAsteroid(index);
    return true;
  }

  function destroyUfo(index) {
    const ufo = ufos[index];
    const gained = registerKill(ufo.small ? 800 : 250) + (ufo.small ? 200 : 100);
    addScore(ufo.small ? 200 : 100);
    shatter([[-18, 2, 18, 2], [-10, -4, 10, -4], [-8, -4, 0, -11], [0, -11, 8, -4], [-18, 2, -10, 8], [10, 8, 18, 2]], ufo.x, ufo.y, 0, ufo.small ? '#ffd166' : '#ff6b9a', 80);
    spawnParticles(ufo.x, ufo.y, '#ff6b9a', 28);
    ring(ufo.x, ufo.y, ufo.small ? '#ffd166' : '#ff6b9a', 70, 600);
    popup(ufo.x, ufo.y - 16, '+' + gained, ufo.small ? '#ffd166' : '#ff6b9a');
    shake(260, 4);
    dropPowerup(ufo.x, ufo.y);
    ufos.splice(index, 1);
    if (!ufos.length) Sound.ufo(false);
    Sound.sfx('ufoDown');
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
    const nowThrusting = !!(keys.ArrowUp || keys.KeyW);
    if (nowThrusting !== thrusting) {
      thrusting = nowThrusting;
      Sound.thrust(thrusting);
    }
    player.angle += rotation * ROTATION_SPEED * dt / 1000;
    if (thrusting) {
      player.vx += Math.cos(player.angle) * THRUST * dt / 1000;
      player.vy += Math.sin(player.angle) * THRUST * dt / 1000;
      if (Math.random() < 0.15) spawnParticles(player.x - Math.cos(player.angle) * 13, player.y - Math.sin(player.angle) * 13, '#ffd166', 1);
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
    if (combo && simTime - lastKillAt > 2500) combo = 0;
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
        if (bullet.hits.indexOf(asteroid) >= 0) continue;
        if (Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) < asteroid.radius) {
          if (!bullet.piercing) bullets.splice(i, 1);
          else bullet.hits.push(asteroid);
          hitAsteroid(j);
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
        if (!gameRunning) return;
      }
    }
  }

  function updateAsteroids(dt) {
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      asteroid.x += asteroid.vx * dt / 1000;
      asteroid.y += asteroid.vy * dt / 1000;
      asteroid.rotation += asteroid.spin * dt / 1000;
      if (asteroid.flash) asteroid.flash = Math.max(0, asteroid.flash - dt);
      wrap(asteroid, asteroid.radius);
      if (gameRunning && player.invincible <= 0 && Math.hypot(player.x - asteroid.x, player.y - asteroid.y) < asteroid.radius + 12) {
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
    for (let i = fragments.length - 1; i >= 0; i--) {
      const f = fragments[i];
      f.x += f.vx * dt / 1000;
      f.y += f.vy * dt / 1000;
      f.rot += f.vr * dt / 1000;
      f.life -= dt / 1000;
      if (f.life <= 0) fragments.splice(i, 1);
    }
    for (const f of fx) f.life -= dt;
    fx = fx.filter(f => f.life > 0);
  }

  function savePrev() {
    player.px = player.x;
    player.py = player.y;
    player.pangle = player.angle;
    for (const list of [asteroids, bullets, ufos, ufoShots, powerups]) for (const e of list) { e.px = e.x; e.py = e.y; }
    for (const a of asteroids) a.prot = a.rotation;
  }

  function update(dt) {
    simTime += dt;
    savePrev();
    fireCooldown = Math.max(0, fireCooldown - dt);
    updatePlayer(dt);
    if (fireHeld || keys.Space) fire();
    updateBullets(dt);
    if (!gameRunning) return;
    updateAsteroids(dt);
    updateUfos(dt);
    if (!gameRunning) return;
    if (!asteroids.length && !ufos.length) nextWave();
  }

  function idle(dt) {
    for (const a of asteroids) { a.px = a.x; a.py = a.y; a.prot = a.rotation; }
    updateAsteroids(dt);
  }

  function background(k) {
    if (bgLayer && bgLayer.k === k) return bgLayer.canvas;
    const c = document.createElement('canvas');
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04020c');
    sky.addColorStop(1, '#0b0620');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    for (const [x, y, r, col] of [[W * 0.25, H * 0.2, 220, 'rgba(192,132,252,0.12)'], [W * 0.8, H * 0.7, 240, 'rgba(95,246,255,0.08)']]) {
      const n = g.createRadialGradient(x, y, 10, x, y, r);
      n.addColorStop(0, col);
      n.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = n;
      g.fillRect(0, 0, W, H);
    }
    for (const star of stars) {
      g.globalAlpha = star.alpha;
      g.fillStyle = '#d6c6ff';
      g.fillRect(star.x, star.y, star.size, star.size);
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    const vig = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
    bgLayer = { k, canvas: c };
    return c;
  }

  function neon(path, color, width) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = width * 5;
    ctx.stroke(path);
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = width * 2.4;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
    ctx.lineWidth = width;
    ctx.stroke(path);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = width * 0.45;
    ctx.stroke(path);
  }

  function lerpWrap(e, a) {
    const dx = e.x - e.px, dy = e.y - e.py;
    if (Math.abs(dx) > W / 2 || Math.abs(dy) > H / 2) return [e.x, e.y];
    return [e.px + dx * a, e.py + dy * a];
  }

  const CRYSTAL_PATH = new Path2D('M0 -0.55 L0.45 0 L0 0.55 L-0.45 0 Z M-0.45 0 L0.45 0 M0 -0.55 L0 0.55');
  const IRON_PATH = new Path2D('M-0.4 -0.2 L0.4 -0.2 M-0.4 0.2 L0.4 0.2 M-0.2 -0.4 L-0.2 0.4 M0.2 -0.4 L0.2 0.4');

  function drawAsteroid(asteroid, a) {
    const [x, y] = lerpWrap(asteroid, a);
    const rot = asteroid.prot + (asteroid.rotation - asteroid.prot) * a;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const color = asteroid.flash ? '#ffffff' : asteroid.color;
    ctx.fillStyle = 'rgba(40, 20, 80, 0.35)';
    ctx.fill(asteroid.path);
    neon(asteroid.path, color, asteroid.size === 'small' ? 1.5 : 2);
    if (asteroid.kind !== 'rock') {
      const s = asteroid.radius;
      ctx.scale(s, s);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / s;
      ctx.stroke(asteroid.kind === 'crystal' ? CRYSTAL_PATH : IRON_PATH);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  const UFO_PATH = new Path2D('M-18 2 L18 2 L10 8 L-10 8 Z M-18 2 L-10 -4 L10 -4 L18 2 M-8 -4 L-4 -10 L4 -10 L8 -4');

  function drawUfo(ufo, a) {
    const [x, y] = lerpWrap(ufo, a);
    ctx.save();
    ctx.translate(x, y);
    if (ufo.small) ctx.scale(0.66, 0.66);
    neon(UFO_PATH, ufo.small ? '#ffd166' : '#ff6b9a', 2);
    ctx.fillStyle = Math.floor(simTime / 120) % 2 ? '#ffffff' : (ufo.small ? '#ffd166' : '#ff6b9a');
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * 7 - 1, 4, 2, 2);
    ctx.restore();
  }

  function drawPowerup(powerup, a) {
    const pulse = 1 + Math.sin(powerup.pulse) * 0.08;
    const [x, y] = lerpWrap(powerup, a);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    const box = new Path2D();
    box.roundRect(-14, -9, 28, 18, 4);
    ctx.fillStyle = 'rgba(10, 6, 24, 0.85)';
    ctx.fill(box);
    neon(box, powerup.type.color, 1.5);
    ctx.fillStyle = powerup.type.color;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.type.label, 0, 1);
    ctx.restore();
  }

  function drawPlayer(a) {
    if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) return;
    const [x, y] = lerpWrap(player, a);
    const angle = player.pangle + (player.angle - player.pangle) * a;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (thrusting) {
      const flame = new Path2D();
      flame.moveTo(-11, -5);
      flame.lineTo(-21 - Math.random() * 9, 0);
      flame.lineTo(-11, 5);
      neon(flame, '#ffd166', 1.8);
    }
    ctx.fillStyle = 'rgba(95, 246, 255, 0.12)';
    ctx.fill(SHIP_PATH);
    neon(SHIP_PATH, '#5ff6ff', 2);
    ctx.restore();
    if (shieldTimer > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(simTime * 0.002);
      const bubble = new Path2D();
      bubble.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.setLineDash([6, 5]);
      neon(bubble, '#66ffa8', 1.4);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function render(now, a, dt) {
    const k = ctx.getTransform().a || 1;
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeAmp * (shakeTime / shakeMax);
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }
    ctx.globalAlpha = firstFrame ? 1 : 1 - Math.exp(-dt / 38);
    firstFrame = false;
    ctx.drawImage(background(k), -12, -12, W + 24, H + 24);
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const asteroid of asteroids) drawAsteroid(asteroid, a);
    for (const ufo of ufos) drawUfo(ufo, a);
    for (const powerup of powerups) drawPowerup(powerup, a);
    for (const bullet of bullets) {
      const [x, y] = lerpWrap(bullet, a);
      const sp = Math.hypot(bullet.vx, bullet.vy) || 1;
      const streak = new Path2D();
      streak.moveTo(x - bullet.vx / sp * 9, y - bullet.vy / sp * 9);
      streak.lineTo(x, y);
      neon(streak, bullet.piercing ? '#d5a7ff' : '#9ff9ff', 1.6);
    }
    for (const shot of ufoShots) {
      const [x, y] = lerpWrap(shot, a);
      ctx.fillStyle = '#ff6b9a';
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe0ea';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
    if (gameRunning) drawPlayer(a);
    for (const f of fragments) {
      const t = Math.max(0, f.life / f.max);
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      const seg = new Path2D();
      seg.moveTo(f.x + f.ax * c - f.ay * s, f.y + f.ax * s + f.ay * c);
      seg.lineTo(f.x + f.bx * c - f.by * s, f.y + f.bx * s + f.by * c);
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.stroke(seg);
    }
    ctx.globalAlpha = 1;
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 1.5, particle.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    for (const f of fx) {
      const t = Math.max(0, f.life / f.max);
      if (f.k === 'ring') {
        const r = new Path2D();
        r.arc(f.x, f.y, f.r * (1 - t) + 4, 0, Math.PI * 2);
        ctx.globalAlpha = t;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2.5 * t + 0.5;
        ctx.stroke(r);
        ctx.globalAlpha = 1;
      } else if (f.k === 'popup') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.font = '900 13px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - (1 - t) * 24);
        ctx.restore();
      }
    }
    if (flash) {
      ctx.fillStyle = 'rgba(' + flash.color + ',' + 0.28 * (flash.life / flash.max) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(100, now - lastTime);
    lastTime = now;
    if (gameRunning) {
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 24 && gameRunning) {
        acc -= STEP;
        update(STEP);
      }
      if (guard >= 24) acc = 0;
      if (gameRunning) {
        Sound.setPace(1 + Math.min(2, waveKills / Math.max(1, wavePieces) * 2.2));
        updateHud();
      }
    } else {
      idle(dt);
    }
    updateParticles(dt);
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (flash && (flash.life -= dt) <= 0) flash = null;
    render(now, gameRunning ? Math.min(1, acc / STEP) : 1, dt);
    Sound.update();
    requestAnimationFrame(loop);
  }

  function startFromOverlay() {
    if (overlay.classList.contains('hidden') || performance.now() - endedAt < 700) return;
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

  function syncMusicButton() {
    const btn = document.querySelector('#gp-header .gp-btn-music');
    if (!btn) return;
    const on = Sound.music.isEnabled();
    btn.classList.toggle('off', !on);
    btn.title = on ? 'Music on (M)' : 'Music off (M)';
    btn.setAttribute('aria-pressed', String(on));
  }

  function toggleMusic() {
    Sound.music.setEnabled(!Sound.music.isEnabled());
    syncMusicButton();
  }

  function addMusicButton() {
    const actions = document.querySelector('#gp-header .gp-header-actions');
    if (!actions || actions.querySelector('.gp-btn-music')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gp-btn-music';
    btn.textContent = '\u{1F3B5}';
    btn.addEventListener('click', event => {
      event.preventDefault();
      btn.blur();
      toggleMusic();
    });
    actions.insertBefore(btn, actions.querySelector('.gp-btn-sound'));
    syncMusicButton();
  }

  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === 'KeyM') {
      if (!event.repeat) toggleMusic();
      return;
    }
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

  window.addEventListener('blur', () => { keys = {}; fireHeld = false; });

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    if (event.pointerType === 'touch' || event.button === 0) { fire(); fireHeld = true; }
    if (event.pointerType === 'touch' && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => canvas.addEventListener(type, () => { fireHeld = false; }));

  document.querySelectorAll('.control-button').forEach(button => {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      if (!gameRunning) startFromOverlay();
      if (action === 'fire') { fire(); fireHeld = true; }
      else if (action === 'jump') hyperspace();
      else keys[action === 'left' ? 'ArrowLeft' : action === 'right' ? 'ArrowRight' : 'ArrowUp'] = true;
      button.classList.add('pressed');
    });
    const release = event => {
      event.preventDefault();
      if (action === 'fire') fireHeld = false;
      else if (action !== 'jump') keys[action === 'left' ? 'ArrowLeft' : action === 'right' ? 'ArrowRight' : 'ArrowUp'] = false;
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
  updateHud();

  if (window.GamePlatform) GamePlatform.initHeader('Asteroids');
  addMusicButton();
  lastTime = performance.now();
  requestAnimationFrame(loop);
  GameEngine.pausable({ isActive: () => gameRunning, container: '#game-area' });
})();
