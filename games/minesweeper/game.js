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
  let finalElapsedMs = 0;
  let longPressTimer = null;
  let gameGeneration = 0;
  let flagMode = false;
  let hintsUsed = 0;

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
  const flagModeBtn   = document.getElementById('flag-mode-btn');
  const hintBtn       = document.getElementById('hint-btn');
  const fxLayer       = document.getElementById('fx-layer');
  const Synth         = window.MinesAudio;

  // ── Audio Engine (Web Audio API) ──
  const Sound = {
    reveal(n) { Synth.sfx('reveal', n || 1); },
    flag() { Synth.sfx('flag'); },
    unflag() { Synth.sfx('unflag'); },
    explosion() { Synth.sfx('boom'); },
    chord() { Synth.sfx('chord'); },
    win() { Synth.sfx('win'); },
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
      finalElapsedMs = performance.now() - timerStart;
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
    hintsUsed = 0;
    fxLayer.innerHTML = '';
    boardEl.classList.remove('shake', 'won');
    minesGenerated = false;
    flagCount = 0;
    revealedCount = 0;
    timerStart = 0;
    finalElapsed = 0;
    finalElapsedMs = 0;
    timerEl.textContent = '00:00';
    overlayEl.classList.add('hidden');

    const config = DIFFICULTIES[difficulty];
    rows = config.rows;
    cols = config.cols;
    totalMines = config.mines;
    updateMineCounter();

    // Dynamic cell sizing for larger boards
    const cellSize = computeCellSize();

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
  function renderRevealed(r, c, delay) {
    const cell = grid[r][c];
    const el = cellElements[r][c];
    el.className = 'cell cell-revealed';
    el.textContent = '';
    if (cell.adjacentMines > 0) {
      el.textContent = cell.adjacentMines;
      el.classList.add(NUM_COLORS[cell.adjacentMines]);
    }
    el.style.animationDelay = delay ? delay + 'ms' : '';
  }

  function revealCell(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged || gameOver) return;

    cell.revealed = true;
    revealedCount++;
    const el = cellElements[r][c];

    if (cell.mine) {
      el.className = 'cell cell-revealed cell-mine cell-mine-exploded';
      el.textContent = '';
      handleLoss(r, c);
      return;
    }

    // Flood fill for empty cells
    const order = [[r, c, 0]];
    for (let i = 0; i < order.length; i++) {
      const [cr, cc, d] = order[i];
      if (grid[cr][cc].adjacentMines !== 0) continue;
      forEachNeighbor(cr, cc, (nr, nc) => {
        const n = grid[nr][nc];
        if (!n.revealed && !n.flagged && !n.mine) {
          n.revealed = true;
          revealedCount++;
          order.push([nr, nc, d + 1]);
        }
      });
    }
    let lastDelay = 0;
    for (const [cr, cc, d] of order) {
      const delay = Math.min(d * 24, 700);
      lastDelay = Math.max(lastDelay, delay);
      renderRevealed(cr, cc, delay);
    }

    Sound.reveal(order.length);

    // Check win
    if (revealedCount === rows * cols - totalMines) {
      handleWin(lastDelay);
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

    if (gameOver) return;
    if (flagMode && !grid[r][c].revealed) {
      toggleFlag(r, c);
      return;
    }
    if (grid[r][c].flagged) return;

    // Chording: click on an already-revealed number cell
    if (grid[r][c].revealed) {
      chordCell(r, c);
      return;
    }

    if (!minesGenerated) {
      generateMines(r, c);
      startTimer();
      Synth.sfx('start');
      Synth.music.start();
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
      if (gameOver) return;
      if (flagMode && !grid[r][c].revealed) { toggleFlag(r, c); return; }
      if (grid[r][c].flagged) return;
      if (grid[r][c].revealed) { chordCell(r, c); return; }
      if (!minesGenerated) { generateMines(r, c); startTimer(); Synth.sfx('start'); Synth.music.start(); }
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
    Synth.music.stop();
    boardEl.classList.add('shake');
    flashBoard();

    // Reveal all mines, show wrong flags
    const mines = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const el = cellElements[r][c];

        if (cell.mine && !cell.revealed && !cell.flagged) mines.push([r, c, Math.hypot(r - hitR, c - hitC)]);

        if (cell.flagged && !cell.mine) {
          el.className = 'cell cell-revealed cell-wrong-flag';
          el.textContent = '\u2716';
        }
      }
    }
    mines.sort((a, b) => a[2] - b[2]);
    const step = Math.min(70, 1400 / Math.max(1, mines.length));
    const gen = gameGeneration;
    mines.forEach(([r, c], i) => {
      setTimeout(() => {
        if (gen !== gameGeneration) return;
        cellElements[r][c].className = 'cell cell-revealed cell-mine cell-mine-chain';
        if (i % 3 === 0) Synth.sfx('pop');
      }, 150 + i * step);
    });

    if (window.GamePlatform) {
      GamePlatform.recordGame('minesweeper', 0, finalElapsedMs, { win: false, difficulty: difficulty });
    }

    // Show overlay after brief delay
    setTimeout(() => {
      if (gen !== gameGeneration) return;
      showOverlay(false);
    }, 900 + mines.length * step);
  }

  function handleWin(delay) {
    gameOver = true;
    stopTimer();
    Synth.music.stop();
    const gen = gameGeneration;
    setTimeout(() => {
      if (gen !== gameGeneration) return;
      Sound.win();
      boardEl.classList.add('won');
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const el = cellElements[r][c];
          if (grid[r][c].revealed) el.style.animationDelay = ((r + c) * 18) + 'ms';
        }
      }
      confetti(70);
    }, delay || 0);

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
      GamePlatform.recordGame('minesweeper', 0, finalElapsedMs, { win: true, timeMs: finalElapsedMs, difficulty: difficulty });
    }

    setTimeout(() => {
      if (gen !== gameGeneration) return;
      showOverlay(true);
    }, (delay || 0) + 1100);
  }

  function flashBoard() {
    const f = document.createElement('div');
    f.className = 'fx-flash';
    fxLayer.appendChild(f);
    f.addEventListener('animationend', () => f.remove());
  }

  function confetti(n) {
    const colors = ['#4a9eff', '#2ed573', '#ffa502', '#ff4757', '#a55eea', '#18dcff'];
    const w = boardEl.offsetWidth, h = boardEl.offsetHeight;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'fx-confetti';
      p.style.left = Math.random() * w + 'px';
      p.style.top = '-10px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() - 0.5) * 140 + 'px');
      p.style.setProperty('--dy', h * (0.8 + Math.random() * 0.4) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = Math.random() * 0.5 + 's';
      fxLayer.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
  }

  function findSafeCell() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (!cell.revealed || cell.adjacentMines === 0) continue;
        let flags = 0;
        const hidden = [];
        forEachNeighbor(r, c, (nr, nc) => {
          const n = grid[nr][nc];
          if (n.flagged) flags++;
          else if (!n.revealed) hidden.push([nr, nc]);
        });
        if (hidden.length && flags === cell.adjacentMines) {
          const safe = hidden.find(([nr, nc]) => !grid[nr][nc].mine);
          if (safe) return { cell: safe, deduced: true };
        }
      }
    }
    const frontier = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.revealed || cell.flagged || cell.mine) continue;
        let touches = false;
        forEachNeighbor(r, c, (nr, nc) => { if (grid[nr][nc].revealed) touches = true; });
        if (touches) frontier.push([r, c]);
      }
    }
    if (frontier.length) return { cell: frontier[Math.floor(Math.random() * frontier.length)], deduced: false };
    return null;
  }

  function useHint() {
    if (gameOver || !minesGenerated) {
      Synth.sfx('deny');
      return;
    }
    const found = findSafeCell();
    if (!found) return;
    hintsUsed++;
    const [r, c] = found.cell;
    if (!found.deduced) timerStart -= 10000;
    Synth.sfx('hint');
    const el = cellElements[r][c];
    el.classList.add('cell-hint');
    const gen = gameGeneration;
    setTimeout(() => {
      if (gen !== gameGeneration) return;
      el.classList.remove('cell-hint');
      revealCell(r, c);
    }, 450);
  }

  function setFlagMode(on) {
    flagMode = on;
    flagModeBtn.classList.toggle('active', flagMode);
    flagModeBtn.setAttribute('aria-pressed', String(flagMode));
    flagModeBtn.title = flagMode ? 'Tap places flags (F)' : 'Tap reveals cells (F)';
    Synth.sfx('mode', flagMode);
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
        `<p>Mines: <span>${totalMines}</span></p>` +
        (hintsUsed ? `<p>Hints used: <span>${hintsUsed}</span></p>` : '');

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

  flagModeBtn.addEventListener('click', () => setFlagMode(!flagMode));
  hintBtn.addEventListener('click', useHint);

  function syncMusicButton() {
    const btn = document.querySelector('#gp-header .gp-btn-music');
    if (!btn) return;
    const on = Synth.music.isEnabled();
    btn.classList.toggle('off', !on);
    btn.title = on ? 'Music on (M)' : 'Music off (M)';
    btn.setAttribute('aria-pressed', String(on));
  }

  function toggleMusic() {
    Synth.music.setEnabled(!Synth.music.isEnabled());
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
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'm' || e.key === 'M') toggleMusic();
    else if (e.key === 'f' || e.key === 'F') setFlagMode(!flagMode);
    else if (e.key === 'h' || e.key === 'H') useHint();
  });

  function audioLoop() {
    Synth.update();
    requestAnimationFrame(audioLoop);
  }

  // Prevent context menu on board
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── Resize / Orientation Handler ──
  function computeCellSize() {
    const app = document.getElementById('app');
    const hud = document.getElementById('hud');
    const header = document.getElementById('gp-header');
    const sideBySide = !!app && getComputedStyle(app).flexDirection === 'row';
    const hudW = sideBySide && hud ? hud.offsetWidth + 12 : 0;
    const hudH = !sideBySide && hud ? hud.offsetHeight + 12 : 0;
    const headerH = header ? header.offsetHeight : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gp-header-h')) || 0);
    const availW = Math.min(window.innerWidth - 40 - hudW, 860);
    const availH = window.innerHeight - headerH - hudH - 36;
    const minSize = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 26 : 20;
    const maxSize = minSize === 26 && Math.min(window.innerWidth, window.innerHeight) >= 700 ? 46 : 36;
    const fit = Math.floor(Math.min(availW / cols, availH / rows)) - 2;
    return Math.max(minSize, Math.min(maxSize, fit));
  }

  function resizeBoard() {
    if (!cellElements || !cellElements.length) return;
    const cellSize = computeCellSize();
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
  addMusicButton();
  requestAnimationFrame(audioLoop);
})();
