// ── Canvas & Context ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── HUD Elements ──
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-message');
const overlayBtn = document.getElementById('overlay-btn');
const highscoresDiv = document.getElementById('highscores');
const scoreList = document.getElementById('score-list');
const powerupHud = document.getElementById('powerup-hud');
const levelSelect = document.getElementById('level-select');

// ── Game Constants ──
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 14;
const PADDLE_SPEED = 8;
const BALL_RADIUS = 8;
let BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_WIDTH = 70;
const BRICK_HEIGHT = 24;
const BRICK_PADDING = 6;
const BRICK_OFFSET_TOP = 50;
const BRICK_OFFSET_LEFT = (canvas.width - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;
const POWERUP_DROP_CHANCE = 0.2;
const POWERUP_RADIUS = 12;
const POWERUP_SPEED = 2.5;

// ── World / Level System ──
const WORLDS = {
  1: {
    name: 'Classic',
    colors: ['#ff4d6d', '#ff8c42', '#ffd700', '#00e676', '#00d4ff'],
    baseSpeed: 4
  },
  2: {
    name: 'Neon',
    colors: ['#ff00ff', '#00ffff', '#ff6600', '#66ff00', '#ffff00'],
    baseSpeed: 5
  },
  3: {
    name: 'Dark',
    colors: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'],
    baseSpeed: 6
  }
};

const LEVELS_PER_WORLD = 5;
const ROW_POINTS = [7, 5, 3, 2, 1];

const POWERUP_TYPES = [
  { id: 'wide',    label: 'W', color: '#00e676', name: 'Wide Paddle',  duration: 10000 },
  { id: 'multi',   label: 'M', color: '#e040fb', name: 'Multi-Ball',   duration: 0 },
  { id: 'slow',    label: 'S', color: '#00d4ff', name: 'Slow Motion',  duration: 8000 },
  { id: 'life',    label: '+', color: '#ff4d6d', name: 'Extra Life',   duration: 0 },
  { id: 'fire',    label: 'F', color: '#ff6600', name: 'Fireball',     duration: 8000 },
  { id: 'laser',   label: 'L', color: '#ffff00', name: 'Laser',        duration: 10000 },
  { id: 'magnet',  label: 'G', color: '#ff69b4', name: 'Magnet',       duration: 5000 },
];

// ── Level Patterns (15 unique, symmetric left-right) ──
const LEVEL_PATTERNS = {
  // World 1 - Classic
  '1-1': [ // Full Grid
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1]
  ],
  '1-2': [ // Diamond
    [0,0,0,0,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,0,0,1,1,0,0,0,0]
  ],
  '1-3': [ // Checkerboard
    [1,0,1,0,1,1,0,1,0,1],
    [0,1,0,1,0,0,1,0,1,0],
    [1,0,1,0,1,1,0,1,0,1],
    [0,1,0,1,0,0,1,0,1,0],
    [1,0,1,0,1,1,0,1,0,1],
    [0,1,0,1,0,0,1,0,1,0]
  ],
  '1-4': [ // V / Chevron
    [1,0,0,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,0,0,1,0],
    [0,0,1,0,0,0,0,1,0,0],
    [0,0,0,1,0,0,1,0,0,0],
    [0,0,0,0,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,0,0]
  ],
  '1-5': [ // Fortress
    [1,0,1,0,1,1,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,0,0,0,0,0,0,1,1],
    [1,1,0,0,0,0,0,0,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [0,1,1,1,0,0,1,1,1,0],
    [0,0,1,1,0,0,1,1,0,0]
  ],
  // World 2 - Neon
  '2-1': [ // Horizontal Stripes
    [1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,0]
  ],
  '2-2': [ // Pyramid
    [0,0,0,0,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1]
  ],
  '2-3': [ // Hourglass
    [1,1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1]
  ],
  '2-4': [ // Cross / Plus
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,0,0,0]
  ],
  '2-5': [ // Spiral
    [1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1]
  ],
  // World 3 - Dark
  '3-1': [ // Double Diamond
    [0,1,0,0,0,0,0,0,1,0],
    [1,1,1,0,0,0,0,1,1,1],
    [1,1,1,1,0,0,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,0,0,1,1,1,1],
    [1,1,1,0,0,0,0,1,1,1],
    [0,1,0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0]
  ],
  '3-2': [ // Arrow Down
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,0,0,1,1,0,0,0,0],
    [0,0,0,0,1,1,0,0,0,0]
  ],
  '3-3': [ // Frame / Border
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1]
  ],
  '3-4': [ // Zigzag
    [1,1,0,0,0,0,0,0,1,1],
    [0,1,1,0,0,0,0,1,1,0],
    [0,0,1,1,0,0,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0],
    [0,0,1,1,0,0,1,1,0,0],
    [0,1,1,0,0,0,0,1,1,0],
    [1,1,0,0,0,0,0,0,1,1],
    [0,1,1,0,0,0,0,1,1,0]
  ],
  '3-5': [ // Heart
    [0,1,1,0,0,0,0,1,1,0],
    [1,1,1,1,0,0,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,0,0,0]
  ]
};

