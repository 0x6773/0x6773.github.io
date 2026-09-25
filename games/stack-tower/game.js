(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const heightEl = document.getElementById('height');
  const comboEl = document.getElementById('combo');
  const missionEl = document.getElementById('mission-status');
  const overlay = document.getElementById('overlay');
  const overlayMessage = document.getElementById('overlay-message');
  const overlayButton = document.getElementById('overlay-button');
  const perfectBanner = document.getElementById('perfect-banner');
  const highscores = document.getElementById('highscores');
  const dropButton = document.getElementById('drop-button');

  const W = canvas.width;
  const H = canvas.height;
  const BAR_H = 18;
  const BASE_Y = H - 42;
  const SCORE_KEY = 'stacktower_highscores';
  const COLORS = ['#5ee7f2', '#7dff9b', '#ffcf5c', '#ff8fa3', '#b998ff', '#7db7ff'];
  const MISSIONS = [
    { id: 'height', text: 'Reach height 15', target: 15 },
    { id: 'perfect', text: 'Make 5 perfect drops', target: 5 },
    { id: 'narrow', text: 'Make 3 narrow drops', target: 3 }
  ];

  let audioCtx = null;
  let gameRunning = false;
  let animationId = null;
  let lastTime = 0;
  let score = 0;
  let height = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfects = 0;
  let narrowPlacements = 0;
  let bars = [];
  let currentBar = null;
  let particles = [];
  let stars = [];
  let mission = MISSIONS[0];
  let missionComplete = false;
  let perfectTimer = null;

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
    oscillator.type = type || 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume || 0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function sfxDrop() { tone(240, 0.08, 'triangle', 0.08); }
  function sfxPerfect() { [520, 720, 980].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.08), i * 70)); }
  function sfxMission() { [660, 880, 1180].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'sine', 0.08), i * 70)); }
  function sfxGameOver() { [300, 220, 140].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.09), i * 100)); }

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

  function missionProgress() {
    if (mission.id === 'height') return height;
    if (mission.id === 'perfect') return perfects;
    return narrowPlacements;
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString();
    heightEl.textContent = height;
    comboEl.textContent = combo > 1 ? 'x' + Math.min(5, 1 + Math.floor((combo - 1) / 2)) : '--';
    missionEl.textContent = missionComplete ? 'Mission complete' : 'Mission: ' + mission.text + ' (' + Math.min(mission.target, missionProgress()) + '/' + mission.target + ')';
    if (window.GamePlatform) GamePlatform.updateScore(score);
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 1.6 + 0.3, alpha: Math.random() * 0.6 + 0.15 });
  }

  function makeBar(x, y, width, color, kind) {
    return { x, y, width, baseWidth: width, color: color || COLORS[0], kind: kind || 'normal', phase: Math.random() * Math.PI * 2 };
  }

  function createCurrentBar(width) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const roll = Math.random();
    const kind = roll < 0.16 ? 'shrink' : roll < 0.27 ? 'bonus' : 'normal';
    const color = kind === 'shrink' ? '#ff8fa3' : kind === 'bonus' ? '#ffcf5c' : COLORS[(bars.length + 1) % COLORS.length];
    const bar = makeBar(direction > 0 ? 0 : W - width, bars[bars.length - 1].y - BAR_H, width, color, kind);
    bar.speed = Math.min(300, 105 + height * 6 + Math.random() * 85);
    bar.direction = direction;
    bar.shrinkRate = kind === 'shrink' ? 0.012 + Math.random() * 0.01 : 0;
    return bar;
  }

  function resetTower() {
    const base = makeBar((W - 180) / 2, BASE_Y, 180, COLORS[0]);
    bars = [base];
    currentBar = createCurrentBar(180);
  }

  function selectMission() {
    const day = Math.floor(Date.now() / 86400000);
    mission = MISSIONS[day % MISSIONS.length];
    missionComplete = false;
  }

  function beginGame() {
    if (gameRunning) return;
    gameRunning = true;
    score = 0;
    height = 0;
    combo = 0;
    maxCombo = 0;
    perfects = 0;
    narrowPlacements = 0;
    particles = [];
    createStars();
    selectMission();
    resetTower();
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
      GamePlatform.recordGame('stack-tower', score, elapsed * 1000, { maxCombo, maxHeight: height });
      GamePlatform.updateScore(score);
    }
    overlayMessage.textContent = 'Tower collapsed | Score: ' + score + ' | Height: ' + height;
    overlayButton.textContent = 'Play Again';
    overlay.classList.remove('hidden');
  }

  function showBanner(text, sound) {
    perfectBanner.textContent = text;
    perfectBanner.classList.remove('hidden');
    clearTimeout(perfectTimer);
    perfectTimer = setTimeout(() => perfectBanner.classList.add('hidden'), 700);
    if (sound) sound();
  }

  function checkMission() {
    if (missionComplete || missionProgress() < mission.target) return;
    missionComplete = true;
    score += 100;
    showBanner('MISSION COMPLETE', sfxMission);
  }

  function spawnParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 25;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, life: 0.7, color });
    }
  }

  function dropBar() {
    if (!gameRunning || !currentBar) return;
    const previous = bars[bars.length - 1];
    const overlapLeft = Math.max(currentBar.x, previous.x);
    const overlapRight = Math.min(currentBar.x + currentBar.width, previous.x + previous.width);
    const overlapWidth = overlapRight - overlapLeft;
    if (overlapWidth <= 0) {
      finishGame();
      return;
    }

    const aligned = Math.abs(currentBar.x - previous.x) <= 3 && Math.abs(currentBar.width - previous.width) <= 3;
    const placedWidth = aligned ? previous.width : overlapWidth;
    const placedX = aligned ? previous.x : overlapLeft;
    const placed = makeBar(placedX, currentBar.y, placedWidth, currentBar.color, currentBar.kind);
    bars.push(placed);
    height += 1;
    if (currentBar.kind === 'bonus') score += 50;
    if (aligned) {
      perfects += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      score += 20 + Math.min(5, 1 + Math.floor((combo - 1) / 2)) * 10;
      spawnParticles(placedX + placedWidth / 2, placed.y, '#ffcf5c', 14);
      showBanner('PERFECT', sfxPerfect);
    } else {
      if (overlapWidth / previous.width > 0.75) combo += 1; else combo = 0;
      maxCombo = Math.max(maxCombo, combo);
      if (overlapWidth / previous.width < 0.6) narrowPlacements += 1;
      score += 10 + Math.floor(overlapWidth / 8) + (combo > 1 ? Math.min(5, combo) * 4 : 0);
      spawnParticles(placedX + placedWidth / 2, placed.y, placed.color, 6);
      sfxDrop();
    }
    checkMission();
    if (placedWidth < 18) {
      finishGame();
      return;
    }
    if (placed.y < 170) for (const bar of bars) bar.y += BAR_H;
    currentBar = createCurrentBar(placedWidth);
    updateHud();
  }

  function update(dt) {
    if (!currentBar) return;
    currentBar.phase += dt * 0.004;
    if (currentBar.kind === 'shrink') currentBar.width = Math.max(28, currentBar.width - currentBar.shrinkRate * dt);
    currentBar.x += currentBar.speed * currentBar.direction * dt / 1000;
    if (currentBar.x <= 0) {
      currentBar.x = 0;
      currentBar.direction = 1;
    }
    if (currentBar.x + currentBar.width >= W) {
      currentBar.x = W - currentBar.width;
      currentBar.direction = -1;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx * dt / 1000;
      particle.y += particle.vy * dt / 1000;
      particle.vy += 100 * dt / 1000;
      particle.life -= dt / 1000;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBar(bar, active) {
    const pulse = active ? 1 + Math.sin(bar.phase) * 0.04 : 1;
    ctx.save();
    ctx.translate(bar.x + bar.width / 2, bar.y + BAR_H / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = bar.color;
    ctx.shadowColor = bar.color;
    ctx.shadowBlur = active || bar.kind === 'bonus' ? 12 : 5;
    ctx.fillRect(-bar.width / 2, -BAR_H / 2, bar.width, BAR_H);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(-bar.width / 2 + 2, -BAR_H / 2 + 2, bar.width - 4, 4);
    if (bar.kind === 'shrink') {
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-bar.width / 2 + 3, -BAR_H / 2 + 3, bar.width - 6, BAR_H - 6);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#071a24');
    gradient.addColorStop(1, '#071017');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = '#b7f7ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(94,231,242,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, BASE_Y + BAR_H + 4);
    ctx.lineTo(W, BASE_Y + BAR_H + 4);
    ctx.stroke();
    for (const bar of bars) drawBar(bar, false);
    if (gameRunning && currentBar) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(currentBar.x, currentBar.y + BAR_H + 8);
      ctx.lineTo(currentBar.x + currentBar.width, currentBar.y + BAR_H + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      drawBar(currentBar, true);
    }
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
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      dropBar();
    }
  });

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    else dropBar();
    if (event.pointerType === 'touch' && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });

  dropButton.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    else dropBar();
    dropButton.classList.add('pressed');
  });

  const releaseButton = event => {
    event.preventDefault();
    dropButton.classList.remove('pressed');
  };
  dropButton.addEventListener('pointerup', releaseButton);
  dropButton.addEventListener('pointercancel', releaseButton);
  dropButton.addEventListener('pointerleave', releaseButton);

  resetTower();
  createStars();
  selectMission();
  renderScores(safeLoadScores());
  render();
  updateHud();

  if (window.GamePlatform) GamePlatform.initHeader('Stack Tower');
})();
