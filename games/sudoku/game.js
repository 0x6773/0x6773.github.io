// ─── Sudoku Game ─────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Constants ──
  const DIFFICULTY_CONFIG = {
    easy:   { clues: 42, label: 'Easy' },
    medium: { clues: 32, label: 'Medium' },
    hard:   { clues: 26, label: 'Hard' },
  };

  const MAX_HINTS = 3;
  const MAX_UNDO = 10;

  // ── State ──
  let difficulty = 'easy';
  let solution = [];      // 9x9 completed grid
  let puzzle = [];         // 9x9 initial puzzle (0 = empty)
  let board = [];          // 9x9 current player state
  let pencilMarks = [];    // 9x9 arrays of Sets
  let givenCells = [];     // 9x9 booleans
  let selectedRow = -1;
  let selectedCol = -1;
  let pencilMode = false;
  let hintsRemaining = MAX_HINTS;
  let undoStack = [];
  let gameOver = false;
  let gameStarted = false;

  // Timer state
  let timerStart = 0;
  let timerRunning = false;
  let timerDisplayInterval = null;
  let timerPausedElapsed = 0;
  let timerPausedAt = 0;

  // ── DOM ──
  const boardEl = document.getElementById('board');
  const timerEl = document.getElementById('timer');
  const diffBtns = document.querySelectorAll('.diff-btn');
  const pencilBtn = document.getElementById('btn-pencil');
  const eraseBtn = document.getElementById('btn-erase');
  const hintBtn = document.getElementById('btn-hint');
  const undoBtn = document.getElementById('btn-undo');
  const newGameBtn = document.getElementById('btn-new-game');
  const numBtns = document.querySelectorAll('.num-btn');
  const winOverlay = document.getElementById('win-overlay');
  const winTitle = document.getElementById('win-title');
  const winStats = document.getElementById('win-stats');
  const bestTimesSection = document.getElementById('best-times-section');
  const bestTimesList = document.getElementById('best-times-list');
  const playAgainBtn = document.getElementById('play-again-btn');
  const bestTimeDisplay = document.getElementById('best-time-display');

  let cellElements = []; // 9x9 DOM references

  // ── Audio Engine (Web Audio API) ──
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function isMuted() {
    return window.GamePlatform && GamePlatform.isMuted();
  }

  function playTone(freq, duration, type, volume) {
    if (isMuted()) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume || 0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) { /* audio not supported */ }
  }

  const Sound = {
    place() {
      playTone(520 + Math.random() * 100, 0.1, 'sine', 0.08);
    },
    error() {
      playTone(200, 0.15, 'square', 0.1);
      setTimeout(() => playTone(160, 0.2, 'square', 0.08), 100);
    },
    hint() {
      playTone(800, 0.08, 'sine', 0.08);
      setTimeout(() => playTone(1000, 0.1, 'sine', 0.07), 80);
    },
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.3, 'sine', 0.12), i * 150);
      });
      setTimeout(() => playTone(1047, 0.5, 'triangle', 0.1), 600);
    },
    erase() {
      playTone(400, 0.06, 'sine', 0.06);
    }
  };

  // ── Sudoku Generator ──

  // Fill diagonal 3x3 boxes (independent of each other)
  function fillDiagonalBoxes(grid) {
    for (let box = 0; box < 3; box++) {
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      let idx = 0;
      for (let r = box * 3; r < box * 3 + 3; r++) {
        for (let c = box * 3; c < box * 3 + 3; c++) {
          grid[r][c] = nums[idx++];
        }
      }
    }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isValidPlacement(grid, row, col, num) {
    // Check row
    for (let c = 0; c < 9; c++) {
      if (grid[row][c] === num) return false;
    }
    // Check column
    for (let r = 0; r < 9; r++) {
      if (grid[r][col] === num) return false;
    }
    // Check 3x3 box
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  }

  function solveSudoku(grid) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of nums) {
            if (isValidPlacement(grid, r, c, num)) {
              grid[r][c] = num;
              if (solveSudoku(grid)) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  // Count solutions (up to 2 for uniqueness check, with iteration cap)
  function countSolutions(grid, limit) {
    limit = limit || 2;
    let count = 0;
    let iterations = 0;
    const maxIterations = 50000;

    function solve() {
      if (count >= limit || iterations >= maxIterations) return;
      iterations++;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (grid[r][c] === 0) {
            for (let num = 1; num <= 9; num++) {
              if (isValidPlacement(grid, r, c, num)) {
                grid[r][c] = num;
                solve();
                grid[r][c] = 0;
                if (count >= limit || iterations >= maxIterations) return;
              }
            }
            return;
          }
        }
      }
      count++;
    }

    solve();
    return count;
  }

  function generatePuzzle(clueCount) {
    // Step 1: Create a valid completed grid
    const grid = createEmptyGrid();
    fillDiagonalBoxes(grid);
    solveSudoku(grid);

    // Save solution
    const sol = grid.map(row => row.slice());

    // Step 2: Remove cells
    const totalCells = 81;
    let toRemove = totalCells - clueCount;
    const positions = shuffle(
      Array.from({ length: 81 }, (_, i) => i)
    );

    for (const pos of positions) {
      if (toRemove <= 0) break;
      const r = Math.floor(pos / 9);
      const c = pos % 9;
      const backup = grid[r][c];
      grid[r][c] = 0;

      // Check uniqueness
      const testGrid = grid.map(row => row.slice());
      if (countSolutions(testGrid, 2) === 1) {
        toRemove--;
      } else {
        grid[r][c] = backup;
      }
    }

    return { puzzle: grid, solution: sol };
  }

  function createEmptyGrid() {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
  }

  // ── Timer ──
  function startTimer() {
    if (timerRunning) return;
    timerStart = performance.now();
    timerRunning = true;
    updateTimerDisplay();
    timerDisplayInterval = setInterval(updateTimerDisplay, 200);
  }

  function stopTimer() {
    if (timerRunning) {
      timerPausedElapsed += performance.now() - timerStart;
    }
    timerRunning = false;
    if (timerDisplayInterval) {
      clearInterval(timerDisplayInterval);
      timerDisplayInterval = null;
    }
  }

  function pauseTimer() {
    if (!timerRunning) return;
    timerPausedElapsed += performance.now() - timerStart;
    timerRunning = false;
    if (timerDisplayInterval) {
      clearInterval(timerDisplayInterval);
      timerDisplayInterval = null;
    }
  }

  function resumeTimer() {
    if (timerRunning || gameOver || !gameStarted) return;
    timerStart = performance.now();
    timerRunning = true;
    timerDisplayInterval = setInterval(updateTimerDisplay, 200);
  }

  function getElapsedMs() {
    let total = timerPausedElapsed;
    if (timerRunning) {
      total += performance.now() - timerStart;
    }
    return total;
  }

  function getElapsedSeconds() {
    return Math.floor(getElapsedMs() / 1000);
  }

  function updateTimerDisplay() {
    const secs = getElapsedSeconds();
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }

  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // Pause timer when tab is hidden
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  });

  // ── Best Times ──
  function getBestTimes(diff) {
    try {
      const data = localStorage.getItem(`sudoku_best_${diff}`);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  function saveBestTime(diff, seconds) {
    const times = getBestTimes(diff);
    times.push(seconds);
    times.sort((a, b) => a - b);
    const top5 = times.slice(0, 5);
    try {
      localStorage.setItem(`sudoku_best_${diff}`, JSON.stringify(top5));
    } catch (e) { /* storage full */ }
    return top5;
  }

  function showBestTime() {
    const times = getBestTimes(difficulty);
    if (times.length > 0) {
      bestTimeDisplay.innerHTML = `Best (${DIFFICULTY_CONFIG[difficulty].label}): <span>${formatTime(times[0])}</span>`;
    } else {
      bestTimeDisplay.innerHTML = '';
    }
  }

  // ── Board Initialization ──
  function initGame() {
    stopTimer();
    timerPausedElapsed = 0;
    timerEl.textContent = '00:00';
    gameOver = false;
    gameStarted = false;
    pencilMode = false;
    hintsRemaining = MAX_HINTS;
    undoStack = [];
    selectedRow = -1;
    selectedCol = -1;

    updatePencilBtn();
    updateHintBtn();
    winOverlay.classList.add('hidden');

    // Generate puzzle
    const config = DIFFICULTY_CONFIG[difficulty];
    const result = generatePuzzle(config.clues);
    solution = result.solution;
    puzzle = result.puzzle.map(row => row.slice());
    board = result.puzzle.map(row => row.slice());

    // Track given cells
    givenCells = Array.from({ length: 9 }, () => Array(9).fill(false));
    pencilMarks = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    );

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0) {
          givenCells[r][c] = true;
        }
      }
    }

    buildBoard();
    showBestTime();
    updateNumberCounts();

    // Only start timer if start overlay is already dismissed (i.e. not initial load)
    const startOverlay = document.getElementById('start-overlay');
    if (!startOverlay || startOverlay.classList.contains('hidden')) {
      gameStarted = true;
      startTimer();
    }
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    cellElements = [];

    for (let r = 0; r < 9; r++) {
      cellElements[r] = [];
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Box borders
        if (c % 3 === 2 && c < 8) cell.classList.add('box-right');
        if (r % 3 === 2 && r < 8) cell.classList.add('box-bottom');
        if (c % 3 === 0) cell.classList.add('box-left');
        if (r % 3 === 0) cell.classList.add('box-top');

        // Pencil marks container
        const pencilDiv = document.createElement('div');
        pencilDiv.className = 'pencil-marks';
        for (let n = 1; n <= 9; n++) {
          const mark = document.createElement('span');
          mark.className = 'pencil-mark';
          mark.dataset.num = n;
          pencilDiv.appendChild(mark);
        }
        cell.appendChild(pencilDiv);

        cell.addEventListener('click', onCellClick);
        boardEl.appendChild(cell);
        cellElements[r][c] = cell;
      }
    }

    renderBoard();
  }

  function renderBoard() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        renderCell(r, c);
      }
    }
    highlightSelection();
  }

  function renderCell(r, c) {
    const cell = cellElements[r][c];
    const val = board[r][c];

    // Clear value text (keep pencil marks div)
    const pencilDiv = cell.querySelector('.pencil-marks');

    // Remove old value span if any
    const oldVal = cell.querySelector('.cell-value');
    if (oldVal) oldVal.remove();

    // Set classes
    cell.classList.remove('given', 'error');

    if (val !== 0) {
      const span = document.createElement('span');
      span.className = 'cell-value';
      span.textContent = val;
      cell.appendChild(span);
      pencilDiv.style.display = 'none';

      if (givenCells[r][c]) {
        cell.classList.add('given');
      }

      // Check for conflicts
      if (!givenCells[r][c] && val !== solution[r][c]) {
        cell.classList.add('error');
      }
    } else {
      pencilDiv.style.display = 'grid';
      // Render pencil marks
      const marks = pencilMarks[r][c];
      for (let n = 1; n <= 9; n++) {
        const markEl = pencilDiv.querySelector(`[data-num="${n}"]`);
        markEl.textContent = marks.has(n) ? n : '';
      }
    }
  }

  function highlightSelection() {
    // Clear all highlights
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cellElements[r][c].classList.remove('selected', 'same-number', 'same-region', 'conflict');
      }
    }

    if (selectedRow < 0 || selectedCol < 0) return;

    const selVal = board[selectedRow][selectedCol];
    const selBoxR = Math.floor(selectedRow / 3) * 3;
    const selBoxC = Math.floor(selectedCol / 3) * 3;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = cellElements[r][c];
        const boxR = Math.floor(r / 3) * 3;
        const boxC = Math.floor(c / 3) * 3;

        // Same row, col, or box
        if (r === selectedRow || c === selectedCol ||
            (boxR === selBoxR && boxC === selBoxC)) {
          cell.classList.add('same-region');
        }

        // Same number highlighting
        if (selVal !== 0 && board[r][c] === selVal && !(r === selectedRow && c === selectedCol)) {
          cell.classList.add('same-number');
        }
      }
    }

    // Selected cell
    cellElements[selectedRow][selectedCol].classList.add('selected');

    // Highlight conflicts (auto-check)
    highlightConflicts();
  }

  function highlightConflicts() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cellElements[r][c].classList.remove('conflict');
      }
    }

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val === 0) continue;

        let hasConflict = false;

        // Check row
        for (let cc = 0; cc < 9; cc++) {
          if (cc !== c && board[r][cc] === val) {
            hasConflict = true;
            cellElements[r][cc].classList.add('conflict');
          }
        }

        // Check column
        for (let rr = 0; rr < 9; rr++) {
          if (rr !== r && board[rr][c] === val) {
            hasConflict = true;
            cellElements[rr][c].classList.add('conflict');
          }
        }

        // Check box
        const boxR = Math.floor(r / 3) * 3;
        const boxC = Math.floor(c / 3) * 3;
        for (let rr = boxR; rr < boxR + 3; rr++) {
          for (let cc = boxC; cc < boxC + 3; cc++) {
            if (rr !== r || cc !== c) {
              if (board[rr][cc] === val) {
                hasConflict = true;
                cellElements[rr][cc].classList.add('conflict');
              }
            }
          }
        }

        if (hasConflict) {
          cellElements[r][c].classList.add('conflict');
        }
      }
    }
  }

  // ── Number Counts (gray out completed numbers) ──
  function updateNumberCounts() {
    for (let n = 1; n <= 9; n++) {
      let count = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          // Only count correctly-placed numbers so wrong entries don't
          // disable the button and prevent the user from correcting errors
          if (board[r][c] === n && board[r][c] === solution[r][c]) count++;
        }
      }
      const btn = document.querySelector(`.num-btn[data-num="${n}"]`);
      if (count >= 9) {
        btn.classList.add('num-complete');
      } else {
        btn.classList.remove('num-complete');
      }
    }
  }

  // ── Input Logic ──
  function placeNumber(num) {
    if (gameOver || selectedRow < 0 || selectedCol < 0) return;
    if (givenCells[selectedRow][selectedCol]) return;

    if (pencilMode) {
      // Pencil marks mode
      pushUndo(selectedRow, selectedCol);

      if (board[selectedRow][selectedCol] !== 0) {
        board[selectedRow][selectedCol] = 0;
      }

      const marks = pencilMarks[selectedRow][selectedCol];
      if (marks.has(num)) {
        marks.delete(num);
      } else {
        marks.add(num);
      }

      Sound.place();
      renderCell(selectedRow, selectedCol);
      highlightSelection();
      updateNumberCounts();
    } else {
      // Normal mode — collect affected pencil marks BEFORE modifying state
      const affected = collectAffectedPencilMarks(selectedRow, selectedCol, num);
      pushUndo(selectedRow, selectedCol, affected);

      board[selectedRow][selectedCol] = num;
      pencilMarks[selectedRow][selectedCol].clear();

      // Auto-remove pencil marks in same row/col/box
      removePencilMarksForPlacement(selectedRow, selectedCol, num);

      if (num !== solution[selectedRow][selectedCol]) {
        Sound.error();
      } else {
        Sound.place();
      }

      renderCell(selectedRow, selectedCol);
      highlightSelection();
      updateNumberCounts();

      // Check win
      if (checkWin()) {
        handleWin();
      }
    }
  }

  function removePencilMarksForPlacement(row, col, num) {
    // Remove pencil mark from same row
    for (let c = 0; c < 9; c++) {
      if (pencilMarks[row][c].has(num)) {
        pencilMarks[row][c].delete(num);
        renderCell(row, c);
      }
    }
    // Same column
    for (let r = 0; r < 9; r++) {
      if (pencilMarks[r][col].has(num)) {
        pencilMarks[r][col].delete(num);
        renderCell(r, col);
      }
    }
    // Same box
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        if (pencilMarks[r][c].has(num)) {
          pencilMarks[r][c].delete(num);
          renderCell(r, c);
        }
      }
    }
  }

  function collectAffectedPencilMarks(row, col, num) {
    const affected = [];
    const seen = {};

    function addCell(r, c) {
      if (r === row && c === col) return; // skip the placed cell itself
      const key = r * 9 + c;
      if (seen[key]) return;
      if (pencilMarks[r][c].has(num)) {
        seen[key] = true;
        affected.push({ row: r, col: c, marks: new Set(pencilMarks[r][c]) });
      }
    }

    // Same row
    for (let c = 0; c < 9; c++) addCell(row, c);
    // Same column
    for (let r = 0; r < 9; r++) addCell(r, col);
    // Same box
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        addCell(r, c);
      }
    }

    return affected;
  }

  function eraseCell() {
    if (gameOver || selectedRow < 0 || selectedCol < 0) return;
    if (givenCells[selectedRow][selectedCol]) return;

    pushUndo(selectedRow, selectedCol);

    board[selectedRow][selectedCol] = 0;
    pencilMarks[selectedRow][selectedCol].clear();
    Sound.erase();
    renderCell(selectedRow, selectedCol);
    highlightSelection();
    updateNumberCounts();
  }

  // ── Undo ──
  function pushUndo(r, c, affectedMarks) {
    undoStack.push({
      row: r,
      col: c,
      value: board[r][c],
      marks: new Set(pencilMarks[r][c]),
      affectedMarks: affectedMarks || []
    });
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
  }

  function performUndo() {
    if (gameOver || undoStack.length === 0) return;

    const action = undoStack.pop();
    board[action.row][action.col] = action.value;
    pencilMarks[action.row][action.col] = action.marks;

    // Restore pencil marks that were auto-removed in related cells
    if (action.affectedMarks) {
      for (const am of action.affectedMarks) {
        pencilMarks[am.row][am.col] = am.marks;
        renderCell(am.row, am.col);
      }
    }

    selectedRow = action.row;
    selectedCol = action.col;

    renderCell(action.row, action.col);
    highlightSelection();
    updateNumberCounts();
    Sound.erase();
  }

  // ── Hint ──
  function giveHint() {
    if (gameOver || hintsRemaining <= 0) return;

    // Find all empty or wrong cells
    const candidates = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!givenCells[r][c] && board[r][c] !== solution[r][c]) {
          candidates.push({ r, c });
        }
      }
    }

    if (candidates.length === 0) return;

    // Pick a random cell (prefer selected cell if it's wrong)
    let target;
    if (selectedRow >= 0 && selectedCol >= 0 &&
        !givenCells[selectedRow][selectedCol] &&
        board[selectedRow][selectedCol] !== solution[selectedRow][selectedCol]) {
      target = { r: selectedRow, c: selectedCol };
    } else {
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }

    hintsRemaining--;
    updateHintBtn();

    board[target.r][target.c] = solution[target.r][target.c];
    pencilMarks[target.r][target.c].clear();

    selectedRow = target.r;
    selectedCol = target.c;

    Sound.hint();
    renderCell(target.r, target.c);
    cellElements[target.r][target.c].classList.add('hint-reveal');
    setTimeout(() => {
      cellElements[target.r][target.c].classList.remove('hint-reveal');
    }, 600);

    highlightSelection();
    updateNumberCounts();

    if (checkWin()) {
      handleWin();
    }
  }

  // ── Win Check ──
  function checkWin() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== solution[r][c]) return false;
      }
    }
    return true;
  }

  function handleWin() {
    gameOver = true;
    stopTimer();
    Sound.win();

    const elapsed = getElapsedSeconds();
    const diffLabel = DIFFICULTY_CONFIG[difficulty].label;

    // Record on platform
    if (window.GamePlatform) {
      GamePlatform.recordGame('sudoku', 0, getElapsedMs(), { win: true });
    }

    // Save best time
    const times = saveBestTime(difficulty, elapsed);

    // Show win overlay
    winTitle.textContent = 'Puzzle Complete!';
    winStats.innerHTML =
      `<p>Difficulty: <span>${diffLabel}</span></p>` +
      `<p>Time: <span>${formatTime(elapsed)}</span></p>` +
      `<p>Hints used: <span>${MAX_HINTS - hintsRemaining}</span></p>`;

    // Best times
    if (times.length > 0) {
      bestTimesSection.classList.remove('hidden');
      bestTimesList.innerHTML = '';
      times.forEach(t => {
        const li = document.createElement('li');
        li.textContent = formatTime(t);
        if (t === elapsed) li.classList.add('new-score');
        bestTimesList.appendChild(li);
      });
    }

    setTimeout(() => {
      winOverlay.classList.remove('hidden');
      startConfetti();
    }, 400);
  }

  // ── Confetti ──
  function startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00d4ff', '#e94560', '#2ed573', '#ffa502', '#ff6b81', '#a29bfe', '#fd79a8'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let frame = 0;
    const maxFrames = 180;

    function animate() {
      if (frame > maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rot += p.rotSpeed;
        if (frame > maxFrames - 40) {
          p.opacity = Math.max(0, p.opacity - 0.025);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      requestAnimationFrame(animate);
    }

    animate();
  }

  // ── Event Handlers ──
  function onCellClick(e) {
    if (gameOver) return;
    const cell = e.currentTarget;
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);

    selectedRow = r;
    selectedCol = c;
    highlightSelection();
  }

  // Keyboard input
  document.addEventListener('keydown', function (e) {
    if (gameOver) return;

    const key = e.key;

    // Number keys 1-9
    if (key >= '1' && key <= '9') {
      e.preventDefault();
      placeNumber(parseInt(key));
      return;
    }

    // Arrow keys for navigation
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      if (selectedRow < 0) { selectedRow = 0; selectedCol = 0; }
      else if (key === 'ArrowUp') selectedRow = Math.max(0, selectedRow - 1);
      else if (key === 'ArrowDown') selectedRow = Math.min(8, selectedRow + 1);
      else if (key === 'ArrowLeft') selectedCol = Math.max(0, selectedCol - 1);
      else if (key === 'ArrowRight') selectedCol = Math.min(8, selectedCol + 1);
      highlightSelection();
      return;
    }

    // Delete/Backspace to erase
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      eraseCell();
      return;
    }

    // P for pencil mode toggle
    if (key === 'p' || key === 'P') {
      e.preventDefault();
      togglePencilMode();
      return;
    }

    // Z for undo
    if ((key === 'z' || key === 'Z') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      performUndo();
      return;
    }

    // H for hint
    if (key === 'h' || key === 'H') {
      e.preventDefault();
      giveHint();
      return;
    }
  });

  // Number pad buttons
  numBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const num = parseInt(this.dataset.num);
      placeNumber(num);
    });
  });

  // Action buttons
  pencilBtn.addEventListener('click', togglePencilMode);
  eraseBtn.addEventListener('click', eraseCell);
  hintBtn.addEventListener('click', giveHint);
  undoBtn.addEventListener('click', performUndo);
  newGameBtn.addEventListener('click', initGame);
  playAgainBtn.addEventListener('click', function () {
    winOverlay.classList.add('hidden');
    initGame();
  });

  function togglePencilMode() {
    pencilMode = !pencilMode;
    updatePencilBtn();
  }

  function updatePencilBtn() {
    if (pencilMode) {
      pencilBtn.classList.add('active');
    } else {
      pencilBtn.classList.remove('active');
    }
  }

  function updateHintBtn() {
    const label = hintBtn.querySelector('.action-label');
    label.textContent = `Hint (${hintsRemaining})`;
    if (hintsRemaining <= 0) {
      hintBtn.style.opacity = '0.4';
      hintBtn.style.pointerEvents = 'none';
    } else {
      hintBtn.style.opacity = '1';
      hintBtn.style.pointerEvents = '';
    }
  }

  // Difficulty buttons
  diffBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      diffBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      difficulty = this.dataset.difficulty;
      initGame();
    });
  });

  // ── Start Overlay ──
  const startGameBtn = document.getElementById('start-game-btn');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', function () {
      document.getElementById('start-overlay').classList.add('hidden');
      if (!gameStarted && !gameOver) {
        gameStarted = true;
        startTimer();
      }
    });
  }

  // ── Init ──
  initGame();

  if (window.GamePlatform) {
    GamePlatform.initHeader('Sudoku');
  }
})();