// ── Audio (Web Audio API) ──
let audioCtx;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'square', vol = 0.12) {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxPaddleHit()  { playTone(440, 0.08, 'triangle', 0.15); }
function sfxWallBounce() { playTone(300, 0.04, 'sine', 0.06); }
function sfxBrickBreak(row) { playTone(520 + row * 80, 0.1, 'square', 0.1); }
function sfxLifeLost()   { playTone(200, 0.3, 'sawtooth', 0.12); setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.1), 150); }
function sfxPowerup()    { playTone(880, 0.08, 'sine', 0.12); setTimeout(() => playTone(1100, 0.1, 'sine', 0.1), 60); }
function sfxLevelUp()    { [660, 880, 1100].forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'triangle', 0.12), i * 100)); }
function sfxGameOver()   { [300, 250, 200, 150].forEach((f, i) => setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.1), i * 150)); }
function sfxWin()        { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'triangle', 0.14), i * 120)); }
function sfxFireball()   { playTone(200, 0.15, 'sawtooth', 0.14); setTimeout(() => playTone(400, 0.2, 'square', 0.1), 80); }
function sfxLaserShoot() { playTone(1200, 0.05, 'square', 0.08); }
function sfxMagnetCatch(){ playTone(600, 0.1, 'sine', 0.1); setTimeout(() => playTone(800, 0.1, 'sine', 0.08), 50); }
function sfxLevelComplete() { [523, 659, 784, 880, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'triangle', 0.13), i * 90)); }
function sfxWorldUnlock() {
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'triangle', 0.14), i * 100));
}

// ── High Scores ──
const HS_KEY = 'breakout_highscores';
function loadHighScores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; }
  catch { return []; }
}
function saveHighScore(s) {
  const scores = loadHighScores();
  scores.push({ score: s, date: new Date().toLocaleDateString() });
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(HS_KEY, JSON.stringify(scores.slice(0, 5)));
}
function renderHighScores() {
  const scores = loadHighScores();
  if (scores.length === 0) { highscoresDiv.classList.add('hidden'); return; }
  highscoresDiv.classList.remove('hidden');
  scoreList.innerHTML = scores
    .map((s, i) => `<li>#${i + 1}  ${String(s.score).padStart(5, ' ')}  ${s.date}</li>`)
    .join('');
}

// ── Progress System (localStorage) ──
const PROGRESS_KEY = 'breakout_progress';

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (data && data.worlds) return data;
  } catch {}
  return { worlds: { 1: {}, 2: {}, 3: {} } };
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function isLevelUnlocked(world, level) {
  if (world === 1 && level === 1) return true;
  const progress = loadProgress();
  if (level === 1) {
    // First level of a world: need all previous world levels completed
    const prevWorld = world - 1;
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
      if (!progress.worlds[prevWorld] || !progress.worlds[prevWorld][l]) return false;
    }
    return true;
  }
  // Need previous level in same world completed
  return !!(progress.worlds[world] && progress.worlds[world][level - 1]);
}

function isWorldUnlocked(world) {
  if (world === 1) return true;
  return isLevelUnlocked(world, 1);
}

function getLevelStars(world, level) {
  const progress = loadProgress();
  if (progress.worlds[world] && progress.worlds[world][level]) {
    return progress.worlds[world][level].stars || 0;
  }
  return 0;
}

function saveLevelResult(world, level, score) {
  const progress = loadProgress();
  if (!progress.worlds[world]) progress.worlds[world] = {};

  const globalLevel = (world - 1) * LEVELS_PER_WORLD + level;
  let stars = 1; // completed
  if (score >= 200 * globalLevel) stars = 2;
  if (score >= 500 * globalLevel) stars = 3;

  const existing = progress.worlds[world][level];
  if (!existing || stars > existing.stars || score > existing.bestScore) {
    progress.worlds[world][level] = {
      stars: existing ? Math.max(stars, existing.stars) : stars,
      bestScore: existing ? Math.max(score, existing.bestScore) : score
    };
  }
  saveProgress(progress);
  return stars;
}

// ── Particles ──
let particles = [];

function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 3,
      color,
      life: 1.0,
      decay: 0.015 + Math.random() * 0.025
    });
  }
}

function spawnPaddleSparkle(x, y) {
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x: x + (Math.random() - 0.5) * 30,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.5 + Math.random() * 2,
      color: '#00d4ff',
      life: 1.0,
      decay: 0.03 + Math.random() * 0.02
    });
  }
}

function spawnFireTrail(x, y) {
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const speed = 0.5 + Math.random() * 1.5;
    const colors = ['#ff6600', '#ff4400', '#ff2200', '#ffaa00'];
    particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.8,
      decay: 0.04 + Math.random() * 0.03
    });
  }
}

