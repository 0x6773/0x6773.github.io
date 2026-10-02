// ── Canvas & Context ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
GameEngine.sharpCanvas(canvas);

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
const Sound = window.BreakoutAudio;

function ensureAudio() {
  return GameEngine.audio();
}

function sfxPaddleHit(k) { Sound.sfx('paddle', k); }
function sfxWallBounce() { Sound.sfx('wall'); }
function sfxBrickBreak(row) { Sound.sfx('brick', row); }
function sfxLifeLost()   { Sound.sfx('life'); }
function sfxPowerup()    { Sound.sfx('powerup'); }
function sfxLevelUp()    { Sound.sfx('levelComplete'); }
function sfxGameOver()   { Sound.sfx('gameover'); }
function sfxWin()        { Sound.sfx('win'); }
function sfxFireball()   { Sound.sfx('fireball'); }
function sfxLaserShoot() { Sound.sfx('laser'); }
function sfxMagnetCatch(){ Sound.sfx('magnet'); }
function sfxLevelComplete() { Sound.sfx('levelComplete'); }
function sfxWorldUnlock() {
  Sound.sfx('worldUnlock');
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
  try { localStorage.setItem(HS_KEY, JSON.stringify(scores.slice(0, 5))); } catch {}
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
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch {}
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
    p.vy += p.shard ? 0.18 : 0.08;
    p.life -= p.decay;
    if (p.shard) p.rot += p.vr;
    else p.r *= 0.98;
    if (p.life <= 0 || p.r < 0.3) particles.splice(i, 1);
  }
  for (const g of rings) g.life -= 0.05;
  rings = rings.filter(g => g.life > 0);
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    if (p.shard) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(-p.r, -p.r * 0.6);
      ctx.lineTo(p.r, -p.r * 0.2);
      ctx.lineTo(-p.r * 0.2, p.r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  for (const g of rings) {
    ctx.globalAlpha = g.life;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 3 * g.life + 0.5;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * (1 - g.life) + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

let rings = [];

function spawnRing(x, y, color, r) {
  rings.push({ x, y, color, r: r || 40, life: 1 });
}

function spawnShards(b) {
  for (let i = 0; i < 9; i++) {
    particles.push({
      x: b.x + Math.random() * b.w,
      y: b.y + Math.random() * b.h,
      vx: (Math.random() - 0.5) * 5,
      vy: -1 - Math.random() * 3,
      r: 3 + Math.random() * 4,
      color: b.color,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.015,
      shard: true,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4
    });
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
    ctx.globalAlpha = Math.max(0, ft.life);
    ctx.font = '800 16px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(5,6,20,0.7)';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = ft.color;
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

function drawTrails(heads) {
  let trailColor = '0,212,255';
  if (activeEffects['fire']) trailColor = '255,102,0';
  else if (activeEffects['slow']) trailColor = '224,64,251';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const [bi, trail] of ballTrails) {
    const pts = trail.slice(0, -1);
    if (heads[bi]) pts.push(heads[bi]);
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length;
      ctx.strokeStyle = 'rgba(' + trailColor + ',' + (t * 0.4).toFixed(3) + ')';
      ctx.lineWidth = BALL_RADIUS * 1.8 * t;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }
  ctx.restore();
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

const bgCache = new Map();

function backgroundLayer(world) {
  const k = ctx.getTransform().a || 1;
  const key = world + '|' + k;
  let layer = bgCache.get(key);
  if (layer) return layer;
  const W = canvas.width, H = canvas.height;
  layer = document.createElement('canvas');
  layer.width = Math.round(W * k);
  layer.height = Math.round(H * k);
  const g = layer.getContext('2d');
  g.scale(k, k);
  const tones = { 1: ['#060a1e', '#101d44', 'rgba(0,212,255,0.16)', 'rgba(255,77,109,0.10)'], 2: ['#0e0220', '#26063a', 'rgba(255,0,255,0.20)', 'rgba(0,255,255,0.14)'], 3: ['#040309', '#120a22', 'rgba(139,92,246,0.20)', 'rgba(236,72,153,0.10)'] }[world] || ['#060a1e', '#101d44', 'rgba(0,212,255,0.16)', 'rgba(255,77,109,0.10)'];
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, tones[0]);
  bg.addColorStop(1, tones[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (const [x, y, r, col] of [[W * 0.2, H * 0.15, 320, tones[2]], [W * 0.85, H * 0.55, 300, tones[3]]]) {
    const n = g.createRadialGradient(x, y, 10, x, y, r);
    n.addColorStop(0, col);
    n.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = n;
    g.fillRect(0, 0, W, H);
  }
  g.strokeStyle = world === 2 ? 'rgba(255,0,255,0.10)' : 'rgba(120,180,255,0.05)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= W; x += 40) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 40) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
  g.stroke();
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  bgCache.set(key, layer);
  return layer;
}

function drawBackground(time) {
  const world = currentWorld || 1;
  ctx.drawImage(backgroundLayer(world), 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    ctx.globalAlpha = Math.max(0, 0.3 + 0.4 * Math.sin(time * s.speed * 0.002 + s.phase));
    ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  if (world === 2) {
    const H = canvas.height, W = canvas.width, horizon = H * 0.72;
    ctx.strokeStyle = 'rgba(0,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const t = ((i + (time * 0.004) % 1) / 10);
      const y = horizon + (H - horizon) * t * t;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    for (let x = -W; x <= W * 2; x += 80) {
      ctx.moveTo(W / 2 + (x - W / 2) * 0.2, horizon);
      ctx.lineTo(x, H);
    }
    ctx.stroke();
  } else if (world === 3) {
    const fog = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
    fog.addColorStop(0, 'rgba(139,92,246,0)');
    fog.addColorStop(1, 'rgba(139,92,246,' + (0.12 + 0.05 * Math.sin(time * 0.01)).toFixed(3) + ')');
    ctx.fillStyle = fog;
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
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

// ── Boss Mode State ──
let bossMode = false;
let boss = null;
let bossProjectiles = [];

// ── Precision Mode State ──
let precisionMode = false;
let precisionLoop = 0; // how many times we've looped through all 5 levels

// ── Screen Flash ──
let screenFlashColor = null;
let screenFlashAlpha = 0;

function screenFlash(color, alpha = 0.4) {
  screenFlashColor = color;
  screenFlashAlpha = Math.max(screenFlashAlpha, alpha);
}

// ── Combo Text ──
let comboTexts = [];

function showComboText(text) {
  comboTexts.push({
    text: text,
    x: canvas.width / 2,
    y: canvas.height / 2 - 40,
    life: 1.0,
    vy: -0.8,
    scale: 1.5
  });
}

function updateComboTexts() {
  for (let i = comboTexts.length - 1; i >= 0; i--) {
    const ct = comboTexts[i];
    ct.y += ct.vy;
    ct.life -= 0.012;
    ct.scale *= 0.995;
    if (ct.life <= 0) comboTexts.splice(i, 1);
  }
}

function drawComboTexts() {
  for (const ct of comboTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ct.life);
    ctx.font = '900 ' + Math.round(28 * ct.scale) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(5,6,20,0.85)';
    ctx.strokeText(ct.text, ct.x, ct.y);
    ctx.shadowColor = '#ffb300';
    ctx.shadowBlur = 18;
    const tg = ctx.createLinearGradient(0, ct.y - 24, 0, ct.y);
    tg.addColorStop(0, '#fff6c2');
    tg.addColorStop(1, '#ffc400');
    ctx.fillStyle = tg;
    ctx.fillText(ct.text, ct.x, ct.y);
    ctx.restore();
  }
}

// ── Laser beam object ──
function spawnLaser() {
  sfxLaserShoot();
  // Dual lasers when Wide + Laser are both active
  if (activeEffects['wide'] && activeEffects['laser']) {
    lasers.push({ x: paddle.x + 6, y: paddle.y, vy: -10, alive: true });
    lasers.push({ x: paddle.x + paddle.w - 6, y: paddle.y, vy: -10, alive: true });
  } else {
    lasers.push({ x: paddle.x + paddle.w / 2, y: paddle.y, vy: -10, alive: true });
  }
}

// ── Input: Keyboard ──
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ((e.key === 'm' || e.key === 'M') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) toggleMusic();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// ── Input: Mouse ──
canvas.addEventListener('mousemove', e => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const mouseX = (e.clientX - rect.left) * scaleX;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2));
  paddle.px = paddle.x;
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
  paddle.px = paddle.x;
}, { passive: false });

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  ensureAudio();
  if (running) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const touchX = (e.touches[0].clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, touchX - paddle.w / 2));
    if (magnetStuck) {
      releaseMagnetBall();
    }
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
  const levelNum = (typeof currentLevel === 'number') ? currentLevel : LEVELS_PER_WORLD;
  let speed = world.baseSpeed + (levelNum - 1) * 0.3;
  if (precisionMode) {
    speed *= 1.2;
    speed += precisionLoop * 0.5; // gets faster each loop
  }
  return speed;
}

// ── Boss Level Functions ──
function startBossLevel(worldNum, keepScore) {
  _gameRecorded = false;
  bossMode = true;
  bossProjectiles = [];
  currentWorld = worldNum;
  currentLevel = 'B';
  if (!keepScore) score = 0;
  lives = 3;
  powerups = [];
  activeEffects = {};
  particles = [];
  floatingTexts = [];
  comboTexts = [];
  ballTrails = new Map();
  lasers = [];
  laserTimer = 0;
  magnetStuck = false;
  magnetBallOffset = 0;
  shakeAmount = 0;
  shakeDuration = 0;
  running = true;

  boss = {
    x: canvas.width / 2 - BRICK_WIDTH * 2,
    y: 30,
    w: BRICK_WIDTH * 4,
    h: BRICK_HEIGHT * 2,
    hp: [20, 35, 50][worldNum - 1],
    maxHp: [20, 35, 50][worldNum - 1],
    speed: [1, 1.5, 2.5][worldNum - 1],
    dx: 1,
    color: WORLDS[worldNum].colors[0],
    shieldTimer: 0,
    shieldInterval: [10000, 8000, 6000][worldNum - 1],
    attackTimer: 0,
    attackInterval: worldNum === 3 ? 3000 : 0,
    worldNum: worldNum,
    lastTime: GameEngine.now(),
    dropTimer: 0,
    dropInterval: worldNum === 2 ? 5000 : 0
  };

  bricks = [];
  buildBossShield(worldNum);

  rings = [];
  resetBalls();
  resetPaddle();
  updateHUD();
  updatePowerupHUD();
  hideSecondaryBtn();
  if (animId) GameEngine.clock.cancelAnimationFrame(animId);
  if (window.GamePlatform) GamePlatform.startTimer();
  startMusic();
  loop();
}

function buildBossShield(worldNum) {
  var shieldRows = worldNum === 1 ? 1 : worldNum === 2 ? 2 : 2;
  var worldColors = WORLDS[worldNum].colors;
  var bossLeft = Math.floor((boss.x - BRICK_OFFSET_LEFT) / (BRICK_WIDTH + BRICK_PADDING));
  var bossRight = Math.ceil((boss.x + boss.w - BRICK_OFFSET_LEFT) / (BRICK_WIDTH + BRICK_PADDING));
  bossLeft = Math.max(0, bossLeft - 1);
  bossRight = Math.min(BRICK_COLS, bossRight + 1);

  // Shield starts below the boss
  var shieldStartY = boss.y + boss.h + 10;

  // Clear existing bricks and rebuild
  bricks = [];
  BRICK_ROWS = shieldRows;
  for (var r = 0; r < shieldRows; r++) {
    bricks[r] = [];
    for (var c = 0; c < BRICK_COLS; c++) {
      var inRange = c >= bossLeft && c < bossRight;
      var colorIdx = r % worldColors.length;
      bricks[r][c] = {
        x: BRICK_OFFSET_LEFT + c * (BRICK_WIDTH + BRICK_PADDING),
        y: shieldStartY + r * (BRICK_HEIGHT + BRICK_PADDING),
        w: BRICK_WIDTH,
        h: BRICK_HEIGHT,
        alive: inRange,
        color: worldColors[colorIdx],
        points: ROW_POINTS[colorIdx],
        row: colorIdx,
        isShield: true
      };
    }
  }
}

function spawnBossProjectile() {
  if (!boss) return;
  var px = boss.x + boss.w / 2 + (Math.random() - 0.5) * boss.w * 0.6;
  var py = boss.y + boss.h;
  bossProjectiles.push({
    x: px,
    y: py,
    w: 8,
    h: 8,
    vy: 3 + Math.random() * 1.5,
    color: '#ff4d6d'
  });
  Sound.sfx('bossShot');
}

function spawnBossObstacle() {
  if (!boss) return;
  // W2 boss drops an obstacle brick downward
  var px = boss.x + Math.random() * boss.w;
  var py = boss.y + boss.h;
  bossProjectiles.push({
    x: px - BRICK_WIDTH / 4,
    y: py,
    w: BRICK_WIDTH / 2,
    h: BRICK_HEIGHT / 2,
    vy: 2,
    color: WORLDS[boss.worldNum].colors[Math.floor(Math.random() * 3)],
    isObstacle: true
  });
  Sound.sfx('bossDrop');
}

function updateBoss(dt) {
  if (!boss) return;

  var now = GameEngine.now();
  var elapsed = now - boss.lastTime;
  boss.lastTime = now;

  // Move boss
  boss.x += boss.speed * boss.dx;
  if (boss.x <= 0) { boss.x = 0; boss.dx = 1; }
  if (boss.x + boss.w >= canvas.width) { boss.x = canvas.width - boss.w; boss.dx = -1; }

  // Regenerate shield
  boss.shieldTimer += elapsed;
  if (boss.shieldTimer >= boss.shieldInterval) {
    boss.shieldTimer = 0;
    buildBossShield(boss.worldNum);
  }

  // Boss attacks (World 3: projectiles)
  if (boss.attackInterval > 0) {
    boss.attackTimer += elapsed;
    if (boss.attackTimer >= boss.attackInterval) {
      boss.attackTimer = 0;
      spawnBossProjectile();
    }
  }

  // Boss drops (World 2: obstacles)
  if (boss.dropInterval > 0) {
    boss.dropTimer += elapsed;
    if (boss.dropTimer >= boss.dropInterval) {
      boss.dropTimer = 0;
      spawnBossObstacle();
    }
  }

  // Update boss projectiles
  for (var i = bossProjectiles.length - 1; i >= 0; i--) {
    var proj = bossProjectiles[i];
    proj.y += proj.vy;

    // Off screen
    if (proj.y > canvas.height) {
      bossProjectiles.splice(i, 1);
      continue;
    }

    // Hit paddle
    if (proj.x + proj.w > paddle.x && proj.x < paddle.x + paddle.w &&
        proj.y + proj.h > paddle.y && proj.y < paddle.y + paddle.h) {
      bossProjectiles.splice(i, 1);
      triggerShake(6, 10);
      spawnParticles(proj.x + proj.w / 2, proj.y + proj.h / 2, proj.color, 10);
      // Lose a life
      lives--;
      sfxLifeLost();
      updateHUD();
      if (lives <= 0) {
        gameOver(false);
        return;
      }
      continue;
    }
  }

  // Check ball collision with boss body
  for (var bi = 0; bi < balls.length; bi++) {
    var ball = balls[bi];
    if (magnetStuck && bi === 0) continue;
    if (ball.bossCooldown > 0) { ball.bossCooldown--; continue; }
    if (ball.x + ball.r > boss.x && ball.x - ball.r < boss.x + boss.w &&
        ball.y + ball.r > boss.y && ball.y - ball.r < boss.y + boss.h) {
      boss.hp--;
      bounceOffRect(ball, boss);
      ball.bossCooldown = 10;
      Sound.sfx('bossHit');
      spawnRing(ball.x, ball.y, boss.color, 50);
      spawnParticles(ball.x, ball.y, boss.color, 8);
      screenFlash(boss.color);
      triggerShake(4, 8);

      var pts = 10 * boss.worldNum;
      score += pts;
      spawnFloatingText(ball.x, ball.y, '+' + pts, boss.color);
      updateHUD();

      if (boss.hp <= 0) {
        bossDefeated();
        return;
      }
    }
  }

  // Check laser collision with boss
  for (var li = lasers.length - 1; li >= 0; li--) {
    var laser = lasers[li];
    if (laser.x > boss.x && laser.x < boss.x + boss.w &&
        laser.y > boss.y && laser.y < boss.y + boss.h) {
      boss.hp--;
      lasers.splice(li, 1);
      spawnParticles(laser.x, laser.y, '#ffff00', 6);
      screenFlash('#ffff00');

      var lpts = 5 * boss.worldNum;
      score += lpts;
      spawnFloatingText(laser.x, laser.y, '+' + lpts, '#ffff00');
      updateHUD();

      if (boss.hp <= 0) {
        bossDefeated();
        return;
      }
    }
  }
}

function drawBoss() {
  if (!boss) return;
  const x = boss.x, y = boss.y, w = boss.w, h = boss.h;
  const hpFraction = boss.hp / boss.maxHp;

  // Boss body
  ctx.save();
  ctx.shadowColor = boss.color;
  ctx.shadowBlur = 28;
  var bossGrad = ctx.createLinearGradient(x, y, x, y + h);
  bossGrad.addColorStop(0, lightenColor(boss.color, 90));
  bossGrad.addColorStop(0.45, boss.color);
  bossGrad.addColorStop(1, darkenColor(boss.color, 90));
  ctx.fillStyle = bossGrad;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, h / 2.2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    ctx.moveTo(x + (w * i) / 6, y + 6);
    ctx.lineTo(x + (w * i) / 6, y + h - 6);
  }
  ctx.stroke();

  // Shine highlight
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  roundRect(ctx, x + h / 3, y + 3, w - (h / 3) * 2, h * 0.28, h * 0.14);
  ctx.fill();
  ctx.restore();

  const target = balls[0];
  const look = target ? Math.max(-1, Math.min(1, (target.x - (x + w / 2)) / 220)) : 0;
  const lookY = target ? Math.max(-1, Math.min(1, (target.y - (y + h / 2)) / 220)) : 0;
  for (const side of [-1, 1]) {
    const ex = x + w / 2 + side * w * 0.17, ey = y + h * 0.52;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hpFraction < 0.3 ? '#ff1744' : '#140a2a';
    ctx.beginPath();
    ctx.arc(ex + look * 5, ey + lookY * 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (hpFraction < 0.5) {
      ctx.strokeStyle = 'rgba(10,8,25,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ex - 13 * side * -1, ey - 14);
      ctx.lineTo(ex + 12 * side * -1, ey - 9);
      ctx.stroke();
    }
  }

  // Health bar
  var barW = w;
  var barH = 7;
  var barY = y - 15;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  roundRect(ctx, x, barY, barW, barH, 3.5);
  ctx.fill();
  var hpColor = hpFraction > 0.5 ? '#00e676' : hpFraction > 0.3 ? '#ffd740' : '#ff4d6d';
  ctx.save();
  ctx.shadowColor = hpColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  roundRect(ctx, x, barY, Math.max(barH, barW * hpFraction), barH, 3.5);
  ctx.fill();
  ctx.restore();

  // HP text
  ctx.fillStyle = '#fff';
  ctx.font = '800 10px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(boss.hp + '/' + boss.maxHp, x + w / 2, barY - 3);

  // BOSS label
  ctx.textAlign = 'left';
  ctx.fillStyle = boss.color;
  ctx.fillText('BOSS', x, barY - 3);

  // Draw boss projectiles
  for (var proj of bossProjectiles) {
    ctx.save();
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 12;
    if (proj.isObstacle) {
      const og = ctx.createLinearGradient(0, proj.y, 0, proj.y + proj.h);
      og.addColorStop(0, lightenColor(proj.color, 80));
      og.addColorStop(1, darkenColor(proj.color, 60));
      ctx.fillStyle = og;
      ctx.beginPath();
      roundRect(ctx, proj.x, proj.y, proj.w, proj.h, 4);
      ctx.fill();
    } else {
      const pg = ctx.createRadialGradient(proj.x + proj.w / 2, proj.y + proj.h / 2, 0, proj.x + proj.w / 2, proj.y + proj.h / 2, proj.w);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.4, proj.color);
      pg.addColorStop(1, 'rgba(255,77,109,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(proj.x + proj.w / 2, proj.y + proj.h / 2, proj.w, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function bossDefeated() {
  var defeatedWorld = boss.worldNum;
  boss = null;
  bossMode = false;
  bossProjectiles = [];
  running = false;
  GameEngine.clock.cancelAnimationFrame(animId);
  Object.values(activeEffects).forEach(function(e) { GameEngine.clock.clearTimeout(e.timer); });
  activeEffects = {};
  powerupHud.innerHTML = '';
  lasers = [];
  magnetStuck = false;

  Sound.music.stop();
  sfxWin();

  // Big explosion particles
  for (var i = 0; i < 50; i++) {
    spawnParticles(
      canvas.width / 2 + (Math.random() - 0.5) * 200,
      80 + Math.random() * 60,
      ['#ffd700', '#ff6600', '#ff4d6d', '#00e676', '#00d4ff'][Math.floor(Math.random() * 5)],
      5
    );
  }
  screenFlash('#ffd700');
  triggerShake(10, 20);

  // Save progress for the world's level 5
  saveLevelResult(defeatedWorld, LEVELS_PER_WORLD, score);
  saveHighScore(score);

  if (window.GamePlatform) {
    _gameRecorded = true;
    var t = GamePlatform.stopTimer();
    GamePlatform.recordGame('breakout', score, t * 1000, {
      win: true,
      world: defeatedWorld,
      level: 'Boss'
    });
    GamePlatform.updateScore(score);
  }

  // Check if all worlds completed
  var allDone = defeatedWorld === 3;

  overlayTitle.textContent = 'BOSS DEFEATED!';
  overlayTitle.style.color = '#ffd700';

  var msgText = allDone
    ? 'All worlds completed!\nFinal Score: ' + score
    : 'World ' + defeatedWorld + ' Complete!\nScore: ' + score;
  overlayMsg.textContent = msgText;

  var howTo = overlay.querySelector('.how-to-play');
  if (howTo) howTo.style.display = 'none';
  highscoresDiv.classList.add('hidden');

  if (allDone) {
    overlayBtn.textContent = 'Play';
    hideSecondaryBtn();
  } else {
    overlayBtn.textContent = 'Next Level';
    currentWorld = defeatedWorld;
    currentLevel = LEVELS_PER_WORLD; // so goToNextLevel advances to next world
    setupSecondaryBtn();
  }

  hidePrecisionBtn();
  overlay.classList.remove('hidden');
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

// ── Precision Mode Scoring ──
const PRECISION_HS_KEY = 'breakout_precision_highscores';

function loadPrecisionScores() {
  try { return JSON.parse(localStorage.getItem(PRECISION_HS_KEY)) || []; }
  catch { return []; }
}

function savePrecisionScore(s) {
  const scores = loadPrecisionScores();
  scores.push({ score: s, date: new Date().toLocaleDateString() });
  scores.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(PRECISION_HS_KEY, JSON.stringify(scores.slice(0, 5))); } catch {}
}

function renderPrecisionScores() {
  const scores = loadPrecisionScores();
  if (scores.length === 0) { highscoresDiv.classList.add('hidden'); return; }
  highscoresDiv.classList.remove('hidden');
  scoreList.innerHTML = '<li style="color:#ffd700;font-weight:700;margin-bottom:4px">Precision Leaderboard</li>' +
    scores.map((s, i) => `<li>#${i + 1}  ${String(s.score).padStart(5, ' ')}  ${s.date}</li>`).join('');
}

function startPrecisionMode() {
  precisionMode = true;
  precisionLoop = 0;
  startLevel(1, 1);
}

// ── Overlay / Start Screen ──
function showStartScreen() {
  precisionMode = false;
  precisionLoop = 0;
  overlayTitle.textContent = 'Breakout';
  overlayTitle.style.color = '#00d4ff';
  overlayMsg.textContent = 'Click or tap to start';
  overlayBtn.textContent = 'Play';
  // Show how-to-play and highscores
  const howTo = overlay.querySelector('.how-to-play');
  if (howTo) howTo.style.display = '';
  var precBtn = document.getElementById('precision-btn');
  if (precBtn) precBtn.style.display = '';
  renderHighScores();
  overlay.classList.remove('hidden');
}

function hidePrecisionBtn() {
  var precBtn = document.getElementById('precision-btn');
  if (precBtn) precBtn.style.display = 'none';
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
    if (currentLevel === 'B') {
      startBossLevel(currentWorld);
    } else {
      startLevel(currentWorld, currentLevel);
    }
  }
});

// Precision Mode button
document.getElementById('precision-btn').addEventListener('click', () => {
  ensureAudio();
  overlay.classList.add('hidden');
  startPrecisionMode();
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
  _gameRecorded = false;
  bossMode = false;
  boss = null;
  bossProjectiles = [];
  currentWorld = world;
  currentLevel = level;
  score = 0;
  lives = precisionMode ? 1 : 3;
  powerups = [];
  activeEffects = {};
  particles = [];
  floatingTexts = [];
  comboTexts = [];
  ballTrails = new Map();
  lasers = [];
  laserTimer = 0;
  magnetStuck = false;
  magnetBallOffset = 0;
  shakeAmount = 0;
  shakeDuration = 0;
  rings = [];
  running = true;
  resetBalls();
  resetPaddle();
  buildBricks();
  updateHUD();
  updatePowerupHUD();
  hideSecondaryBtn();
  if (animId) GameEngine.clock.cancelAnimationFrame(animId);
  if (window.GamePlatform) GamePlatform.startTimer();
  startMusic();
  loop();
}

function goToNextLevel() {
  if (precisionMode) {
    // In precision mode, loop through World 1 levels
    let nextLevel = currentLevel + 1;
    if (nextLevel > LEVELS_PER_WORLD) {
      precisionLoop++;
      nextLevel = 1;
    }
    startLevel(1, nextLevel);
    return;
  }
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
        row: colorIdx,
        r, c,
        type: 'normal',
        hp: 1,
        maxHp: 1,
        flash: 0
      };
    }
  }
  assignSpecialBricks(key);
}

