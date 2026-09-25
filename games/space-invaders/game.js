(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
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
  const POWERUP_TYPES = [
    { id: 'rapid', label: 'RAPID', color: '#ffca28', duration: 8000 },
    { id: 'spread', label: 'SPREAD', color: '#ff8c42', duration: 8000 },
    { id: 'laser', label: 'LASER', color: '#ff4d8d', duration: 7000 },
    { id: 'shield', label: 'SHIELD', color: '#66e676', duration: 0 },
    { id: 'life', label: 'LIFE', color: '#00e5ff', duration: 0 }
  ];

  let audioCtx = null;
  let gameRunning = false;
  let animationId = null;
  let lastTime = 0;
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
  let stars = [];
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

  function sfxShoot() { tone(620, 0.07, 'square', 0.06); }
  function sfxHit() { tone(180, 0.09, 'sawtooth', 0.07); }
  function sfxPowerup() { tone(740, 0.08, 'triangle', 0.08); setTimeout(() => tone(1040, 0.12, 'triangle', 0.08), 70); }
  function sfxShield() { tone(110, 0.1, 'triangle', 0.08); }
  function sfxBoss() { [240, 180, 120].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sawtooth', 0.08), i * 75)); }
  function sfxWave() { [440, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.08), i * 70)); }
  function sfxGameOver() { [320, 240, 160].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.1), i * 100)); }

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
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 1.8 + 0.4,
        alpha: Math.random() * 0.6 + 0.15
      });
    }
  }

  function createInvaders() {
    invaders = [];
    if (wave % 5 === 0) {
      invaders.push({
        isBoss: true,
        x: W / 2 - 70,
        y: 70,
        w: 140,
        h: 54,
        hp: 24 + wave * 3,
        maxHp: 24 + wave * 3,
        vx: 56 + wave * 2,
        color: '#ff4d8d'
      });
      enemyDirection = 1;
      enemyShootTimer = 500;
      sfxBoss();
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
        invaders.push({
          x: startX + col * gapX,
          y: startY + row * gapY,
          w: INVADER_W,
          h: INVADER_H,
          row,
          color: COLORS[row]
        });
      }
    }
    enemyDirection = wave % 2 === 0 ? -1 : 1;
    enemyShootTimer = 700;
  }

  function createShields() {
    shields = [];
    const starts = [82, 190, 298];
    for (const startX of starts) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
          if (row === 0 && (col === 0 || col === 1 || col === 6 || col === 7)) continue;
          if (row === 2 && (col === 2 || col === 3 || col === 4 || col === 5)) continue;
          shields.push({ x: startX + col * 8, y: H - 142 + row * 8, w: 8, h: 8, alive: true });
        }
      }
    }
  }

  function resetPlayer() {
    player = { x: W / 2 - PLAYER_W / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
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
    shotCooldown = 0;
    rapidTimer = 0;
    spreadTimer = 0;
    laserTimer = 0;
    combo = 0;
    maxCombo = 0;
    lastKillAt = 0;
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
    lastTime = performance.now();
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
  }

  function finishGame(won) {
    if (!gameRunning) return;
    gameRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    if (won) tone(880, 0.2, 'triangle', 0.12); else sfxGameOver();
    const topScores = saveScore(score);
    renderScores(topScores);
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('space-invaders', score, elapsed * 1000, { win: won, maxCombo });
      GamePlatform.updateScore(score);
    }
    overlayMessage.textContent = (won ? 'Sector cleared' : 'The invasion reached Earth') + ' | Score: ' + score + ' | Wave: ' + wave;
    overlayButton.textContent = 'Play Again';
    overlay.classList.remove('hidden');
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
    sfxWave();
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
      playerBullets.push({ x: player.x + player.w / 2 - bulletWidth / 2, y: player.y - 8, w: bulletWidth, h: laser ? 18 : 12, vx, speed: bulletSpeed });
    }
    shotCooldown = rapid ? 95 : 220;
    sfxShoot();
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
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.65, color });
    }
  }

  function dropPowerup(x, y) {
    if (Math.random() > 0.14) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x: x - 12, y, w: 24, h: 18, vy: 62, type, pulse: 0 });
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
    sfxPowerup();
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

  function updateBoss(dt, boss) {
    boss.x += boss.vx * dt / 1000;
    if (boss.x <= 18 || boss.x + boss.w >= W - 18) boss.vx *= -1;
    boss.y = 70 + Math.sin(performance.now() * 0.002) * 12;
    enemyShootTimer -= dt;
    if (enemyShootTimer <= 0) {
      enemyBullets.push({ x: boss.x + boss.w * 0.25 - 2, y: boss.y + boss.h, w: 5, h: 14 });
      enemyBullets.push({ x: boss.x + boss.w * 0.75 - 2, y: boss.y + boss.h, w: 5, h: 14 });
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
    const speed = 22 + Math.min(58, wave * 4);
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
    } else {
      for (const invader of invaders) invader.x += distance * enemyDirection;
    }
    enemyShootTimer -= dt;
    if (enemyShootTimer <= 0) {
      const shooter = chooseShooter();
      if (shooter) enemyBullets.push({ x: shooter.x + shooter.w / 2 - 2, y: shooter.y + shooter.h, w: 4, h: 12 });
      enemyShootTimer = Math.max(320, 950 - wave * 40) + Math.random() * 420;
    }
    for (const invader of invaders) {
      if (invader.y + invader.h >= player.y - 6) finishGame(false);
    }
  }

  function registerKill(target) {
    const now = performance.now();
    combo = now - lastKillAt <= 2500 ? combo + 1 : 1;
    lastKillAt = now;
    maxCombo = Math.max(maxCombo, combo);
    const multiplier = Math.min(5, 1 + Math.floor((combo - 1) / 3));
    const base = target.isBoss ? 500 : (5 - target.row) * 10;
    score += base * multiplier;
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
      let hit = -1;
      for (let j = invaders.length - 1; j >= 0; j--) {
        if (overlap(bullet, invaders[j])) { hit = j; break; }
      }
      if (hit >= 0) {
        const target = invaders[hit];
        if (target.isBoss) {
          target.hp -= 1;
          score += 25;
          spawnParticles(bullet.x, bullet.y, target.color, 4);
          if (target.hp <= 0) {
            registerKill(target);
            spawnParticles(target.x + target.w / 2, target.y + target.h / 2, target.color, 45);
            invaders.splice(hit, 1);
            dropPowerup(target.x + target.w / 2, target.y);
            dropPowerup(target.x + target.w / 2, target.y + 16);
          }
        } else {
          registerKill(target);
          spawnParticles(target.x + target.w / 2, target.y + target.h / 2, target.color, 12);
          dropPowerup(target.x + target.w / 2, target.y);
          invaders.splice(hit, 1);
        }
        playerBullets.splice(i, 1);
        sfxHit();
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
      let removed = false;
      for (const shield of shields) {
        if (shield.alive && overlap(bullet, shield)) {
          shield.alive = false;
          enemyBullets.splice(i, 1);
          spawnParticles(shield.x, shield.y, '#66e676', 4);
          sfxShield();
          removed = true;
          break;
        }
      }
      if (removed) continue;
      if (overlap(bullet, player)) {
        enemyBullets.splice(i, 1);
        lives -= 1;
        combo = 0;
        spawnParticles(player.x + player.w / 2, player.y, '#ff4d8d', 18);
        resetPlayer();
        playerBullets = [];
        updateHud();
        if (lives <= 0) finishGame(false);
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
      particle.life -= dt / 1000;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function update(dt) {
    const direction = (keys.ArrowLeft || keys.KeyA ? -1 : 0) + (keys.ArrowRight || keys.KeyD ? 1 : 0);
    player.x += direction * PLAYER_SPEED * dt / 1000;
    player.x = Math.max(0, Math.min(W - player.w, player.x));
    shotCooldown = Math.max(0, shotCooldown - dt);
    rapidTimer = Math.max(0, rapidTimer - dt);
    spreadTimer = Math.max(0, spreadTimer - dt);
    laserTimer = Math.max(0, laserTimer - dt);
    if (combo && performance.now() - lastKillAt > 2500) combo = 0;
    updateInvaders(dt);
    if (!gameRunning) return;
    updateBullets(dt);
    if (!gameRunning) return;
    updateParticles(dt);
    updateHud();
    if (!invaders.length) nextWave();
  }

  function drawStars() {
    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = '#b9d7ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawInvader(invader) {
    if (invader.isBoss) {
      ctx.fillStyle = invader.color;
      ctx.fillRect(invader.x + 14, invader.y + 8, invader.w - 28, invader.h - 16);
      ctx.fillRect(invader.x, invader.y + 20, 16, 16);
      ctx.fillRect(invader.x + invader.w - 16, invader.y + 20, 16, 16);
      ctx.fillRect(invader.x + 30, invader.y, invader.w - 60, 12);
      ctx.fillStyle = '#050816';
      ctx.fillRect(invader.x + 38, invader.y + 18, 10, 10);
      ctx.fillRect(invader.x + invader.w - 48, invader.y + 18, 10, 10);
      ctx.fillStyle = '#ffca28';
      ctx.fillRect(invader.x, invader.y - 12, invader.w, 5);
      ctx.fillStyle = '#66e676';
      ctx.fillRect(invader.x, invader.y - 12, invader.w * Math.max(0, invader.hp / invader.maxHp), 5);
      return;
    }
    ctx.fillStyle = invader.color;
    ctx.fillRect(invader.x + 4, invader.y + 3, invader.w - 8, invader.h - 6);
    ctx.fillRect(invader.x, invader.y + 7, 4, 6);
    ctx.fillRect(invader.x + invader.w - 4, invader.y + 7, 4, 6);
    ctx.fillRect(invader.x + 6, invader.y, 4, 4);
    ctx.fillRect(invader.x + invader.w - 10, invader.y, 4, 4);
    ctx.fillRect(invader.x + 5, invader.y + invader.h - 3, 4, 5);
    ctx.fillRect(invader.x + invader.w - 9, invader.y + invader.h - 3, 4, 5);
    ctx.fillStyle = '#050816';
    ctx.fillRect(invader.x + 7, invader.y + 7, 3, 3);
    ctx.fillRect(invader.x + invader.w - 10, invader.y + 7, 3, 3);
  }

  function drawPlayer() {
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(player.x + 7, player.y + 6, player.w - 14, player.h - 6);
    ctx.fillRect(player.x + 12, player.y, 10, 8);
    ctx.fillRect(player.x, player.y + player.h - 4, player.w, 4);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.fillRect(player.x - 6, player.y + player.h + 3, player.w + 12, 3);
  }

  function drawPowerup(powerup) {
    const pulse = 1 + Math.sin(powerup.pulse) * 0.08;
    ctx.save();
    ctx.translate(powerup.x + powerup.w / 2, powerup.y + powerup.h / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = powerup.type.color;
    ctx.shadowColor = powerup.type.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(-powerup.w / 2, -powerup.h / 2, powerup.w, powerup.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#050816';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.type.label, 0, 1);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050816';
    ctx.fillRect(0, 0, W, H);
    drawStars();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, H - 22);
    ctx.lineTo(W, H - 22);
    ctx.stroke();

    for (const shield of shields) {
      if (shield.alive) {
        ctx.fillStyle = '#66e676';
        ctx.fillRect(shield.x, shield.y, shield.w - 1, shield.h - 1);
      }
    }
    for (const invader of invaders) drawInvader(invader);
    for (const powerup of powerups) drawPowerup(powerup);
    for (const bullet of playerBullets) {
      ctx.fillStyle = laserTimer > 0 ? '#ff4d8d' : '#fff';
      ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }
    for (const bullet of enemyBullets) {
      ctx.fillStyle = '#ff5c8a';
      ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }
    if (gameRunning) drawPlayer();
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / 0.65);
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
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'A', 'd', 'D', ' '].includes(event.key)) event.preventDefault();
    keys[event.code] = true;
    if (event.key === ' ' || event.key === 'ArrowUp') fire();
  });

  document.addEventListener('keyup', event => {
    keys[event.code] = false;
  });

  window.addEventListener('blur', () => { keys = {}; });

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    movePlayerTo(event.clientX);
    if (event.pointerType === 'touch' || event.button === 0) fire();
    if (event.pointerType === 'touch' && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', event => {
    if (gameRunning && (event.pointerType === 'touch' || event.buttons > 0)) movePlayerTo(event.clientX);
  });

  document.querySelectorAll('.control-button').forEach(button => {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      if (!gameRunning) startFromOverlay();
      if (action === 'fire') fire();
      else keys[action === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true;
      button.classList.add('pressed');
    });
    const release = event => {
      event.preventDefault();
      if (action !== 'fire') keys[action === 'left' ? 'ArrowLeft' : 'ArrowRight'] = false;
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
  render();
  updateHud();

  if (window.GamePlatform) GamePlatform.initHeader('Space Invaders');
})();