function spawnMagnetParticles(ballX, ballY, paddleX, paddleY) {
  const dx = paddleX - ballX;
  const dy = paddleY - ballY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return;
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    const t = (i + Math.random()) / steps;
    particles.push({
      x: ballX + dx * t + (Math.random() - 0.5) * 8,
      y: ballY + dy * t + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 1 + Math.random() * 2,
      color: '#ff69b4',
      life: 0.5,
      decay: 0.05 + Math.random() * 0.05
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= p.decay;
    p.r *= 0.98;
    if (p.life <= 0 || p.r < 0.3) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Floating score text ──
let floatingTexts = [];

function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1.0, vy: -1.5 });
}

function updateFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life -= 0.02;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

// ── Ball trail ──
const TRAIL_LENGTH = 8;
let ballTrails = new Map();

function updateTrails() {
  const currentIds = new Set(balls.map((_, i) => i));
  for (const key of ballTrails.keys()) {
    if (!currentIds.has(key)) ballTrails.delete(key);
  }
  for (let i = 0; i < balls.length; i++) {
    if (!ballTrails.has(i)) ballTrails.set(i, []);
    const trail = ballTrails.get(i);
    trail.push({ x: balls[i].x, y: balls[i].y });
    if (trail.length > TRAIL_LENGTH) trail.shift();
  }
}

function drawTrails() {
  for (const [bi, trail] of ballTrails) {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const alpha = (i / trail.length) * 0.3;
      const r = BALL_RADIUS * (i / trail.length) * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      let trailColor = '#00d4ff';
      if (activeEffects['fire']) trailColor = '#ff6600';
      else if (activeEffects['slow']) trailColor = '#e040fb';
      ctx.fillStyle = trailColor;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── Screen shake ──
let shakeAmount = 0;
let shakeDuration = 0;

function triggerShake(amount = 6, duration = 12) {
  shakeAmount = amount;
  shakeDuration = duration;
}

function getShakeOffset() {
  if (shakeDuration <= 0) return { x: 0, y: 0 };
  shakeDuration--;
  const intensity = shakeAmount * (shakeDuration / 12);
  return {
    x: (Math.random() - 0.5) * intensity * 2,
    y: (Math.random() - 0.5) * intensity * 2
  };
}

// ── Background stars ──
const stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 0.5 + Math.random() * 1.5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.5
  });
}

function drawBackground(time) {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#0a0a1a');
  bgGrad.addColorStop(1, '#16213e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const s of stars) {
    const alpha = 0.3 + 0.4 * Math.sin(time * s.speed * 0.002 + s.phase);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Game State ──
let score, lives, currentWorld, currentLevel, balls, paddle, bricks, powerups, activeEffects, running, animId;
let keys = {};
let gameTime = 0;
let lasers = [];       // active laser beams
let laserTimer = 0;    // countdown to next laser shot
let magnetStuck = false; // is ball stuck to paddle via magnet
let magnetBallOffset = 0; // offset of stuck ball from paddle center

// ── Laser beam object ──
function spawnLaser() {
  sfxLaserShoot();
  lasers.push({
    x: paddle.x + paddle.w / 2,
    y: paddle.y,
    vy: -10,
    alive: true
  });
}

// ── Input: Keyboard ──
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup', e => { keys[e.key] = false; });

// ── Input: Mouse ──
canvas.addEventListener('mousemove', e => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const mouseX = (e.clientX - rect.left) * scaleX;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2));
});

canvas.addEventListener('click', e => {
  ensureAudio();
  if (running && magnetStuck) {
    releaseMagnetBall();
  }
});

// ── Input: Touch ──
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const touchX = (e.touches[0].clientX - rect.left) * scaleX;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, touchX - paddle.w / 2));
}, { passive: false });

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  ensureAudio();
  if (running && magnetStuck) {
    releaseMagnetBall();
  }
}, { passive: false });

function releaseMagnetBall() {
  if (!magnetStuck) return;
  magnetStuck = false;
  // Launch ball upward
  const ball = balls[0];
  if (ball) {
    const speed = getBallSpeed();
    ball.dy = -speed;
    ball.dx = (Math.random() - 0.5) * speed * 0.8;
  }
}

function getBallSpeed() {
  const world = WORLDS[currentWorld];
  return world.baseSpeed + (currentLevel - 1) * 0.3;
}

// ── Level Select Screen ──
let selectedWorldTab = 1;

function showLevelSelect() {
  overlay.classList.add('hidden');
  levelSelect.classList.remove('hidden');
  renderLevelSelect();
}

function hideLevelSelect() {
  levelSelect.classList.add('hidden');
}

