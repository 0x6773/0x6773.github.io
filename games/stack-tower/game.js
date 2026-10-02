(function () {
  'use strict';

  const { setTimeout, clearTimeout, requestAnimationFrame, performance } = GameEngine.clock;
  const Sound = window.StackAudio;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  GameEngine.sharpCanvas(canvas);
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
  const SCORE_KEY = 'stacktower_highscores';
  const BASE = 120;
  const SLAB_H = 22;
  const RANGE = 170;
  const MIN_SIZE = 8;
  const PERFECT_TOL = 4;
  const GROW = 8;
  const COS = Math.cos(Math.PI / 6);
  const SIN = 0.5;
  const STEP = 1000 / 120;
  const MISSIONS = [
    { id: 'height', text: 'Reach height 15', target: 15 },
    { id: 'perfect', text: 'Make 5 perfect drops', target: 5 },
    { id: 'narrow', text: 'Make 3 narrow drops', target: 3 }
  ];

  let gameRunning = false;
  let demo = true;
  let lastTime = 0;
  let acc = 0;
  let score = 0;
  let height = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfects = 0;
  let narrowPlacements = 0;
  let streak = 0;
  let slabs = [];
  let current = null;
  let debris = [];
  let particles = [];
  let fx = [];
  let motes = [];
  let mission = MISSIONS[0];
  let missionComplete = false;
  let perfectTimer = null;
  let endedAt = 0;
  let baseHue = 200;
  let camY = 0, camScale = 1, targetScale = 1;
  let demoTimer = 0;
  let overTimer = null;

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
    if (window.GamePlatform && gameRunning) GamePlatform.updateScore(score);
  }

  function slabColor(level, kind) {
    if (kind === 'bonus') return [46, 95, 62];
    return [(baseHue + level * 6) % 360, 72, 66];
  }

  function makeSlab(x, z, w, d, level, kind) {
    return { x, z, w, d, level, kind: kind || 'normal', color: slabColor(level, kind), flash: 0 };
  }

  function createCurrent() {
    const top = slabs[slabs.length - 1];
    const level = top.level + 1;
    const axis = level % 2 ? 'x' : 'z';
    const roll = Math.random();
    const kind = level < 2 ? 'normal' : roll < 0.16 ? 'shrink' : roll < 0.27 ? 'bonus' : 'normal';
    const slab = makeSlab(top.x, top.z, top.w, top.d, level, kind);
    const dir = Math.random() < 0.5 ? -1 : 1;
    slab.axis = axis;
    slab.dir = dir;
    slab[axis] = top[axis] - dir * RANGE;
    slab.prev = slab[axis];
    slab.speed = Math.min(240, 95 + height * 5 + Math.random() * 50);
    slab.shrinkRate = kind === 'shrink' ? 0.012 + Math.random() * 0.01 : 0;
    slab.phase = 0;
    return slab;
  }

  function resetTower() {
    baseHue = Math.floor(Math.random() * 360);
    slabs = [];
    for (let i = 0; i < 4; i++) slabs.push(makeSlab(0, 0, BASE, BASE, i - 3));
    debris = [];
    current = createCurrent();
    camY = targetCam();
    camScale = targetScale = 1;
  }

  function selectMission() {
    const day = Math.floor(Date.now() / 86400000);
    mission = MISSIONS[day % MISSIONS.length];
    missionComplete = false;
  }

  function beginGame() {
    if (gameRunning) return;
    clearTimeout(overTimer);
    gameRunning = true;
    demo = false;
    score = 0;
    height = 0;
    combo = 0;
    maxCombo = 0;
    perfects = 0;
    narrowPlacements = 0;
    streak = 0;
    particles = [];
    fx = [];
    selectMission();
    resetTower();
    overlay.classList.add('hidden');
    highscores.classList.add('hidden');
    if (window.GamePlatform) {
      GamePlatform.resetTimer();
      GamePlatform.startTimer();
    }
    updateHud();
    acc = 0;
    Sound.sfx('start');
    Sound.music.start();
  }

  function finishGame() {
    if (!gameRunning) return;
    gameRunning = false;
    endedAt = performance.now();
    Sound.music.stop();
    Sound.sfx('gameover');
    const topScores = saveScore(score);
    renderScores(topScores);
    if (window.GamePlatform) {
      const elapsed = GamePlatform.stopTimer();
      GamePlatform.recordGame('stack-tower', score, elapsed * 1000, { maxCombo, maxHeight: height });
      GamePlatform.updateScore(score);
    }
    const towerH = (slabs[slabs.length - 1].level + 4) * SLAB_H;
    targetScale = Math.min(1, (H * 0.62) / (towerH * 1 + 140));
    overlayMessage.textContent = 'Tower collapsed | Score: ' + score + ' | Height: ' + height;
    overlayButton.textContent = 'Play Again';
    overTimer = setTimeout(() => {
      if (gameRunning) return;
      endedAt = performance.now();
      overlay.classList.remove('hidden');
    }, 1400);
  }

  function showBanner(text, sound) {
    perfectBanner.textContent = text;
    perfectBanner.classList.remove('hidden');
    perfectBanner.style.animation = 'none';
    void perfectBanner.offsetWidth;
    perfectBanner.style.animation = '';
    clearTimeout(perfectTimer);
    perfectTimer = setTimeout(() => perfectBanner.classList.add('hidden'), 750);
    if (sound) sound();
  }

  function checkMission() {
    if (missionComplete || missionProgress() < mission.target) return;
    missionComplete = true;
    score += 100;
    showBanner('MISSION COMPLETE', () => Sound.sfx('mission'));
  }

  function iso(x, y, z) {
    return [W / 2 + (x - z) * COS * camScale, H * 0.62 + ((x + z) * SIN - (y - camY)) * camScale];
  }

  function spawnParticles(x, y, z, color, amount) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
      particles.push({ x, y, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 40 + Math.random() * 90, life: 0.8, max: 0.8, color });
    }
  }

  function dropSlab() {
    if (!current) return;
    const top = slabs[slabs.length - 1];
    const axis = current.axis;
    const sizeKey = axis === 'x' ? 'w' : 'd';
    const delta = current[axis] - top[axis];
    const prevSize = top[sizeKey];
    const size = current[sizeKey];
    const lo = Math.max(current[axis] - size / 2, top[axis] - prevSize / 2);
    const hi = Math.min(current[axis] + size / 2, top[axis] + prevSize / 2);
    const overlap = hi - lo;
    const ty = current.level * SLAB_H;
    if (overlap <= 0) {
      debris.push({ ...current, vy: 0, vx: (axis === 'x' ? current.dir : 0) * 40, vz: (axis === 'z' ? current.dir : 0) * 40, y: ty, life: 2.5 });
      current = null;
      if (gameRunning) Sound.sfx('miss');
      if (gameRunning) finishGame(); else demoReset();
      return;
    }
    const perfect = Math.abs(delta) <= PERFECT_TOL && Math.abs(size - prevSize) <= PERFECT_TOL;
    const placed = makeSlab(current.x, current.z, current.w, current.d, current.level, current.kind);
    if (perfect) {
      placed[axis] = top[axis];
      placed[sizeKey] = prevSize;
      streak++;
      if (streak >= 3 && placed[sizeKey] < BASE) {
        placed[sizeKey] = Math.min(BASE, placed[sizeKey] + GROW);
        if (gameRunning) Sound.sfx('grow');
        fx.push({ k: 'grow', slab: placed, life: 500, max: 500 });
      }
    } else {
      streak = 0;
      placed[axis] = (lo + hi) / 2;
      placed[sizeKey] = overlap;
      const cutSize = size - overlap;
      if (cutSize > 0.5) {
        const side = current[axis] > top[axis] ? 1 : -1;
        const cut = makeSlab(current.x, current.z, current.w, current.d, current.level, current.kind);
        cut[sizeKey] = cutSize;
        cut[axis] = side > 0 ? hi + cutSize / 2 : lo - cutSize / 2;
        debris.push({ ...cut, y: ty, vy: 0, vx: axis === 'x' ? side * 30 : 0, vz: axis === 'z' ? side * 30 : 0, life: 2.2 });
        if (gameRunning) Sound.sfx('cut');
      }
    }
    placed.flash = 1;
    slabs.push(placed);
    current = null;
    if (gameRunning) scorePlacement(perfect, overlap, prevSize, placed);
    if (placed[sizeKey] < MIN_SIZE) {
      if (gameRunning) finishGame(); else demoReset();
      return;
    }
    if (slabs.length > 60) slabs.splice(0, slabs.length - 60);
    current = createCurrent();
  }

  function scorePlacement(perfect, overlap, prevSize, placed) {
    height += 1;
    const [cx, cy, cz] = [placed.x, placed.level * SLAB_H + SLAB_H, placed.z];
    if (placed.kind === 'bonus') {
      score += 50;
      fx.push({ k: 'popup', x: cx, y: cy + 10, z: cz, text: '+50 BONUS', color: '#ffd76a', life: 900, max: 900 });
    }
    if (perfect) {
      perfects += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      score += 20 + Math.min(5, 1 + Math.floor((combo - 1) / 2)) * 10;
      fx.push({ k: 'ring', slab: placed, life: 600, max: 600 });
      spawnParticles(cx, cy, cz, '#ffffff', 16);
      Sound.sfx('perfect', streak - 1);
      showBanner(streak > 1 ? 'PERFECT x' + streak : 'PERFECT');
    } else {
      if (overlap / prevSize > 0.75) combo += 1; else combo = 0;
      maxCombo = Math.max(maxCombo, combo);
      if (overlap / prevSize < 0.6) narrowPlacements += 1;
      score += 10 + Math.floor(overlap / 8) + (combo > 1 ? Math.min(5, combo) * 4 : 0);
      spawnParticles(cx, cy, cz, 'hsl(' + placed.color[0] + ',80%,75%)', 6);
      Sound.sfx('place', height);
    }
    checkMission();
    updateHud();
  }

  function demoReset() {
    demoTimer = 1.2;
  }

  function targetCam() {
    const top = slabs.length ? slabs[slabs.length - 1].level : 0;
    return (top + 1) * SLAB_H;
  }

  function update(dt) {
    const s = dt / 1000;
    if (current) {
      current.prev = current[current.axis];
      current.phase += s * 4;
      if (current.kind === 'shrink') {
        const key = current.axis === 'x' ? 'w' : 'd';
        current[key] = Math.max(28, current[key] - current.shrinkRate * dt);
      }
      const top = slabs[slabs.length - 1];
      current[current.axis] += current.speed * current.dir * s;
      if (current[current.axis] > top[current.axis] + RANGE) { current[current.axis] = top[current.axis] + RANGE; current.dir = -1; }
      if (current[current.axis] < top[current.axis] - RANGE) { current[current.axis] = top[current.axis] - RANGE; current.dir = 1; }
      if (demo && !gameRunning) {
        demoTimer -= s;
        if (demoTimer <= 0 && Math.abs(current[current.axis] - top[current.axis]) < 10 + Math.random() * 30) {
          dropSlab();
          demoTimer = 0.5 + Math.random() * 0.6;
        }
      }
    } else if (demo && !gameRunning) {
      demoTimer -= s;
      if (demoTimer <= 0) resetTower();
    }
    if (demo && !gameRunning && slabs.length > 16) resetTower();
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.vy -= 520 * s;
      d.y += d.vy * s;
      d.x += d.vx * s;
      d.z += d.vz * s;
      d.life -= s;
      if (d.life <= 0) debris.splice(i, 1);
    }
  }

  function updateFx(dt) {
    const s = dt / 1000;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * s;
      p.z += p.vz * s;
      p.y += p.vy * s;
      p.vy -= 260 * s;
      p.life -= s;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (const f of fx) f.life -= dt;
    fx = fx.filter(f => f.life > 0);
    for (const sl of slabs) if (sl.flash) sl.flash = Math.max(0, sl.flash - s * 3);
    for (const m of motes) {
      m.y -= m.v * s;
      if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
    }
    const goal = gameRunning || demo ? targetCam() : targetCam() * 0.5;
    camY += (goal - camY) * Math.min(1, s * 4);
    camScale += (targetScale - camScale) * Math.min(1, s * 3);
  }

  function hsl(c, dl) {
    return 'hsl(' + c[0] + ',' + c[1] + '%,' + Math.max(0, Math.min(100, c[2] + dl)) + '%)';
  }

  function drawBox(b, y0, alpha, extra) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y1 = y0 + SLAB_H;
    const t00 = iso(x0, y1, z0), t10 = iso(x1, y1, z0), t11 = iso(x1, y1, z1), t01 = iso(x0, y1, z1);
    const b10 = iso(x1, y0, z0), b11 = iso(x1, y0, z1), b01 = iso(x0, y0, z1);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = hsl(b.color, -10);
    ctx.beginPath(); ctx.moveTo(t10[0], t10[1]); ctx.lineTo(t11[0], t11[1]); ctx.lineTo(b11[0], b11[1]); ctx.lineTo(b10[0], b10[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hsl(b.color, -22);
    ctx.beginPath(); ctx.moveTo(t01[0], t01[1]); ctx.lineTo(t11[0], t11[1]); ctx.lineTo(b11[0], b11[1]); ctx.lineTo(b01[0], b01[1]); ctx.closePath(); ctx.fill();
    const top = ctx.createLinearGradient(t00[0], t00[1], t11[0], t11[1]);
    top.addColorStop(0, hsl(b.color, 12));
    top.addColorStop(1, hsl(b.color, 2));
    ctx.fillStyle = top;
    ctx.beginPath(); ctx.moveTo(t00[0], t00[1]); ctx.lineTo(t10[0], t10[1]); ctx.lineTo(t11[0], t11[1]); ctx.lineTo(t01[0], t01[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(t01[0], t01[1]); ctx.lineTo(t00[0], t00[1]); ctx.lineTo(t10[0], t10[1]); ctx.stroke();
    if (b.kind === 'shrink' && extra) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(t00[0], t00[1]); ctx.lineTo(t10[0], t10[1]); ctx.lineTo(t11[0], t11[1]); ctx.lineTo(t01[0], t01[1]); ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      for (let i = -12; i < 12; i++) {
        const p = iso(x0 + i * 14, y1, z0), q = iso(x0 + i * 14 + 60, y1, z1);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      ctx.restore();
    }
    if (b.kind === 'bonus') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(performance.now() * 0.006);
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath(); ctx.moveTo(t00[0], t00[1]); ctx.lineTo(t10[0], t10[1]); ctx.lineTo(t11[0], t11[1]); ctx.lineTo(t01[0], t01[1]); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (b.flash) {
      ctx.globalAlpha = b.flash * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(t00[0], t00[1]); ctx.lineTo(t10[0], t10[1]); ctx.lineTo(t11[0], t11[1]); ctx.lineTo(b11[0], b11[1]); ctx.lineTo(b01[0], b01[1]); ctx.lineTo(t01[0], t01[1]); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRhombus(b, y, grow, color, alpha) {
    const w = b.w / 2 + grow, d = b.d / 2 + grow;
    const p = [iso(b.x - w, y, b.z - d), iso(b.x + w, y, b.z - d), iso(b.x + w, y, b.z + d), iso(b.x - w, y, b.z + d)];
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function render(alpha) {
    const level = slabs.length ? slabs[slabs.length - 1].level : 0;
    const bgHue = (baseHue + 180 + level * 3) % 360;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'hsl(' + bgHue + ',45%,30%)');
    bg.addColorStop(1, 'hsl(' + ((bgHue + 40) % 360) + ',50%,11%)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, H * 0.6);
    glow.addColorStop(0, 'rgba(255,255,255,0.10)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const m of motes) ctx.fillRect(m.x, m.y, m.s, m.s);
    const ref = slabs[slabs.length - 1];
    const behind = d => ref && (d.x + d.z) < (ref.x + ref.z) - 1;
    for (const d of debris) if (behind(d)) drawBox(d, d.y, Math.min(1, d.life));
    for (const sl of slabs) drawBox(sl, sl.level * SLAB_H, 1, false);
    for (const d of debris) if (!behind(d)) drawBox(d, d.y, Math.min(1, d.life));
    if (current) {
      const pos = current.prev + (current[current.axis] - current.prev) * alpha;
      const keep = current[current.axis];
      current[current.axis] = pos;
      drawBox(current, current.level * SLAB_H, 1, true);
      current[current.axis] = keep;
    }
    for (const f of fx) {
      const t = Math.max(0, f.life / f.max);
      if (f.k === 'ring') drawRhombus(f.slab, (f.slab.level + 1) * SLAB_H, (1 - t) * 26 + 2, '#ffffff', t);
      else if (f.k === 'grow') drawRhombus(f.slab, (f.slab.level + 1) * SLAB_H, 2, 'rgba(160,255,190,1)', t);
      else if (f.k === 'popup') {
        const [sx, sy] = iso(f.x, f.y + (1 - t) * 30, f.z);
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.font = '900 15px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, sx, sy);
        ctx.globalAlpha = 1;
      }
    }
    for (const p of particles) {
      const [sx, sy] = iso(p.x, p.y, p.z);
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    const dt = Math.min(100, now - lastTime);
    lastTime = now;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 24) {
      acc -= STEP;
      update(STEP);
    }
    if (guard >= 24) acc = 0;
    updateFx(dt);
    render(Math.min(1, acc / STEP));
    Sound.update();
    requestAnimationFrame(loop);
  }

  function startFromOverlay() {
    if (overlay.classList.contains('hidden') || performance.now() - endedAt < 700) return;
    ensureAudio();
    beginGame();
  }

  function playerDrop() {
    if (!gameRunning) return;
    dropSlab();
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
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) playerDrop();
    }
  });

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    else playerDrop();
    if (event.pointerType === 'touch' && canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });

  dropButton.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!gameRunning) startFromOverlay();
    else playerDrop();
    dropButton.classList.add('pressed');
  });

  const releaseButton = event => {
    event.preventDefault();
    dropButton.classList.remove('pressed');
  };
  dropButton.addEventListener('pointerup', releaseButton);
  dropButton.addEventListener('pointercancel', releaseButton);
  dropButton.addEventListener('pointerleave', releaseButton);

  for (let i = 0; i < 40; i++) motes.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5, v: 6 + Math.random() * 14 });
  resetTower();
  selectMission();
  renderScores(safeLoadScores());
  updateHud();

  if (window.GamePlatform) GamePlatform.initHeader('Stack Tower');
  addMusicButton();
  lastTime = performance.now();
  requestAnimationFrame(loop);
  GameEngine.pausable({ isActive: () => gameRunning, container: '#game-area' });
})();