function assignSpecialBricks(key) {
  let seed = 7;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const level = typeof currentLevel === 'number' ? currentLevel : LEVELS_PER_WORLD;
  const toughRows = currentWorld === 1 ? (level >= 3 ? 1 : 0) : 2;
  for (let r = 0; r < Math.min(toughRows, BRICK_ROWS); r++) {
    for (const b of bricks[r]) {
      if (!b.alive) continue;
      b.type = 'tough';
      b.hp = b.maxHp = r === 0 && currentWorld === 3 ? 3 : 2;
    }
  }
  const pairs = (n, type) => {
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 40; tries++) {
        const r = Math.floor(rand() * BRICK_ROWS), c = Math.floor(rand() * (BRICK_COLS / 2));
        const a = bricks[r][c], m = bricks[r][BRICK_COLS - 1 - c];
        if (a.alive && m.alive && a.type === 'normal' && m.type === 'normal') {
          a.type = m.type = type;
          break;
        }
      }
    }
  };
  if (level >= 3 || currentWorld > 1) pairs(Math.min(3, Math.floor((level - 1) / 2) + currentWorld - 1), 'explosive');
  if (!precisionMode && (level >= 2 || currentWorld > 1)) pairs(1, 'gold');
}

function brickPoints(b) {
  const lvlNum = (typeof currentLevel === 'number') ? currentLevel : LEVELS_PER_WORLD;
  const globalLevel = (currentWorld - 1) * LEVELS_PER_WORLD + lvlNum;
  return b.points * globalLevel * (b.maxHp || 1) * (b.type === 'gold' ? 2 : 1);
}

