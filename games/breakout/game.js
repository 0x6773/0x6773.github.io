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
const MAX_LEVEL = 5;
const POWERUP_DROP_CHANCE = 0.2;
const POWERUP_RADIUS = 12;
const POWERUP_SPEED = 2.5;

const ROW_COLORS = ['#ff4d6d', '#ff8c42', '#ffd700', '#00e676', '#00d4ff'];
const ROW_POINTS = [7, 5, 3, 2, 1];

const POWERUP_TYPES = [
  { id: 'wide',  label: 'W', color: '#00e676', name: 'Wide Paddle', duration: 10000 },
  { id: 'multi', label: 'M', color: '#e040fb', name: 'Multi-Ball',  duration: 0 },
  { id: 'slow',  label: 'S', color: '#00d4ff', name: 'Slow Motion', duration: 8000 },
  { id: 'life',  label: '+', color: '#ff4d6d', name: 'Extra Life',  duration: 0 },
];

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

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08; // gravity
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
let ballTrails = new Map(); // ball index -> [{x, y}]

function updateTrails() {
  // Clean up trails for balls that no longer exist
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
      ctx.fillStyle = activeEffects['slow'] ? '#e040fb' : '#00d4ff';
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
  // Subtle gradient bg
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#0a0a1a');
  bgGrad.addColorStop(1, '#16213e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
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
let score, lives, level, balls, paddle, bricks, powerups, activeEffects, running, animId;
let keys = {};
let gameTime = 0;

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
}, { passive: false });

// ── Overlay button ──
overlayBtn.addEventListener('click', () => {
  ensureAudio();
  overlay.classList.add('hidden');
  init();
});

// ── Initialisation ──
function init() {
  score = 0;
  lives = 3;
  level = 1;
  powerups = [];
  activeEffects = {};
  particles = [];
  floatingTexts = [];
  ballTrails = new Map();
  shakeAmount = 0;
  shakeDuration = 0;
  running = true;
  resetBalls();
  resetPaddle();
  buildBricks();
  updateHUD();
  updatePowerupHUD();
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function makeBall() {
  const speed = 4 + level * 0.5;
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

  // Define symmetric brick patterns per level (1 = brick, 0 = empty)
  var pattern;
  switch (level) {
    case 1: // Classic Full Grid
      pattern = [
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1]
      ];
      break;
    case 2: // Diamond
      pattern = [
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,1,1,0,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,0,0,1,1,0,0,0,0]
      ];
      break;
    case 3: // Checkerboard (symmetric left-right)
      pattern = [
        [1,0,1,0,1,1,0,1,0,1],
        [0,1,0,1,0,0,1,0,1,0],
        [1,0,1,0,1,1,0,1,0,1],
        [0,1,0,1,0,0,1,0,1,0],
        [1,0,1,0,1,1,0,1,0,1],
        [0,1,0,1,0,0,1,0,1,0]
      ];
      break;
    case 4: // V / Chevron
      pattern = [
        [1,0,0,0,0,0,0,0,0,1],
        [0,1,0,0,0,0,0,0,1,0],
        [0,0,1,0,0,0,0,1,0,0],
        [0,0,0,1,0,0,1,0,0,0],
        [0,0,0,0,1,1,0,0,0,0],
        [0,0,0,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,0,0]
      ];
      break;
    case 5: // Fortress
      pattern = [
        [1,0,1,0,1,1,0,1,0,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,0,0,1,1],
        [1,1,0,0,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [0,1,1,1,0,0,1,1,1,0],
        [0,0,1,1,0,0,1,1,0,0]
      ];
      break;
    default:
      pattern = [
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1]
      ];
  }

  BRICK_ROWS = pattern.length;

  for (var r = 0; r < BRICK_ROWS; r++) {
    bricks[r] = [];
    for (var c = 0; c < BRICK_COLS; c++) {
      var colorIdx = r % ROW_COLORS.length;
      bricks[r][c] = {
        x: BRICK_OFFSET_LEFT + c * (BRICK_WIDTH + BRICK_PADDING),
        y: BRICK_OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_PADDING),
        w: BRICK_WIDTH,
        h: BRICK_HEIGHT,
        alive: !!pattern[r][c],
        color: ROW_COLORS[colorIdx],
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
      updatePowerupHUD();
    }, duration)
  };
}

