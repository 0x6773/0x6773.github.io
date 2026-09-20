// ─── Minesweeper Game ───────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Constants ──
  const DIFFICULTIES = {
    easy:   { rows: 9,  cols: 9,  mines: 10  },
    medium: { rows: 16, cols: 16, mines: 40  },
    hard:   { rows: 16, cols: 30, mines: 99  },
    custom: { rows: 16, cols: 16, mines: 40  },
  };

  const NUM_COLORS = {
    1: 'num-1', 2: 'num-2', 3: 'num-3', 4: 'num-4',
    5: 'num-5', 6: 'num-6', 7: 'num-7', 8: 'num-8',
  };

  // ── State ──
  let difficulty = 'easy';
  let rows, cols, totalMines;
  let grid;            // 2D: { mine, revealed, flagged, adjacentMines }
  let cellElements;    // 2D DOM references
  let minesGenerated = false;
  let gameOver = false;
  let flagCount = 0;
  let revealedCount = 0;
  let timerStart = 0;
  let timerRunning = false;
  let timerDisplayInterval = null;
  let finalElapsed = 0;
  let longPressTimer = null;
  let gameGeneration = 0;

  // ── DOM ──
  const boardEl       = document.getElementById('board');
  const mineCountEl   = document.getElementById('mine-count');
  const timerEl       = document.getElementById('timer');
  const overlayEl     = document.getElementById('overlay');
  const overlayTitle  = document.getElementById('overlay-title');
  const overlayStats  = document.getElementById('overlay-stats');
  const highScoreSec  = document.getElementById('high-scores-section');
  const highScoreList = document.getElementById('high-scores-list');
  const playAgainBtn  = document.getElementById('play-again-btn');
  const diffBtns      = document.querySelectorAll('.diff-btn');

  // ── Audio Engine (Web Audio API) ──
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type, volume, ramp) {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume || 0.15, ctx.currentTime);
      if (ramp !== false) {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) { /* audio not supported */ }
  }

  function playNoise(duration, volume) {
    try {
      const ctx = getAudioCtx();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime);
    } catch (e) { /* audio not supported */ }
  }

  const Sound = {
    reveal() {
      playTone(600 + Math.random() * 200, 0.08, 'sine', 0.08);
    },
    flag() {
      playTone(880, 0.06, 'square', 0.06);
      setTimeout(() => playTone(1100, 0.08, 'square', 0.05), 60);
    },
    unflag() {
      playTone(1100, 0.06, 'square', 0.05);
      setTimeout(() => playTone(880, 0.08, 'square', 0.06), 60);
    },
    explosion() {
      playNoise(0.6, 0.35);
      playTone(80, 0.5, 'sawtooth', 0.2);
      setTimeout(() => playTone(40, 0.4, 'sawtooth', 0.15), 100);
    },
    chord() {
      playTone(700, 0.06, 'sine', 0.07);
      setTimeout(() => playTone(900, 0.08, 'sine', 0.06), 40);
    },
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.25, 'sine', 0.12), i * 150);
      });
      setTimeout(() => playTone(1047, 0.5, 'triangle', 0.1), 600);
    },
  };

  // ── Timer (performance.now based) ──
  function startTimer() {
    if (timerRunning) return;
    timerStart = performance.now();
    timerRunning = true;
    updateTimerDisplay();
    timerDisplayInterval = setInterval(updateTimerDisplay, 200);
  }

  function stopTimer() {
    if (timerRunning) {
      finalElapsed = getElapsedSeconds();
    }
    timerRunning = false;
    if (timerDisplayInterval) {
      clearInterval(timerDisplayInterval);
      timerDisplayInterval = null;
    }
  }

  function getElapsedSeconds() {
    if (!timerRunning || !timerStart) return 0;
    return Math.floor((performance.now() - timerStart) / 1000);
  }

  function updateTimerDisplay() {
    const secs = timerRunning ? getElapsedSeconds() : 0;
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }

  function updateMineCounter() {
    const remaining = totalMines - flagCount;
    mineCountEl.textContent = String(Math.max(remaining, 0)).padStart(3, '0');
    if (remaining < 0) {
      mineCountEl.textContent = '-' + String(Math.abs(remaining)).padStart(2, '0');
    }
  }

  // ── High Scores ──
  function getHighScores(diff) {
    try {
      const data = localStorage.getItem(`minesweeper_scores_${diff}`);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  function saveHighScore(diff, time) {
    const scores = getHighScores(diff);
    scores.push(time);
    scores.sort((a, b) => a - b);
    const top5 = scores.slice(0, 5);
    try {
      localStorage.setItem(`minesweeper_scores_${diff}`, JSON.stringify(top5));
    } catch (e) { /* storage full */ }
    return top5;
  }

  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Board Initialization ──
  function initGame() {
    stopTimer();
    gameGeneration++;
    gameOver = false;
    minesGenerated = false;
    flagCount = 0;
    revealedCount = 0;
    timerStart = 0;
    finalElapsed = 0;
    timerEl.textContent = '00:00';
    overlayEl.classList.add('hidden');

    const config = DIFFICULTIES[difficulty];
    rows = config.rows;
    cols = config.cols;
    totalMines = config.mines;
    updateMineCounter();

    // Dynamic cell sizing for larger boards
    const maxWidth = Math.min(window.innerWidth - 40, 600);
    const cellSize = Math.max(20, Math.min(36, Math.floor(maxWidth / cols)));

    // Build grid data
    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { mine: false, revealed: false, flagged: false, adjacentMines: 0 };
      }
    }

    // Build DOM
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

    cellElements = [];
    for (let r = 0; r < rows; r++) {
      cellElements[r] = [];
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell cell-unrevealed';
        cell.style.width = cellSize + 'px';
        cell.style.height = cellSize + 'px';
        cell.style.fontSize = Math.max(10, cellSize * 0.4) + 'px';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Desktop events
        cell.addEventListener('click', onCellClick);
        cell.addEventListener('contextmenu', onCellRightClick);

        // Mobile long-press
        cell.addEventListener('touchstart', onTouchStart, { passive: false });
        cell.addEventListener('touchend', onTouchEnd);
        cell.addEventListener('touchmove', onTouchCancel);
        cell.addEventListener('touchcancel', onTouchCancel);

        boardEl.appendChild(cell);
        cellElements[r][c] = cell;
      }
    }
  }

  // ── Mine Generation (after first click) ──
  function generateMines(safeRow, safeCol) {
    const safeCells = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr;
        const nc = safeCol + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          safeCells.add(nr * cols + nc);
        }
      }
    }

    let placed = 0;
    while (placed < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      const idx = r * cols + c;
      if (!grid[r][c].mine && !safeCells.has(idx)) {
        grid[r][c].mine = true;
        placed++;
      }
    }

    // Calculate adjacency numbers
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let count = 0;
        forEachNeighbor(r, c, (nr, nc) => {
          if (grid[nr][nc].mine) count++;
        });
        grid[r][c].adjacentMines = count;
      }
    }

    minesGenerated = true;
  }

  // ── Helpers ──
  function forEachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          fn(nr, nc);
        }
      }
    }
  }

  // ── Reveal Logic ──
  function revealCell(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged || gameOver) return;

    cell.revealed = true;
    revealedCount++;
    const el = cellElements[r][c];
    el.className = 'cell cell-revealed';

    if (cell.mine) {
      el.classList.add('cell-mine', 'cell-mine-exploded');
      el.textContent = '\u{1F4A5}';
      handleLoss(r, c);
      return;
    }

    if (cell.adjacentMines > 0) {
      el.textContent = cell.adjacentMines;
      el.classList.add(NUM_COLORS[cell.adjacentMines]);
    }

    Sound.reveal();

    // Flood fill for empty cells
    if (cell.adjacentMines === 0) {
      forEachNeighbor(r, c, (nr, nc) => {
        if (!grid[nr][nc].revealed && !grid[nr][nc].flagged) {
          revealCell(nr, nc);
        }
      });
    }

    // Check win
    if (revealedCount === rows * cols - totalMines) {
      handleWin();
    }
  }

  // ── Flag Logic ──
  function toggleFlag(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || gameOver) return;

    cell.flagged = !cell.flagged;
    const el = cellElements[r][c];

    if (cell.flagged) {
      el.className = 'cell cell-flagged';
      el.textContent = '';
      flagCount++;
      Sound.flag();
    } else {
      el.className = 'cell cell-unrevealed';
      flagCount--;
      Sound.unflag();
    }
    updateMineCounter();
  }

  // ── Chord Flash Style ──
  (function injectChordStyle() {
    const style = document.createElement('style');
    style.textContent =
      '.cell-chord-flash{background:rgba(255,255,150,0.6)!important;' +
      'transform:scale(1.08);transition:background .1s ease,transform .1s ease;}';
    document.head.appendChild(style);
  })();

  // ── Chording (auto-reveal) ──
  function chordCell(r, c) {
    const cell = grid[r][c];
    if (!cell.revealed || cell.adjacentMines === 0 || gameOver) return;

    // Count flagged neighbors
    let adjFlags = 0;
    forEachNeighbor(r, c, (nr, nc) => {
      if (grid[nr][nc].flagged) adjFlags++;
    });

    if (adjFlags !== cell.adjacentMines) return;

    // Collect non-flagged, non-revealed neighbors to chord-reveal
    const toReveal = [];
    forEachNeighbor(r, c, (nr, nc) => {
      if (!grid[nr][nc].revealed && !grid[nr][nc].flagged) {
        toReveal.push([nr, nc]);
      }
    });

    if (toReveal.length === 0) return;

    // Visual feedback: brief highlight flash
    toReveal.forEach(([nr, nc]) => {
      cellElements[nr][nc].classList.add('cell-chord-flash');
    });

    Sound.chord();

    // Reveal after brief flash
    const gen = gameGeneration;
    setTimeout(() => {
      if (gen !== gameGeneration) return; // game was reset; discard stale reveal
      toReveal.forEach(([nr, nc]) => {
        cellElements[nr][nc].classList.remove('cell-chord-flash');
        revealCell(nr, nc);
      });
    }, 100);
  }

  // ── Event Handlers ──
  function getCellCoords(e) {
    const el = e.target.closest('.cell');
    if (!el) return null;
    return { r: parseInt(el.dataset.row), c: parseInt(el.dataset.col) };
  }

  function onCellClick(e) {
    e.preventDefault();
    const coords = getCellCoords(e);
    if (!coords) return;
    const { r, c } = coords;

    if (gameOver || grid[r][c].flagged) return;

    // Chording: click on an already-revealed number cell
    if (grid[r][c].revealed) {
      chordCell(r, c);
      return;
    }

    if (!minesGenerated) {
      generateMines(r, c);
      startTimer();
    }

    revealCell(r, c);
  }

  function onCellRightClick(e) {
    e.preventDefault();
    const coords = getCellCoords(e);
    if (!coords) return;
    const { r, c } = coords;

    if (!minesGenerated) {
      // allow flagging before first reveal but don't start timer/generate
      toggleFlag(r, c);
      return;
    }

    toggleFlag(r, c);
  }

  // Mobile long-press
  let touchStartCoords = null;
  let longPressHandled = false; // blocks click after long-press flag

  function onTouchStart(e) {
    const coords = getCellCoords(e);
    if (!coords) return;
    e.preventDefault(); // prevent text selection and default touch behavior
    touchStartCoords = coords;
    longPressHandled = false;
    longPressTimer = setTimeout(() => {
      if (touchStartCoords) {
        toggleFlag(touchStartCoords.r, touchStartCoords.c);
        longPressHandled = true;
        touchStartCoords = null;
      }
    }, 400);
  }

  function onTouchEnd(e) {
    clearTimeout(longPressTimer);
    e.preventDefault(); // prevent synthetic click from firing
    if (longPressHandled) {
      longPressHandled = false;
      touchStartCoords = null;
      return; // was a long-press flag, don't do anything else
    }
    // Short tap: treat as a click/reveal
    if (touchStartCoords) {
      const { r, c } = touchStartCoords;
      touchStartCoords = null;
      if (gameOver || grid[r][c].flagged) return;
      if (grid[r][c].revealed) { chordCell(r, c); return; }
      if (!minesGenerated) { generateMines(r, c); startTimer(); }
      revealCell(r, c);
    }
  }

  function onTouchCancel() {
    clearTimeout(longPressTimer);
    touchStartCoords = null;
    longPressHandled = false;
  }

  // ── Game Over ──
  function handleLoss(hitR, hitC) {
    gameOver = true;
    stopTimer();
    Sound.explosion();

    // Reveal all mines, show wrong flags
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const el = cellElements[r][c];

        if (cell.mine && !cell.revealed && !cell.flagged) {
          el.className = 'cell cell-revealed cell-mine';
          el.textContent = '\u{1F4A3}';
        }

        if (cell.flagged && !cell.mine) {
          el.className = 'cell cell-revealed cell-wrong-flag';
          el.textContent = '\u2716';
        }
      }
    }

    if (window.GamePlatform) {
      GamePlatform.recordGame('minesweeper', revealedCount, finalElapsed * 1000, { win: false });
    }

    // Show overlay after brief delay
    setTimeout(() => {
      showOverlay(false);
    }, 800);
  }

  function handleWin() {
    gameOver = true;
    stopTimer();
    Sound.win();

    // Auto-flag remaining mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine && !grid[r][c].flagged) {
          grid[r][c].flagged = true;
          flagCount++;
          cellElements[r][c].className = 'cell cell-flagged';
          cellElements[r][c].textContent = '';
        }
      }
    }
    updateMineCounter();

    if (window.GamePlatform) {
      GamePlatform.recordGame('minesweeper', revealedCount, finalElapsed * 1000, { win: true });
    }

    setTimeout(() => {
      showOverlay(true);
    }, 600);
  }

  // ── Overlay ──
  function showOverlay(won) {
    overlayEl.classList.remove('hidden');

    if (won) {
      overlayTitle.textContent = 'You Win!';
      overlayTitle.className = 'win';
      const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      overlayStats.innerHTML =
        `<p>Difficulty: <span>${diffLabel}</span></p>` +
        `<p>Time: <span>${formatTime(finalElapsed)}</span></p>` +
        `<p>Mines: <span>${totalMines}</span></p>`;

      // Save & show high scores
      const scores = saveHighScore(difficulty, finalElapsed);
      highScoreSec.classList.remove('hidden');
      highScoreList.innerHTML = '';
      scores.forEach((s) => {
        const li = document.createElement('li');
        li.textContent = formatTime(s);
        if (s === finalElapsed) {
          li.classList.add('new-score');
        }
        highScoreList.appendChild(li);
      });
    } else {
      overlayTitle.textContent = 'Game Over';
      overlayTitle.className = 'lose';
      overlayStats.innerHTML =
        `<p>Time: <span>${formatTime(finalElapsed)}</span></p>` +
        `<p>Cells revealed: <span>${revealedCount - 1}</span> / <span>${rows * cols - totalMines}</span></p>`;

      // Show high scores if any exist
      const scores = getHighScores(difficulty);
      if (scores.length > 0) {
        highScoreSec.classList.remove('hidden');
        highScoreList.innerHTML = '';
        scores.forEach((s) => {
          const li = document.createElement('li');
          li.textContent = formatTime(s);
          highScoreList.appendChild(li);
        });
      } else {
        highScoreSec.classList.add('hidden');
      }
    }
  }

  // ── Custom Config ──
  const customConfigEl = document.getElementById('custom-config');
  const customRowsEl   = document.getElementById('custom-rows');
  const customColsEl   = document.getElementById('custom-cols');
  const customMinesEl  = document.getElementById('custom-mines');
  const customApplyBtn = document.getElementById('custom-apply');

  function validateCustomMines(r, c, m) {
    const maxMines = r * c - 9;
    return Math.min(m, Math.max(1, maxMines));
  }

  function applyCustomConfig() {
    let r = parseInt(customRowsEl.value, 10) || 16;
    let c = parseInt(customColsEl.value, 10) || 16;
    let m = parseInt(customMinesEl.value, 10) || 40;

    // Clamp rows and cols
    r = Math.max(5, Math.min(30, r));
    c = Math.max(5, Math.min(30, c));
    // Validate mines
    m = validateCustomMines(r, c, m);

    // Update inputs to show adjusted values
    customRowsEl.value = r;
    customColsEl.value = c;
    customMinesEl.value = m;

    DIFFICULTIES.custom.rows = r;
    DIFFICULTIES.custom.cols = c;
    DIFFICULTIES.custom.mines = m;

    difficulty = 'custom';
    initGame();
  }

  customApplyBtn.addEventListener('click', applyCustomConfig);

  // ── UI Bindings ──
  diffBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      diffBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.difficulty;

      if (difficulty === 'custom') {
        // Show custom config and pre-fill with current values
        customConfigEl.classList.remove('hidden');
        customRowsEl.value = DIFFICULTIES.custom.rows;
        customColsEl.value = DIFFICULTIES.custom.cols;
        customMinesEl.value = DIFFICULTIES.custom.mines;
      } else {
        customConfigEl.classList.add('hidden');
      }

      initGame();
    });
  });

  playAgainBtn.addEventListener('click', () => {
    initGame();
  });

  // Prevent context menu on board
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── Resize / Orientation Handler ──
  function resizeBoard() {
    if (!cellElements || !cellElements.length) return;
    const maxWidth = Math.min(window.innerWidth - 40, 600);
    const cellSize = Math.max(20, Math.min(36, Math.floor(maxWidth / cols)));
    boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
    const fontSize = Math.max(10, cellSize * 0.4) + 'px';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = cellElements[r][c];
        el.style.width = cellSize + 'px';
        el.style.height = cellSize + 'px';
        el.style.fontSize = fontSize;
      }
    }
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeBoard, 100);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // ── Init ──
  initGame();

  if (window.GamePlatform) {
    GamePlatform.initHeader('Minesweeper');
  }
})();