function hitBrick(b, opts) {
  if ((b.hp || 1) > 1 && !activeEffects['fire']) {
    b.hp--;
    b.flash = 10;
    Sound.sfx('tough');
    spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffffff', 5);
    return false;
  }
  destroyBrick(b, opts);
  return true;
}

function destroyBrick(b, opts) {
  const o = opts || {};
  b.alive = false;
  const pts = brickPoints(b);
  score += pts;
  sfxBrickBreak(b.row);
  spawnShards(b);
  spawnParticles(b.x + b.w / 2, b.y + b.h / 2, o.color || b.color, 8);
  spawnFloatingText(b.x + b.w / 2, b.y, '+' + pts, o.color || b.color);
  updateHUD();
  if (b.type === 'gold') {
    Sound.sfx('gold');
    spawnRing(b.x + b.w / 2, b.y + b.h / 2, '#ffd700', 50);
    if (!precisionMode) powerups.push({ x: b.x + b.w / 2, y: b.y + b.h, type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)], vy: POWERUP_SPEED, angle: 0 });
  } else if (o.drops) {
    spawnPowerup(b.x + b.w / 2, b.y + b.h);
  }
  if (b.type === 'explosive') explodeBrick(b);
}

function explodeBrick(b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  Sound.sfx('explode');
  spawnRing(cx, cy, '#ffb347', 110);
  spawnParticles(cx, cy, '#ffb347', 22);
  spawnParticles(cx, cy, '#ff4d6d', 12);
  triggerShake(7, 14);
  screenFlash('#ff8a3d', 0.14);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = bricks[b.r + dr];
      const n = row && row[b.c + dc];
      if (n && n.alive) destroyBrick(n, { drops: true });
    }
  }
}