function updatePowerupHUD() {
  const active = Object.keys(activeEffects);
  if (active.length === 0) { powerupHud.innerHTML = ''; return; }
  powerupHud.innerHTML = active.map(id => {
    const t = POWERUP_TYPES.find(p => p.id === id);
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

  // Update each ball
  const ballsToRemove = [];
  for (let bi = 0; bi < balls.length; bi++) {
    const ball = balls[bi];

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.x - ball.r <= 0 || ball.x + ball.r >= canvas.width) {
      ball.dx *= -1;
      sfxWallBounce();
    }
    if (ball.y - ball.r <= 0) {
      ball.dy *= -1;
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
      ball.y + ball.r <= paddle.y + paddle.h &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.w
    ) {
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
          const pts = b.points * level;
          score += pts;
          sfxBrickBreak(b.row);
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 14);
          spawnFloatingText(b.x + b.w / 2, b.y, '+' + pts, b.color);
          updateHUD();
          spawnPowerup(b.x + b.w / 2, b.y + b.h);

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
    updatePowerupHUD();
    if (lives <= 0) return gameOver(false);
    resetBalls();
  }

  // Update falling power-ups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.vy;
    p.angle += 0.05;
    // Collect with paddle
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
    // Off screen
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
    if (level >= MAX_LEVEL) return gameOver(true);
    sfxLevelUp();
    level++;
    updateHUD();
    // Clear timed effects
    Object.values(activeEffects).forEach(e => clearTimeout(e.timer));
    activeEffects = {};
    paddle.w = PADDLE_WIDTH;
    powerups = [];
    updatePowerupHUD();
    resetBalls();
    buildBricks();
  }
}

// ── Draw ──
function draw() {
  const shake = getShakeOffset();

  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Background with stars
  drawBackground(gameTime);

  // Bricks with gradient and shine
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const b = bricks[r][c];
      if (!b.alive) continue;

      // Main brick with gradient
      const brickGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      brickGrad.addColorStop(0, lightenColor(b.color, 30));
      brickGrad.addColorStop(0.5, b.color);
      brickGrad.addColorStop(1, darkenColor(b.color, 30));
      ctx.fillStyle = brickGrad;
      ctx.beginPath();
      roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();

      // Shine highlight on top
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
    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(0, -POWERUP_RADIUS);
    ctx.lineTo(POWERUP_RADIUS * 0.7, 0);
    ctx.lineTo(0, POWERUP_RADIUS);
    ctx.lineTo(-POWERUP_RADIUS * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Label
    ctx.rotate(-p.angle); // counter-rotate text so it stays upright
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
  grad.addColorStop(0, isWide ? '#00e676' : '#00d4ff');
  grad.addColorStop(0.5, isWide ? '#69f0ae' : '#48e5ff');
  grad.addColorStop(1, isWide ? '#00c853' : '#0077b6');
  ctx.fillStyle = grad;
  ctx.shadowColor = isWide ? '#00e676' : '#00d4ff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
  ctx.fill();
  ctx.restore();

  // Balls with glow
  for (const ball of balls) {
    ctx.save();
    const ballColor = activeEffects['slow'] ? '#e040fb' : '#00d4ff';
    // Outer glow
    ctx.shadowColor = ballColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    // Inner bright core
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
  levelEl.textContent = 'Level: ' + level;
  livesEl.textContent = 'Lives: ' + lives;
  if (window.GamePlatform) GamePlatform.updateScore(score);
}

// ── Game Over / Win ──
function gameOver(won) {
  running = false;
  cancelAnimationFrame(animId);
  Object.values(activeEffects).forEach(e => clearTimeout(e.timer));
  activeEffects = {};
  powerupHud.innerHTML = '';

  if (won) sfxWin(); else sfxGameOver();

  saveHighScore(score);
  if (window.GamePlatform) {
    var t = GamePlatform.stopTimer();
    GamePlatform.recordGame('breakout', score, t * 1000, { win: won });
    GamePlatform.updateScore(score);
  }
  overlayTitle.textContent = won ? 'You Win!' : 'Game Over';
  overlayTitle.style.color = won ? '#ffd700' : '#ff4d6d';
  overlayMsg.textContent = 'Final Score: ' + score;
  overlayBtn.textContent = 'Play Again';
  renderHighScores();
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
  // Save stats if user leaves mid-game
  window.addEventListener('beforeunload', function() {
    if (score > 0) {
      var t = GamePlatform.stopTimer();
      GamePlatform.recordGame('breakout', score, t * 1000, { win: false });
    }
  });
}

// ── Show start screen ──
renderHighScores();