function renderLevelSelect() {
  const progress = loadProgress();

  let html = '<h1 class="ls-title">Select Level</h1>';
  html += '<div class="ls-world-tabs">';
  for (let w = 1; w <= 3; w++) {
    const unlocked = isWorldUnlocked(w);
    const active = w === selectedWorldTab;
    html += `<button class="ls-tab${active ? ' active' : ''}${!unlocked ? ' locked' : ''}" 
             data-world="${w}" ${!unlocked ? 'disabled' : ''}>
             ${unlocked ? '' : '<span class="lock-icon">&#128274;</span>'}
             World ${w}: ${WORLDS[w].name}
           </button>`;
  }
  html += '</div>';

  html += '<div class="ls-levels">';
  const w = selectedWorldTab;
  for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
    const unlocked = isLevelUnlocked(w, l);
    const levelData = progress.worlds[w] && progress.worlds[w][l];
    const starCount = levelData ? levelData.stars : 0;

    let starsHtml = '';
    for (let s = 1; s <= 3; s++) {
      starsHtml += `<span class="star ${s <= starCount ? 'earned' : ''}">${s <= starCount ? '\u2605' : '\u2606'}</span>`;
    }

    html += `<button class="ls-level-btn${!unlocked ? ' locked' : ''}" 
             data-world="${w}" data-level="${l}" ${!unlocked ? 'disabled' : ''}>
             <div class="ls-level-num">${!unlocked ? '&#128274;' : l}</div>
             <div class="ls-level-stars">${starsHtml}</div>
           </button>`;
  }
  html += '</div>';

  html += '<button class="ls-back-btn" id="ls-back">Back</button>';

  levelSelect.innerHTML = html;

  // Bind events
  levelSelect.querySelectorAll('.ls-tab:not([disabled])').forEach(tab => {
    tab.addEventListener('click', () => {
      selectedWorldTab = parseInt(tab.dataset.world);
      renderLevelSelect();
    });
  });

  levelSelect.querySelectorAll('.ls-level-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseInt(btn.dataset.world);
      const l = parseInt(btn.dataset.level);
      hideLevelSelect();
      startLevel(w, l);
    });
  });

  document.getElementById('ls-back').addEventListener('click', () => {
    hideLevelSelect();
    showStartScreen();
  });
}

// ── Overlay / Start Screen ──
function showStartScreen() {
  overlayTitle.textContent = 'Breakout';
  overlayTitle.style.color = '#00d4ff';
  overlayMsg.textContent = 'Click or tap to start';
  overlayBtn.textContent = 'Play';
  // Show how-to-play and highscores
  const howTo = overlay.querySelector('.how-to-play');
  if (howTo) howTo.style.display = '';
  renderHighScores();
  overlay.classList.remove('hidden');
}

overlayBtn.addEventListener('click', () => {
  ensureAudio();
  const btnText = overlayBtn.textContent;
  if (btnText === 'Play' || btnText === 'Start Game') {
    overlay.classList.add('hidden');
    showLevelSelect();
  } else if (btnText === 'Next Level') {
    overlay.classList.add('hidden');
    goToNextLevel();
  } else if (btnText === 'Retry') {
    overlay.classList.add('hidden');
    startLevel(currentWorld, currentLevel);
  }
});

// Secondary button handler (Level Select from result screen)
function setupSecondaryBtn() {
  let secBtn = document.getElementById('overlay-btn-secondary');
  if (!secBtn) {
    secBtn = document.createElement('button');
    secBtn.id = 'overlay-btn-secondary';
    overlayBtn.parentNode.insertBefore(secBtn, overlayBtn.nextSibling);
  }
  secBtn.style.display = '';
  secBtn.textContent = 'Level Select';
  secBtn.onclick = () => {
    overlay.classList.add('hidden');
    secBtn.style.display = 'none';
    showLevelSelect();
  };
  return secBtn;
}

function hideSecondaryBtn() {
  const secBtn = document.getElementById('overlay-btn-secondary');
  if (secBtn) secBtn.style.display = 'none';
}

// ── Initialisation ──
function startLevel(world, level) {
  currentWorld = world;
  currentLevel = level;
  score = 0;
  lives = 3;
  powerups = [];
  activeEffects = {};
  particles = [];
  floatingTexts = [];
  ballTrails = new Map();
  lasers = [];
  laserTimer = 0;
  magnetStuck = false;
  magnetBallOffset = 0;
  shakeAmount = 0;
  shakeDuration = 0;
  running = true;
  resetBalls();
  resetPaddle();
  buildBricks();
  updateHUD();
  updatePowerupHUD();
  hideSecondaryBtn();
  if (animId) cancelAnimationFrame(animId);
  if (window.GamePlatform) GamePlatform.startTimer();
  loop();
}

function goToNextLevel() {
  let nextWorld = currentWorld;
  let nextLevel = currentLevel + 1;
  if (nextLevel > LEVELS_PER_WORLD) {
    nextWorld++;
    nextLevel = 1;
  }
  if (nextWorld > 3) {
    // All done
    showStartScreen();
    return;
  }
  startLevel(nextWorld, nextLevel);
}

