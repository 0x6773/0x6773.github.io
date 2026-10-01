(function () {
  'use strict';

  const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame, performance } = GameEngine.clock;

  // ── Canvases ──
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nextCvs = document.getElementById('nextCanvas');
  const nextCtx = nextCvs.getContext('2d');
  const holdCvs = document.getElementById('holdCanvas');
  const holdCtx = holdCvs.getContext('2d');
  GameEngine.sharpCanvas(canvas);
  GameEngine.sharpCanvas(nextCvs, { redraw: () => { if (nextQueue) drawNext(); } });
  GameEngine.sharpCanvas(holdCvs, { redraw: () => drawHold() });

  // ── DOM ──
  const scoreEl = document.getElementById('score-display');
  const levelEl = document.getElementById('level-display');
  const linesEl = document.getElementById('lines-display');
  const scoreLabel = document.getElementById('score-label');
  const levelLabel = document.getElementById('level-label');
  const linesLabel = document.getElementById('lines-label');
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
  const Sound = window.TetrisAudio;
  function ensureAudio() {
    return GameEngine.audio();
  }
  function sfxMove()    { Sound.sfx('move'); }
  function sfxRotate()  { Sound.sfx('rotate'); }
  function sfxDrop()    { Sound.sfx('harddrop'); }
  function sfxLock()    { Sound.sfx('lock'); }
  function sfxLine(n)   { Sound.sfx('line' + Math.min(3, n)); }
  function sfxTetris()  { Sound.sfx('tetris'); }
  function sfxGameOver(){ Sound.sfx('gameover'); }
  function sfxHold()    { Sound.sfx('hold'); }
  function sfxPowerup() { Sound.sfx('powerup'); }
  function sfxBomb()    { Sound.sfx('bomb'); }
  function sfxNuke()    { Sound.sfx('nuke'); }
  function sfxSlow()    { Sound.sfx('slow'); }
  function sfxFlat()    { Sound.sfx('flat'); }
  function sfxColorBomb(){ Sound.sfx('colorbomb'); }

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
  let colorBombPending = false;

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
    if (tetrisMode === 'sprint') {
      scoreList.innerHTML = sc.map((s, i) => {
        var cs = 999999 - s.score; // convert back to centiseconds
        var secs = cs / 100;
        return `<li>#${i+1}  ${formatSprintTime(secs)}  ${s.date}</li>`;
      }).join('');
    } else {
      scoreList.innerHTML = sc.map((s, i) => `<li>#${i+1}  ${String(s.score).padStart(6,' ')}  ${s.date}</li>`).join('');
    }
  }

  // ── Particles ──
  let fx = [];
  let shakeTime = 0, shakeMax = 1, shakeAmp = 0;
  let collapse = null;
  let greyRow = -1;
  const holdPanel = holdCvs.parentElement;
  const scoreChip = scoreEl.parentElement;

  function addFx(o) {
    fx.push(o);
    if (fx.length > 800) fx.splice(0, fx.length - 800);
  }

  function sparks(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random()) * (speed || 3);
      addFx({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, size: 1.5 + Math.random() * 2.5, color, life: 500 + Math.random() * 400, max: 900 });
    }
  }

  function spawnLineParticles(row) {
    for (let x = 0; x < COLS; x++) {
      const color = (board[row] && board[row][x]) || '#ffffff';
      sparks(x * CELL + CELL / 2, row * CELL + CELL / 2, color, 2, 3.5);
      sparks(x * CELL + CELL / 2, row * CELL + CELL / 2, '#ffffff', 1, 2);
    }
  }

  function spawnExplosion(cx, cy, color, count) {
    sparks(cx * CELL + CELL / 2, cy * CELL + CELL / 2, color, count + 2, 4.5);
  }

  function screenFlash(color) {
    addFx({ k: 'flash', color, life: 380, max: 380 });
  }

  function shake(ms, amp) {
    if (ms >= shakeTime) { shakeTime = ms; shakeMax = ms; }
    shakeAmp = Math.max(amp, shakeTime > 0 ? shakeAmp : 0);
  }

  function banner(text, color, size) {
    const slot = fx.filter(f => f.k === 'banner' && f.life > 300).length;
    addFx({ k: 'banner', text, color, size: size || 24, slot, life: 1400, max: 1400 });
  }

  function popup(text, x, y, color) {
    addFx({ k: 'popup', text, x, y, color: color || '#ffffff', life: 950, max: 950 });
  }

  function pulse(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function setHue(lv) {
    document.body.style.setProperty('--hue', String((220 + (lv - 1) * 28) % 360));
  }

  function updateFx(dt) {
    const k = dt / 16.67;
    for (const f of fx) {
      f.life -= dt;
      if (f.k === 'spark') {
        f.x += f.vx * k;
        f.y += f.vy * k;
        f.vy += 0.12 * k;
        f.vx *= Math.pow(0.97, k);
      } else if (f.k === 'popup') f.y -= 0.5 * k;
    }
    fx = fx.filter(f => f.life > 0);
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (collapse) {
      collapse.t += dt;
      if (collapse.t >= collapse.dur) collapse = null;
    }
    if (greyRow >= 0 && greyRow > 0) greyRow = Math.max(0, greyRow - dt / 30);
  }

  // ── Game State ──
  let board, score, level, lines, bag, nextQueue, current, holdPiece, holdUsed;
  let dropTimer, lockTimer, gameRunning, animId, lastTime;

  // ── Combo / T-spin state ──
  let comboCount = 0;
  let lastClearWasDifficult = false;
  let lastActionWasRotate = false;

  // ── Sprint mode state ──
  let sprintStartTime = 0;
  let sprintElapsed = 0;

  const RESTART_LOCK_MS = 700;
  let endedAt = 0;
  function restartLocked() { return performance.now() - endedAt < RESTART_LOCK_MS; }

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

  // ── SRS Wall Kick Tables ──
  const SRS_KICKS = {
    '0>1': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
    '1>2': [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
    '2>3': [[0,0], [1,0], [1,-1], [0,2], [1,2]],
    '3>0': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
  };
  const SRS_KICKS_CCW = {
    '1>0': [[0,0], [1,0], [1,-1], [0,2], [1,2]],
    '2>1': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
    '3>2': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
    '0>3': [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
  };
  const SRS_KICKS_I = {
    '0>1': [[0,0], [-2,0], [1,0], [-2,1], [1,-2]],
    '1>2': [[0,0], [-1,0], [2,0], [-1,-2], [2,1]],
    '2>3': [[0,0], [2,0], [-1,0], [2,-1], [-1,2]],
    '3>0': [[0,0], [1,0], [-2,0], [1,2], [-2,-1]],
  };
  const SRS_KICKS_I_CCW = {
    '1>0': [[0,0], [2,0], [-1,0], [2,-1], [-1,2]],
    '2>1': [[0,0], [1,0], [-2,0], [1,2], [-2,-1]],
    '3>2': [[0,0], [-2,0], [1,0], [-2,1], [1,-2]],
    '0>3': [[0,0], [-1,0], [2,0], [-1,-2], [2,1]],
  };

  // ── Piece helpers ──
  function makePiece(name) {
    const def = PIECES[name];
    const cells = def.shape.map(c => ({ x: c[0], y: c[1] }));
    return { name, cells, color: def.color, x: 3, y: 0, rotation: 0 };
  }

  function rotateCellsSRS(cells, name, dir) {
    const size = name === 'I' ? 4 : (name === 'O' ? 2 : 3);
    return cells.map(c => {
      if (dir === 1) { // clockwise
        return { x: size - 1 - c.y, y: c.x };
      } else { // counter-clockwise
        return { x: c.y, y: size - 1 - c.x };
      }
    });
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
    fx = [];
    collapse = null;
    greyRow = -1;
    shakeTime = 0;
    puInventory = [];
    colorBombPending = false;
    slowActive = false; if (slowTimer) clearTimeout(slowTimer);
    comboCount = 0;
    lastClearWasDifficult = false;
    lastActionWasRotate = false;
    sprintStartTime = performance.now();
    sprintElapsed = 0;
    renderPowerupBar();
    colorPicker.classList.add('hidden');

    // Show/hide power-up bar based on mode
    if (tetrisMode === 'classic' || tetrisMode === 'sprint') {
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
    if (window.GamePlatform) { GamePlatform.resetTimer(); GamePlatform.startTimer(); }
    setHue(1);
    Sound.setLevel(1);
    Sound.music.start();
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
  function moveLeft()  { current.x--; if (!isValid(current)) current.x++; else { lastActionWasRotate = false; sfxMove(); } }
  function moveRight() { current.x++; if (!isValid(current)) current.x--; else { lastActionWasRotate = false; sfxMove(); } }

  function moveDown() {
    current.y++;
    if (!isValid(current)) { current.y--; return false; }
    lastActionWasRotate = false;
    dropTimer = 0; lockTimer = 0;
    return true;
  }

  function hardDrop() {
    let dropped = 0;
    const startY = current.y;
    while (true) { current.y++; if (!isValid(current)) { current.y--; break; } dropped++; }
    if (dropped > 0) {
      lastActionWasRotate = false;
      const tops = {};
      for (const c of current.cells) tops[current.x + c.x] = Math.min(tops[current.x + c.x] ?? 99, c.y);
      addFx({ k: 'trail', cols: Object.keys(tops).map(Number).map(x => ({ x, top: startY + tops[x], bottom: current.y + tops[x] })), color: current.color, life: 260, max: 260 });
      for (const c of piecePositions(current)) {
        if (!current.cells.some(o => o.x === c.x - current.x && o.y === c.y - current.y + 1)) sparks(c.x * CELL + CELL / 2, (c.y + 1) * CELL, current.color, 2, 1.6);
      }
    }
    score += dropped * 2;
    sfxDrop();
    shake(140, 2.5);
    lockPiece();
  }

  function rotate(dir) {
    if (current.name === 'O') return; // O doesn't rotate

    const oldCells = current.cells.map(c => ({...c}));
    const oldRotation = current.rotation;
    const newRotation = (oldRotation + (dir === 1 ? 1 : 3)) % 4;

    // Rotate cells
    current.cells = rotateCellsSRS(current.cells, current.name, dir);
    current.rotation = newRotation;

    // Get kick table
    const key = oldRotation + '>' + newRotation;
    var kicks;
    if (current.name === 'I') {
      kicks = dir === 1 ? SRS_KICKS_I[key] : SRS_KICKS_I_CCW[key];
    } else {
      kicks = dir === 1 ? SRS_KICKS[key] : SRS_KICKS_CCW[key];
    }

    if (!kicks) kicks = [[0,0]];

    // Try each kick offset
    for (const [kx, ky] of kicks) {
      current.x += kx;
      current.y -= ky; // SRS uses y-up, canvas uses y-down
      if (isValid(current)) {
        lastActionWasRotate = true;
        sfxRotate();
        return;
      }
      current.x -= kx;
      current.y += ky;
    }

    // All kicks failed, revert
    current.cells = oldCells;
    current.rotation = oldRotation;
  }

  function hold() {
    if (holdUsed) return;
    sfxHold();
    pulse(holdPanel, 'flash');
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

  function tCornersFilled(piece) {
    var cells = piecePositions(piece);
    var center = cells.find(function (c) {
      return cells.filter(function (o) { return Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1; }).length === 3;
    });
    if (!center) return 0;
    var filled = 0;
    var corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (var i = 0; i < corners.length; i++) {
      var x = center.x + corners[i][0], y = center.y + corners[i][1];
      if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
    }
    return filled;
  }

  function lockPiece() {
    sfxLock();
    var lockedName = current.name;
    var lockedRotate = lastActionWasRotate && lockedName === 'T' && tCornersFilled(current) >= 3;
    addFx({ k: 'lock', cells: piecePositions(current), life: 180, max: 180 });
    for (const c of piecePositions(current)) {
      if (c.y >= 0 && c.y < ROWS) board[c.y][c.x] = current.color;
    }
    holdUsed = false;
    clearLines(lockedName, lockedRotate);
    if (gameRunning) spawnNext();
  }

  // ── Combo text helpers ──
  function showComboText(texts) {
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i];
      var color = t.indexOf('TETRIS') === 0 ? '#5ff3ff' : t.indexOf('T-SPIN') === 0 ? '#ff6bff' : t.indexOf('BACK') === 0 ? '#b18cff' : '#ffb347';
      banner(t, color, t === 'TETRIS!' ? 34 : 22);
    }
  }

  function clearLines(lockedName, lockedRotate) {
    const fullRows = [];
    for (let y = 0; y < ROWS; y++) {
      if (board[y].every(c => c !== null)) fullRows.push(y);
    }

    const n = fullRows.length;

    if (n > 0) {
      const scoreBefore = score, levelBefore = level;
      for (const row of fullRows) spawnLineParticles(row);
      addFx({ k: 'rows', rows: fullRows.slice(), life: 340, max: 340 });
      const shift = new Array(ROWS).fill(0);
      let below = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (fullRows.includes(y)) below++;
        else if (y + below < ROWS) shift[y + below] = below;
      }
      collapse = { shift, t: 0, dur: 160 };
      if (n === 4) sfxTetris(); else sfxLine(n);

      // Remove rows
      for (const row of fullRows) {
        board.splice(row, 1);
        board.unshift(new Array(COLS).fill(null));
      }

      lines += n;
      score += LINE_SCORES[n] * level;
      level = Math.floor(lines / 10) + 1;

      // ── Combo / T-spin scoring ──
      comboCount++;

      var isTSpin = (lockedName === 'T' && lockedRotate);
      var isDifficult = (n === 4 || isTSpin);

      var comboTexts = [];

      if (isTSpin) {
        if (n === 1) comboTexts.push('T-SPIN SINGLE');
        else if (n === 2) comboTexts.push('T-SPIN DOUBLE');
        else if (n === 3) comboTexts.push('T-SPIN TRIPLE');
        score += [0, 400, 800, 1200][n] * level;
        Sound.sfx('tspin');
      }

      if (n === 4) comboTexts.push('TETRIS!');

      if (isDifficult && lastClearWasDifficult) {
        comboTexts.push('BACK-TO-BACK');
        score += Math.floor(LINE_SCORES[n] * level * 0.5);
        Sound.sfx('b2b');
      }

      if (comboCount > 1) {
        comboTexts.push('COMBO x' + comboCount);
        score += 50 * comboCount * level;
        Sound.sfx('combo', comboCount);
      }

      lastClearWasDifficult = isDifficult;

      if (comboTexts.length > 0) showComboText(comboTexts);

      popup('+' + (score - scoreBefore).toLocaleString(), COLS * CELL / 2, (fullRows[0] + n / 2) * CELL, n === 4 ? '#5ff3ff' : '#ffffff');
      pulse(scoreChip, 'bump');
      if (n === 4) { shake(320, 5); screenFlash('#5ff3ff'); }
      else if (n >= 2) shake(160, 2);
      if (level > levelBefore) {
        banner('LEVEL ' + level, '#7cf9a6', 26);
        Sound.sfx('levelup');
        Sound.setLevel(level);
        setHue(level);
      }

      updateHUD();

      // Sprint mode: check for 40 line completion
      if (tetrisMode === 'sprint' && lines >= 40) {
        sprintComplete();
        return;
      }

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
    } else {
      comboCount = 0;
    }
  }

  function gameOver() {
    gameRunning = false;
    endedAt = performance.now();
    colorBombPending = false;
    colorPicker.classList.add('hidden');
    sfxGameOver();
    Sound.music.stop();
    greyRow = ROWS;
    shake(260, 4);
    saveHS(score);
    if (window.GamePlatform) {
      var t = GamePlatform.stopTimer();
      GamePlatform.recordGame('tetris', score, t * 1000, { linesCleared: lines });
      GamePlatform.updateScore(score);
    }
    overlay.querySelector('h1').textContent = 'GAME OVER';
    overlaySub.textContent = 'Score: ' + score.toLocaleString() + '  |  Lines: ' + lines;
    renderHS();
    showOverlayLater();
  }

  function showOverlayLater() {
    setTimeout(() => {
      if (gameRunning) return;
      modeSelector.style.display = 'flex';
      overlay.classList.remove('hidden');
    }, 650);
  }

  // ── Sprint helpers ──
  function sfxWin() { Sound.sfx('win'); }

  function formatSprintTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  function sprintComplete() {
    gameRunning = false;
    endedAt = performance.now();
    sprintElapsed = (performance.now() - sprintStartTime) / 1000;
    sfxWin();
    Sound.music.stop();
    banner('SPRINT COMPLETE', '#7cf9a6', 26);
    for (let i = 0; i < 6; i++) sparks(COLS * CELL * (0.15 + i * 0.14), ROWS * CELL * 0.45, ['#5ff3ff', '#ff6bff', '#ffd34d', '#7cf9a6'][i % 4], 8, 5);
    if (window.GamePlatform) {
      var t = GamePlatform.stopTimer();
      GamePlatform.recordGame('tetris', score, t * 1000, { linesCleared: lines, mode: 'sprint', sprintMs: Math.round(sprintElapsed * 1000) });
    }
    // For sprint, save inverted score so lower times rank higher (999999 - centiseconds)
    var centiseconds = Math.round(sprintElapsed * 100);
    saveHS(999999 - centiseconds);
    overlay.querySelector('h1').textContent = 'SPRINT COMPLETE!';
    overlaySub.textContent = '40 Lines in ' + formatSprintTime(sprintElapsed);
    renderHS();
    showOverlayLater();
  }

  // ── Input ──
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

  document.addEventListener('keydown', e => {
    if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey) {
      if (!e.repeat) toggleMusic();
      return;
    }
    if (!gameRunning) {
      if (overlay && !overlay.classList.contains('hidden') && !restartLocked()) { ensureAudio(); init(); }
      return;
    }
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); moveLeft(); break;
      case 'ArrowRight': case 'd': case 'D': e.preventDefault(); moveRight(); break;
      case 'ArrowDown': case 's': case 'S': e.preventDefault(); if (moveDown()) { score += 1; Sound.sfx('softdrop'); } break;
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
  modeBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // Don't start the game when clicking mode buttons
      modeBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const mode = btn.dataset.mode;
      tetrisMode = mode;
      var modeLabel = mode === 'sprint' ? 'Sprint 40L' : mode.charAt(0).toUpperCase() + mode.slice(1);
      overlaySub.textContent = modeLabel + ' — Click or press any key to start';
      renderHS();
    });
  });

  // Start on overlay click
  overlay.addEventListener('click', e => {
    // Don't start if user clicked inside the mode selector
    if (modeSelector.contains(e.target) || restartLocked()) return;
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
      case 'down': if (moveDown()) { score += 1; Sound.sfx('softdrop'); } break;
      case 'rotate': rotate(1); break;
      case 'drop': hardDrop(); break;
      case 'hold': hold(); break;
    }
    updateHUD();
  }

  document.querySelectorAll('.t-btn').forEach(btn => {
    const action = btn.dataset.action;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('pressed'); startAction(action); });
    btn.addEventListener('pointerup', e => { e.preventDefault(); btn.classList.remove('pressed'); stopAction(); });
    btn.addEventListener('pointerleave', () => { btn.classList.remove('pressed'); stopAction(); });
    btn.addEventListener('pointercancel', () => { btn.classList.remove('pressed'); stopAction(); });
  });

  // Canvas gestures (touch devices)
  let gesture = null;
  const touchOf = e => gesture && [...e.changedTouches].find(t => t.identifier === gesture.id);
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (!gameRunning || gesture) return;
    const t = e.changedTouches[0];
    gesture = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now(), moved: false };
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = touchOf(e);
    if (!t || !gameRunning) return;
    const step = canvas.getBoundingClientRect().width / COLS * 0.9;
    while (Math.abs(t.clientX - gesture.x) >= step) {
      const dir = Math.sign(t.clientX - gesture.x);
      if (dir > 0) moveRight(); else moveLeft();
      gesture.x += dir * step;
      gesture.moved = true;
    }
    while (t.clientY - gesture.y >= step) {
      if (moveDown()) { score += 1; Sound.sfx('softdrop'); }
      gesture.y += step;
      gesture.moved = true;
    }
    if (Math.abs(t.clientX - gesture.x0) > 10 || Math.abs(t.clientY - gesture.y0) > 10) gesture.moved = true;
    updateHUD();
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t = touchOf(e);
    if (!t) return;
    const g = gesture;
    gesture = null;
    if (!gameRunning) return;
    const dt = Math.max(1, performance.now() - g.t0), dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (dy > 50 && dy / dt > 0.5 && dy > Math.abs(dx) * 1.5) hardDrop();
    else if (dy < -40 && -dy / dt > 0.4 && -dy > Math.abs(dx) * 1.5) hold();
    else if (!g.moved && dt < 350) rotate(1);
    updateHUD();
  }, { passive: false });
  canvas.addEventListener('touchcancel', () => { gesture = null; });

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
        div.addEventListener('pointerdown', e => { e.preventDefault(); usePowerup(i); });
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
    if (colorBombPending) return;
    const colorsOnBoard = new Set();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (board[y][x]) colorsOnBoard.add(board[y][x]);
    }
    if (colorsOnBoard.size === 0) return;
    colorBombPending = true;

    colorOptions.innerHTML = '';
    for (const color of colorsOnBoard) {
      const btn = document.createElement('div');
      btn.className = 'color-opt';
      btn.style.background = color;
      btn.style.color = color;
      btn.addEventListener('click', () => {
        if (!colorBombPending || !gameRunning) return;
        colorBombPending = false;
        sfxColorBomb(); screenFlash('#e040fb');
        // Remove all blocks of this color
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if (board[y][x] === color) {
            spawnExplosion(x, y, color, 3);
            board[y][x] = null;
          }
        }
        // Gravity: collapse empty rows — collect non-empty rows and rebuild
        const nonEmpty = [];
        for (let y = 0; y < ROWS; y++) {
          if (board[y].some(c => c !== null)) nonEmpty.push(board[y]);
        }
        const emptyRows = Math.max(0, ROWS - nonEmpty.length);
        board = Array.from({ length: emptyRows }, () => new Array(COLS).fill(null)).concat(nonEmpty);
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
  function step(dt) {
    dropTimer += dt;
    const baseSpeed = tetrisMode === 'sprint' ? 500 : SPEED(level);
    const speed = slowActive ? baseSpeed * 2 : baseSpeed;

    // Auto-drop
    if (dropTimer >= speed) {
      dropTimer -= speed;
      current.y++;
      if (!isValid(current)) {
        current.y--;
        // Don't accumulate lockTimer here; the resting check below handles it
      } else {
        lockTimer = 0;
        lastActionWasRotate = false;
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
  }

  function frame(now) {
    const dt = Math.min(now - lastTime, 100);
    lastTime = now;
    if (gameRunning) step(dt);
    updateFx(dt);
    render(now);
    Sound.update();
    animId = requestAnimationFrame(frame);
  }

  // ── Rendering ──
  const spriteCache = new Map();
  const BOARD_W = COLS * CELL, BOARD_H = ROWS * CELL;

  function rr(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.arcTo(x + w, y, x + w, y + h, r);
    cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r);
    cx.arcTo(x, y, x + w, y, r);
    cx.closePath();
  }

  function rgba(hex, a) {
    return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + a + ')';
  }

  function blockSprite(color, size, k) {
    const key = color + '|' + size + '|' + k;
    let sp = spriteCache.get(key);
    if (sp) return sp;
    const pad = Math.ceil(size * 0.4);
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil((size + pad * 2) * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    const x = pad + 1, y = pad + 1, s = size - 2, r = Math.max(2, size * 0.18);
    g.shadowColor = rgba(color, 0.6);
    g.shadowBlur = size * 0.45 * k;
    g.fillStyle = color;
    rr(g, x, y, s, s, r);
    g.fill();
    g.shadowBlur = 0;
    const body = g.createLinearGradient(x, y, x + s, y + s);
    body.addColorStop(0, lighten(color, 70));
    body.addColorStop(0.45, color);
    body.addColorStop(1, darken(color, 60));
    g.fillStyle = body;
    rr(g, x, y, s, s, r);
    g.fill();
    g.lineWidth = Math.max(1, size * 0.07);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.moveTo(x + r, y + g.lineWidth / 2);
    g.lineTo(x + s - r, y + g.lineWidth / 2);
    g.moveTo(x + g.lineWidth / 2, y + r);
    g.lineTo(x + g.lineWidth / 2, y + s - r);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.moveTo(x + r, y + s - g.lineWidth / 2);
    g.lineTo(x + s - r, y + s - g.lineWidth / 2);
    g.moveTo(x + s - g.lineWidth / 2, y + r);
    g.lineTo(x + s - g.lineWidth / 2, y + s - r);
    g.stroke();
    const gloss = g.createLinearGradient(x, y, x, y + s * 0.55);
    gloss.addColorStop(0, 'rgba(255,255,255,0.6)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    rr(g, x + s * 0.12, y + s * 0.1, s * 0.76, s * 0.38, r * 0.7);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.1)';
    rr(g, x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4, r * 0.5);
    g.fill();
    sp = { canvas: c, pad };
    spriteCache.set(key, sp);
    return sp;
  }

  function drawBlock(cx, px, py, size, color, k) {
    const sp = blockSprite(color, size, k);
    cx.drawImage(sp.canvas, px - sp.pad, py - sp.pad, size + sp.pad * 2, size + sp.pad * 2);
  }

  function drawCell(cx, x, y, color) {
    drawBlock(cx, x * CELL, y * CELL, CELL, color, cx.getTransform().a || 1);
  }

  function drawGhostCell(cx, x, y, color) {
    const px = x * CELL + 3, py = y * CELL + 3, s = CELL - 6;
    rr(cx, px, py, s, s, 5);
    cx.fillStyle = rgba(color, 0.1);
    cx.fill();
    cx.lineWidth = 1.5;
    cx.strokeStyle = rgba(color, 0.65);
    cx.stroke();
  }

  function hue() {
    return (220 + ((level || 1) - 1) * 28) % 360;
  }

  function drawBoardBg() {
    const bg = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    bg.addColorStop(0, '#0d1428');
    bg.addColorStop(1, '#070a16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    const glow = ctx.createRadialGradient(BOARD_W / 2, BOARD_H, 20, BOARD_W / 2, BOARD_H, BOARD_H * 0.7);
    glow.addColorStop(0, 'hsla(' + hue() + ', 90%, 60%, 0.14)');
    glow.addColorStop(1, 'hsla(' + hue() + ', 90%, 60%, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, BOARD_H); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(BOARD_W, y * CELL + 0.5); }
    ctx.stroke();
  }

  function drawFx(now) {
    for (const f of fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === 'trail') {
        for (const col of f.cols) {
          const top = col.top * CELL, bottom = (col.bottom + 1) * CELL;
          if (bottom <= top) continue;
          const g = ctx.createLinearGradient(0, top, 0, bottom);
          g.addColorStop(0, rgba(f.color, 0));
          g.addColorStop(1, rgba(f.color, 0.45 * a));
          ctx.fillStyle = g;
          ctx.fillRect(col.x * CELL + 4, top, CELL - 8, bottom - top);
        }
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === 'lock') {
        ctx.fillStyle = 'rgba(255,255,255,' + 0.55 * a + ')';
        for (const c of f.cells) if (c.y >= 0) { rr(ctx, c.x * CELL + 2, c.y * CELL + 2, CELL - 4, CELL - 4, 5); ctx.fill(); }
      } else if (f.k === 'rows') {
        for (const r of f.rows) {
          const h = CELL * (0.25 + 0.75 * a);
          const y = r * CELL + (CELL - h) / 2;
          const g = ctx.createLinearGradient(0, 0, BOARD_W, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, 'rgba(255,255,255,' + 0.95 * a + ')');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, y, BOARD_W, h);
          ctx.fillStyle = 'hsla(' + hue() + ', 100%, 70%, ' + 0.35 * a + ')';
          ctx.fillRect(0, y - 6, BOARD_W, h + 12);
        }
      } else if (f.k === 'spark') {
        ctx.fillStyle = f.color;
        ctx.globalAlpha = Math.min(1, a * 1.4);
        ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    for (const f of fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === 'banner') {
        const age = f.max - f.life;
        const scale = age < 120 ? 0.6 + 0.55 * (age / 120) : age < 200 ? 1.15 - 0.15 * ((age - 120) / 80) : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life / 300);
        ctx.translate(BOARD_W / 2, BOARD_H * 0.38 + f.slot * 38 - Math.min(age, 400) * 0.03);
        ctx.scale(scale, scale);
        ctx.font = '900 ' + f.size + 'px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(5,8,20,0.85)';
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, 0, 0);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(f.text, 0, -1);
        ctx.restore();
      } else if (f.k === 'popup') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      } else if (f.k === 'flash') {
        ctx.fillStyle = rgba(f.color, 0.35 * a);
        ctx.fillRect(0, 0, BOARD_W, BOARD_H);
      }
    }
  }

  function render(now) {
    const k = ctx.getTransform().a || 1;
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeAmp * (shakeTime / shakeMax);
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }
    drawBoardBg();
    if (board) {
      const ease = collapse ? 1 - Math.pow(1 - collapse.t / collapse.dur, 3) : 1;
      let danger = false;
      for (let y = 0; y < ROWS; y++) {
        const off = collapse ? -collapse.shift[y] * CELL * (1 - ease) : 0;
        const grey = greyRow >= 0 && y >= greyRow;
        for (let x = 0; x < COLS; x++) {
          const color = board[y][x];
          if (!color) continue;
          if (y < 4) danger = true;
          drawBlock(ctx, x * CELL, y * CELL + off, CELL, grey ? '#3b4258' : color, k);
        }
      }
      if (current && gameRunning) {
        const gy = ghostY(current);
        for (const c of current.cells) {
          const ry = gy + c.y;
          if (ry >= 0 && gy !== current.y) drawGhostCell(ctx, current.x + c.x, ry, current.color);
        }
        for (const c of piecePositions(current)) if (c.y >= 0) drawCell(ctx, c.x, c.y, current.color);
      }
      if (danger && gameRunning) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,70,100,' + (0.35 + 0.25 * Math.sin(now * 0.008)) + ')';
        ctx.strokeRect(1.5, 1.5, BOARD_W - 3, BOARD_H - 3);
      }
    }
    drawFx(now);
    if (slowActive) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,212,255,' + (0.4 + 0.2 * Math.sin(now * 0.005)) + ')';
      ctx.strokeRect(1.5, 1.5, BOARD_W - 3, BOARD_H - 3);
    }
    if (tetrisMode === 'sprint' && gameRunning) {
      sprintElapsed = (performance.now() - sprintStartTime) / 1000;
      const label = 'TIME ' + formatSprintTime(sprintElapsed);
      ctx.font = '800 13px "Segoe UI", system-ui, sans-serif';
      const w = ctx.measureText(label).width + 22;
      rr(ctx, BOARD_W / 2 - w / 2, 8, w, 22, 11);
      ctx.fillStyle = 'rgba(8,12,26,0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(124,249,166,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#7cf9a6';
      ctx.fillText(label, BOARD_W / 2, 19.5);
    }
    ctx.restore();
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
    const k = cx.getTransform().a || 1;
    for (const c of def.shape) drawBlock(cx, ox + c[0] * miniCell, oy + c[1] * miniCell, miniCell, def.color, k);
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCvs.width, nextCvs.height);
    const k = nextCtx.getTransform().a || 1;
    for (let i = 0; i < nextQueue.length; i++) {
      const name = nextQueue[i];
      const def = PIECES[name];
      const miniCell = i === 0 ? 18 : 15;
      let maxX = 0, maxY = 0;
      for (const c of def.shape) { if (c[0] > maxX) maxX = c[0]; if (c[1] > maxY) maxY = c[1]; }
      const pw = (maxX + 1) * miniCell;
      const ox = (nextCvs.width - pw) / 2;
      const oy = 14 + i * 82;
      nextCtx.globalAlpha = i === 0 ? 1 : 0.75;
      for (const c of def.shape) drawBlock(nextCtx, ox + c[0] * miniCell, oy + c[1] * miniCell, miniCell, def.color, k);
      nextCtx.globalAlpha = 1;
    }
  }

  function drawHold() {
    drawMiniPiece(holdCtx, holdPiece, holdCvs.width, holdCvs.height);
    if (holdUsed && holdPiece) {
      holdCtx.fillStyle = 'rgba(8,12,26,0.55)';
      holdCtx.fillRect(0, 0, holdCvs.width, holdCvs.height);
    }
  }

  // ── HUD ──
  function updateHUD() {
    if (tetrisMode === 'sprint') {
      scoreLabel.textContent = 'Mode';
      scoreEl.textContent = '40L';
      levelLabel.textContent = 'Time';
      levelEl.textContent = formatSprintTime(sprintElapsed);
      linesLabel.textContent = 'Lines';
      linesEl.textContent = Math.min(lines, 40) + '/40';
    } else {
      scoreLabel.textContent = 'Score';
      scoreEl.textContent = score.toLocaleString();
      levelLabel.textContent = 'Level';
      levelEl.textContent = level;
      linesLabel.textContent = 'Lines';
      linesEl.textContent = lines;
    }
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
  }
  addMusicButton();

  // ── Show start screen ──
  // Hide power-up bar on initial load (Classic is default)
  powerupBar.style.display = 'none';
  overlaySub.textContent = 'Classic — Click or press any key to start';
  renderHS();
  setHue(1);
  lastTime = performance.now();
  animId = requestAnimationFrame(frame);
  GameEngine.pausable({ isActive: () => gameRunning, container: '#game-container' });
})();