// ── Power-up helpers ──
function spawnPowerup(x, y) {
  if (precisionMode) return; // No power-ups in precision mode
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
      if (!activeEffects['slow']) {
        balls.forEach(b => { b.dx *= 0.5; b.dy *= 0.5; });
      }
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
  checkCombos();
  updatePowerupHUD();
}

// ── Power-Up Combinations ──
function checkCombos() {
  if (activeEffects['fire'] && balls.length > 1) {
    showComboText('FIRE STORM!');
  }
  if (activeEffects['wide'] && activeEffects['laser']) {
    showComboText('DUAL LASERS!');
  }
  if (activeEffects['magnet'] && balls.length > 1) {
    showComboText('MAGNET FIELD!');
  }
}

function setTimedEffect(id, duration) {
  if (activeEffects[id]) GameEngine.clock.clearTimeout(activeEffects[id].timer);
  const expiresAt = GameEngine.now() + duration;
  activeEffects[id] = {
    expiresAt,
    duration,
    timer: GameEngine.clock.setTimeout(() => {
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
    const remaining = Math.max(0, Math.ceil((effect.expiresAt - GameEngine.now()) / 1000));
    const fraction = Math.max(0, (effect.expiresAt - GameEngine.now()) / effect.duration);
    const barWidth = Math.round(fraction * 100);
    return `<span class="powerup-indicator" style="background:${t.color}">
      ${t.name} ${remaining}s
      <span class="powerup-timer-bar" style="width:${barWidth}%;background:rgba(255,255,255,0.35)"></span>
    </span>`;
  }).join('');
}

function bounceOffRect(ball, rect, frac = 1) {
  const prevX = ball.x - ball.dx * frac;
  const prevY = ball.y - ball.dy * frac;
  const cameFromSide = prevX + ball.r <= rect.x || prevX - ball.r >= rect.x + rect.w;
  const cameFromEnd = prevY + ball.r <= rect.y || prevY - ball.r >= rect.y + rect.h;
  let horizontal;
  if (cameFromSide !== cameFromEnd) {
    horizontal = cameFromSide;
  } else {
    const overlapX = Math.min((ball.x + ball.r) - rect.x, (rect.x + rect.w) - (ball.x - ball.r));
    const overlapY = Math.min((ball.y + ball.r) - rect.y, (rect.y + rect.h) - (ball.y - ball.r));
    horizontal = overlapX < overlapY;
  }
  if (horizontal) {
    ball.dx = ball.x < rect.x + rect.w / 2 ? -Math.abs(ball.dx) : Math.abs(ball.dx);
  } else {
    ball.dy = ball.y < rect.y + rect.h / 2 ? -Math.abs(ball.dy) : Math.abs(ball.dy);
  }
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
          hitBrick(b, { color: '#ffff00' });
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

    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ball.dx), Math.abs(ball.dy)) / 4));
    const frac = 1 / steps;
    let lost = false, stuck = false;
    for (let s = 0; s < steps && !lost && !stuck; s++) {
      ball.x += ball.dx * frac;
      ball.y += ball.dy * frac;

      // Wall collisions
      if ((ball.x - ball.r <= 0 && ball.dx < 0) || (ball.x + ball.r >= canvas.width && ball.dx > 0)) {
        ball.dx *= -1;
        ball.x = Math.max(ball.r, Math.min(canvas.width - ball.r, ball.x));
        sfxWallBounce();
      }
      if (ball.y - ball.r <= 0 && ball.dy < 0) {
        ball.dy = Math.abs(ball.dy);
        sfxWallBounce();
      }

      // Fell off bottom
      if (ball.y + ball.r >= canvas.height) {
        lost = true;
        break;
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
          stuck = true;
          break;
        }

        const hitPos = (ball.x - paddle.x) / paddle.w;
        sfxPaddleHit(Math.abs(hitPos - 0.5));
        spawnPaddleSparkle(ball.x, paddle.y);
        spawnRing(ball.x, paddle.y, 'rgba(120,230,255,0.9)', 26);
        paddle.squash = 1;
        const angle = (hitPos - 0.5) * 2.5;
        const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        ball.dx = speed * Math.sin(angle);
        ball.dy = -speed * Math.cos(angle);
      }

      // Brick collisions
      bricksLoop:
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
            hitBrick(b, { drops: true });

            // Fireball: don't reverse ball direction
            if (!activeEffects['fire']) {
              bounceOffRect(ball, b, frac);
              break bricksLoop;
            }
          }
        }
      }
    }
    if (lost) {
      ballsToRemove.push(bi);
      continue;
    }

    // Fire trail particles
    if (activeEffects['fire'] && gameTime % 2 === 0) {
      spawnFireTrail(ball.x, ball.y);
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
    Object.values(activeEffects).forEach(e => GameEngine.clock.clearTimeout(e.timer));
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
  if (paddle.squash) paddle.squash = paddle.squash < 0.02 ? 0 : paddle.squash * 0.82;
  for (let r = 0; r < BRICK_ROWS; r++) for (let c = 0; c < BRICK_COLS; c++) if (bricks[r][c].flash) bricks[r][c].flash--;
  updateParticles();
  updateFloatingTexts();
  updateTrails();
  updateComboTexts();

  // Screen flash decay
  if (screenFlashAlpha > 0) screenFlashAlpha -= 0.02;

  // Update boss
  if (bossMode) {
    updateBoss();
    if (!running) return; // boss defeated or game over
  }

  // Update power-up timer display every frame
  if (Object.keys(activeEffects).length > 0) updatePowerupHUD();

  // Check level cleared (skip in boss mode - boss has own win condition)
  if (!bossMode) {
    let allCleared = true;
    for (let r = 0; r < BRICK_ROWS && allCleared; r++)
      for (let c = 0; c < BRICK_COLS && allCleared; c++)
        if (bricks[r][c].alive) allCleared = false;

    if (allCleared) {
      return levelComplete();
    }
  }
}

