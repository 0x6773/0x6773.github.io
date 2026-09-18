// ============================================================
//  2048 Game — Pure JS
// ============================================================

(function () {
  'use strict';

  // ---- Constants ------------------------------------------
  const SIZE = 4;
  const STORAGE_BEST = '2048_best_score';

  // ---- DOM refs -------------------------------------------
  const gridBg        = document.getElementById('grid-background');
  const tileContainer = document.getElementById('tile-container');
  const scoreEl       = document.getElementById('score');
  const bestScoreEl   = document.getElementById('best-score');
  const newGameBtn    = document.getElementById('new-game-btn');
  const gameOverOvl   = document.getElementById('game-over-overlay');
  const gameOverBtn   = document.getElementById('game-over-btn');
  const winOvl        = document.getElementById('win-overlay');
  const keepPlayBtn   = document.getElementById('keep-playing-btn');
  const winNewBtn     = document.getElementById('win-new-game-btn');

  // ---- State ----------------------------------------------
  let grid        = [];   // 2‑D array of cell values (0 = empty)
  let tiles       = [];   // flat list of tile objects { id, row, col, value, el }
  let score       = 0;
  let bestScore   = parseInt(localStorage.getItem(STORAGE_BEST)) || 0;
  let moving      = false;
  let hasWon      = false; // shown the win dialog once?
  let tileIdSeq   = 0;

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
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      gridBg.appendChild(cell);
    }
  }

  // ---- Tile positioning helpers ----------------------------
  // Returns { left, top, size } in percent strings for a tile at (row, col)
  function tilePosition(row, col) {
    // Each cell is 1/4 of the container, with gaps handled by padding+gap in CSS.
    // We compute positions relative to the tile-container (which has same padding
    // as the grid-background).
    const gap = getComputedGap();
    const containerWidth = tileContainer.offsetWidth;
    const totalGap = gap * (SIZE + 1); // padding on both sides + inner gaps
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

  // ---- Movement -------------------------------------------
  // direction: { dr, dc } — unit vector of movement
  // We iterate in the direction of movement so tiles merge correctly.

  function move(dir) {
    if (moving) return;

    const { dr, dc } = dir;
    let moved = false;
    let mergeScore = 0;
    const mergedPositions = []; // tiles that resulted from a merge

    // Build traversal order
    const rows = [...Array(SIZE).keys()];
    const cols = [...Array(SIZE).keys()];
    if (dr === 1) rows.reverse();
    if (dc === 1) cols.reverse();

    // merged flags — each cell can only merge once per move
    const merged = emptyGrid();

    for (const r of rows) {
      for (const c of cols) {
        if (grid[r][c] === 0) continue;

        let cr = r, cc = c;
        // Slide as far as possible
        while (true) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
          if (grid[nr][nc] === 0) {
            // move into empty cell
            grid[nr][nc] = grid[cr][cc];
            grid[cr][cc] = 0;
            cr = nr;
            cc = nc;
            moved = true;
          } else if (grid[nr][nc] === grid[cr][cc] && !merged[nr][nc]) {
            // merge
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

        // Update tile object position
        const tile = tiles.find(t => t.row === r && t.col === c);
        if (tile && (cr !== r || cc !== c)) {
          tile.row = cr;
          tile.col = cc;
          tile.value = grid[cr][cc];
        }
      }
    }

    if (!moved) return;

    moving = true;
    sfxSlide();

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

      // Spawn new tile
      spawnTile();

      // Check win
      if (!hasWon && tiles.some(t => t.value === 2048)) {
        hasWon = true;
        sfxWin();
        winOvl.classList.remove('hidden');
        moving = false;
        return;
      }

      // Check game over
      if (isGameOver()) {
        sfxGameOver();
        gameOverOvl.classList.remove('hidden');
      }

      moving = false;
    }, 160);
  }

  // Rebuild tile elements from the grid state
  function reconcileTiles(mergedPositions) {
    // Remove all tile elements
    tileContainer.innerHTML = '';
    tiles = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) continue;
        const tile = { id: tileIdSeq++, row: r, col: c, value: grid[r][c] };
        const el = createTileEl(tile);

        // Check if this was a merge target
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

  // ---- Score display --------------------------------------
  function updateScoreDisplay() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(STORAGE_BEST, bestScore);
    }
    bestScoreEl.textContent = bestScore;
  }

  function showScorePop(val) {
    const scoreBox = scoreEl.parentElement;
    const pop = document.createElement('span');
    pop.className = 'score-pop';
    pop.textContent = '+' + val;
    scoreBox.style.position = 'relative';
    scoreBox.appendChild(pop);
    pop.addEventListener('animationend', () => pop.remove());
  }

  // ---- Init / New Game ------------------------------------
  function newGame() {
    grid = emptyGrid();
    tiles = [];
    score = 0;
    hasWon = false;
    moving = false;
    tileContainer.innerHTML = '';
    gameOverOvl.classList.add('hidden');
    winOvl.classList.add('hidden');
    updateScoreDisplay();
    spawnTile();
    spawnTile();
  }

  // ---- Input handling -------------------------------------
  const DIRS = {
    up:    { dr: -1, dc:  0 },
    down:  { dr:  1, dc:  0 },
    left:  { dr:  0, dc: -1 },
    right: { dr:  0, dc:  1 },
  };

  document.addEventListener('keydown', (e) => {
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

  // ---- Resize handler (reposition tiles) ------------------
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      tiles.forEach(t => updateTileEl(t.el, t));
    }, 100);
  });

  // ---- Boot -----------------------------------------------
  buildGrid();
  bestScoreEl.textContent = bestScore;
  newGame();
})();
