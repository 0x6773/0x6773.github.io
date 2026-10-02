(function () {
  'use strict';

  const { setTimeout, clearTimeout, requestAnimationFrame, performance } = GameEngine.clock;
  const Sound = window.InvadersAudio;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  GameEngine.sharpCanvas(canvas);
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const livesEl = document.getElementById('lives');
  const comboEl = document.getElementById('combo');
  const powerupStatusEl = document.getElementById('powerup-status');
  const overlay = document.getElementById('overlay');
  const overlayMessage = document.getElementById('overlay-message');
  const overlayButton = document.getElementById('overlay-button');
  const waveBanner = document.getElementById('wave-banner');
  const highscores = document.getElementById('highscores');

  const W = canvas.width;
  const H = canvas.height;
  const PLAYER_W = 34;
  const PLAYER_H = 18;
  const PLAYER_Y = H - 48;
  const PLAYER_SPEED = 260;
  const BULLET_SPEED = 390;
  const ENEMY_BULLET_SPEED = 170;
  const INVADER_W = 24;
  const INVADER_H = 18;
  const SCORE_KEY = 'spaceinvaders_highscores';
  const COLORS = ['#00e5ff', '#7c4dff', '#ff4d8d', '#ffca28', '#66e676'];
  const STEP = 1000 / 120;
  const UFO_POINTS = [50, 100, 150, 300];
  const POWERUP_TYPES = [
    { id: 'rapid', label: 'RAPID', color: '#ffca28', duration: 8000 },
    { id: 'spread', label: 'SPREAD', color: '#ff8c42', duration: 8000 },
    { id: 'laser', label: 'LASER', color: '#ff4d8d', duration: 7000 },
    { id: 'shield', label: 'SHIELD', color: '#66e676', duration: 0 },
    { id: 'life', label: 'LIFE', color: '#00e5ff', duration: 0 }
  ];

  let gameRunning = false;
  let lastTime = 0;
  let acc = 0;
  let simTime = 0;
  let score = 0;
  let wave = 1;
  let lives = 3;
  let player;
  let invaders = [];
  let playerBullets = [];
  let enemyBullets = [];
  let powerups = [];
  let shields = [];
  let particles = [];
  let fx = [];
  let starLayers = [];
  let keys = {};
  let enemyDirection = 1;
  let enemyShootTimer = 800;
  let shotCooldown = 0;
  let rapidTimer = 0;
  let spreadTimer = 0;
  let laserTimer = 0;
  let combo = 0;
  let maxCombo = 0;
  let lastKillAt = 0;
  let waveBannerTimer = null;
  let endedAt = 0;
  let formationTravel = 0;
  let animFrame = 0;
  let waveTotal = 50;
  let ufo = null;
  let ufoTimer = 15000;
  let shakeTime = 0, shakeMax = 1, shakeAmp = 0;
  let flash = null;
  let fireHeld = false;
  let muzzle = 0;
  let invulnerable = 0;
  const spriteCache = new Map();
  let bgLayer = null;

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
    comboEl.textContent = combo > 1 ? 'x' + Math.min(5, 1 + Math.floor((combo - 1) / 3)) : '--';
    const active = [];
    if (rapidTimer > 0) active.push('RAPID ' + formatSeconds(rapidTimer));
    if (spreadTimer > 0) active.push('SPREAD ' + formatSeconds(spreadTimer));
    if (laserTimer > 0) active.push('LASER ' + formatSeconds(laserTimer));
    powerupStatusEl.textContent = active.length ? active.join('  |  ') : 'Destroy invaders to earn power-ups';
    if (window.GamePlatform) GamePlatform.updateScore(score);
  }

  function createStars() {
    starLayers = [0.25, 0.55, 1].map((depth, i) => {
      const list = [];
      for (let k = 0; k < [70, 40, 18][i]; k++) {
        list.push({ x: Math.random() * W, y: Math.random() * H, size: (0.6 + Math.random()) * (0.8 + depth), alpha: 0.25 + Math.random() * 0.5 * depth + depth * 0.25, tw: Math.random() * 6 });
      }
      return { depth, list };
    });
  }

  function createInvaders() {
    invaders = [];
    ufo = null;
    Sound.ufo(false);
    if (wave % 5 === 0) {
      invaders.push({
        isBoss: true,
        x: W / 2 - 70,
        y: 70,
        px: W / 2 - 70,
        py: 70,
        w: 140,
        h: 54,
        hp: 24 + wave * 3,
        maxHp: 24 + wave * 3,
        vx: 56 + wave * 2,
        color: '#ff4d8d'
      });
      enemyDirection = 1;
      enemyShootTimer = 500;
      waveTotal = 1;
      Sound.sfx('boss');
      return;
    }
    const cols = 10;
    const rows = 5;
    const startX = 38;
    const startY = 62;
    const gapX = 37;
    const gapY = 31;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * gapX, y = startY + row * gapY;
        invaders.push({ x, y, px: x, py: y, w: INVADER_W, h: INVADER_H, row, color: COLORS[row] });
      }
    }
    waveTotal = invaders.length;
    enemyDirection = wave % 2 === 0 ? -1 : 1;
    enemyShootTimer = 700;
    ufoTimer = 12000 + Math.random() * 10000;
  }

  function createShields() {
    shields = [];
    const starts = [82, 190, 298];
    for (const startX of starts) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
          if (row === 0 && (col === 0 || col === 1 || col === 6 || col === 7)) continue;
          if (row === 2 && (col === 2 || col === 3 || col === 4 || col === 5)) continue;
          shields.push({ x: startX + col * 8, y: H - 142 + row * 8, w: 8, h: 8, alive: true, hit: 0 });
        }
      }
    }
  }

  function resetPlayer() {
    player = { x: W / 2 - PLAYER_W / 2, px: W / 2 - PLAYER_W / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H, vx: 0, tilt: 0 };
  }

  function beginGame() {
    if (gameRunning) return;
    gameRunning = true;
    score = 0;
    wave = 1;
    lives = 3;
    playerBullets = [];
    enemyBullets = [];
    powerups = [];
    particles = [];
    fx = [];
    shotCooldown = 0;
    rapidTimer = 0;
    spreadTimer = 0;
    laserTimer = 0;
    combo = 0;
    maxCombo = 0;
    lastKillAt = 0;
    invulnerable = 0;
    resetPlayer();
    createInvaders();
    createShields();
    createStars();
    overlay.classList.add('hidden');
    highscores.classList.add('hidden');
    if (window.GamePlatform) {
      GamePlatform.resetTimer();
      GamePlatform.startTimer();
    }
    updateHud();
    acc = 0;
    Sound.sfx('start');
    Sound.setPace(1);
    Sound.music.start();
  }

  function finishGame(won) {
    if (!gameRunning) return;
    gameRunning = false;
    endedAt = performance.now();
    Sound.ufo(false);
    Sound.music.stop();
    if (won) Sound.sfx('life'); else Sound.sfx('gameover');
    explode(player.x + player.w / 2, player.y + player.h / 2, '#00e5ff', 40, true);
    const topScores = saveScore(score);
    renderScores(topScores);
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('space-invaders', score, elapsed * 1000, { win: won, maxCombo });
      GamePlatform.updateScore(score);
    }
    overlayMessage.textContent = (won ? 'Sector cleared' : 'The invasion reached Earth') + ' | Score: ' + score + ' | Wave: ' + wave;
    overlayButton.textContent = 'Play Again';
    setTimeout(() => {
      if (gameRunning) return;
      endedAt = performance.now();
      overlay.classList.remove('hidden');
    }, 900);
  }

  function nextWave() {
    wave += 1;
    score += 200;
    combo = 0;
    playerBullets = [];
    enemyBullets = [];
    powerups = [];
    createInvaders();
    createShields();
    resetPlayer();
    waveBanner.textContent = wave % 5 === 0 ? 'BOSS WAVE ' + wave : 'WAVE ' + wave;
    waveBanner.classList.remove('hidden');
    clearTimeout(waveBannerTimer);
    waveBannerTimer = setTimeout(() => waveBanner.classList.add('hidden'), 1100);
    Sound.sfx('wave');
    updateHud();
  }

  function fire() {
    if (!gameRunning || shotCooldown > 0 || playerBullets.length >= 6) return;
    const rapid = rapidTimer > 0;
    const spread = spreadTimer > 0;
    const laser = laserTimer > 0;
    const bulletSpeed = laser ? 570 : BULLET_SPEED;
    const bulletWidth = laser ? 7 : 4;
    const shots = spread ? [-90, 0, 90] : [0];
    for (const vx of shots) {
      const x = player.x + player.w / 2 - bulletWidth / 2, y = player.y - 8;
      playerBullets.push({ x, y, px: x, py: y, w: bulletWidth, h: laser ? 18 : 12, vx, speed: bulletSpeed, laser });
    }
    shotCooldown = rapid ? 95 : 220;
    muzzle = 80;
    Sound.sfx('shoot', laser ? 'laser' : 'gun');
  }

  function movePlayerTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    player.x = Math.max(0, Math.min(W - player.w, (clientX - rect.left) * scale - player.w / 2));
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function spawnParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 90 + 30;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.65, max: 0.65, color, size: 2 + Math.random() * 2 });
    }
  }

  function explode(x, y, color, amount, big) {
    spawnParticles(x, y, color, amount);
    spawnParticles(x, y, '#ffffff', Math.ceil(amount / 4));
    for (let i = 0; i < (big ? 10 : 4); i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, max: 0.9, color, size: 3 + Math.random() * 3, debris: true, rot: Math.random() * 6 });
    }
    fx.push({ k: 'ring', x, y, color, r: big ? 70 : 28, life: big ? 600 : 360, max: big ? 600 : 360 });
    fx.push({ k: 'glow', x, y, color, r: big ? 60 : 22, life: 220, max: 220 });
  }

  function popup(x, y, text, color, size) {
    fx.push({ k: 'popup', x, y, text, color, size: size || 13, life: 900, max: 900 });
  }

  function shake(ms, amp) {
    if (ms >= shakeTime) { shakeTime = ms; shakeMax = ms; }
    shakeAmp = Math.max(amp, shakeTime > 0 ? shakeAmp : 0);
  }

  function dropPowerup(x, y) {
    if (Math.random() > 0.14) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x: x - 12, y, px: x - 12, py: y, w: 24, h: 18, vy: 62, type, pulse: 0 });
  }

  function repairShields() {
    let restored = 0;
    for (const shield of shields) {
      if (!shield.alive) {
        shield.alive = true;
        restored++;
        if (restored >= 8) break;
      }
    }
  }

  function applyPowerup(powerup) {
    const type = powerup.type;
    if (type.id === 'rapid') rapidTimer = Math.max(rapidTimer, type.duration);
    if (type.id === 'spread') spreadTimer = Math.max(spreadTimer, type.duration);
    if (type.id === 'laser') laserTimer = Math.max(laserTimer, type.duration);
    if (type.id === 'shield') repairShields();
    if (type.id === 'life') lives = Math.min(5, lives + 1);
    spawnParticles(powerup.x + powerup.w / 2, powerup.y, type.color, 16);
    popup(powerup.x + powerup.w / 2, powerup.y - 6, type.label, type.color, 14);
    Sound.sfx(type.id === 'life' ? 'life' : 'powerup');
    updateHud();
  }

  function chooseShooter() {
    if (invaders.length === 1 && invaders[0].isBoss) return invaders[0];
    const shooters = [];
    for (let col = 0; col < 10; col++) {
      let candidate = null;
      for (const invader of invaders) {
        if (invader.x + invader.w / 2 >= 32 + col * 37 && invader.x + invader.w / 2 < 69 + col * 37 && (!candidate || invader.y > candidate.y)) candidate = invader;
      }
      if (candidate) shooters.push(candidate);
    }
    return shooters.length ? shooters[Math.floor(Math.random() * shooters.length)] : null;
  }

  function enemyShot(x, y, w, h, vx) {
    enemyBullets.push({ x, y, px: x, py: y, w, h, vx: vx || 0, phase: Math.random() * 6 });
  }

  function updateBoss(dt, boss) {
    boss.x += boss.vx * dt / 1000;
    if (boss.x <= 18 || boss.x + boss.w >= W - 18) boss.vx *= -1;
    boss.y = 70 + Math.sin(simTime * 0.002) * 12;
    enemyShootTimer -= dt;
    if (enemyShootTimer <= 0) {
      enemyShot(boss.x + boss.w * 0.25 - 2, boss.y + boss.h, 5, 14);
      enemyShot(boss.x + boss.w * 0.75 - 2, boss.y + boss.h, 5, 14);
      if (boss.hp < boss.maxHp / 2) enemyShot(boss.x + boss.w * 0.5 - 2, boss.y + boss.h, 5, 14, (player.x - boss.x - boss.w / 2) * 0.25);
      enemyShootTimer = Math.max(300, 850 - wave * 30);
    }
    if (boss.y + boss.h >= player.y - 6) finishGame(false);
  }

  function updateInvaders(dt) {
    if (!invaders.length) return;
    if (invaders.length === 1 && invaders[0].isBoss) {
      updateBoss(dt, invaders[0]);
      return;
    }
    const speed = 22 + Math.min(58, wave * 4) + (1 - invaders.length / waveTotal) * 40;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const invader of invaders) {
      minX = Math.min(minX, invader.x);
      maxX = Math.max(maxX, invader.x + invader.w);
    }
    const distance = speed * dt / 1000;
    if ((enemyDirection > 0 && maxX + distance >= W - 14) || (enemyDirection < 0 && minX - distance <= 14)) {
      enemyDirection *= -1;
      for (const invader of invaders) invader.y += 16;
      animFrame ^= 1;
    } else {
      for (const invader of invaders) invader.x += distance * enemyDirection;
      formationTravel += distance;
      if (formationTravel >= 12) { formationTravel = 0; animFrame ^= 1; }
    }
    enemyShootTimer -= dt;
    if (enemyShootTimer <= 0) {
      const shooter = chooseShooter();
      if (shooter) enemyShot(shooter.x + shooter.w / 2 - 2, shooter.y + shooter.h, 4, 12);
      enemyShootTimer = Math.max(320, 950 - wave * 40) + Math.random() * 420;
    }
    for (const invader of invaders) {
      if (invader.y + invader.h >= player.y - 6) finishGame(false);
    }
  }

  function updateUfo(dt) {
    if (invaders.length === 1 && invaders[0].isBoss) return;
    if (!ufo) {
      ufoTimer -= dt;
      if (ufoTimer <= 0 && invaders.length > 4) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const x = dir > 0 ? -46 : W + 6;
        ufo = { x, px: x, y: 30, py: 30, w: 40, h: 16, vx: dir * 95 };
        Sound.ufo(true);
      }
      return;
    }
    ufo.x += ufo.vx * dt / 1000;
    if (ufo.x < -60 || ufo.x > W + 20) {
      ufo = null;
      Sound.ufo(false);
      ufoTimer = 18000 + Math.random() * 12000;
    }
  }

  function registerKill(target) {
    const now = simTime;
    combo = now - lastKillAt <= 2500 ? combo + 1 : 1;
    lastKillAt = now;
    maxCombo = Math.max(maxCombo, combo);
    const multiplier = Math.min(5, 1 + Math.floor((combo - 1) / 3));
    const base = target.isBoss ? 500 : (5 - target.row) * 10;
    score += base * multiplier;
    return base * multiplier;
  }

  function hitPlayer() {
    lives -= 1;
    combo = 0;
    explode(player.x + player.w / 2, player.y + player.h / 2, '#ff4d8d', 26, true);
    shake(420, 7);
    flash = { color: '255,77,141', life: 280, max: 280 };
    Sound.sfx('playerHit');
    resetPlayer();
    invulnerable = 1500;
    playerBullets = [];
    updateHud();
    if (lives <= 0) finishGame(false);
  }

  function updateBullets(dt) {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      bullet.x += bullet.vx * dt / 1000;
      bullet.y -= bullet.speed * dt / 1000;
      if (bullet.y + bullet.h < 0) {
        playerBullets.splice(i, 1);
        continue;
      }
      if (ufo && overlap(bullet, ufo)) {
        const pts = UFO_POINTS[Math.floor(Math.random() * UFO_POINTS.length)];
        score += pts;
        explode(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, '#ff6bff', 30, true);
        popup(ufo.x + ufo.w / 2, ufo.y + 22, '+' + pts, '#ff9bff', 18);
        shake(200, 3);
        Sound.ufo(false);
        Sound.sfx('ufoHit');
        ufo = null;
        ufoTimer = 18000 + Math.random() * 12000;
        playerBullets.splice(i, 1);
        updateHud();
        continue;
      }
      let hit = -1;
      for (let j = invaders.length - 1; j >= 0; j--) {
        if (overlap(bullet, invaders[j])) { hit = j; break; }
      }
      if (hit >= 0) {
        const target = invaders[hit];
        if (target.isBoss) {
          target.hp -= 1;
          target.flash = 80;
          score += 25;
          spawnParticles(bullet.x, bullet.y, target.color, 4);
          Sound.sfx('bossHit');
          if (target.hp <= 0) {
            registerKill(target);
            explode(target.x + target.w / 2, target.y + target.h / 2, target.color, 60, true);
            popup(target.x + target.w / 2, target.y + target.h / 2, '+500', '#ffca28', 20);
            shake(600, 9);
            Sound.sfx('bigBoom');
            invaders.splice(hit, 1);
            dropPowerup(target.x + target.w / 2, target.y);
            dropPowerup(target.x + target.w / 2, target.y + 16);
          }
        } else {
          const gained = registerKill(target);
          explode(target.x + target.w / 2, target.y + target.h / 2, target.color, 12, false);
          if (combo > 3) popup(target.x + target.w / 2, target.y, '+' + gained, target.color, 12);
          dropPowerup(target.x + target.w / 2, target.y);
          invaders.splice(hit, 1);
          Sound.sfx('kill', target.row);
        }
        playerBullets.splice(i, 1);
        updateHud();
      }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i];
      powerup.y += powerup.vy * dt / 1000;
      powerup.pulse += dt * 0.01;
      if (overlap(powerup, player)) {
        applyPowerup(powerup);
        powerups.splice(i, 1);
      } else if (powerup.y > H) {
        powerups.splice(i, 1);
      }
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      bullet.y += ENEMY_BULLET_SPEED * dt / 1000;
      bullet.x += bullet.vx * dt / 1000;
      let removed = false;
      for (const shield of shields) {
        if (shield.alive && overlap(bullet, shield)) {
          shield.alive = false;
          enemyBullets.splice(i, 1);
          spawnParticles(shield.x + 4, shield.y + 4, '#66e676', 5);
          Sound.sfx('shield');
          removed = true;
          break;
        }
      }
      if (removed) continue;
      if (invulnerable <= 0 && overlap(bullet, player)) {
        enemyBullets.splice(i, 1);
        hitPlayer();
        if (!gameRunning) return;
        continue;
      }
      if (bullet.y > H) enemyBullets.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx * dt / 1000;
      particle.y += particle.vy * dt / 1000;
      particle.vy += 85 * dt / 1000;
      if (particle.debris) { particle.vx *= 0.99; particle.rot += dt * 0.01; }
      particle.life -= dt / 1000;
      if (particle.life <= 0) particles.splice(i, 1);
    }
    for (const f of fx) f.life -= dt;
    fx = fx.filter(f => f.life > 0);
  }

  function savePrev() {
    player.px = player.x;
    for (const list of [invaders, playerBullets, enemyBullets, powerups]) for (const e of list) { e.px = e.x; e.py = e.y; }
    if (ufo) { ufo.px = ufo.x; ufo.py = ufo.y; }
  }

  function update(dt) {
    simTime += dt;
    savePrev();
    const direction = (keys.ArrowLeft || keys.KeyA ? -1 : 0) + (keys.ArrowRight || keys.KeyD ? 1 : 0);
    const before = player.x;
    player.x += direction * PLAYER_SPEED * dt / 1000;
    player.x = Math.max(0, Math.min(W - player.w, player.x));
    player.vx = (player.x - before) / dt * 1000;
    player.tilt += ((player.vx / PLAYER_SPEED) * 0.35 - player.tilt) * Math.min(1, dt / 90);
    shotCooldown = Math.max(0, shotCooldown - dt);
    rapidTimer = Math.max(0, rapidTimer - dt);
    spreadTimer = Math.max(0, spreadTimer - dt);
    laserTimer = Math.max(0, laserTimer - dt);
    invulnerable = Math.max(0, invulnerable - dt);
    muzzle = Math.max(0, muzzle - dt);
    if (fireHeld || keys.Space || keys.ArrowUp) fire();
    if (combo && simTime - lastKillAt > 2500) combo = 0;
    updateInvaders(dt);
    if (!gameRunning) return;
    updateUfo(dt);
    updateBullets(dt);
    if (!gameRunning) return;
    for (const invader of invaders) if (invader.flash) invader.flash = Math.max(0, invader.flash - dt);
    for (const shield of shields) if (shield.hit) shield.hit = Math.max(0, shield.hit - dt);
    if (!invaders.length) nextWave();
  }

  function background(k) {
    if (bgLayer && bgLayer.k === k) return bgLayer.canvas;
    const c = document.createElement('canvas');
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04050f');
    sky.addColorStop(0.6, '#070b22');
    sky.addColorStop(1, '#0d1638');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    for (const [x, y, r, col] of [[90, 150, 160, 'rgba(124,77,255,0.18)'], [340, 300, 180, 'rgba(0,229,255,0.10)'], [210, 60, 120, 'rgba(255,77,141,0.10)']]) {
      const n = g.createRadialGradient(x, y, 10, x, y, r);
      n.addColorStop(0, col);
      n.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = n;
      g.fillRect(0, 0, W, H);
    }
    const cx = W / 2, cy = H + 330, R = 380;
    const atmo = g.createRadialGradient(cx, cy, R - 10, cx, cy, R + 40);
    atmo.addColorStop(0, 'rgba(80,190,255,0.55)');
    atmo.addColorStop(1, 'rgba(80,190,255,0)');
    g.fillStyle = atmo;
    g.beginPath(); g.arc(cx, cy, R + 40, 0, Math.PI * 2); g.fill();
    const planet = g.createLinearGradient(0, H - 60, 0, H);
    planet.addColorStop(0, '#1d4f8a');
    planet.addColorStop(1, '#0b2246');
    g.fillStyle = planet;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(160,230,255,0.6)';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, R, Math.PI * 1.25, Math.PI * 1.75); g.stroke();
    bgLayer = { k, canvas: c };
    return c;
  }

  function invaderSprite(type, color, frame, k) {
    const key = type + color + frame + '|' + k;
    let sp = spriteCache.get(key);
    if (sp) return sp;
    const pad = 8, w = INVADER_W + pad * 2, h = INVADER_H + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * k);
    c.height = Math.ceil(h * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    g.translate(pad, pad);
    const body = g.createLinearGradient(0, 0, 0, INVADER_H);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.25, color);
    body.addColorStop(1, shade(color, -70));
    g.shadowColor = color;
    g.shadowBlur = 7 * k;
    g.fillStyle = body;
    g.strokeStyle = shade(color, -90);
    g.lineWidth = 1;
    const cx = INVADER_W / 2;
    g.beginPath();
    if (type === 0) {
      g.moveTo(cx, 0);
      g.quadraticCurveTo(cx + 10, 2, cx + 9, 10);
      g.lineTo(cx - 9, 10);
      g.quadraticCurveTo(cx - 10, 2, cx, 0);
      g.fill();
      g.shadowBlur = 0;
      g.lineWidth = 2;
      g.strokeStyle = color;
      const legs = frame ? [[-8, 16], [-3, 18], [3, 18], [8, 16]] : [[-10, 15], [-4, 17], [4, 17], [10, 15]];
      for (const [lx, ly] of legs) { g.beginPath(); g.moveTo(cx + lx * 0.6, 10); g.lineTo(cx + lx, ly); g.stroke(); }
    } else if (type === 1) {
      g.ellipse(cx, 8, 10, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.lineWidth = 2;
      g.strokeStyle = color;
      const arm = frame ? -1 : 1;
      g.beginPath(); g.moveTo(cx - 9, 8); g.lineTo(cx - 12, 8 - 5 * arm); g.moveTo(cx + 9, 8); g.lineTo(cx + 12, 8 - 5 * arm); g.stroke();
      g.beginPath(); g.moveTo(cx - 5, 14); g.lineTo(cx - 7 - 2 * arm, 18); g.moveTo(cx + 5, 14); g.lineTo(cx + 7 + 2 * arm, 18); g.stroke();
      g.beginPath(); g.moveTo(cx - 4, 2); g.lineTo(cx - 7, -2); g.moveTo(cx + 4, 2); g.lineTo(cx + 7, -2); g.stroke();
    } else {
      g.moveTo(cx - 11, 9);
      g.quadraticCurveTo(cx - 11, 0, cx, 0);
      g.quadraticCurveTo(cx + 11, 0, cx + 11, 9);
      g.lineTo(cx + 11, 12);
      g.lineTo(cx - 11, 12);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = color;
      const t = frame ? [-11, -5, 1, 7] : [-9, -3, 3, 9];
      for (const tx of t) { g.beginPath(); g.moveTo(cx + tx, 12); g.lineTo(cx + tx + 2, 18); g.lineTo(cx + tx + 4, 12); g.closePath(); g.fill(); }
    }
    g.fillStyle = '#0a0a1e';
    g.beginPath(); g.arc(cx - 4, 7, 2.3, 0, Math.PI * 2); g.arc(cx + 4, 7, 2.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(cx - 3.3, 6.3, 0.9, 0, Math.PI * 2); g.arc(cx + 4.7, 6.3, 0.9, 0, Math.PI * 2); g.fill();
    sp = { canvas: c, pad, w, h };
    spriteCache.set(key, sp);
    return sp;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function drawStars(now) {
    const drift = player ? (player.x - W / 2) : 0;
    for (const layer of starLayers) {
      for (const star of layer.list) {
        const y = (star.y + now * 0.012 * layer.depth) % H;
        const x = ((star.x - drift * 0.04 * layer.depth) % W + W) % W;
        ctx.globalAlpha = star.alpha * (0.7 + 0.3 * Math.sin(now * 0.003 + star.tw));
        ctx.fillStyle = layer.depth > 0.9 ? '#ffffff' : '#b9d7ff';
        ctx.fillRect(x, y, star.size, star.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawInvader(invader, a, k, now) {
    const x = lerp(invader.px, invader.x, a), y = lerp(invader.py, invader.y, a);
    if (invader.isBoss) {
      drawBoss(invader, x, y, now);
      return;
    }
    const type = invader.row === 0 ? 0 : invader.row < 3 ? 1 : 2;
    const sp = invaderSprite(type, invader.color, animFrame, k);
    ctx.drawImage(sp.canvas, x - sp.pad, y - sp.pad + Math.sin(now * 0.004 + invader.x * 0.05) * 0.8, sp.w, sp.h);
  }

  function drawBoss(boss, x, y, now) {
    const cx = x + boss.w / 2, cy = y + boss.h / 2;
    ctx.save();
    ctx.shadowColor = '#ff4d8d';
    ctx.shadowBlur = 24;
    const hull = ctx.createLinearGradient(0, y, 0, y + boss.h);
    hull.addColorStop(0, boss.flash ? '#ffffff' : '#ffb3cf');
    hull.addColorStop(0.4, boss.flash ? '#ffd6e6' : '#ff4d8d');
    hull.addColorStop(1, '#5c0f33');
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.ellipse(cx, cy + 6, boss.w / 2, boss.h / 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    const dome = ctx.createRadialGradient(cx - 10, y + 6, 4, cx, y + 16, 40);
    dome.addColorStop(0, 'rgba(255,255,255,0.95)');
    dome.addColorStop(0.4, 'rgba(120,220,255,0.75)');
    dome.addColorStop(1, 'rgba(40,60,140,0.6)');
    ctx.fillStyle = dome;
    ctx.beginPath(); ctx.ellipse(cx, y + 18, 34, 20, 0, Math.PI, 0); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const lx = x + 14 + i * (boss.w - 28) / 6;
      ctx.fillStyle = Math.floor(now / 160 + i) % 2 ? '#ffca28' : '#ffffff';
      ctx.beginPath(); ctx.arc(lx, cy + 10, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#2a0618';
    ctx.fillRect(x + boss.w * 0.25 - 5, y + boss.h - 6, 10, 10);
    ctx.fillRect(x + boss.w * 0.75 - 5, y + boss.h - 6, 10, 10);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y - 14, boss.w, 6);
    const frac = Math.max(0, boss.hp / boss.maxHp);
    const bar = ctx.createLinearGradient(x, 0, x + boss.w, 0);
    bar.addColorStop(0, '#ff4d8d');
    bar.addColorStop(1, '#ffca28');
    ctx.fillStyle = bar;
    ctx.fillRect(x, y - 14, boss.w * frac, 6);
  }

  function drawUfo(a, now) {
    const x = lerp(ufo.px, ufo.x, a), y = ufo.y;
    const cx = x + ufo.w / 2;
    ctx.save();
    ctx.shadowColor = '#ff6bff';
    ctx.shadowBlur = 18;
    const hull = ctx.createLinearGradient(0, y, 0, y + ufo.h);
    hull.addColorStop(0, '#ffd1ff');
    hull.addColorStop(0.5, '#e040fb');
    hull.addColorStop(1, '#5a0f6e');
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.ellipse(cx, y + 10, ufo.w / 2, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(150,230,255,0.85)';
    ctx.beginPath(); ctx.ellipse(cx, y + 6, 10, 7, 0, Math.PI, 0); ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = Math.floor(now / 120 + i) % 2 ? '#ffffff' : '#ffca28';
      ctx.beginPath(); ctx.arc(x + 8 + i * 8, y + 11, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(a, now) {
    if (invulnerable > 0 && Math.floor(now / 90) % 2 === 0) return;
    const x = lerp(player.px, player.x, a), y = player.y;
    const cx = x + player.w / 2;
    ctx.save();
    ctx.translate(cx, y + player.h / 2);
    ctx.rotate(player.tilt * 0.4);
    const flame = 6 + Math.random() * 5;
    const fl = ctx.createLinearGradient(0, 8, 0, 8 + flame + 8);
    fl.addColorStop(0, 'rgba(255,255,255,0.95)');
    fl.addColorStop(0.3, 'rgba(0,229,255,0.9)');
    fl.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = fl;
    ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(0, 8 + flame + 8); ctx.lineTo(5, 8); ctx.closePath(); ctx.fill();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    const hull = ctx.createLinearGradient(-17, 0, 17, 0);
    hull.addColorStop(0, '#0b5f7a');
    hull.addColorStop(0.5, '#bff6ff');
    hull.addColorStop(1, '#0b5f7a');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(5, -4);
    ctx.lineTo(17, 6);
    ctx.lineTo(17, 9);
    ctx.lineTo(5, 7);
    ctx.lineTo(0, 10);
    ctx.lineTo(-5, 7);
    ctx.lineTo(-17, 9);
    ctx.lineTo(-17, 6);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(0, -3, 2.6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4d8d';
    ctx.fillRect(-16, 5, 3, 3);
    ctx.fillRect(13, 5, 3, 3);
    if (muzzle > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const m = muzzle / 80;
      const mg = ctx.createRadialGradient(0, -14, 0, 0, -14, 12 * m + 2);
      mg.addColorStop(0, 'rgba(255,255,255,' + m + ')');
      mg.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(0, -14, 12 * m + 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPowerup(powerup, a) {
    const pulse = 1 + Math.sin(powerup.pulse) * 0.08;
    const x = lerp(powerup.px, powerup.x, a), y = lerp(powerup.py, powerup.y, a);
    ctx.save();
    ctx.translate(x + powerup.w / 2, y + powerup.h / 2);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = powerup.type.color;
    ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(0, -powerup.h / 2, 0, powerup.h / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, powerup.type.color);
    g.addColorStop(1, shade(powerup.type.color, -70));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(-powerup.w / 2, -powerup.h / 2, powerup.w, powerup.h, 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#050816';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.type.label, 0, 1);
    ctx.restore();
  }

  function render(now, a) {
    const k = ctx.getTransform().a || 1;
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeAmp * (shakeTime / shakeMax);
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }
    ctx.drawImage(background(k), 0, 0, W, H);
    drawStars(now);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(0, H - 22);
    ctx.lineTo(W, H - 22);
    ctx.stroke();
    for (const shield of shields) {
      if (!shield.alive) continue;
      const g = ctx.createLinearGradient(0, shield.y, 0, shield.y + 8);
      g.addColorStop(0, '#b6ffcf');
      g.addColorStop(1, '#2fbf6a');
      ctx.fillStyle = g;
      ctx.fillRect(shield.x, shield.y, shield.w - 1, shield.h - 1);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(102,230,118,0.08)';
    for (const shield of shields) if (shield.alive) ctx.fillRect(shield.x - 2, shield.y - 2, shield.w + 3, shield.h + 3);
    ctx.restore();
    for (const invader of invaders) drawInvader(invader, a, k, now);
    if (ufo) drawUfo(a, now);
    for (const powerup of powerups) drawPowerup(powerup, a);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bullet of playerBullets) {
      const x = lerp(bullet.px, bullet.x, a), y = lerp(bullet.py, bullet.y, a);
      const col = bullet.laser ? '255,77,141' : '120,240,255';
      const g = ctx.createLinearGradient(0, y, 0, y + bullet.h + 10);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(' + col + ',0.95)');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, bullet.w, bullet.h + 10);
      ctx.fillStyle = 'rgba(' + col + ',0.18)';
      ctx.fillRect(x - 3, y - 2, bullet.w + 6, bullet.h + 6);
    }
    for (const bullet of enemyBullets) {
      const x = lerp(bullet.px, bullet.x, a), y = lerp(bullet.py, bullet.y, a);
      const cx = x + bullet.w / 2;
      const wob = Math.sin(now * 0.03 + bullet.phase) * 2.5;
      const glow = ctx.createRadialGradient(cx, y + bullet.h / 2, 0, cx, y + bullet.h / 2, 10);
      glow.addColorStop(0, 'rgba(255,90,120,0.55)');
      glow.addColorStop(1, 'rgba(255,90,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 10, y + bullet.h / 2 - 10, 20, 20);
      ctx.strokeStyle = 'rgba(255,120,150,1)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + wob, y + bullet.h * 0.33);
      ctx.lineTo(cx - wob, y + bullet.h * 0.66);
      ctx.lineTo(cx, y + bullet.h);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,235,240,0.95)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    if (gameRunning) drawPlayer(a, now);
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      if (particle.debris) {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.fillRect(-particle.size / 2, -1, particle.size, 2);
        ctx.restore();
      } else ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    for (const f of fx) {
      const t = Math.max(0, f.life / f.max);
      if (f.k === 'ring') {
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = t;
        ctx.lineWidth = 3 * t + 0.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - t) + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'glow') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, 'rgba(255,255,255,' + 0.9 * t + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (f.k === 'popup') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.font = '900 ' + f.size + 'px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - (1 - t) * 24);
        ctx.restore();
      }
    }
    if (flash) {
      ctx.fillStyle = 'rgba(' + flash.color + ',' + 0.3 * (flash.life / flash.max) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function frame(now) {
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
        const p = waveTotal > 1 ? 1 + (1 - invaders.length / waveTotal) * 2.2 : 1.6;
        Sound.setPace(p);
        updateHud();
      }
    }
    updateParticles(dt);
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (flash && (flash.life -= dt) <= 0) flash = null;
    render(now, gameRunning ? Math.min(1, acc / STEP) : 1);
    Sound.update();
    requestAnimationFrame(frame);
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
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'A', 'd', 'D', ' '].includes(event.key)) event.preventDefault();
    keys[event.code] = true;
    if (event.key === ' ' || event.key === 'ArrowUp') fire();
  });

  document.addEventListener('keyup', event => {
    keys[event.code] = false;
  });

  window.addEventListener('blur', () => { keys = {}; fireHeld = false; });

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    movePlayerTo(event.clientX);
    if (event.pointerType === 'touch' || event.button === 0) { fire(); fireHeld = true; }
    if (event.pointerType === 'touch' && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', event => {
    if (gameRunning && (event.pointerType === 'touch' || event.buttons > 0)) movePlayerTo(event.clientX);
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => canvas.addEventListener(type, () => { fireHeld = false; }));

  document.querySelectorAll('.control-button').forEach(button => {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      if (!gameRunning) startFromOverlay();
      if (action === 'fire') { fire(); fireHeld = true; }
      else keys[action === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true;
      button.classList.add('pressed');
    });
    const release = event => {
      event.preventDefault();
      if (action === 'fire') fireHeld = false;
      else keys[action === 'left' ? 'ArrowLeft' : 'ArrowRight'] = false;
      button.classList.remove('pressed');
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  });

  resetPlayer();
  createInvaders();
  createShields();
  createStars();
  renderScores(safeLoadScores());
  updateHud();

  if (window.GamePlatform) GamePlatform.initHeader('Space Invaders');
  addMusicButton();
  lastTime = performance.now();
  requestAnimationFrame(frame);
  GameEngine.pausable({ isActive: () => gameRunning, container: '#game-area' });
})();
