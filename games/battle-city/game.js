(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const baseEl = document.getElementById('base');
  const tanksEl = document.getElementById('tanks');
  const overlay = document.getElementById('overlay');
  const overlayMessage = document.getElementById('overlay-message');
  const overlayButton = document.getElementById('overlay-button');
  const waveBanner = document.getElementById('wave-banner');
  const highscores = document.getElementById('highscores');
  const fireButton = document.getElementById('fire-button');

  const W = canvas.width;
  const H = canvas.height;
  const TILE = 32;
  const COLS = 15;
  const ROWS = 19;
  const SCORE_KEY = 'battlecity_highscores';
  const POWERUP_TYPES = [
    { id: 'rapid', label: 'R', color: '#ffcf5c' },
    { id: 'shield', label: 'S', color: '#6de6ff' },
    { id: 'repair', label: '+', color: '#7dff83' },
    { id: 'piercing', label: 'P', color: '#ff789a' },
    { id: 'freeze', label: 'F', color: '#b998ff' }
  ];
  let MAP = [];

  let audioCtx = null;
  let gameRunning = false;
  let animationId = null;
  let lastTime = 0;
  let score = 0;
  let wave = 1;
  let baseLives = 3;
  let enemies = [];
  let bullets = [];
  let powerups = [];
  let particles = [];
  let rapidTimer = 0;
  let shieldTimer = 0;
  let piercingTimer = 0;
  let freezeTimer = 0;
  let stars = [];
  let player;
  let keys = {};
  let spawnTimer = 0;
  let spawnRemaining = 0;
  let waveActive = false;
  let waveBannerTimer = null;

  function isMuted() { return window.GamePlatform && GamePlatform.isMuted(); }

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
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + duration);
  }

  function sfxShoot() { tone(440, 0.06, 'square', 0.06); }
  function sfxHit() { tone(160, 0.1, 'sawtooth', 0.07); }
  function sfxWave() { [420, 620, 840].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.08), i * 70)); }
  function sfxGameOver() { [300, 220, 140].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.09), i * 100)); }

  function safeLoadScores() {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveScore(value) {
    const scores = safeLoadScores();
    scores.push(value); scores.sort((a, b) => b - a);
    const top = scores.slice(0, 5);
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(top)); } catch (e) { }
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

  function updateHud() {
    scoreEl.textContent = score.toLocaleString();
    waveEl.textContent = wave;
    baseEl.textContent = baseLives;
    tanksEl.textContent = enemies.length + spawnRemaining;
    if (window.GamePlatform) GamePlatform.updateScore(score);
  }

  function setStatus(text) { document.getElementById('status-line')?.replaceChildren(document.createTextNode(text)); }

  function createStars() {
    stars = [];
    for (let i = 0; i < 55; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 1.4 + 0.3, alpha: Math.random() * 0.5 + 0.12 });
  }

  function tileAt(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 2;
    return Number(MAP[row][col]);
  }

  function generateMap() {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let col = 0; col < COLS; col++) {
      grid[0][col] = (col >= 6 && col <= 8) ? 0 : 2;
      grid[ROWS - 1][col] = 2;
    }
    for (let row = 0; row < ROWS; row++) {
      grid[row][0] = 2;
      grid[row][COLS - 1] = 2;
    }
    const protectedCells = (row, col) => row <= 2 && col >= 5 && col <= 9 || row >= 15 && col >= 5 && col <= 9 || row >= 7 && row <= 10 && col >= 6 && col <= 8;
    const types = [1, 1, 1, 1, 2, 3, 4];
    for (let i = 0; i < 62; i++) {
      const row = 2 + Math.floor(Math.random() * 13);
      const col = 1 + Math.floor(Math.random() * 13);
      if (protectedCells(row, col)) continue;
      grid[row][col] = types[Math.floor(Math.random() * types.length)];
      if (Math.random() < 0.28 && col < COLS - 2 && !protectedCells(row, col + 1)) grid[row][col + 1] = grid[row][col];
    }
    for (let col = 5; col <= 9; col++) grid[17][col] = 0;
    MAP = grid.map(row => row.join(''));
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function blocked(rect, ignore) {
    const left = Math.floor(rect.x / TILE);
    const right = Math.floor((rect.x + rect.w - 1) / TILE);
    const top = Math.floor(rect.y / TILE);
    const bottom = Math.floor((rect.y + rect.h - 1) / TILE);
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const type = tileAt(col, row);
        if (type === 1 || type === 2 || type === 3) return true;
      }
    }
    for (const enemy of enemies) if (enemy !== ignore && rectsOverlap(rect, enemy)) return true;
    return false;
  }

  function moveTank(tank, dx, dy) {
    const nextX = { x: tank.x + dx, y: tank.y, w: tank.w, h: tank.h };
    if (nextX.x >= 0 && nextX.x + nextX.w <= W && !blocked(nextX, tank)) tank.x = nextX.x;
    const nextY = { x: tank.x, y: tank.y + dy, w: tank.w, h: tank.h };
    if (nextY.y >= 0 && nextY.y + nextY.h <= H && !blocked(nextY, tank)) tank.y = nextY.y;
  }

  function resetPlayer() {
    player = { x: 7 * TILE + 5, y: 17 * TILE + 5, w: 22, h: 22, dir: 'up', cooldown: 0, invincible: 1.2 };
  }

  function beginGame() {
    if (gameRunning) return;
    gameRunning = true;
    score = 0; wave = 1; baseLives = 3; bullets = []; enemies = []; powerups = []; particles = [];
    rapidTimer = 0; shieldTimer = 0; piercingTimer = 0; freezeTimer = 0;
    spawnRemaining = 0; waveActive = false;
    createStars(); generateMap(); resetPlayer();
    overlay.classList.add('hidden'); highscores.classList.add('hidden');
    if (window.GamePlatform) { GamePlatform.resetTimer(); GamePlatform.startTimer(); }
    updateHud();
    startWave();
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
    const top = saveScore(score); renderScores(top);
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('battle-city', score, elapsed * 1000, { maxWave: wave });
    }
    overlayMessage.textContent = 'Base destroyed | Score: ' + score + ' | Wave: ' + wave;
    overlayButton.textContent = 'Play Again'; overlay.classList.remove('hidden');
  }

  function startWave() {
    if (!gameRunning || waveActive) return;
    waveActive = true; spawnRemaining = 4 + wave * 2; spawnTimer = 0;
    setStatus('Wave ' + wave + ' incoming. Protect the base.'); sfxWave(); updateHud();
  }

  function spawnEnemy() {
    const slots = [6, 7, 8];
    const col = slots[Math.floor(Math.random() * slots.length)];
    const roll = Math.random();
    const type = wave >= 5 && roll < 0.15 ? 'engineer' : wave >= 4 && roll < 0.3 ? 'sniper' : wave >= 4 && roll < 0.52 ? 'heavy' : wave >= 2 && roll < 0.72 ? 'fast' : 'scout';
    const speed = type === 'fast' ? 105 : type === 'heavy' ? 46 : type === 'sniper' ? 58 : type === 'engineer' ? 50 : 68;
    const hp = type === 'heavy' || type === 'sniper' || type === 'engineer' ? 3 : 1;
    const enemy = { x: col * TILE + 5, y: 5, w: 22, h: 22, dir: 'down', type, cooldown: 0, speed, hp };
    enemies.push(enemy);
  }

  function fire(tank, owner) {
    if (tank.cooldown > 0) return;
    const directions = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const direction = directions[tank.dir];
    bullets.push({ x: tank.x + tank.w / 2 - 3, y: tank.y + tank.h / 2 - 3, w: 6, h: 6, vx: direction.x * 270, vy: direction.y * 270, owner, power: owner === 'player' && piercingTimer > 0 ? 2 : 1 });
    tank.cooldown = owner === 'player' ? (rapidTimer > 0 ? 0.18 : 0.36) : (tank.type === 'sniper' ? 0.75 : 1.25 + Math.random() * 1.4);
    if (owner === 'player') sfxShoot();
  }

  function spawnParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 90 + 25;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 20, life: 0.7, color });
    }
  }

  function dropPowerup(x, y) {
    if (Math.random() > 0.14) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x: x - 10, y: y - 10, w: 20, h: 20, type, pulse: 0 });
  }

  function applyPowerup(powerup) {
    if (powerup.type.id === 'rapid') rapidTimer = 8000;
    if (powerup.type.id === 'shield') shieldTimer = 8000;
    if (powerup.type.id === 'repair') baseLives = Math.min(3, baseLives + 1);
    if (powerup.type.id === 'piercing') piercingTimer = 8000;
    if (powerup.type.id === 'freeze') freezeTimer = 5000;
    score += 100;
    spawnParticles(powerup.x + 10, powerup.y + 10, powerup.type.color, 12);
    tone(740, 0.08, 'triangle', 0.08);
    updateHud();
  }

  function updatePowerups(dt) {
    rapidTimer = Math.max(0, rapidTimer - dt);
    shieldTimer = Math.max(0, shieldTimer - dt);
    piercingTimer = Math.max(0, piercingTimer - dt);
    freezeTimer = Math.max(0, freezeTimer - dt);
    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i];
      powerup.pulse += dt * 0.01;
      if (rectsOverlap(powerup, player)) {
        applyPowerup(powerup);
        powerups.splice(i, 1);
      }
    }
  }

  function hitTile(bullet, col, row) {
    const type = tileAt(col, row);
    if (type === 1) {
      MAP[row] = MAP[row].substring(0, col) + '0' + MAP[row].substring(col + 1);
      spawnParticles(col * TILE + TILE / 2, row * TILE + TILE / 2, '#c96d45', 5);
      return true;
    }
    if (type === 2) return true;
    return false;
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.x += bullet.vx * dt / 1000; bullet.y += bullet.vy * dt / 1000;
      if (bullet.x < 0 || bullet.x > W || bullet.y < 0 || bullet.y > H) { bullets.splice(i, 1); continue; }
      const col = Math.floor((bullet.x + bullet.w / 2) / TILE);
      const row = Math.floor((bullet.y + bullet.h / 2) / TILE);
      if (hitTile(bullet, col, row)) { bullets.splice(i, 1); continue; }
      if (bullet.owner === 'player') {
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
          if (rectsOverlap(bullet, enemies[j])) {
            enemies[j].hp -= 1;
            if (bullet.power <= 1) bullets.splice(i, 1); else bullet.power -= 1;
            spawnParticles(enemies[j].x + 11, enemies[j].y + 11, '#ffcf5c', 5);
            if (enemies[j].hp <= 0) {
              score += enemies[j].type === 'heavy' || enemies[j].type === 'sniper' || enemies[j].type === 'engineer' ? 150 : 75;
              dropPowerup(enemies[j].x + 11, enemies[j].y + 11);
              enemies.splice(j, 1);
            }
            updateHud(); hit = true; break;
          }
        }
        if (hit) continue;
      } else if (rectsOverlap(bullet, player)) {
        bullets.splice(i, 1);
        if (player.invincible <= 0) {
          if (shieldTimer > 0) { shieldTimer = 0; spawnParticles(player.x + 11, player.y + 11, '#6de6ff', 12); }
          else { baseLives -= 1; resetPlayer(); if (baseLives <= 0) finishGame(); }
          updateHud();
        }
        continue;
      }
    }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.cooldown = Math.max(0, enemy.cooldown - dt / 1000);
      const direction = enemy.dir === 'down' ? { x: 0, y: 1 } : enemy.dir === 'up' ? { x: 0, y: -1 } : enemy.dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
      const before = { x: enemy.x, y: enemy.y };
      const speed = freezeTimer > 0 ? enemy.speed * 0.35 : enemy.speed;
      moveTank(enemy, direction.x * speed * dt / 1000, direction.y * speed * dt / 1000);
      if (enemy.x === before.x && enemy.y === before.y) {
        const dirs = ['up', 'right', 'left', 'down']; enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
      }
      if (Math.random() < dt / 2600) fire(enemy, 'enemy');
      if (enemy.y > H - 55 && enemy.x > 5 * TILE && enemy.x < 10 * TILE) { baseLives -= 1; enemies.splice(i, 1); resetPlayer(); updateHud(); if (baseLives <= 0) finishGame(); }
    }
  }

  function update(dt) {
    player.cooldown = Math.max(0, player.cooldown - dt / 1000);
    player.invincible = Math.max(0, player.invincible - dt / 1000);
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.KeyA) { dx = -1; player.dir = 'left'; }
    if (keys.ArrowRight || keys.KeyD) { dx = 1; player.dir = 'right'; }
    if (keys.ArrowUp || keys.KeyW) { dy = -1; player.dir = 'up'; }
    if (keys.ArrowDown || keys.KeyS) { dy = 1; player.dir = 'down'; }
    moveTank(player, dx * 125 * dt / 1000, dy * 125 * dt / 1000);
    updatePowerups(dt);
    updateEnemies(dt); updateBullets(dt);
    spawnTimer -= dt / 1000;
    if (waveActive && spawnRemaining > 0 && spawnTimer <= 0) { spawnEnemy(); spawnRemaining -= 1; spawnTimer = Math.max(0.8, 1.5 - wave * 0.04); }
    if (waveActive && spawnRemaining === 0 && enemies.length === 0) {
      waveActive = false;
      wave += 1;
      score += 250;
      updateHud();
      setStatus('Wave cleared. Next wave incoming.');
      setTimeout(() => { if (gameRunning) startWave(); }, 900);
    }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.life -= dt / 1000; if (p.life <= 0) particles.splice(i, 1); }
  }

  function drawTank(tank, color, enemy) {
    ctx.save(); ctx.translate(tank.x + 11, tank.y + 11);
    const rotation = tank.dir === 'up' ? 0 : tank.dir === 'right' ? Math.PI / 2 : tank.dir === 'down' ? Math.PI : -Math.PI / 2;
    ctx.rotate(rotation);
    ctx.fillStyle = color; ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = enemy ? '#3b1a25' : '#1e3325'; ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = color; ctx.fillRect(-3, -15, 6, 12);
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#18201d'; ctx.fillRect(0, 0, W, H);
    for (const star of stars) { ctx.globalAlpha = star.alpha; ctx.fillStyle = '#c4d8bf'; ctx.fillRect(star.x, star.y, star.size, star.size); }
    ctx.globalAlpha = 1;
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const type = tileAt(col, row); const x = col * TILE, y = row * TILE;
      if (type === 1) { ctx.fillStyle = '#a9583d'; ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2); ctx.strokeStyle = '#e08b5d'; ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10); }
      if (type === 2) { ctx.fillStyle = '#64727b'; ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2); ctx.fillStyle = '#8f9da3'; ctx.fillRect(x + 5, y + 5, 7, 7); }
      if (type === 3) { ctx.fillStyle = '#226c91'; ctx.fillRect(x, y, TILE, TILE); ctx.strokeStyle = '#62b9d8'; ctx.beginPath(); ctx.moveTo(x + 4, y + 10); ctx.quadraticCurveTo(x + 12, y + 3, x + 25, y + 10); ctx.stroke(); }
      if (type === 4) { ctx.fillStyle = '#35663e'; ctx.fillRect(x, y, TILE, TILE); ctx.fillStyle = '#78a653'; ctx.beginPath(); ctx.arc(x + 10, y + 13, 7, 0, Math.PI * 2); ctx.arc(x + 23, y + 10, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = '#e7d96b'; ctx.fillRect(5 * TILE + 2, 17 * TILE + 2, TILE * 5 - 4, TILE - 4); ctx.fillStyle = '#283424'; ctx.fillRect(7 * TILE + 6, 17 * TILE + 6, TILE + 12, TILE - 12);
    for (const powerup of powerups) {
      ctx.fillStyle = powerup.type.color;
      ctx.beginPath(); ctx.arc(powerup.x + 10, powerup.y + 10, 10 + Math.sin(powerup.pulse) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#18201d'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(powerup.type.label, powerup.x + 10, powerup.y + 10);
    }
    for (const enemy of enemies) drawTank(enemy, enemy.type === 'heavy' ? '#b998ff' : enemy.type === 'fast' ? '#ffcf5c' : enemy.type === 'sniper' ? '#bd9bff' : enemy.type === 'engineer' ? '#7dffb2' : '#ff5f7f', true);
    if (shieldTimer > 0) { ctx.strokeStyle = '#6de6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x + 11, player.y + 11, 18, 0, Math.PI * 2); ctx.stroke(); }
    drawTank(player, player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0 ? '#fff' : '#7dff83', false);
    for (const bullet of bullets) { ctx.fillStyle = bullet.owner === 'player' ? '#fff' : '#ff9a86'; ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h); }
    for (const particle of particles) { ctx.globalAlpha = particle.life / 0.7; ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, 3, 3); }
    ctx.globalAlpha = 1;
  }

  function loop(now) { if (!gameRunning) { render(); return; } const dt = Math.min(40, now - lastTime); lastTime = now; update(dt); render(); if (gameRunning) animationId = requestAnimationFrame(loop); }

  function startFromOverlay() { ensureAudio(); beginGame(); }
  overlayButton.addEventListener('click', event => { event.stopPropagation(); startFromOverlay(); });
  overlay.addEventListener('click', event => { if (event.target === overlay) startFromOverlay(); });
  document.addEventListener('keydown', event => { if (!gameRunning && event.key !== 'Tab') { event.preventDefault(); startFromOverlay(); } if (!gameRunning) return; if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S',' '].includes(event.key)) event.preventDefault(); keys[event.code] = true; if (event.key === ' ') fire(player, 'player'); });
  document.addEventListener('keyup', event => { keys[event.code] = false; });
  window.addEventListener('blur', () => { keys = {}; });
  canvas.addEventListener('pointerdown', event => { event.preventDefault(); if (!gameRunning) startFromOverlay(); else fire(player, 'player'); if (event.pointerType === 'touch' && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId); });
  document.querySelectorAll('[data-action]').forEach(button => { const action = button.dataset.action; button.addEventListener('pointerdown', event => { event.preventDefault(); if (!gameRunning) startFromOverlay(); if (action === 'fire') fire(player, 'player'); else keys[action === 'up' ? 'ArrowUp' : action === 'down' ? 'ArrowDown' : action === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true; button.classList.add('pressed'); }); const release = event => { event.preventDefault(); if (action !== 'fire') keys[action === 'up' ? 'ArrowUp' : action === 'down' ? 'ArrowDown' : action === 'left' ? 'ArrowLeft' : 'ArrowRight'] = false; button.classList.remove('pressed'); }; button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('pointerleave', release); });

  createStars(); generateMap(); resetPlayer(); renderScores(safeLoadScores()); render(); updateHud();
  if (window.GamePlatform) GamePlatform.initHeader('Battle City');
})();
