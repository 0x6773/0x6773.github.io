// ============================================================
//  2048 Game — Pure JS (with Undo, Stats, Game Modes)
// ============================================================

(function () {
  'use strict';

  // ---- Mode definitions ------------------------------------
  const MODES = {
    classic:    { name: 'Classic',     size: 4, winTile: 2048, timed: false },
    mini:       { name: 'Mini',        size: 3, winTile: 256,  timed: false },
    big:        { name: 'Big',         size: 5, winTile: 2048, timed: false },
    timeattack: { name: 'Time Attack', size: 4, winTile: 0,    timed: true, duration: 60 },
  };

  // ---- Constants ------------------------------------------
  const MAX_UNDO = 5;
  const STORAGE_PREFIX = '2048_';

  // ---- DOM refs -------------------------------------------
  const gridBg          = document.getElementById('grid-background');
  const tileContainer   = document.getElementById('tile-container');
  const scoreEl         = document.getElementById('score');
  const bestScoreEl     = document.getElementById('best-score');
  const movesEl         = document.getElementById('moves-count');
  const timerDisplayEl  = document.getElementById('timer-display');
  const timerLabelEl    = document.getElementById('timer-label');
  const highestTileEl   = document.getElementById('highest-tile');
  const modeLabelEl     = document.getElementById('mode-label');
  const newGameBtn      = document.getElementById('new-game-btn');
  const undoBtn         = document.getElementById('undo-btn');
  const gameOverOvl     = document.getElementById('game-over-overlay');
  const gameOverBtn     = document.getElementById('game-over-btn');
  const gameOverMsg     = document.getElementById('game-over-msg');
  const winOvl          = document.getElementById('win-overlay');
  const keepPlayBtn     = document.getElementById('keep-playing-btn');
  const winNewBtn       = document.getElementById('win-new-game-btn');
  const timerBarTrack   = document.getElementById('timer-bar-track');
  const timerBarFill    = document.getElementById('timer-bar-fill');

  // ---- State ----------------------------------------------
  let currentMode = 'classic';
  let SIZE        = 4;

  let grid        = [];   // 2-D array of cell values (0 = empty)
  let tiles       = [];   // flat list of tile objects { id, row, col, value, el }
  let score       = 0;
  let bestScore   = 0;
  let moving      = false;
  let hasWon      = false; // shown the win dialog once?
  let tileIdSeq   = 0;
  let gameActive  = false;

  // Statistics
  let moveCount       = 0;
  let highestTile     = 0;
  let elapsedSeconds  = 0;
  let timerInterval   = null;

  // Time Attack
  let countdownSeconds = 0;
  let countdownInterval = null;

  // Undo
  let undoStack = [];

  // Persistent stats
  let allTimeHighestTile = parseInt(localStorage.getItem(STORAGE_PREFIX + 'highest_tile_ever')) || 0;
  let allTimeTotalMoves  = parseInt(localStorage.getItem(STORAGE_PREFIX + 'total_moves_ever')) || 0;

  // ---- Storage helpers ------------------------------------
  function storageKeyBest(mode) {
    return STORAGE_PREFIX + 'best_' + mode;
  }

  function loadBestScore() {
    bestScore = parseInt(localStorage.getItem(storageKeyBest(currentMode))) || 0;
  }

  function saveBestScore() {
    localStorage.setItem(storageKeyBest(currentMode), bestScore);
  }

  function savePersistentStats() {
    localStorage.setItem(STORAGE_PREFIX + 'highest_tile_ever', allTimeHighestTile);
    localStorage.setItem(STORAGE_PREFIX + 'total_moves_ever', allTimeTotalMoves);
  }

  // ---- Audio context (lazy) --------------------------------
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type, volume) {
    try {
      const ctx = ensureAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume || 0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) { /* audio not available */ }
  }

  function sfxSlide()   { playTone(300, 0.10, 'sine', 0.06); }
  function sfxMerge()   { playTone(520, 0.15, 'triangle', 0.10); }
  function sfxGameOver(){ playTone(180, 0.45, 'sawtooth', 0.06); }
  function sfxWin()     {
    playTone(523, 0.15, 'sine', 0.10);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.10), 120);
    setTimeout(() => playTone(784, 0.25, 'sine', 0.12), 240);
  }

  // ---- Build static grid cells ----------------------------
  function buildGrid() {
    gridBg.innerHTML = '';
    document.documentElement.style.setProperty('--grid-size', SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      gridBg.appendChild(cell);
    }
  }

  // ---- Tile positioning helpers ----------------------------
  function tilePosition(row, col) {
    const gap = getComputedGap();
    const containerWidth = tileContainer.offsetWidth;
    const totalGap = gap * (SIZE + 1);
    const cellSize = (containerWidth - totalGap) / SIZE;

    const left = gap + col * (cellSize + gap);
    const top  = gap + row * (cellSize + gap);
    return { left, top, size: cellSize };
  }

  function getComputedGap() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap'));
  }

  // ---- Tile DOM element creation --------------------------
  function createTileEl(tile) {
    const el = document.createElement('div');
    el.className = 'tile';
    updateTileEl(el, tile);
    return el;
  }

  function updateTileEl(el, tile) {
    const pos = tilePosition(tile.row, tile.col);
    el.style.width  = pos.size + 'px';
    el.style.height = pos.size + 'px';
    el.style.left   = pos.left + 'px';
    el.style.top    = pos.top  + 'px';

    // Font size scaling
    const base = pos.size * 0.45;
    const digits = String(tile.value).length;
    const fontSize = digits <= 2 ? base : base * (2 / digits);
    el.style.fontSize = fontSize + 'px';
    el.style.lineHeight = pos.size + 'px';

    el.textContent = tile.value;

    // Color class
    el.className = 'tile';
    if (tile.value <= 2048) {
      el.classList.add('tile-' + tile.value);
    } else {
      el.classList.add('tile-super');
    }
  }

  // ---- Grid logic -----------------------------------------
  function emptyGrid() {
    const g = [];
    for (let r = 0; r < SIZE; r++) {
      g[r] = [];
      for (let c = 0; c < SIZE; c++) g[r][c] = 0;
    }
    return g;
  }

  function deepCopyGrid(g) {
    return g.map(row => row.slice());
  }

  function emptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === 0) cells.push({ r, c });
    return cells;
  }

  function spawnTile() {
    const empty = emptyCells();
    if (empty.length === 0) return null;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    grid[r][c] = value;

    const tile = { id: tileIdSeq++, row: r, col: c, value };
    const el = createTileEl(tile);
    el.classList.add('tile-new');
    tile.el = el;
    tileContainer.appendChild(el);
    tiles.push(tile);
    return tile;
  }

  // ---- Undo system ----------------------------------------
  function performUndo() {
    if (undoStack.length === 0 || !gameActive) return;
    // Don't allow undo if game over overlay is visible
    if (!gameOverOvl.classList.contains('hidden')) return;

    const state = undoStack.pop();
    grid = state.grid;
    score = state.score;
    moveCount = state.moveCount;
    highestTile = state.highestTile;

    // Rebuild tile DOM from grid
    tileContainer.innerHTML = '';
    tiles = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) continue;
        const tile = { id: tileIdSeq++, row: r, col: c, value: grid[r][c] };
        const el = createTileEl(tile);
        tile.el = el;
        tileContainer.appendChild(el);
        tiles.push(tile);
      }
    }

    updateScoreDisplay();
    updateStatsDisplay();
    updateUndoButton();
  }

  function updateUndoButton() {
    const count = undoStack.length;
    undoBtn.textContent = '\u21B6 ' + count;
    undoBtn.disabled = count === 0;
  }

  // ---- Movement -------------------------------------------
  function move(dir) {
    if (moving || !gameActive) return;

    const { dr, dc } = dir;
    let moved = false;
    let mergeScore = 0;
    const mergedPositions = [];

    // Save undo state BEFORE moving
    const preGrid = deepCopyGrid(grid);
    const preScore = score;
    const preMoveCount = moveCount;
    const preHighestTile = highestTile;

    // Build traversal order
    const rows = [...Array(SIZE).keys()];
    const cols = [...Array(SIZE).keys()];
    if (dr === 1) rows.reverse();
    if (dc === 1) cols.reverse();

    const merged = emptyGrid();

    for (const r of rows) {
      for (const c of cols) {
        if (grid[r][c] === 0) continue;

        let cr = r, cc = c;
        while (true) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
          if (grid[nr][nc] === 0) {
            grid[nr][nc] = grid[cr][cc];
            grid[cr][cc] = 0;
            cr = nr;
            cc = nc;
            moved = true;
          } else if (grid[nr][nc] === grid[cr][cc] && !merged[nr][nc]) {
            const newVal = grid[cr][cc] * 2;
            grid[nr][nc] = newVal;
            grid[cr][cc] = 0;
            merged[nr][nc] = 1;
            mergeScore += newVal;
            cr = nr;
            cc = nc;
            moved = true;
            mergedPositions.push({ row: cr, col: cc, value: newVal });
            break;
          } else {
            break;
          }
        }

        const tile = tiles.find(t => t.row === r && t.col === c);
        if (tile && (cr !== r || cc !== c)) {
          tile.row = cr;
          tile.col = cc;
          tile.value = grid[cr][cc];
        }
      }
    }

    if (!moved) return;

    // Push undo state (the state BEFORE this move)
    undoStack.push({
      grid: preGrid,
      score: preScore,
      moveCount: preMoveCount,
      highestTile: preHighestTile,
    });
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    updateUndoButton();

    moving = true;
    sfxSlide();

    // Increment move counter
    moveCount++;
    allTimeTotalMoves++;
    savePersistentStats();

    // Animate tile positions
    tiles.forEach(t => {
      const pos = tilePosition(t.row, t.col);
      t.el.style.left = pos.left + 'px';
      t.el.style.top  = pos.top  + 'px';
    });

    // After transition finishes, reconcile DOM
    setTimeout(() => {
      reconcileTiles(mergedPositions);

      // Update score
      if (mergeScore > 0) {
        score += mergeScore;
        sfxMerge();
        showScorePop(mergeScore);
      }
      updateScoreDisplay();
      updateHighestTile();
      updateStatsDisplay();

      // Spawn new tile
      spawnTile();

      // Check win (only for modes with a winTile)
      const mode = MODES[currentMode];
      if (mode.winTile > 0 && !hasWon && tiles.some(t => t.value === mode.winTile)) {
        hasWon = true;
        sfxWin();
        winOvl.classList.remove('hidden');
        moving = false;
        return;
      }

      // Check game over
      if (isGameOver()) {
        triggerGameOver('No more moves available.');
      }

      moving = false;
    }, 160);
  }

  // Rebuild tile elements from the grid state
  function reconcileTiles(mergedPositions) {
    tileContainer.innerHTML = '';
    tiles = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) continue;
        const tile = { id: tileIdSeq++, row: r, col: c, value: grid[r][c] };
        const el = createTileEl(tile);

        if (mergedPositions.some(m => m.row === r && m.col === c && m.value === tile.value)) {
          el.classList.add('tile-merged');
        }

        tile.el = el;
        tileContainer.appendChild(el);
        tiles.push(tile);
      }
    }
  }

  // ---- Game state checks ----------------------------------
  function isGameOver() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return false;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
      }
    return true;
  }

  function triggerGameOver(msg) {
    gameActive = false;
    sfxGameOver();
    stopTimers();
    if (gameOverMsg) gameOverMsg.textContent = msg;
    if (window.GamePlatform) {
      GamePlatform.recordGame('2048', score, 0);
      GamePlatform.updateScore(score);
    }
    gameOverOvl.classList.remove('hidden');
  }

  // ---- Highest tile tracking ------------------------------
  function updateHighestTile() {
    let maxVal = 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] > maxVal) maxVal = grid[r][c];
    highestTile = maxVal;
    if (highestTile > allTimeHighestTile) {
      allTimeHighestTile = highestTile;
      savePersistentStats();
    }
  }

  // ---- Score display --------------------------------------
  function updateScoreDisplay() {
    scoreEl.textContent = score.toLocaleString();
    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
    }
    bestScoreEl.textContent = bestScore.toLocaleString();
    if (window.GamePlatform) GamePlatform.updateScore(score);
  }

  function updateStatsDisplay() {
    movesEl.textContent = moveCount;
    highestTileEl.textContent = highestTile || '-';
  }

  function showScorePop(val) {
    // Find a visible score element to anchor the pop to
    const scoreBox = scoreEl.closest('.stat-item') || scoreEl.parentElement;
    const pop = document.createElement('span');
    pop.className = 'score-pop';
    pop.textContent = '+' + val;
    scoreBox.style.position = 'relative';
    scoreBox.appendChild(pop);
    pop.addEventListener('animationend', () => pop.remove());
  }

  // ---- Timer system ---------------------------------------
  function formatTime(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function startElapsedTimer() {
    stopTimers();
    elapsedSeconds = 0;
    timerDisplayEl.textContent = '00:00';
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      timerDisplayEl.textContent = formatTime(elapsedSeconds);
    }, 1000);
  }

  function startCountdownTimer(durationSec) {
    stopTimers();
    countdownSeconds = durationSec;
    timerDisplayEl.textContent = formatTime(countdownSeconds);
    timerBarFill.style.width = '100%';

    countdownInterval = setInterval(() => {
      countdownSeconds--;
      if (countdownSeconds <= 0) {
        countdownSeconds = 0;
        timerDisplayEl.textContent = '00:00';
        timerBarFill.style.width = '0%';
        clearInterval(countdownInterval);
        countdownInterval = null;
        // Time's up!
        if (gameActive) {
          triggerGameOver("Time's up! Final score: " + score.toLocaleString());
        }
      } else {
        timerDisplayEl.textContent = formatTime(countdownSeconds);
        const pct = (countdownSeconds / MODES[currentMode].duration) * 100;
        timerBarFill.style.width = pct + '%';
      }
    }, 1000);
  }

  function stopTimers() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // ---- Init / New Game ------------------------------------
  function newGame() {
    const mode = MODES[currentMode];
    SIZE = mode.size;

    // Reset state
    grid = emptyGrid();
    tiles = [];
    score = 0;
    hasWon = false;
    moving = false;
    moveCount = 0;
    highestTile = 0;
    undoStack = [];
    gameActive = true;
    tileContainer.innerHTML = '';
    gameOverOvl.classList.add('hidden');
    winOvl.classList.add('hidden');

    // Load best score for current mode
    loadBestScore();

    // Rebuild grid for the correct size
    buildGrid();

    // Update UI labels
    modeLabelEl.textContent = mode.name;
    updateUndoButton();
    updateScoreDisplay();
    updateStatsDisplay();

    // Timer setup
    if (mode.timed) {
      timerBarTrack.classList.add('active');
      timerLabelEl.textContent = '\u23F1';
      startCountdownTimer(mode.duration);
    } else {
      timerBarTrack.classList.remove('active');
      timerBarFill.style.width = '100%';
      timerLabelEl.textContent = '\u23F1';
      startElapsedTimer();
    }

    // Spawn starting tiles
    spawnTile();
    spawnTile();
    updateHighestTile();
    updateStatsDisplay();
  }

  // ---- Mode switching (called from start overlay) ---------
  function startMode(mode) {
    if (MODES[mode]) {
      currentMode = mode;
    }
    newGame();
  }

  // Expose for the start overlay script
  window.Game2048 = { startMode: startMode };

  // ---- Input handling -------------------------------------
  const DIRS = {
    up:    { dr: -1, dc:  0 },
    down:  { dr:  1, dc:  0 },
    left:  { dr:  0, dc: -1 },
    right: { dr:  0, dc:  1 },
  };

  document.addEventListener('keydown', (e) => {
    // Undo: Ctrl+Z / Cmd+Z or U key
    if (((e.ctrlKey || e.metaKey) && e.key === 'z') ||
        ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.altKey && !e.metaKey)) {
      e.preventDefault();
      performUndo();
      return;
    }

    let dir = null;
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': dir = DIRS.up;    break;
      case 'ArrowDown':  case 's': case 'S': dir = DIRS.down;  break;
      case 'ArrowLeft':  case 'a': case 'A': dir = DIRS.left;  break;
      case 'ArrowRight': case 'd': case 'D': dir = DIRS.right; break;
    }
    if (dir) {
      e.preventDefault();
      move(dir);
    }
  });

  // ---- Touch / Swipe --------------------------------------
  let touchStartX = 0, touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const minSwipe = 30;

    if (Math.max(absDx, absDy) < minSwipe) return;

    if (absDx > absDy) {
      move(dx > 0 ? DIRS.right : DIRS.left);
    } else {
      move(dy > 0 ? DIRS.down : DIRS.up);
    }
  }, { passive: true });

  // Prevent scrolling on the game area
  document.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // ---- Buttons --------------------------------------------
  newGameBtn.addEventListener('click', newGame);
  gameOverBtn.addEventListener('click', newGame);
  winNewBtn.addEventListener('click', newGame);
  keepPlayBtn.addEventListener('click', () => {
    winOvl.classList.add('hidden');
  });
  undoBtn.addEventListener('click', performUndo);

  // ---- Resize handler (reposition tiles) ------------------
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      tiles.forEach(t => updateTileEl(t.el, t));
    }, 100);
  });

  // ---- Boot -----------------------------------------------
  loadBestScore();
  buildGrid();
  bestScoreEl.textContent = bestScore;
  newGame();

  if (window.GamePlatform) {
    GamePlatform.initHeader('2048');
  }
})();