// ── Draw ──
const spriteCache = new Map();

function brickSprite(color, type, w, h) {
  const k = ctx.getTransform().a || 1;
  const key = color + type + w + 'x' + h + '|' + k;
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const pad = 10;
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + pad * 2) * k);
  c.height = Math.ceil((h + pad * 2) * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  g.translate(pad, pad);
  const base = type === 'tough' ? '#8f9bb8' : type === 'gold' ? '#ffc93c' : type === 'explosive' ? '#ff5a36' : color;
  g.shadowColor = base;
  g.shadowBlur = 12 * k;
  const body = g.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, lightenColor(base, 80));
  body.addColorStop(0.45, base);
  body.addColorStop(1, darkenColor(base, 70));
  g.fillStyle = body;
  g.beginPath();
  roundRect(g, 0, 0, w, h, 6);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.beginPath();
  roundRect(g, 4, 4, w - 8, h - 8, 4);
  g.fill();
  const gloss = g.createLinearGradient(0, 0, 0, h * 0.55);
  gloss.addColorStop(0, 'rgba(255,255,255,0.6)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gloss;
  g.beginPath();
  roundRect(g, 2, 1.5, w - 4, h * 0.45, 4);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = 1;
  g.beginPath();
  roundRect(g, 0.5, 0.5, w - 1, h - 1, 6);
  g.stroke();
  g.fillStyle = 'rgba(10,12,28,0.75)';
  g.strokeStyle = 'rgba(10,12,28,0.75)';
  if (type === 'tough') {
    for (const [rx, ry] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) {
      g.beginPath(); g.arc(rx, ry, 2, 0, Math.PI * 2); g.fill();
    }
    g.lineWidth = 1.5;
    g.strokeRect(12, h / 2 - 0.5, w - 24, 1);
  } else if (type === 'explosive') {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, rr = i % 2 ? 4 : 9;
      g.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr * 0.75);
    }
    g.closePath();
    g.fill();
  } else if (type === 'gold') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3.5 : 8;
      g.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  sp = { canvas: c, pad };
  spriteCache.set(key, sp);
  return sp;
}