function makeBall() {
  const speed = getBallSpeed();
  return {
    x: canvas.width / 2,
    y: canvas.height - 50,
    r: BALL_RADIUS,
    dx: speed * (Math.random() > 0.5 ? 1 : -1),
    dy: -speed
  };
}

function resetBalls() {
  balls = [makeBall()];
  ballTrails = new Map();
  magnetStuck = false;
}

function resetPaddle() {
  paddle = {
    x: (canvas.width - PADDLE_WIDTH) / 2,
    y: canvas.height - 30,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT
  };
}

function buildBricks() {
  bricks = [];
  const key = currentWorld + '-' + currentLevel;
  const pattern = LEVEL_PATTERNS[key] || LEVEL_PATTERNS['1-1'];
  const worldColors = WORLDS[currentWorld].colors;
  BRICK_ROWS = pattern.length;

  for (let r = 0; r < BRICK_ROWS; r++) {
    bricks[r] = [];
    for (let c = 0; c < BRICK_COLS; c++) {
      const colorIdx = r % worldColors.length;
      bricks[r][c] = {
        x: BRICK_OFFSET_LEFT + c * (BRICK_WIDTH + BRICK_PADDING),
        y: BRICK_OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_PADDING),
        w: BRICK_WIDTH,
        h: BRICK_HEIGHT,
        alive: !!pattern[r][c],
        color: worldColors[colorIdx],
        points: ROW_POINTS[colorIdx],
        row: colorIdx
      };
    }
  }
}

// ── Power-up helpers ──
function spawnPowerup(x, y) {
  if (Math.random() > POWERUP_DROP_CHANCE) return;
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({ x, y, type, vy: POWERUP_SPEED, angle: 0 });
}

function activatePowerup(type) {
  sfxPowerup();
  switch (type.id) {
    case 'wide':
      paddle.w = PADDLE_WIDTH * 1.6;
      paddle.x = Math.min(paddle.x, canvas.width - paddle.w);
      setTimedEffect('wide', type.duration);
      break;
    case 'multi': {
      const newBalls = [];
      const src = balls[0] || makeBall();
      for (let i = 0; i < 2; i++) {
        const b = { ...src };
        const angle = (i === 0 ? -0.4 : 0.4);
        const speed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
        b.dx = speed * Math.sin(angle);
        b.dy = -speed * Math.cos(angle);
        newBalls.push(b);
      }
      balls.push(...newBalls);
      if (magnetStuck) releaseMagnetBall();
      break;
    }
    case 'slow':
      balls.forEach(b => { b.dx *= 0.5; b.dy *= 0.5; });
      setTimedEffect('slow', type.duration);
      break;
    case 'life':
      lives++;
      updateHUD();
      break;
    case 'fire':
      sfxFireball();
      setTimedEffect('fire', type.duration);
      break;
    case 'laser':
      laserTimer = 0;
      setTimedEffect('laser', type.duration);
      break;
    case 'magnet':
      sfxMagnetCatch();
      setTimedEffect('magnet', type.duration);
      break;
  }
  updatePowerupHUD();
}

function setTimedEffect(id, duration) {
  if (activeEffects[id]) clearTimeout(activeEffects[id].timer);
  const expiresAt = Date.now() + duration;
  activeEffects[id] = {
    expiresAt,
    duration,
    timer: setTimeout(() => {
      delete activeEffects[id];
      if (id === 'wide') {
        paddle.w = PADDLE_WIDTH;
        paddle.x = Math.min(paddle.x, canvas.width - paddle.w);
      }
      if (id === 'slow') {
        balls.forEach(b => { b.dx *= 2; b.dy *= 2; });
      }
      if (id === 'magnet' && magnetStuck) {
        releaseMagnetBall();
      }
      updatePowerupHUD();
    }, duration)
  };
}

function updatePowerupHUD() {
  const active = Object.keys(activeEffects);
  if (active.length === 0) { powerupHud.innerHTML = ''; return; }
  powerupHud.innerHTML = active.map(id => {
    const t = POWERUP_TYPES.find(p => p.id === id);
    if (!t) return '';
    const effect = activeEffects[id];
    const remaining = Math.max(0, Math.ceil((effect.expiresAt - Date.now()) / 1000));
    const fraction = Math.max(0, (effect.expiresAt - Date.now()) / effect.duration);
    const barWidth = Math.round(fraction * 100);
    return `<span class="powerup-indicator" style="background:${t.color}">
      ${t.name} ${remaining}s
      <span class="powerup-timer-bar" style="width:${barWidth}%;background:rgba(255,255,255,0.35)"></span>
    </span>`;
  }).join('');
}

