// ============================================================
//  2048 Game — Pure JS (with Undo, Stats, Game Modes)
// ============================================================

(function () {
  'use strict';

  const Sound = window.Audio2048;

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
  const SLIDE_MS = 120;
  const CONFETTI = ['#ff5f8f', '#ffb84d', '#ffe066', '#5ce1a0', '#4dc3ff', '#b28dff'];

  // ---- DOM refs -------------------------------------------
  const gridBg          = document.getElementById('grid-background');
  const tileContainer   = document.getElementById('tile-container');
  const boardEl         = document.getElementById('board-container');
  const scoreEl         = document.getElementById('score');
  const bestScoreEl     = document.getElementById('best-score');
  const movesEl         = document.getElementById('moves-count');
  const timerDisplayEl  = document.getElementById('timer-display');
  const timerLabelEl    = document.getElementById('timer-label');
  const highestTileEl   = document.getElementById('highest-tile');
  const modeLabelEl     = document.getElementById('mode-label');
  const newGameBtn      = document.getElementById('new-game-btn');
  const undoBtn         = document.getElementById('undo-btn');
  const hintBtn         = document.getElementById('hint-btn');
  const gameOverOvl     = document.getElementById('game-over-overlay');
  const gameOverBtn     = document.getElementById('game-over-btn');
  const gameOverMsg     = document.getElementById('game-over-msg');
  const winOvl          = document.getElementById('win-overlay');
  const keepPlayBtn     = document.getElementById('keep-playing-btn');
  const winNewBtn       = document.getElementById('win-new-game-btn');
  const timerBarTrack   = document.getElementById('timer-bar-track');
  const timerBarFill    = document.getElementById('timer-bar-fill');
  const startOverlayEl  = document.getElementById('start-overlay');
  const fxLayer         = document.getElementById('fx-layer');

  // ---- State ----------------------------------------------
  let currentMode = 'classic';
  let SIZE        = 4;

  let grid        = [];   // 2-D array of cell values (0 = empty)
  let tiles       = [];   // flat list of tile objects { id, row, col, value, el }
  let score       = 0;
  let bestScore   = 0;
  let bestAtStart = 0;
  let celebratedBest = false;
  let moving      = false;
  let hasWon      = false; // shown the win dialog once?
  let tileIdSeq   = 0;
  let gameActive  = false;
  let queuedMove  = null;

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

  // Safe localStorage helpers
  function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* quota/security */ }
  }

  // Persistent stats
  let allTimeHighestTile = parseInt(safeGetItem(STORAGE_PREFIX + 'highest_tile_ever')) || 0;
  let allTimeTotalMoves  = parseInt(safeGetItem(STORAGE_PREFIX + 'total_moves_ever')) || 0;

  // ---- Storage helpers ------------------------------------
  function storageKeyBest(mode) {
    return STORAGE_PREFIX + 'best_' + mode;
  }

  function loadBestScore() {
    bestScore = parseInt(safeGetItem(storageKeyBest(currentMode))) || 0;
  }

  function saveBestScore() {
    safeSetItem(storageKeyBest(currentMode), bestScore);
  }

  function savePersistentStats() {
    safeSetItem(STORAGE_PREFIX + 'highest_tile_ever', allTimeHighestTile);
    safeSetItem(STORAGE_PREFIX + 'total_moves_ever', allTimeTotalMoves);
  }

  // ---- Audio context (lazy) --------------------------------

  function ensureAudio() {
    return GameEngine.audio();
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
    const val = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap'));
    return isNaN(val) ? 8 : val; // fallback to 8px if CSS var is missing
  }

  // ---- Tile DOM element creation --------------------------
  function createTileEl(tile) {
    const el = document.createElement('div');
    el.className = 'tile';
    const inner = document.createElement('div');
    inner.className = 'tile-inner';
    el.appendChild(inner);
    updateTileEl(el, tile);
    return el;
  }

  function placeTile(el, tile) {
    const pos = tilePosition(tile.row, tile.col);
    el.style.transform = 'translate(' + pos.left + 'px,' + pos.top + 'px)';
    return pos;
  }

  function updateTileEl(el, tile) {
    const pos = placeTile(el, tile);
    el.style.width  = pos.size + 'px';
    el.style.height = pos.size + 'px';
    const inner = el.firstChild;

    // Font size scaling
    const base = pos.size * 0.45;
    const digits = String(tile.value).length;
    const fontSize = digits <= 2 ? base : base * (2 / digits) * 1.1;
    inner.style.fontSize = fontSize + 'px';

    inner.textContent = tile.value;

    // Color class
    inner.className = 'tile-inner ' + (tile.value <= 2048 ? 'tile-' + tile.value : 'tile-super');
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

  function addTile(r, c, value, cls) {
    const tile = { id: tileIdSeq++, row: r, col: c, value };
    const el = createTileEl(tile);
    if (cls) el.firstChild.classList.add(cls);
    tile.el = el;
    tileContainer.appendChild(el);
    tiles.push(tile);
    return tile;
  }

  function spawnTile() {
    const empty = emptyCells();
    if (empty.length === 0) return null;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    grid[r][c] = value;
    return addTile(r, c, value, 'tile-new');
  }

  // Rebuild tile elements from the grid state
  function rebuildTiles() {
    tileContainer.innerHTML = '';
    tiles = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== 0) addTile(r, c, grid[r][c], 'tile-new');
      }
    }
  }

  // ---- Undo system ----------------------------------------
  function performUndo() {
    if (undoStack.length === 0 || !gameActive || moving) return;
    // Don't allow undo if game over overlay is visible
    if (!gameOverOvl.classList.contains('hidden')) return;

    const state = undoStack.pop();
    grid = state.grid;
    score = state.score;
    moveCount = state.moveCount;
    highestTile = state.highestTile;

    // Rebuild tile DOM from grid
    rebuildTiles();
    Sound.sfx('undo');

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
  function slide(g, dir) {
    const { dr, dc } = dir;
    const cells = g.map(row => row.slice());
    const moves = [];
    let moved = false;
    let gained = 0;
    // Build traversal order
    const rows = [...Array(SIZE).keys()];
    const cols = [...Array(SIZE).keys()];
    if (dr === 1) rows.reverse();
    if (dc === 1) cols.reverse();
    const merged = emptyGrid();
    for (const r of rows) {
      for (const c of cols) {
        if (cells[r][c] === 0) continue;
        let cr = r, cc = c, mergedInto = false;
        while (true) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
          if (cells[nr][nc] === 0) {
            cells[nr][nc] = cells[cr][cc];
            cells[cr][cc] = 0;
            cr = nr;
            cc = nc;
          } else if (cells[nr][nc] === cells[cr][cc] && !merged[nr][nc]) {
            const newVal = cells[cr][cc] * 2;
            cells[nr][nc] = newVal;
            cells[cr][cc] = 0;
            merged[nr][nc] = 1;
            gained += newVal;
            cr = nr;
            cc = nc;
            mergedInto = true;
            break;
          } else {
            break;
          }
        }
        if (cr !== r || cc !== c) moved = true;
        moves.push({ from: [r, c], to: [cr, cc], merge: mergedInto });
      }
    }
    return { grid: cells, moved, gained, moves };
  }

  function move(dir) {
    if (!gameActive) return;
    if (startOverlayEl && !startOverlayEl.classList.contains('hidden')) return;
    if (moving) {
      queuedMove = dir;
      return;
    }

    const result = slide(grid, dir);
    if (!result.moved) {
      boardEl.classList.remove('bump');
      void boardEl.offsetWidth;
      boardEl.classList.add('bump');
      return;
    }

    // Push undo state (the state BEFORE this move)
    undoStack.push({
      grid: deepCopyGrid(grid),
      score: score,
      moveCount: moveCount,
      highestTile: highestTile,
    });
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    updateUndoButton();

    moving = true;
    Sound.sfx('slide');
    clearHint();

    // Increment move counter
    moveCount++;
    allTimeTotalMoves++;
    savePersistentStats();

    // Animate tile positions
    const byCell = new Map(tiles.map(t => [t.row + ',' + t.col, t]));
    const removed = [];
    const mergedTargets = [];
    for (const m of result.moves) {
      const t = byCell.get(m.from[0] + ',' + m.from[1]);
      if (!t) continue;
      t.row = m.to[0];
      t.col = m.to[1];
      placeTile(t.el, t);
      if (m.merge) {
        removed.push(t);
        mergedTargets.push({ row: m.to[0], col: m.to[1], value: result.grid[m.to[0]][m.to[1]] });
      }
    }
    grid = result.grid;

    // After transition finishes, reconcile DOM
    setTimeout(() => {
      for (const t of removed) t.el.remove();
      tiles = tiles.filter(t => removed.indexOf(t) < 0);
      for (const m of mergedTargets) {
        const target = tiles.find(t => t.row === m.row && t.col === m.col);
        if (!target) continue;
        target.value = m.value;
        updateTileEl(target.el, target);
        target.el.firstChild.classList.add('tile-merged');
        burst(m.row, m.col, m.value);
      }

      // Update score
      if (result.gained > 0) {
        score += result.gained;
        mergedTargets.forEach((m, i) => setTimeout(() => Sound.sfx('merge', m.value), i * 35));
        if (mergedTargets.length >= 3) {
          Sound.sfx('combo', mergedTargets.length);
          floatText(boardEl.offsetWidth / 2, boardEl.offsetHeight * 0.18, 'COMBO x' + mergedTargets.length, 'combo');
        }
        showScorePop(result.gained);
      }
      updateScoreDisplay();
      updateHighestTile();
      updateStatsDisplay();

      // Spawn new tile
      spawnTile();
      Sound.sfx('spawn');

      // Check win (only for modes with a winTile)
      const mode = MODES[currentMode];
      if (mode.winTile > 0 && !hasWon && tiles.some(t => t.value === mode.winTile)) {
        hasWon = true;
        Sound.sfx('win');
        confetti(90);
        setTimeout(() => winOvl.classList.remove('hidden'), 500);
        moving = false;
        return;
      }

      // Check game over
      if (isGameOver()) {
        triggerGameOver('No more moves available.');
      }

      moving = false;
      if (queuedMove) {
        const next = queuedMove;
        queuedMove = null;
        move(next);
      }
    }, SLIDE_MS + 10);
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
    queuedMove = null;
    Sound.sfx('gameover');
    Sound.music.stop();
    stopTimers();
    boardEl.classList.add('is-over');
    if (gameOverMsg) gameOverMsg.textContent = msg;
    if (window.GamePlatform) {
      GamePlatform.recordGame('2048', score, 0, { maxTile: highestTile, win: hasWon });
      GamePlatform.updateScore(score);
    }
    setTimeout(() => gameOverOvl.classList.remove('hidden'), 650);
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
      if (!celebratedBest && bestAtStart > 0 && score > bestAtStart) {
        celebratedBest = true;
        Sound.sfx('best');
        floatText(boardEl.offsetWidth / 2, boardEl.offsetHeight * 0.4, 'NEW BEST!', 'best');
        confetti(30);
      }
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

  function tileColor(value) {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue('--c-' + (value <= 2048 ? value : 'super')).trim() || '#ffd166';
  }

  function burst(row, col, value) {
    const pos = tilePosition(row, col);
    const cx = pos.left + pos.size / 2, cy = pos.top + pos.size / 2;
    const color = tileColor(value);
    const ring = document.createElement('div');
    ring.className = 'fx-ring';
    ring.style.left = cx + 'px';
    ring.style.top = cy + 'px';
    ring.style.setProperty('--size', pos.size + 'px');
    ring.style.borderColor = color;
    fxLayer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
    const n = value >= 128 ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'fx-spark';
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = pos.size * (0.55 + Math.random() * 0.45);
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.background = color;
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      fxLayer.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
    floatText(cx, pos.top, '+' + value, 'tile-score');
  }

  function floatText(x, y, text, kind) {
    const el = document.createElement('div');
    el.className = 'fx-text ' + (kind || '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    fxLayer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function confetti(n) {
    const w = boardEl.offsetWidth;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'fx-confetti';
      p.style.left = Math.random() * w + 'px';
      p.style.top = '-12px';
      p.style.background = CONFETTI[i % CONFETTI.length];
      p.style.setProperty('--dx', (Math.random() - 0.5) * 120 + 'px');
      p.style.setProperty('--dy', boardEl.offsetHeight * (0.7 + Math.random() * 0.5) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = Math.random() * 0.4 + 's';
      fxLayer.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
  }

  function scoreGrid(g) {
    let empty = 0, smooth = 0, mono = 0, max = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = g[r][c];
        if (!v) { empty++; continue; }
        const lv = Math.log2(v);
        max = Math.max(max, v);
        if (c < SIZE - 1 && g[r][c + 1]) smooth -= Math.abs(lv - Math.log2(g[r][c + 1]));
        if (r < SIZE - 1 && g[r + 1][c]) smooth -= Math.abs(lv - Math.log2(g[r + 1][c]));
      }
    }
    for (let r = 0; r < SIZE; r++) {
      let inc = 0, dec = 0;
      for (let c = 0; c < SIZE - 1; c++) {
        const a = g[r][c] ? Math.log2(g[r][c]) : 0, b = g[r][c + 1] ? Math.log2(g[r][c + 1]) : 0;
        if (a > b) dec += a - b; else inc += b - a;
      }
      mono -= Math.min(inc, dec);
    }
    for (let c = 0; c < SIZE; c++) {
      let inc = 0, dec = 0;
      for (let r = 0; r < SIZE - 1; r++) {
        const a = g[r][c] ? Math.log2(g[r][c]) : 0, b = g[r + 1][c] ? Math.log2(g[r + 1][c]) : 0;
        if (a > b) dec += a - b; else inc += b - a;
      }
      mono -= Math.min(inc, dec);
    }
    const corner = [g[0][0], g[0][SIZE - 1], g[SIZE - 1][0], g[SIZE - 1][SIZE - 1]].indexOf(max) >= 0 ? 1 : 0;
    return empty * 2.7 + smooth * 0.1 + mono * 1.0 + corner * 2;
  }

  function bestMove() {
    let best = null, bestScoreValue = -Infinity;
    for (const name of ['up', 'left', 'right', 'down']) {
      const res = slide(grid, DIRS[name]);
      if (!res.moved) continue;
      const empties = [];
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!res.grid[r][c]) empties.push([r, c]);
      let total = 0;
      const sample = empties.slice(0, 6);
      for (const [r, c] of sample) {
        res.grid[r][c] = 2;
        total += scoreGrid(res.grid) * 0.9;
        res.grid[r][c] = 4;
        total += scoreGrid(res.grid) * 0.1;
        res.grid[r][c] = 0;
      }
      const value = (sample.length ? total / sample.length : scoreGrid(res.grid)) + res.gained * 0.004;
      if (value > bestScoreValue) { bestScoreValue = value; best = name; }
    }
    return best;
  }

  let hintTimer = null;
  function showHint() {
    if (!gameActive || moving) return;
    const dir = bestMove();
    if (!dir) return;
    clearHint();
    const arrow = document.createElement('div');
    arrow.className = 'hint-arrow hint-' + dir;
    arrow.textContent = { up: '\u2191', down: '\u2193', left: '\u2190', right: '\u2192' }[dir];
    arrow.id = 'hint-arrow';
    fxLayer.appendChild(arrow);
    Sound.sfx('hint');
    hintTimer = setTimeout(clearHint, 1600);
    return dir;
  }

  function clearHint() {
    clearTimeout(hintTimer);
    const old = document.getElementById('hint-arrow');
    if (old) old.remove();
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
        timerBarTrack.classList.toggle('urgent', countdownSeconds <= 10);
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
    if (gameActive && moveCount > 0 && window.GamePlatform) {
      GamePlatform.recordGame('2048', score, 0, { maxTile: highestTile, win: hasWon });
    }
    const mode = MODES[currentMode];
    SIZE = mode.size;

    // Reset state
    grid = emptyGrid();
    tiles = [];
    score = 0;
    hasWon = false;
    moving = false;
    queuedMove = null;
    moveCount = 0;
    highestTile = 0;
    undoStack = [];
    gameActive = true;
    celebratedBest = false;
    tileContainer.innerHTML = '';
    fxLayer.innerHTML = '';
    boardEl.classList.remove('is-over');
    timerBarTrack.classList.remove('urgent');
    gameOverOvl.classList.add('hidden');
    winOvl.classList.add('hidden');

    // Load best score for current mode
    loadBestScore();
    bestAtStart = bestScore;

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
    if (startOverlayEl && startOverlayEl.classList.contains('hidden')) {
      Sound.sfx('start');
      Sound.music.start();
    }
  }

  // ---- Mode switching (called from start overlay) ---------
  function startMode(mode) {
    if (MODES[mode]) {
      currentMode = mode;
    }
    ensureAudio();
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

  document.addEventListener('keydown', (e) => {
    // Undo: Ctrl+Z / Cmd+Z or U key
    if (((e.ctrlKey || e.metaKey) && e.key === 'z') ||
        ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.altKey && !e.metaKey)) {
      e.preventDefault();
      performUndo();
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'm' || e.key === 'M') {
      if (!e.repeat) toggleMusic();
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      if (!e.repeat) showHint();
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

  // ---- Touch / Swipe — scoped to game area only -----------
  let touchStartX = 0, touchStartY = 0;
  let touchStartedOnBoard = false;
  const boardContainer = document.querySelector('.board-container') || document.getElementById('grid-background')?.parentElement || document.body;

  boardContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartedOnBoard = true;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!touchStartedOnBoard) return;
    touchStartedOnBoard = false;
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

  // Prevent scrolling only on the game board, not the whole document
  boardContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // ---- Buttons --------------------------------------------
  newGameBtn.addEventListener('click', () => { ensureAudio(); newGame(); });
  gameOverBtn.addEventListener('click', newGame);
  winNewBtn.addEventListener('click', newGame);
  keepPlayBtn.addEventListener('click', () => {
    winOvl.classList.add('hidden');
  });
  undoBtn.addEventListener('click', performUndo);
  hintBtn.addEventListener('click', () => { ensureAudio(); showHint(); });

  // ---- Resize handler (reposition tiles) ------------------
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      tileContainer.classList.add('no-anim');
      tiles.forEach(t => updateTileEl(t.el, t));
      void tileContainer.offsetWidth;
      tileContainer.classList.remove('no-anim');
    }, 100);
  });

  function audioLoop() {
    Sound.update();
    requestAnimationFrame(audioLoop);
  }

  // ---- Boot -----------------------------------------------
  loadBestScore();
  buildGrid();
  bestScoreEl.textContent = bestScore;
  newGame();

  if (window.GamePlatform) {
    GamePlatform.initHeader('2048');
  }
  addMusicButton();
  requestAnimationFrame(audioLoop);
})();