function glowSprite(color) {
  const k = ctx.getTransform().a || 1;
  const key = 'glow' + color + '|' + k;
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const R = BALL_RADIUS * 3.2;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(R * 2 * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  const grad = g.createRadialGradient(R, R, 0, R, R, R);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color.replace('1)', '0.35)'));
  grad.addColorStop(1, color.replace('1)', '0)'));
  g.fillStyle = grad;
  g.fillRect(0, 0, R * 2, R * 2);
  sp = { canvas: c, R };
  spriteCache.set(key, sp);
  return sp;
}

function lerpPos(o, axis, alpha) {
  const prev = o['p' + axis];
  return prev === undefined ? o[axis] : prev + (o[axis] - prev) * alpha;
}

function crackPath(b, n) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sx = b.x + b.w * (0.25 + 0.5 * ((b.c * 7 + i * 3) % 5) / 4);
    ctx.moveTo(sx, b.y + 2);
    ctx.lineTo(sx + (i % 2 ? 6 : -5), b.y + b.h * 0.45);
    ctx.lineTo(sx + (i % 2 ? 2 : -1), b.y + b.h - 2);
  }
  ctx.stroke();
}

function draw(alpha = 1) {
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
      const type = b.type || 'normal';
      const sp = brickSprite(b.color, type, b.w, b.h);
      ctx.drawImage(sp.canvas, b.x - sp.pad, b.y - sp.pad, b.w + sp.pad * 2, b.h + sp.pad * 2);
      if (type === 'tough' && b.hp < b.maxHp) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.2;
        crackPath(b, (b.maxHp - b.hp) * 2);
      } else if (type === 'explosive') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(gameTime * 0.12 + b.c);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        roundRect(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        ctx.restore();
      } else if (type === 'gold') {
        // Shine highlight
        const sweep = ((gameTime * 2 + b.c * 37) % 260) - 60;
        ctx.save();
        ctx.beginPath();
        roundRect(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.moveTo(b.x + sweep, b.y);
        ctx.lineTo(b.x + sweep + 14, b.y);
        ctx.lineTo(b.x + sweep - 6, b.y + b.h);
        ctx.lineTo(b.x + sweep - 20, b.y + b.h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      if (b.flash) {
        ctx.save();
        ctx.globalAlpha = b.flash / 10 * 0.7;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        roundRect(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  const heads = balls.map(ball => ({ x: lerpPos(ball, 'x', alpha), y: lerpPos(ball, 'y', alpha) }));

  // Ball trails
  drawTrails(heads);

  // Laser beams
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const laser of lasers) {
    const ly = lerpPos(laser, 'y', alpha);
    const lg = ctx.createLinearGradient(0, ly, 0, ly + 26);
    lg.addColorStop(0, 'rgba(255,255,220,1)');
    lg.addColorStop(1, 'rgba(255,255,0,0)');
    ctx.fillStyle = 'rgba(255,255,0,0.25)';
    ctx.fillRect(laser.x - 4, ly - 2, 8, 26);
    ctx.fillStyle = lg;
    ctx.fillRect(laser.x - 1.5, ly, 3, 26);
    // Inner bright line
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(laser.x - 0.5, ly, 1, 12);
  }
  ctx.restore();

  // Particles
  drawParticles();

  // Floating score texts
  drawFloatingTexts();

  // Power-ups (spinning)
  for (const p of powerups) {
    const py = lerpPos(p, 'y', alpha);
    ctx.save();
    ctx.translate(p.x, py);
    ctx.rotate(Math.sin(p.angle * 2) * 0.25);
    ctx.shadowColor = p.type.color;
    ctx.shadowBlur = 14;
    const pg = ctx.createLinearGradient(0, -8, 0, 8);
    pg.addColorStop(0, lightenColor(p.type.color, 90));
    pg.addColorStop(0.5, p.type.color);
    pg.addColorStop(1, darkenColor(p.type.color, 70));
    ctx.fillStyle = pg;
    ctx.beginPath();
    roundRect(ctx, -16, -8, 32, 16, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    roundRect(ctx, -13, -6.5, 26, 5, 3);
    ctx.fill();
    ctx.fillStyle = '#0a0b1e';
    ctx.font = '900 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type.label, 0, 1);
    ctx.restore();
  }

  // Paddle with glow
  const isWide = !!activeEffects['wide'];
  const hasMagnet = !!activeEffects['magnet'];
  const hasLaser = !!activeEffects['laser'];
  let pColor1, pColor2, pColor3, pGlow;
  if (hasMagnet) {
    pColor1 = '#ff69b4'; pColor2 = '#ffd1e6'; pColor3 = '#c2185b'; pGlow = '#ff69b4';
  } else if (hasLaser) {
    pColor1 = '#ffff00'; pColor2 = '#ffffcc'; pColor3 = '#b3a600'; pGlow = '#ffff00';
  } else if (isWide) {
    pColor1 = '#00e676'; pColor2 = '#b9f6ca'; pColor3 = '#00a152'; pGlow = '#00e676';
  } else {
    pColor1 = '#00d4ff'; pColor2 = '#c7f6ff'; pColor3 = '#0077b6'; pGlow = '#00d4ff';
  }
  const padX = lerpPos(paddle, 'x', alpha);
  const sq = paddle.squash || 0;
  const pw = paddle.w * (1 + sq * 0.05), ph = paddle.h * (1 - sq * 0.3);
  const pxl = padX + (paddle.w - pw) / 2, pyt = paddle.y + (paddle.h - ph);
  ctx.save();
  ctx.shadowColor = pGlow;
  ctx.shadowBlur = 20;
  const grad = ctx.createLinearGradient(0, pyt, 0, pyt + ph);
  grad.addColorStop(0, pColor2);
  grad.addColorStop(0.45, pColor1);
  grad.addColorStop(1, pColor3);
  ctx.fillStyle = grad;
  ctx.beginPath();
  roundRect(ctx, pxl, pyt, pw, ph, ph / 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  roundRect(ctx, pxl + ph / 2, pyt + 2, pw - ph, ph * 0.3, ph * 0.15);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pxl + ph / 2, pyt + ph / 2, 2.2, 0, Math.PI * 2);
  ctx.arc(pxl + pw - ph / 2, pyt + ph / 2, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Laser barrel indicator(s)
  if (hasLaser) {
    ctx.save();
    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 8;
    if (isWide) {
      // Dual laser barrels
      ctx.fillRect(padX + 4, paddle.y - 5, 4, 5);
      ctx.fillRect(padX + paddle.w - 8, paddle.y - 5, 4, 5);
    } else {
      ctx.fillRect(padX + paddle.w / 2 - 2, paddle.y - 5, 4, 5);
    }
    ctx.restore();
  }

  // Balls with glow
  let ballColor = 'rgba(0,212,255,1)';
  if (activeEffects['fire']) ballColor = 'rgba(255,102,0,1)';
  else if (activeEffects['slow']) ballColor = 'rgba(224,64,251,1)';
  const glow = glowSprite(ballColor);
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    const bx = heads[i].x, by = heads[i].y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Magnet glow when stuck
    if (magnetStuck && ball === balls[0]) {
      ctx.drawImage(glowSprite('rgba(255,105,180,1)').canvas, bx - glow.R * 1.2, by - glow.R * 1.2, glow.R * 2.4, glow.R * 2.4);
    }

    // Fireball outer glow
    if (activeEffects['fire']) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(gameTime * 0.5);
      ctx.drawImage(glow.canvas, bx - glow.R * 1.4, by - glow.R * 1.4, glow.R * 2.8, glow.R * 2.8);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(glow.canvas, bx - glow.R, by - glow.R, glow.R * 2, glow.R * 2);
    ctx.restore();

    // Main ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx, by, ball.r, 0, Math.PI * 2);
    ctx.fill();
    // Inner core
    const coreGrad = ctx.createRadialGradient(bx - 2.5, by - 2.5, 0, bx, by, ball.r);
    coreGrad.addColorStop(0, '#fff');
    coreGrad.addColorStop(0.6, '#fff');
    coreGrad.addColorStop(1, ballColor);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(bx, by, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Boss
  drawBoss();

  // Combo texts
  drawComboTexts();

  // Screen flash overlay
  if (screenFlashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = screenFlashAlpha;
    ctx.fillStyle = screenFlashColor || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Precision mode HUD indicator
  if (precisionMode) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.2 * Math.sin(gameTime * 0.05);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRECISION MODE', canvas.width / 2, canvas.height - 8);
    ctx.restore();
  }

  // Boss mode world indicator
  if (bossMode) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(gameTime * 0.08);
    ctx.fillStyle = '#ff4d6d';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS FIGHT', canvas.width / 2, canvas.height - 8);
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
  if (bossMode) {
    levelEl.textContent = 'World ' + currentWorld + ' BOSS';
  } else if (precisionMode) {
    var loopLabel = precisionLoop > 0 ? ' (x' + (precisionLoop + 1) + ')' : '';
    levelEl.textContent = 'Precision ' + currentLevel + loopLabel;
  } else {
    levelEl.textContent = 'World ' + currentWorld + '-' + currentLevel;
  }
  livesEl.textContent = 'Lives: ' + lives;
  if (window.GamePlatform) GamePlatform.updateScore(score);
}

// ── Level Complete ──
function levelComplete() {
  running = false;
  GameEngine.clock.cancelAnimationFrame(animId);
  Object.values(activeEffects).forEach(e => GameEngine.clock.clearTimeout(e.timer));
  activeEffects = {};
  powerupHud.innerHTML = '';
  lasers = [];
  magnetStuck = false;

  Sound.music.stop();

  // If completing level 5 of a world (and not precision mode), go to boss fight
  if (!precisionMode && currentLevel === LEVELS_PER_WORLD) {
    // Don't save level 5 yet - save after boss is defeated to gate world unlock
    var bossWorld = currentWorld;
    // Brief delay then start boss
    GameEngine.clock.setTimeout(function() { startBossLevel(bossWorld, true); }, 600);
    sfxLevelComplete();
    return;
  }

  sfxLevelComplete();

  if (precisionMode) {
    savePrecisionScore(score);
  } else {
    saveLevelResult(currentWorld, currentLevel, score);
  }
  saveHighScore(score);

  if (window.GamePlatform) {
    _gameRecorded = true;
    var t = GamePlatform.stopTimer();
    GamePlatform.recordGame('breakout', score, t * 1000, {
      win: true,
      world: currentWorld,
      level: currentLevel,
      precision: precisionMode
    });
    GamePlatform.updateScore(score);
  }

  if (!precisionMode) {
    // Check if a new world was just unlocked
    const nextWorld = currentWorld + (currentLevel === LEVELS_PER_WORLD ? 1 : 0);
    if (currentLevel === LEVELS_PER_WORLD && nextWorld <= 3 && isWorldUnlocked(nextWorld)) {
      sfxWorldUnlock();
    }
  }

  // Check if all worlds completed
  const allDone = !precisionMode && currentWorld === 3 && currentLevel === LEVELS_PER_WORLD;

  // Stars display (not in precision mode)
  let starStr = '';
  if (!precisionMode) {
    const starsEarned = getLevelStars(currentWorld, currentLevel);
    for (let i = 1; i <= 3; i++) {
      starStr += i <= starsEarned ? '\u2605' : '\u2606';
    }
  }

  if (precisionMode) {
    overlayTitle.textContent = 'Level Complete!';
    overlayTitle.style.color = '#ffd700';
    var loopLabel = precisionLoop > 0 ? ' (Loop ' + (precisionLoop + 1) + ')' : '';
    overlayMsg.textContent = 'Precision Level ' + currentLevel + loopLabel + '\nScore: ' + score;
  } else {
    overlayTitle.textContent = allDone ? 'Congratulations!' : 'Level Complete!';
    overlayTitle.style.color = '#ffd700';
    let msgText = allDone
      ? 'All worlds completed!\nScore: ' + score + '  ' + starStr
      : 'World ' + currentWorld + '-' + currentLevel + '\nScore: ' + score + '  ' + starStr;
    overlayMsg.textContent = msgText;
  }

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

  hidePrecisionBtn();
  overlay.classList.remove('hidden');
}

// ── Game Over ──
function gameOver(won) {
  running = false;
  bossMode = false;
  boss = null;
  bossProjectiles = [];
  GameEngine.clock.cancelAnimationFrame(animId);
  Object.values(activeEffects).forEach(e => GameEngine.clock.clearTimeout(e.timer));
  activeEffects = {};
  powerupHud.innerHTML = '';
  lasers = [];
  magnetStuck = false;

  Sound.music.stop();
  sfxGameOver();

  if (precisionMode) {
    savePrecisionScore(score);
  }
  saveHighScore(score);
  if (window.GamePlatform) {
    _gameRecorded = true;
    var t = GamePlatform.stopTimer();
    GamePlatform.recordGame('breakout', score, t * 1000, {
      win: false,
      world: currentWorld,
      level: currentLevel,
      precision: precisionMode
    });
    GamePlatform.updateScore(score);
  }

  overlayTitle.textContent = 'Game Over';
  overlayTitle.style.color = '#ff4d6d';
  if (precisionMode) {
    overlayMsg.textContent = 'Precision Mode\nScore: ' + score;
  } else if (currentLevel === 'B') {
    overlayMsg.textContent = 'World ' + currentWorld + ' Boss\nScore: ' + score;
  } else {
    overlayMsg.textContent = 'World ' + currentWorld + '-' + currentLevel + '\nScore: ' + score;
  }
  overlayBtn.textContent = 'Retry';

  // Hide how-to-play
  const howTo = overlay.querySelector('.how-to-play');
  if (howTo) howTo.style.display = 'none';
  highscoresDiv.classList.add('hidden');

  setupSecondaryBtn();
  hidePrecisionBtn();
  overlay.classList.remove('hidden');

  // Reset precision mode on game over
  if (precisionMode) {
    precisionMode = false;
    precisionLoop = 0;
  }
}

// ── Loop ──
const STEP_MS = 1000 / 60;
let lastFrameAt = 0;
let stepAccumulator = 0;

function loop(now) {
  if (!running) return;
  if (now === undefined) {
    now = GameEngine.now();
    lastFrameAt = now;
    stepAccumulator = STEP_MS;
  }
  stepAccumulator += Math.min(now - lastFrameAt, 100);
  lastFrameAt = now;
  while (stepAccumulator >= STEP_MS) {
    stepAccumulator -= STEP_MS;
    gameTime++;
    if (shakeDuration > 0) shakeDuration--;
    savePrev();
    update();
    if (!running) return;
  }
  draw(Math.min(1, stepAccumulator / STEP_MS));
  Sound.update();
  animId = GameEngine.clock.requestAnimationFrame(loop);
}

function savePrev() {
  for (const b of balls) { b.px = b.x; b.py = b.y; }
  if (paddle) paddle.px = paddle.x;
  for (const p of powerups) p.py = p.y;
  for (const l of lasers) l.py = l.y;
}

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

function startMusic() {
  Sound.setWorld(currentWorld);
  Sound.sfx('start');
  Sound.music.start();
}

// Platform integration
let _gameRecorded = false;
if (window.GamePlatform) {
  GamePlatform.initHeader('Breakout');
  addMusicButton();
  window.addEventListener('beforeunload', function() {
    if (score > 0 && !_gameRecorded) {
      var t = GamePlatform.stopTimer();
      GamePlatform.recordGame('breakout', score, t * 1000, { win: false });
    }
  });
}

// ── Show start screen ──
showStartScreen();
GameEngine.pausable({ isActive: () => running, container: '#game-container' });