// ── Update ──
function update() {
  // Paddle keyboard movement
  if (keys['ArrowLeft'] || keys['a']) paddle.x -= PADDLE_SPEED;
  if (keys['ArrowRight'] || keys['d']) paddle.x += PADDLE_SPEED;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));

  // Magnet: if ball is stuck, keep it on paddle
  if (magnetStuck && balls.length > 0) {
    const ball = balls[0];
    ball.x = paddle.x + paddle.w / 2 + magnetBallOffset;
    ball.y = paddle.y - ball.r;
    ball.dx = 0;
    ball.dy = 0;
    // Magnet particles
    if (gameTime % 3 === 0) {
      spawnMagnetParticles(ball.x, ball.y, paddle.x + paddle.w / 2, paddle.y);
    }
  }

  // Laser: shoot periodically
  if (activeEffects['laser']) {
    laserTimer++;
    if (laserTimer >= 24) { // ~400ms at 60fps
      spawnLaser();
      laserTimer = 0;
    }
  }

  // Update lasers
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    laser.y += laser.vy;
    if (laser.y < 0) { lasers.splice(i, 1); continue; }

    // Check laser-brick collision
    let hit = false;
    for (let r = BRICK_ROWS - 1; r >= 0 && !hit; r--) {
      for (let c = 0; c < BRICK_COLS && !hit; c++) {
        const b = bricks[r][c];
        if (!b.alive) continue;
        if (laser.x >= b.x && laser.x <= b.x + b.w &&
            laser.y >= b.y && laser.y <= b.y + b.h) {
          b.alive = false;
          const globalLevel = (currentWorld - 1) * LEVELS_PER_WORLD + currentLevel;
          const pts = b.points * globalLevel;
          score += pts;
          sfxBrickBreak(b.row);
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffff00', 8);
          spawnFloatingText(b.x + b.w / 2, b.y, '+' + pts, '#ffff00');
          updateHUD();
          lasers.splice(i, 1);
          hit = true;
        }
      }
    }
  }

  // Update each ball
  const ballsToRemove = [];
  for (let bi = 0; bi < balls.length; bi++) {
    const ball = balls[bi];

    if (magnetStuck && bi === 0) continue; // skip stuck ball

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Fire trail particles
    if (activeEffects['fire'] && gameTime % 2 === 0) {
      spawnFireTrail(ball.x, ball.y);
    }

    // Wall collisions
    if (ball.x - ball.r <= 0 || ball.x + ball.r >= canvas.width) {
      ball.dx *= -1;
      ball.x = Math.max(ball.r, Math.min(canvas.width - ball.r, ball.x));
      sfxWallBounce();
    }
    if (ball.y - ball.r <= 0) {
      ball.dy = Math.abs(ball.dy);
      sfxWallBounce();
    }

    // Fell off bottom
    if (ball.y + ball.r >= canvas.height) {
      ballsToRemove.push(bi);
      continue;
    }

    // Paddle collision
    if (
      ball.dy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y + ball.r <= paddle.y + paddle.h + 4 &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.w
    ) {
      // Magnet: stick ball
      if (activeEffects['magnet'] && !magnetStuck && bi === 0) {
        magnetStuck = true;
        magnetBallOffset = ball.x - (paddle.x + paddle.w / 2);
        ball.dx = 0;
        ball.dy = 0;
        ball.y = paddle.y - ball.r;
        sfxMagnetCatch();
        continue;
      }

      sfxPaddleHit();
      spawnPaddleSparkle(ball.x, paddle.y);
      const hitPos = (ball.x - paddle.x) / paddle.w;
      const angle = (hitPos - 0.5) * 2.5;
      const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      ball.dx = speed * Math.sin(angle);
      ball.dy = -speed * Math.cos(angle);
    }

    // Brick collisions
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const b = bricks[r][c];
        if (!b.alive) continue;
        if (
          ball.x + ball.r > b.x &&
          ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y &&
          ball.y - ball.r < b.y + b.h
        ) {
          b.alive = false;
          const globalLevel = (currentWorld - 1) * LEVELS_PER_WORLD + currentLevel;
          const pts = b.points * globalLevel;
          score += pts;
          sfxBrickBreak(b.row);
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 14);
          spawnFloatingText(b.x + b.w / 2, b.y, '+' + pts, b.color);
          updateHUD();
          spawnPowerup(b.x + b.w / 2, b.y + b.h);

          // Fireball: don't reverse ball direction
          if (!activeEffects['fire']) {
            const overlapLeft = (ball.x + ball.r) - b.x;
            const overlapRight = (b.x + b.w) - (ball.x - ball.r);
            const overlapTop = (ball.y + ball.r) - b.y;
            const overlapBottom = (b.y + b.h) - (ball.y - ball.r);
            const minOverlapX = Math.min(overlapLeft, overlapRight);
            const minOverlapY = Math.min(overlapTop, overlapBottom);
            if (minOverlapX < minOverlapY) ball.dx *= -1;
            else ball.dy *= -1;
          }
        }
      }
    }
  }

  // Remove lost balls (iterate in reverse)
  for (let i = ballsToRemove.length - 1; i >= 0; i--) {
    balls.splice(ballsToRemove[i], 1);
  }

  // All balls lost
  if (balls.length === 0) {
    lives--;
    sfxLifeLost();
    triggerShake(8, 15);
    updateHUD();
    // Clear timed effects
    Object.values(activeEffects).forEach(e => clearTimeout(e.timer));
    activeEffects = {};
    paddle.w = PADDLE_WIDTH;
    lasers = [];
    laserTimer = 0;
    magnetStuck = false;
    updatePowerupHUD();
    if (lives <= 0) return gameOver(false);
    resetBalls();
  }

  // Update falling power-ups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.vy;
    p.angle += 0.05;
    if (
      p.y + POWERUP_RADIUS >= paddle.y &&
      p.y - POWERUP_RADIUS <= paddle.y + paddle.h &&
      p.x >= paddle.x &&
      p.x <= paddle.x + paddle.w
    ) {
      spawnParticles(p.x, p.y, p.type.color, 8);
      activatePowerup(p.type);
      powerups.splice(i, 1);
      continue;
    }
    if (p.y - POWERUP_RADIUS > canvas.height) {
      powerups.splice(i, 1);
    }
  }

  // Update visual effects
  updateParticles();
  updateFloatingTexts();
  updateTrails();

  // Update power-up timer display every frame
  if (Object.keys(activeEffects).length > 0) updatePowerupHUD();

  // Check level cleared
  let allCleared = true;
  for (let r = 0; r < BRICK_ROWS && allCleared; r++)
    for (let c = 0; c < BRICK_COLS && allCleared; c++)
      if (bricks[r][c].alive) allCleared = false;

  if (allCleared) {
    return levelComplete();
  }
}

