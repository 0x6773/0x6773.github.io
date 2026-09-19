(function () {
  'use strict';

  // ── Canvases ──
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nextCvs = document.getElementById('nextCanvas');
  const nextCtx = nextCvs.getContext('2d');
  const holdCvs = document.getElementById('holdCanvas');
  const holdCtx = holdCvs.getContext('2d');

  // ── DOM ──
  const scoreEl = document.getElementById('score-display');
  const levelEl = document.getElementById('level-display');
  const linesEl = document.getElementById('lines-display');
  const overlay = document.getElementById('overlay');
  const overlaySub = document.getElementById('overlay-sub');
  const highscoresDiv = document.getElementById('highscores');
  const scoreList = document.getElementById('score-list');

  // ── Constants ──
  const COLS = 10, ROWS = 20, CELL = 30;
  const LOCK_DELAY = 500; // ms before piece locks after landing

  const PIECES = {
    I: { shape: [[0,0],[1,0],[2,0],[3,0]], color: '#00d4ff' },
    O: { shape: [[0,0],[1,0],[0,1],[1,1]], color: '#ffd700' },
    T: { shape: [[0,0],[1,0],[2,0],[1,1]], color: '#e040fb' },
    S: { shape: [[1,0],[2,0],[0,1],[1,1]], color: '#00e676' },
    Z: { shape: [[0,0],[1,0],[1,1],[2,1]], color: '#ff4d6d' },
    J: { shape: [[0,0],[0,1],[1,1],[2,1]], color: '#448aff' },
    L: { shape: [[2,0],[0,1],[1,1],[2,1]], color: '#ff8c42' },
  };
  const PIECE_NAMES = Object.keys(PIECES);

  const LINE_SCORES = [0, 100, 300, 500, 800];
  const SPEED = level => Math.max(50, 800 - (level - 1) * 70);

  // ── Audio ──
  let audioCtx;
  function ensureAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  function playTone(f, d, t = 'square', v = 0.1) {
    ensureAudio();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = t; o.frequency.value = f;
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + d);
  }
  function sfxMove()    { playTone(200, 0.05, 'sine', 0.06); }
  function sfxRotate()  { playTone(400, 0.06, 'triangle', 0.08); }
  function sfxDrop()    { playTone(150, 0.12, 'triangle', 0.1); }
  function sfxLock()    { playTone(250, 0.08, 'square', 0.08); }
  function sfxLine(n)   { const base = 500 + n * 100; [base, base+200, base+400].forEach((f,i) => setTimeout(() => playTone(f, 0.12, 'triangle', 0.1), i*60)); }
  function sfxTetris()  { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.15, 'triangle', 0.13), i*70)); }
  function sfxGameOver(){ [300,250,200,150].forEach((f,i) => setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.1), i*120)); }
  function sfxHold()    { playTone(350, 0.06, 'sine', 0.08); }
  function sfxPowerup() { playTone(880, 0.08, 'sine', 0.12); setTimeout(() => playTone(1100, 0.1, 'sine', 0.1), 60); }
  function sfxBomb()    { playTone(80, 0.5, 'sawtooth', 0.15); setTimeout(() => playTone(60, 0.4, 'sawtooth', 0.12), 80); }
  function sfxNuke()    { [60,50,40,30].forEach((f,i) => setTimeout(() => playTone(f, 0.3, 'sawtooth', 0.13), i*80)); }
  function sfxSlow()    { [400,500,600].forEach((f,i) => setTimeout(() => playTone(f, 0.15, 'sine', 0.1), i*80)); }
  function sfxFlat()    { playTone(600, 0.1, 'triangle', 0.1); setTimeout(() => playTone(800, 0.15, 'triangle', 0.12), 80); }
  function sfxColorBomb(){ [800,600,400,200].forEach((f,i) => setTimeout(() => playTone(f, 0.12, 'square', 0.08), i*60)); }

  // ── Power-up definitions ──
  const POWERUPS = [
    { id: 'bomb',     label: 'BOMB',  color: '#ff4d6d', icon: 'B' },
    { id: 'rowblast', label: 'ROW',   color: '#ff8c42', icon: 'R' },
    { id: 'nuke',     label: 'NUKE',  color: '#ffd700', icon: 'N' },
    { id: 'slow',     label: 'SLOW',  color: '#00d4ff', icon: 'S' },
    { id: 'flat',     label: 'FLAT',  color: '#00e676', icon: 'I' },
    { id: 'colorbomb',label: 'COLOR', color: '#e040fb', icon: 'C' },
  ];
  const MAX_POWERUPS = 3;
  let puInventory = [];
  let slowTimer = null, slowActive = false;

  const puSlotsEl = document.getElementById('pu-slots');
  const colorPicker = document.getElementById('color-picker');
  const colorOptions = document.getElementById('color-options');

  // ── Mode (Classic / Arcade) ──
  let tetrisMode = 'classic';
  const modeSelector = document.getElementById('mode-selector');
  const powerupBar = document.getElementById('powerup-bar');
  const modeBtns = document.querySelectorAll('.mode-btn');

  // ── High Scores ──
  function hsKey() { return 'tetris_hs_' + tetrisMode; }
  function loadHS() { try { return JSON.parse(localStorage.getItem(hsKey())) || []; } catch { return []; } }
  function saveHS(s) {
    const sc = loadHS(); sc.push({ score: s, date: new Date().toLocaleDateString() });
    sc.sort((a, b) => b.score - a.score);
    localStorage.setItem(hsKey(), JSON.stringify(sc.slice(0, 5)));
  }
  function renderHS() {
    const sc = loadHS();
    if (!sc.length) { highscoresDiv.classList.add('hidden'); return; }
    highscoresDiv.classList.remove('hidden');
    scoreList.innerHTML = sc.map((s, i) => `<li>#${i+1}  ${String(s.score).padStart(6,' ')}  ${s.date}</li>`).join('');
  }

  // ── Particles ──
  let particles = [];
  function spawnLineParticles(row) {
    for (let x = 0; x < COLS; x++) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
        particles.push({
          x: x * CELL + CELL / 2, y: row * CELL + CELL / 2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
          r: 2 + Math.random() * 2, color: '#fff', life: 1, decay: 0.02 + Math.random() * 0.02
        });
      }
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  function spawnExplosion(cx, cy, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      particles.push({
        x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        r: 2 + Math.random() * 3, color, life: 1, decay: 0.018 + Math.random() * 0.02
      });
    }
  }

  let flashAlpha = 0, flashColor = '#fff';

  function screenFlash(color) {
    flashColor = color; flashAlpha = 0.4;
  }

  function drawFlash() {
    if (flashAlpha <= 0) return;
    ctx.save(); ctx.globalAlpha = flashAlpha; ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    flashAlpha -= 0.015;
    if (flashAlpha < 0) flashAlpha = 0;
  }

  // ── Game State ──
  let board, score, level, lines, bag, nextQueue, current, holdPiece, holdUsed;
  let dropTimer, lockTimer, gameRunning, animId, lastTime;

  // ── Bag randomizer (7-bag) ──
  function fillBag() {
    const b = [...PIECE_NAMES];
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }
  function nextPieceName() {
    if (!bag.length) bag = fillBag();
    return bag.pop();
  }

  // ── Piece helpers ──
  function makePiece(name) {
    const def = PIECES[name];
    const cells = def.shape.map(c => ({ x: c[0], y: c[1] }));
    return { name, cells, color: def.color, x: 3, y: 0 };
  }

  function rotateCells(cells, dir) {
    // Find bounding box
    let maxX = 0, maxY = 0;
    for (const c of cells) { if (c.x > maxX) maxX = c.x; if (c.y > maxY) maxY = c.y; }
    const size = Math.max(maxX, maxY) + 1;
    return cells.map(c => dir === 1
      ? { x: size - 1 - c.y, y: c.x }
      : { x: c.y, y: size - 1 - c.x }
    );
  }

  function piecePositions(piece) {
    return piece.cells.map(c => ({ x: piece.x + c.x, y: piece.y + c.y }));
  }

  function isValid(piece) {
    for (const c of piece.cells) {
      const x = piece.x + c.x, y = piece.y + c.y;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && board[y][x]) return false;
    }
    return true;
  }

  function ghostY(piece) {
    let gy = piece.y;
    const test = { ...piece, y: gy };
    while (true) {
      test.y = gy + 1;
      if (!isValid(test)) return gy;
      gy++;
    }
  }

  // ── Init ──
  function init() {
    // Read selected mode from UI
    const selectedBtn = document.querySelector('.mode-btn.selected');
    if (selectedBtn) tetrisMode = selectedBtn.dataset.mode;

    board = []; for (let y = 0; y < ROWS; y++) { board[y] = []; for (let x = 0; x < COLS; x++) board[y][x] = null; }
    score = 0; level = 1; lines = 0;
    bag = fillBag();
    nextQueue = [];
    for (let i = 0; i < 3; i++) nextQueue.push(nextPieceName());
    holdPiece = null; holdUsed = false;
    particles = [];
    puInventory = [];
    slowActive = false; if (slowTimer) clearTimeout(slowTimer);
    renderPowerupBar();
    colorPicker.classList.add('hidden');

    // Show/hide power-up bar based on mode
    if (tetrisMode === 'classic') {
      powerupBar.style.display = 'none';
    } else {
      powerupBar.style.display = '';
    }

    // Hide mode selector during gameplay
    modeSelector.style.display = 'none';

    spawnNext();
    updateHUD();
    gameRunning = true;
    lastTime = performance.now();
    dropTimer = 0; lockTimer = 0;
    overlay.classList.add('hidden');
    if (animId) cancelAnimationFrame(animId);
    loop(performance.now());
  }

  function spawnNext() {
    const name = nextQueue.shift();
    nextQueue.push(nextPieceName());
    current = makePiece(name);
    if (!isValid(current)) { gameOver(); return; }
    lockTimer = 0;
    drawNext(); drawHold();
  }

  // ── Actions ──
  function moveLeft()  { current.x--; if (!isValid(current)) current.x++; else sfxMove(); }
  function moveRight() { current.x++; if (!isValid(current)) current.x--; else sfxMove(); }

  function moveDown() {
    current.y++;
    if (!isValid(current)) { current.y--; return false; }
    dropTimer = 0; lockTimer = 0;
    return true;
  }

  function hardDrop() {
    let dropped = 0;
    while (true) { current.y++; if (!isValid(current)) { current.y--; break; } dropped++; }
    score += dropped * 2;
    sfxDrop();
    lockPiece();
  }

  function rotate(dir) {
    const oldCells = current.cells;
    current.cells = rotateCells(current.cells, dir);
    // Wall kick: try offsets
    const kicks = [0, -1, 1, -2, 2];
    for (const kx of kicks) {
      for (const ky of [0, -1, 1]) {
        current.x += kx; current.y += ky;
        if (isValid(current)) { sfxRotate(); return; }
        current.x -= kx; current.y -= ky;
      }
    }
    current.cells = oldCells; // revert
  }

  function hold() {
    if (holdUsed) return;
    sfxHold();
    holdUsed = true;
    const name = current.name;
    if (holdPiece) {
      current = makePiece(holdPiece);
      holdPiece = name;
    } else {
      holdPiece = name;
      spawnNext();
    }
    drawHold();
  }

  function lockPiece() {
    sfxLock();
    for (const c of piecePositions(current)) {
      if (c.y >= 0 && c.y < ROWS) board[c.y][c.x] = current.color;
    }
    holdUsed = false;
    clearLines();
    spawnNext();
  }

  function clearLines() {
    const fullRows = [];
    for (let y = 0; y < ROWS; y++) {
      if (board[y].every(c => c !== null)) fullRows.push(y);
    }
    if (!fullRows.length) return;

    for (const row of fullRows) spawnLineParticles(row);

    const n = fullRows.length;
    if (n === 4) sfxTetris(); else sfxLine(n);

    // Remove rows
    for (const row of fullRows) {
      board.splice(row, 1);
      board.unshift(new Array(COLS).fill(null));
    }

    lines += n;
    score += LINE_SCORES[n] * level;
    level = Math.floor(lines / 10) + 1;
    updateHUD();

    // Chance to earn a power-up (Arcade mode only): 1 line=20%, 2=40%, 3=70%, 4=100%
    if (tetrisMode === 'arcade') {
      const puChance = [0, 0.2, 0.4, 0.7, 1.0][n];
      if (puInventory.length < MAX_POWERUPS && Math.random() < puChance) {
        const pu = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        puInventory.push({ ...pu });
        sfxPowerup();
        renderPowerupBar();
      }
    }
  }

  function gameOver() {
    gameRunning = false;
    sfxGameOver();
    saveHS(score);
    if (window.GamePlatform) {
      var t = GamePlatform.stopTimer();
      GamePlatform.recordGame('tetris', score, t * 1000, { linesCleared: lines });
      GamePlatform.updateScore(score);
    }
    overlay.querySelector('h1').textContent = 'GAME OVER';
    overlaySub.textContent = 'Score: ' + score + '  |  Lines: ' + lines;
    renderHS();
    modeSelector.style.display = 'flex';
    overlay.classList.remove('hidden');
  }

  // ── Input ──
  document.addEventListener('keydown', e => {
    if (!gameRunning) {
      if (overlay && !overlay.classList.contains('hidden')) { ensureAudio(); init(); }
      return;
    }
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); moveLeft(); break;
      case 'ArrowRight': case 'd': case 'D': e.preventDefault(); moveRight(); break;
      case 'ArrowDown': case 's': case 'S': e.preventDefault(); if (moveDown()) score += 1; break;
      case 'ArrowUp': case 'w': case 'W': e.preventDefault(); rotate(1); break;
      case 'z': case 'Z': e.preventDefault(); rotate(-1); break;
      case ' ': e.preventDefault(); hardDrop(); break;
      case 'c': case 'C': case 'Shift': e.preventDefault(); hold(); break;
      case '1': e.preventDefault(); if (tetrisMode === 'arcade') usePowerup(0); break;
      case '2': e.preventDefault(); if (tetrisMode === 'arcade') usePowerup(1); break;
      case '3': e.preventDefault(); if (tetrisMode === 'arcade') usePowerup(2); break;
    }
    updateHUD();
  });

  // ── Mode button click handlers ──
  const MODE_STYLES = {
    classic: { selectedBorder: '#00d4ff', selectedColor: '#00d4ff' },
    arcade:  { selectedBorder: '#e040fb', selectedColor: '#e040fb' },
  };

  modeBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // Don't start the game when clicking mode buttons
      modeBtns.forEach(b => {
        b.classList.remove('selected');
        b.style.borderColor = '#333';
        b.style.color = '#666';
      });
      btn.classList.add('selected');
      const mode = btn.dataset.mode;
      const s = MODE_STYLES[mode];
      btn.style.borderColor = s.selectedBorder;
      btn.style.color = s.selectedColor;
      tetrisMode = mode;
      overlaySub.textContent = mode.charAt(0).toUpperCase() + mode.slice(1) + ' — Click or press any key to start';
      renderHS();
    });
  });

  // Start on overlay click
  overlay.addEventListener('click', e => {
    // Don't start if user clicked inside the mode selector
    if (modeSelector.contains(e.target)) return;
    ensureAudio(); init();
  });

  // ── Touch button controls with auto-repeat ──
  let repeatTimer = null, repeatInterval = null;

  function startAction(action) {
    if (!gameRunning) return;
    doAction(action);
    // Auto-repeat for directional buttons
    if (action === 'left' || action === 'right' || action === 'down') {
      clearTimeout(repeatTimer); clearInterval(repeatInterval);
      repeatTimer = setTimeout(() => {
        repeatInterval = setInterval(() => doAction(action), 60);
      }, 180); // DAS: 180ms delay, then 60ms repeat
    }
  }

  function stopAction() {
    clearTimeout(repeatTimer); clearInterval(repeatInterval);
    repeatTimer = null; repeatInterval = null;
  }

  function doAction(action) {
    if (!gameRunning) return;
    switch (action) {
      case 'left': moveLeft(); break;
      case 'right': moveRight(); break;
      case 'down': if (moveDown()) score += 1; break;
      case 'rotate': rotate(1); break;
      case 'drop': hardDrop(); break;
      case 'hold': hold(); break;
    }
    updateHUD();
  }

  document.querySelectorAll('.t-btn').forEach(btn => {
    const action = btn.dataset.action;
    btn.addEventListener('touchstart', e => { e.preventDefault(); btn.classList.add('pressed'); startAction(action); }, { passive: false });
    btn.addEventListener('touchend', e => { e.preventDefault(); btn.classList.remove('pressed'); stopAction(); }, { passive: false });
    btn.addEventListener('touchcancel', e => { btn.classList.remove('pressed'); stopAction(); });
    // Pointer fallback
    btn.addEventListener('mousedown', e => { e.preventDefault(); startAction(action); });
    btn.addEventListener('mouseup', () => stopAction());
    btn.addEventListener('mouseleave', () => stopAction());
  });

  // Canvas tap to rotate (touch devices)
  canvas.addEventListener('touchstart', e => { e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (!gameRunning) return;
    rotate(1);
    updateHUD();
  }, { passive: false });

  // ── Power-up UI ──
  function renderPowerupBar() {
    puSlotsEl.innerHTML = '';
    for (let i = 0; i < MAX_POWERUPS; i++) {
      const div = document.createElement('div');
      div.className = 'pu-slot';
      if (puInventory[i]) {
        const pu = puInventory[i];
        div.style.borderColor = pu.color;
        div.style.color = pu.color;
        div.style.background = pu.color + '18';
        div.textContent = pu.icon;
        div.innerHTML += `<span class="pu-key">${i + 1}</span>`;
        div.addEventListener('click', () => usePowerup(i));
        div.addEventListener('touchstart', e => { e.preventDefault(); usePowerup(i); }, { passive: false });
      } else {
        div.style.borderColor = '#222';
        div.style.color = '#333';
        div.textContent = '-';
      }
      puSlotsEl.appendChild(div);
    }
  }

  function usePowerup(index) {
    if (!gameRunning || index >= puInventory.length) return;
    const pu = puInventory[index];
    switch (pu.id) {
      case 'bomb': activateBomb(); break;
      case 'rowblast': activateRowBlast(); break;
      case 'nuke': activateNuke(); break;
      case 'slow': activateSlow(); break;
      case 'flat': activateFlat(); break;
      case 'colorbomb': activateColorBomb(index); return; // don't remove yet
    }
    puInventory.splice(index, 1);
    renderPowerupBar();
  }

  function activateBomb() {
    sfxBomb(); screenFlash('#ff4d6d');
    // Find the center-bottom of the highest filled area
    let targetY = ROWS - 1, targetX = Math.floor(COLS / 2);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) { targetY = y; targetX = x; y = ROWS; break; }
      }
    }
    // Clear 3x3 around target
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = targetY + dy, nx = targetX + dx;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && board[ny][nx]) {
          spawnExplosion(nx, ny, board[ny][nx], 4);
          board[ny][nx] = null;
        }
      }
    }
    // Also clear around the current piece's ghost position for more usefulness
    if (current) {
      const gy = ghostY(current);
      for (const c of current.cells) {
        const px = current.x + c.x, py = gy + c.y;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = py + dy, nx = px + dx;
            if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && board[ny][nx]) {
              spawnExplosion(nx, ny, board[ny][nx], 3);
              board[ny][nx] = null;
            }
          }
        }
      }
    }
    score += 50;
    updateHUD();
  }

  function activateRowBlast() {
    sfxLine(1); screenFlash('#ff8c42');
    // Clear lowest filled row
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].some(c => c !== null)) {
        spawnLineParticles(y);
        board.splice(y, 1);
        board.unshift(new Array(COLS).fill(null));
        score += 100;
        updateHUD();
        return;
      }
    }
  }

  function activateNuke() {
    sfxNuke(); screenFlash('#ffd700');
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0 && cleared < 3; y--) {
      if (board[y].some(c => c !== null)) {
        spawnLineParticles(y);
        board.splice(y, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++;
        y++; // re-check same index since rows shifted
      }
    }
    score += cleared * 150;
    updateHUD();
  }

  function activateSlow() {
    sfxSlow(); screenFlash('#00d4ff');
    slowActive = true;
    if (slowTimer) clearTimeout(slowTimer);
    slowTimer = setTimeout(() => { slowActive = false; slowTimer = null; }, 15000);
  }

  function activateFlat() {
    sfxFlat(); screenFlash('#00e676');
    // Replace the first item in next queue with I-piece
    nextQueue[0] = 'I';
    drawNext();
  }

  function activateColorBomb(puIndex) {
    // Show color picker with colors currently on the board
    const colorsOnBoard = new Set();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (board[y][x]) colorsOnBoard.add(board[y][x]);
    }
    if (colorsOnBoard.size === 0) return;

    colorOptions.innerHTML = '';
    for (const color of colorsOnBoard) {
      const btn = document.createElement('div');
      btn.className = 'color-opt';
      btn.style.background = color;
      btn.style.color = color;
      btn.addEventListener('click', () => {
        sfxColorBomb(); screenFlash('#e040fb');
        // Remove all blocks of this color
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if (board[y][x] === color) {
            spawnExplosion(x, y, color, 3);
            board[y][x] = null;
          }
        }
        // Gravity: collapse empty rows
        for (let y = ROWS - 1; y >= 0; y--) {
          if (board[y].every(c => c === null)) {
            board.splice(y, 1);
            board.unshift(new Array(COLS).fill(null));
          }
        }
        puInventory.splice(puIndex, 1);
        renderPowerupBar();
        colorPicker.classList.add('hidden');
        score += 200;
        updateHUD();
      });
      colorOptions.appendChild(btn);
    }
    colorPicker.classList.remove('hidden');
  }

  // ── Game Loop ──
  function loop(now) {
    if (!gameRunning) return;
    const dt = now - lastTime;
    lastTime = now;

    dropTimer += dt;
    const speed = slowActive ? SPEED(level) * 2 : SPEED(level);

    // Auto-drop
    if (dropTimer >= speed) {
      dropTimer -= speed;
      current.y++;
      if (!isValid(current)) {
        current.y--;
        lockTimer += speed;
        if (lockTimer >= LOCK_DELAY) lockPiece();
      } else {
        lockTimer = 0;
      }
    }

    // Check if piece is resting on something
    current.y++;
    if (!isValid(current)) {
      current.y--;
      lockTimer += dt;
      if (lockTimer >= LOCK_DELAY) lockPiece();
    } else {
      current.y--;
    }

    updateParticles();
    render();
    if (gameRunning) animId = requestAnimationFrame(loop);
  }

  // ── Rendering ──
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }

    // Board
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (board[y][x]) drawCell(ctx, x, y, board[y][x]);
    }

    if (current && gameRunning) {
      // Ghost piece
      const gy = ghostY(current);
      for (const c of current.cells) {
        const gx = current.x + c.x, ry = gy + c.y;
        if (ry >= 0) drawGhostCell(ctx, gx, ry, current.color);
      }

      // Current piece
      for (const c of piecePositions(current)) {
        if (c.y >= 0) drawCell(ctx, c.x, c.y, current.color);
      }
    }

    drawParticles();
    drawFlash();

    // Slow-motion border indicator
    if (slowActive) {
      ctx.save(); ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.4 + 0.2 * Math.sin(Date.now() * 0.005);
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      ctx.restore();
    }
  }

  function drawCell(cx, x, y, color) {
    const px = x * CELL, py = y * CELL;
    // Main fill
    const grad = cx.createLinearGradient(px, py, px, py + CELL);
    grad.addColorStop(0, lighten(color, 25));
    grad.addColorStop(1, darken(color, 25));
    cx.fillStyle = grad;
    cx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    // Shine
    cx.save(); cx.globalAlpha = 0.2; cx.fillStyle = '#fff';
    cx.fillRect(px + 2, py + 2, CELL - 4, (CELL - 4) * 0.35);
    cx.restore();
  }

  function drawGhostCell(cx, x, y, color) {
    cx.save(); cx.globalAlpha = 0.2;
    cx.strokeStyle = color; cx.lineWidth = 1.5;
    cx.strokeRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
    cx.restore();
  }

  function drawMiniPiece(cx, name, canvasW, canvasH) {
    cx.clearRect(0, 0, canvasW, canvasH);
    if (!name) return;
    const def = PIECES[name];
    const miniCell = 18;
    // Center the piece
    let maxX = 0, maxY = 0;
    for (const c of def.shape) { if (c[0] > maxX) maxX = c[0]; if (c[1] > maxY) maxY = c[1]; }
    const pw = (maxX + 1) * miniCell, ph = (maxY + 1) * miniCell;
    const ox = (canvasW - pw) / 2, oy = (canvasH - ph) / 2;
    for (const c of def.shape) {
      const px = ox + c[0] * miniCell, py = oy + c[1] * miniCell;
      cx.fillStyle = def.color;
      cx.fillRect(px + 1, py + 1, miniCell - 2, miniCell - 2);
      cx.save(); cx.globalAlpha = 0.2; cx.fillStyle = '#fff';
      cx.fillRect(px + 2, py + 2, miniCell - 4, (miniCell - 4) * 0.35);
      cx.restore();
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCvs.width, nextCvs.height);
    for (let i = 0; i < nextQueue.length; i++) {
      const name = nextQueue[i];
      const def = PIECES[name];
      const miniCell = 16;
      let maxX = 0, maxY = 0;
      for (const c of def.shape) { if (c[0] > maxX) maxX = c[0]; if (c[1] > maxY) maxY = c[1]; }
      const pw = (maxX + 1) * miniCell;
      const ox = (nextCvs.width - pw) / 2;
      const oy = 12 + i * 82;
      for (const c of def.shape) {
        const px = ox + c[0] * miniCell, py = oy + c[1] * miniCell;
        nextCtx.fillStyle = def.color;
        nextCtx.fillRect(px + 1, py + 1, miniCell - 2, miniCell - 2);
      }
    }
  }

  function drawHold() {
    drawMiniPiece(holdCtx, holdPiece, holdCvs.width, holdCvs.height);
  }

  // ── HUD ──
  function updateHUD() {
    scoreEl.textContent = 'Score: ' + score;
    levelEl.textContent = 'Level: ' + level;
    linesEl.textContent = 'Lines: ' + lines;
    if (window.GamePlatform) GamePlatform.updateScore(score);
  }

  // ── Color utils ──
  function lighten(hex, n) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + n);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + n);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + n);
    return `rgb(${r},${g},${b})`;
  }
  function darken(hex, n) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - n);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - n);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - n);
    return `rgb(${r},${g},${b})`;
  }

  // Platform integration
  if (window.GamePlatform) {
    GamePlatform.initHeader('Tetris');
    GamePlatform.startTimer();
  }

  // ── Show start screen ──
  // Hide power-up bar on initial load (Classic is default)
  powerupBar.style.display = 'none';
  overlaySub.textContent = 'Classic — Click or press any key to start';
  renderHS();
})();