// ── Draw ──
function draw() {
  const shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Background
  drawBackground(gameTime);

  // Bricks with gradient and shine
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const b = bricks[r][c];
      if (!b.alive) continue;

      const brickGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      brickGrad.addColorStop(0, lightenColor(b.color, 30));
      brickGrad.addColorStop(0.5, b.color);
      brickGrad.addColorStop(1, darkenColor(b.color, 30));
      ctx.fillStyle = brickGrad;
      ctx.beginPath();
      roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();

      // Shine highlight
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      roundRect(ctx, b.x + 2, b.y + 1, b.w - 4, b.h * 0.35, 3);
      ctx.fill();
      ctx.restore();
    }
  }

  // Ball trails
  drawTrails();

  // Laser beams
  for (const laser of lasers) {
    ctx.save();
    ctx.strokeStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laser.x, laser.y);
    ctx.lineTo(laser.x, laser.y + 20);
    ctx.stroke();
    // Inner bright line
    ctx.strokeStyle = '#ffffcc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(laser.x, laser.y);
    ctx.lineTo(laser.x, laser.y + 20);
    ctx.stroke();
    ctx.restore();
  }

  // Particles
  drawParticles();

  // Floating score texts
  drawFloatingTexts();

  // Power-ups (spinning)
  for (const p of powerups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.type.color;
    ctx.shadowColor = p.type.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -POWERUP_RADIUS);
    ctx.lineTo(POWERUP_RADIUS * 0.7, 0);
    ctx.lineTo(0, POWERUP_RADIUS);
    ctx.lineTo(-POWERUP_RADIUS * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.rotate(-p.angle);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type.label, 0, 0);
    ctx.restore();
  }

  // Paddle with glow
  ctx.save();
  const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y);
  const isWide = !!activeEffects['wide'];
  const hasMagnet = !!activeEffects['magnet'];
  const hasLaser = !!activeEffects['laser'];
  let pColor1, pColor2, pColor3, pGlow;
  if (hasMagnet) {
    pColor1 = '#ff69b4'; pColor2 = '#ffb6c1'; pColor3 = '#ff1493'; pGlow = '#ff69b4';
  } else if (hasLaser) {
    pColor1 = '#ffff00'; pColor2 = '#ffffaa'; pColor3 = '#cccc00'; pGlow = '#ffff00';
  } else if (isWide) {
    pColor1 = '#00e676'; pColor2 = '#69f0ae'; pColor3 = '#00c853'; pGlow = '#00e676';
  } else {
    pColor1 = '#00d4ff'; pColor2 = '#48e5ff'; pColor3 = '#0077b6'; pGlow = '#00d4ff';
  }
  grad.addColorStop(0, pColor1);
  grad.addColorStop(0.5, pColor2);
  grad.addColorStop(1, pColor3);
  ctx.fillStyle = grad;
  ctx.shadowColor = pGlow;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
  ctx.fill();
  ctx.restore();

  // Laser barrel indicator
  if (hasLaser) {
    ctx.save();
    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 6;
    ctx.fillRect(paddle.x + paddle.w / 2 - 2, paddle.y - 4, 4, 4);
    ctx.restore();
  }

  // Balls with glow
  for (const ball of balls) {
    ctx.save();
    let ballColor = '#00d4ff';
    if (activeEffects['fire']) ballColor = '#ff6600';
    else if (activeEffects['slow']) ballColor = '#e040fb';

    // Magnet glow when stuck
    if (magnetStuck && ball === balls[0]) {
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#ffb6c1';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fireball outer glow
    if (activeEffects['fire']) {
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(255,102,0,0.3)';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r + 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main ball
    ctx.shadowColor = ballColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    // Inner core
    ctx.shadowBlur = 0;
    const coreGrad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, ball.r);
    coreGrad.addColorStop(0, '#fff');
    coreGrad.addColorStop(1, ballColor);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // end shake transform
}

// ── Color utilities ──
function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// ── HUD ──
function updateHUD() {
  scoreEl.textContent = 'Score: ' + score;
  levelEl.textContent = 'World ' + currentWorld + '-' + currentLevel;
  livesEl.textContent = 'Lives: ' + lives;
  if (window.GamePlatform) GamePlatform.updateScore(score);
}

// ── Level Complete ──
function levelComplete() {
  running = false;
  cancelAnimationFrame(animId);
  Object.values(activeEffects).forEach(e => clearTimeout(e.timer));
  activeEffects = {};
  powerupHud.innerHTML = '';
  lasers = [];
  magnetStuck = false;

  sfxLevelComplete();

  const starsEarned = saveLevelResult(currentWorld, currentLevel, score);
  saveHighScore(score);

  if (window.GamePlatform) {
    var t = GamePlatform.stopTimer();
    GamePlatform.recordGame('breakout', score, t * 1000, {
      win: true,
      world: currentWorld,
      level: currentLevel
    });
    GamePlatform.updateScore(score);
  }

  // Check if a new world was just unlocked
  const nextWorld = currentWorld + (currentLevel === LEVELS_PER_WORLD ? 1 : 0);
  if (currentLevel === LEVELS_PER_WORLD && nextWorld <= 3 && isWorldUnlocked(nextWorld)) {
    sfxWorldUnlock();
  }

  // Check if all worlds completed
  const allDone = currentWorld === 3 && currentLevel === LEVELS_PER_WORLD;

  // Stars display
  let starStr = '';
  for (let i = 1; i <= 3; i++) {
    starStr += i <= starsEarned ? '\u2605' : '\u2606';
  }

  overlayTitle.textContent = allDone ? 'Congratulations!' : 'Level Complete!';
  overlayTitle.style.color = '#ffd700';

  let msgText = allDone
    ? 'All worlds completed!\nScore: ' + score + '  ' + starStr
    : 'World ' + currentWorld + '-' + currentLevel + '\nScore: ' + score + '  ' + starStr;
  overlayMsg.textContent = msgText;

  // Hide how-to-play
  const howTo = overlay.querySelector('.how-to-play');
  if (howTo) howTo.style.display = 'none';
  highscoresDiv.classList.add('hidden');

  if (allDone) {
    overlayBtn.textContent = 'Play';
    hideSecondaryBtn();
  } else {
    overlayBtn.textContent = 'Next Level';
    setupSecondaryBtn();
  }

  overlay.classList.remove('hidden');
}

// ── Game Over ──
function gameOver(won) {
  running = false;
  cancelAnimationFrame(animId);
  Object.values(activeEffects).forEach(e => clearTimeout(e.timer));
  activeEffects = {};
  powerupHud.innerHTML = '';
  lasers = [];
  magnetStuck = false;

  sfxGameOver();

  saveHighScore(score);
  if (window.GamePlatform) {
    var t = GamePlatform.stopTimer();
    GamePlatform.recordGame('breakout', score, t * 1000, {
      win: false,
      world: currentWorld,
      level: currentLevel
    });
    GamePlatform.updateScore(score);
  }

  overlayTitle.textContent = 'Game Over';
  overlayTitle.style.color = '#ff4d6d';
  overlayMsg.textContent = 'World ' + currentWorld + '-' + currentLevel + '\nScore: ' + score;
  overlayBtn.textContent = 'Retry';

  // Hide how-to-play
  const howTo = overlay.querySelector('.how-to-play');
  if (howTo) howTo.style.display = 'none';
  highscoresDiv.classList.add('hidden');

  setupSecondaryBtn();
  overlay.classList.remove('hidden');
}

// ── Loop ──
function loop() {
  if (!running) return;
  gameTime++;
  update();
  if (!running) return;
  draw();
  animId = requestAnimationFrame(loop);
}

// Platform integration
if (window.GamePlatform) {
  GamePlatform.initHeader('Breakout');
  window.addEventListener('beforeunload', function() {
    if (score > 0) {
      var t = GamePlatform.stopTimer();
      GamePlatform.recordGame('breakout', score, t * 1000, { win: false });
    }
  });
}

// ── Show start screen ──
showStartScreen();
