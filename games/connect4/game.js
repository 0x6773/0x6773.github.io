// ============================================
// Connect Four - Game Logic
// ============================================
(function() {
  'use strict';

  // ── Constants ──
  var ROWS = 6;
  var COLS = 7;
  var EMPTY = 0;
  var P1 = 1; // Red
  var P2 = 2; // Yellow

  // ── State ──
  var board = [];
  var currentPlayer = P1;
  var gameOver = false;
  var gameMode = null;       // 'local', 'ai-easy', 'ai-medium', 'ai-hard'
  var aiThinking = false;
  var moveHistory = [];
  var scores = { 1: 0, 2: 0 };
  var winningCells = [];

  // ── Audio Context ──
  var audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    return audioCtx;
  }

  function isMuted() {
    return typeof GamePlatform !== 'undefined' && GamePlatform.isMuted();
  }

  function playDropSound() {
    if (isMuted()) return;
    var ctx = getAudioCtx(); if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  function playWinSound() {
    if (isMuted()) return;
    var ctx = getAudioCtx(); if (!ctx) return;
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i++) {
      (function(freq, delay) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      })(notes[i], i * 0.12);
    }
  }

  function playDrawSound() {
    if (isMuted()) return;
    var ctx = getAudioCtx(); if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  }

  // ── DOM Elements ──
  var boardEl = document.getElementById('board');
  var ghostRowEl = document.getElementById('ghost-row');
  var turnDiscEl = document.getElementById('turn-disc');
  var turnTextEl = document.getElementById('turn-text');
  var scoreP1El = document.getElementById('score-p1');
  var scoreP2El = document.getElementById('score-p2');
  var p2NameEl = document.getElementById('p2-name');
  var btnNewGame = document.getElementById('btn-new-game');
  var btnUndo = document.getElementById('btn-undo');
  var startOverlay = document.getElementById('start-overlay');
  var gameoverOverlay = document.getElementById('gameover-overlay');
  var gameoverTitle = document.getElementById('gameover-title');
  var gameoverMsg = document.getElementById('gameover-msg');
  var btnPlayAgain = document.getElementById('btn-play-again');
  var btnChangeMode = document.getElementById('btn-change-mode');

  // ── Platform Init ──
  if (typeof GamePlatform !== 'undefined') {
    GamePlatform.initHeader('Connect Four');
  }

  // ── Board Setup ──

  function createBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
      board[r] = [];
      for (var c = 0; c < COLS; c++) {
        board[r][c] = EMPTY;
      }
    }
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        var disc = document.createElement('div');
        disc.className = 'disc';
        cell.appendChild(disc);

        cell.addEventListener('click', onCellClick);
        boardEl.appendChild(cell);
      }
    }
    renderGhostRow();
  }

  function renderGhostRow() {
    ghostRowEl.innerHTML = '';
    for (var c = 0; c < COLS; c++) {
      var ghostCell = document.createElement('div');
      ghostCell.className = 'ghost-cell';
      ghostCell.dataset.col = c;

      var ghostDisc = document.createElement('div');
      ghostDisc.className = 'ghost-disc ' + (currentPlayer === P1 ? 'red' : 'yellow');
      ghostCell.appendChild(ghostDisc);

      ghostCell.addEventListener('click', onCellClick);
      ghostCell.addEventListener('mouseenter', onGhostEnter);
      ghostCell.addEventListener('mouseleave', onGhostLeave);
      ghostCell.addEventListener('touchstart', onGhostTouch, { passive: true });
      ghostRowEl.appendChild(ghostCell);
    }
    updateGhostDiscs();
  }

  function updateGhostDiscs() {
    var ghosts = ghostRowEl.querySelectorAll('.ghost-disc');
    var color = currentPlayer === P1 ? 'red' : 'yellow';
    for (var i = 0; i < ghosts.length; i++) {
      ghosts[i].className = 'ghost-disc ' + color;
    }
    // Mark full columns
    var ghostCells = ghostRowEl.querySelectorAll('.ghost-cell');
    for (var c = 0; c < COLS; c++) {
      if (board[0][c] !== EMPTY) {
        ghostCells[c].classList.add('col-full');
      } else {
        ghostCells[c].classList.remove('col-full');
      }
    }
  }

  function onGhostEnter(e) {
    // handled by CSS :hover
  }

  function onGhostLeave(e) {
    // handled by CSS :hover
  }

  function onGhostTouch(e) {
    var col = parseInt(e.currentTarget.dataset.col);
    // Add temporary hover effect for mobile
    var allGhosts = ghostRowEl.querySelectorAll('.ghost-cell');
    for (var i = 0; i < allGhosts.length; i++) {
      allGhosts[i].classList.remove('touch-hover');
    }
    e.currentTarget.classList.add('touch-hover');
    setTimeout(function() {
      e.currentTarget.classList.remove('touch-hover');
    }, 400);
  }

  // ── Game Logic ──

  function getLowestEmptyRow(col) {
    for (var r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === EMPTY) return r;
    }
    return -1;
  }

  function dropDisc(col, player, animate) {
    var row = getLowestEmptyRow(col);
    if (row === -1) return -1;

    board[row][col] = player;
    moveHistory.push({ row: row, col: col, player: player });

    // Render disc
    var cellIndex = row * COLS + col;
    var cell = boardEl.children[cellIndex];
    var disc = cell.querySelector('.disc');
    disc.className = 'disc ' + (player === P1 ? 'red' : 'yellow');
    if (animate !== false) {
      disc.classList.add('dropped');
    } else {
      disc.classList.add('no-anim');
    }

    return row;
  }

  function checkWin(row, col, player) {
    var directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal down-right
      [1, -1]   // diagonal down-left
    ];

    for (var d = 0; d < directions.length; d++) {
      var dr = directions[d][0];
      var dc = directions[d][1];
      var cells = [{ r: row, c: col }];

      // Check forward
      for (var i = 1; i <= 3; i++) {
        var nr = row + dr * i;
        var nc = col + dc * i;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
        if (board[nr][nc] !== player) break;
        cells.push({ r: nr, c: nc });
      }

      // Check backward
      for (var i = 1; i <= 3; i++) {
        var nr = row - dr * i;
        var nc = col - dc * i;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
        if (board[nr][nc] !== player) break;
        cells.push({ r: nr, c: nc });
      }

      if (cells.length >= 4) return cells;
    }
    return null;
  }

  function isBoardFull() {
    for (var c = 0; c < COLS; c++) {
      if (board[0][c] === EMPTY) return false;
    }
    return true;
  }

  function onCellClick(e) {
    if (gameOver || aiThinking) return;

    var col = parseInt(e.currentTarget.dataset.col);
    if (isNaN(col)) return;
    if (board[0][col] !== EMPTY) return;

    makeMove(col);
  }

  function makeMove(col) {
    var player = currentPlayer;
    var row = dropDisc(col, player, true);
    if (row === -1) return;

    playDropSound();

    // Check win
    var win = checkWin(row, col, player);
    if (win) {
      gameOver = true;
      winningCells = win;
      highlightWin(win);
      scores[player]++;
      updateScores();
      playWinSound();

      var playerWon = player === P1;
      if (typeof GamePlatform !== 'undefined') {
        GamePlatform.recordGame('connect4', scores[player], 0, { win: playerWon });
      }

      setTimeout(function() {
        showGameOver(player);
      }, 800);
      return;
    }

    // Check draw
    if (isBoardFull()) {
      gameOver = true;
      playDrawSound();
      setTimeout(function() {
        showGameOver(0);
      }, 500);
      return;
    }

    // Switch player
    currentPlayer = currentPlayer === P1 ? P2 : P1;
    updateTurnIndicator();
    updateGhostDiscs();
    updateUndoButton();

    // AI move
    if (isAIMode() && currentPlayer === P2 && !gameOver) {
      aiThinking = true;
      showThinking();
      var delay = 300 + Math.random() * 200;
      setTimeout(function() {
        hideThinking();
        aiThinking = false;
        if (!gameOver) {
          var aiCol = getAIMove();
          makeMove(aiCol);
        }
      }, delay);
    }
  }

  function highlightWin(cells) {
    for (var i = 0; i < cells.length; i++) {
      var idx = cells[i].r * COLS + cells[i].c;
      var disc = boardEl.children[idx].querySelector('.disc');
      disc.classList.remove('dropped');
      disc.classList.add('winner');
    }
  }

  function updateTurnIndicator() {
    turnDiscEl.className = 'turn-disc ' + (currentPlayer === P1 ? 'red' : 'yellow');
    var name;
    if (currentPlayer === P1) {
      name = 'Player 1';
    } else {
      name = isAIMode() ? 'AI' : 'Player 2';
    }
    turnTextEl.textContent = name + "'s Turn";
  }

  function updateScores() {
    scoreP1El.textContent = scores[P1];
    scoreP2El.textContent = scores[P2];
  }

  function updateUndoButton() {
    if (isAIMode()) {
      // In AI mode, need at least 2 moves (player + AI) or 1 if it's player's turn
      btnUndo.disabled = moveHistory.length === 0 || aiThinking;
    } else {
      btnUndo.disabled = moveHistory.length === 0;
    }
  }

  function isAIMode() {
    return gameMode && gameMode.startsWith('ai-');
  }

  // ── Thinking indicator ──

  function showThinking() {
    var existing = document.querySelector('.thinking-indicator');
    if (existing) existing.remove();

    var indicator = document.createElement('div');
    indicator.className = 'thinking-indicator';
    indicator.innerHTML = '<span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span>';
    var hudCenter = document.getElementById('hud-center');
    hudCenter.appendChild(indicator);
  }

  function hideThinking() {
    var existing = document.querySelector('.thinking-indicator');
    if (existing) existing.remove();
  }

  // ── Game Over ──

  function showGameOver(winner) {
    gameoverOverlay.classList.remove('hidden');
    if (winner === 0) {
      gameoverTitle.textContent = "It's a Draw!";
      gameoverTitle.className = 'draw';
      gameoverMsg.textContent = 'The board is full. No winner this time.';
    } else {
      var name = winner === P1 ? 'Player 1' : (isAIMode() ? 'AI' : 'Player 2');
      var color = winner === P1 ? 'Red' : 'Yellow';
      gameoverTitle.textContent = name + ' Wins!';
      gameoverTitle.className = winner === P1 ? 'win-red' : 'win-yellow';
      gameoverMsg.textContent = color + ' connects four!';
    }
  }

  // ── Undo ──

  function undoMove() {
    if (gameOver || moveHistory.length === 0 || aiThinking) return;

    if (isAIMode()) {
      // Undo two moves (AI + player) if AI already moved
      if (currentPlayer === P1 && moveHistory.length >= 2) {
        undoSingleMove();
        undoSingleMove();
      } else if (currentPlayer === P2) {
        // Shouldn't happen since AI auto-plays
        undoSingleMove();
      }
    } else {
      undoSingleMove();
    }

    updateTurnIndicator();
    updateGhostDiscs();
    updateUndoButton();
  }

  function undoSingleMove() {
    var last = moveHistory.pop();
    if (!last) return;

    board[last.row][last.col] = EMPTY;
    currentPlayer = last.player;

    var idx = last.row * COLS + last.col;
    var disc = boardEl.children[idx].querySelector('.disc');
    disc.className = 'disc';
  }

  // ── AI Logic ──

  function getAIMove() {
    if (gameMode === 'ai-easy') return aiEasy();
    if (gameMode === 'ai-medium') return aiMedium();
    if (gameMode === 'ai-hard') return aiHard();
    return aiEasy();
  }

  function getValidColumns() {
    var cols = [];
    for (var c = 0; c < COLS; c++) {
      if (board[0][c] === EMPTY) cols.push(c);
    }
    return cols;
  }

  // Easy: random valid move
  function aiEasy() {
    var valid = getValidColumns();
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // Medium: blocks opponent wins, takes own wins, else random
  function aiMedium() {
    var valid = getValidColumns();

    // Check if AI can win
    for (var i = 0; i < valid.length; i++) {
      var row = getLowestEmptyRow(valid[i]);
      board[row][valid[i]] = P2;
      if (checkWin(row, valid[i], P2)) {
        board[row][valid[i]] = EMPTY;
        return valid[i];
      }
      board[row][valid[i]] = EMPTY;
    }

    // Block opponent win
    for (var i = 0; i < valid.length; i++) {
      var row = getLowestEmptyRow(valid[i]);
      board[row][valid[i]] = P1;
      if (checkWin(row, valid[i], P1)) {
        board[row][valid[i]] = EMPTY;
        return valid[i];
      }
      board[row][valid[i]] = EMPTY;
    }

    // Prefer center
    if (valid.indexOf(3) !== -1) return 3;

    return valid[Math.floor(Math.random() * valid.length)];
  }

  // Hard: Minimax with alpha-beta pruning
  function aiHard() {
    var valid = getValidColumns();
    var bestScore = -Infinity;
    var bestCol = valid[0];
    var depth = 6;

    // Column order: prefer center
    var orderedCols = valid.slice().sort(function(a, b) {
      return Math.abs(a - 3) - Math.abs(b - 3);
    });

    for (var i = 0; i < orderedCols.length; i++) {
      var col = orderedCols[i];
      var row = getLowestEmptyRow(col);
      board[row][col] = P2;

      var moveScore;
      if (checkWin(row, col, P2)) {
        moveScore = 1000000;
      } else {
        moveScore = minimax(depth - 1, -Infinity, Infinity, false);
      }

      board[row][col] = EMPTY;

      if (moveScore > bestScore) {
        bestScore = moveScore;
        bestCol = col;
      }
    }

    return bestCol;
  }

  function minimax(depth, alpha, beta, maximizing) {
    // Check terminal states
    if (depth === 0) return evaluateBoard();

    var valid = getValidColumns();
    if (valid.length === 0) return 0; // draw

    // Order columns center-first for better pruning
    valid.sort(function(a, b) {
      return Math.abs(a - 3) - Math.abs(b - 3);
    });

    if (maximizing) {
      var maxEval = -Infinity;
      for (var i = 0; i < valid.length; i++) {
        var col = valid[i];
        var row = getLowestEmptyRow(col);
        board[row][col] = P2;

        var score;
        if (checkWin(row, col, P2)) {
          score = 1000000 + depth;
        } else {
          score = minimax(depth - 1, alpha, beta, false);
        }

        board[row][col] = EMPTY;

        if (score > maxEval) maxEval = score;
        if (score > alpha) alpha = score;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      var minEval = Infinity;
      for (var i = 0; i < valid.length; i++) {
        var col = valid[i];
        var row = getLowestEmptyRow(col);
        board[row][col] = P1;

        var score;
        if (checkWin(row, col, P1)) {
          score = -(1000000 + depth);
        } else {
          score = minimax(depth - 1, alpha, beta, true);
        }

        board[row][col] = EMPTY;

        if (score < minEval) minEval = score;
        if (score < beta) beta = score;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function evaluateBoard() {
    var score = 0;

    // Center column preference
    for (var r = 0; r < ROWS; r++) {
      if (board[r][3] === P2) score += 3;
      else if (board[r][3] === P1) score -= 3;
    }

    // Evaluate all windows of 4
    // Horizontal
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c <= COLS - 4; c++) {
        score += evaluateWindow(board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]);
      }
    }

    // Vertical
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r <= ROWS - 4; r++) {
        score += evaluateWindow(board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]);
      }
    }

    // Diagonal down-right
    for (var r = 0; r <= ROWS - 4; r++) {
      for (var c = 0; c <= COLS - 4; c++) {
        score += evaluateWindow(board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]);
      }
    }

    // Diagonal down-left
    for (var r = 0; r <= ROWS - 4; r++) {
      for (var c = 3; c < COLS; c++) {
        score += evaluateWindow(board[r][c], board[r+1][c-1], board[r+2][c-2], board[r+3][c-3]);
      }
    }

    return score;
  }

  function evaluateWindow(a, b, c, d) {
    var cells = [a, b, c, d];
    var aiCount = 0, oppCount = 0, emptyCount = 0;
    for (var i = 0; i < 4; i++) {
      if (cells[i] === P2) aiCount++;
      else if (cells[i] === P1) oppCount++;
      else emptyCount++;
    }

    if (aiCount === 4) return 100;
    if (aiCount === 3 && emptyCount === 1) return 5;
    if (aiCount === 2 && emptyCount === 2) return 2;
    if (oppCount === 3 && emptyCount === 1) return -4;
    if (oppCount === 4) return -100;
    return 0;
  }

  // ── Game Flow ──

  function startGame(mode) {
    gameMode = mode;
    gameOver = false;
    aiThinking = false;
    currentPlayer = P1;
    moveHistory = [];
    winningCells = [];

    if (isAIMode()) {
      p2NameEl.textContent = 'AI';
    } else {
      p2NameEl.textContent = 'Player 2';
    }

    createBoard();
    renderBoard();
    updateTurnIndicator();
    updateScores();
    updateUndoButton();

    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');

    if (typeof GamePlatform !== 'undefined') {
      GamePlatform.startTimer();
    }
  }

  function newGame() {
    if (!gameMode) return;
    gameOver = false;
    aiThinking = false;
    currentPlayer = P1;
    moveHistory = [];
    winningCells = [];

    createBoard();
    renderBoard();
    updateTurnIndicator();
    updateUndoButton();
    gameoverOverlay.classList.add('hidden');

    if (typeof GamePlatform !== 'undefined') {
      GamePlatform.resetTimer();
      GamePlatform.startTimer();
    }
  }

  // ── Event Listeners ──

  // Mode buttons
  var modeButtons = document.querySelectorAll('.mode-btn');
  for (var i = 0; i < modeButtons.length; i++) {
    modeButtons[i].addEventListener('click', function() {
      var mode = this.dataset.mode;
      startGame(mode);
    });
  }

  btnNewGame.addEventListener('click', newGame);
  btnUndo.addEventListener('click', undoMove);

  btnPlayAgain.addEventListener('click', function() {
    newGame();
  });

  btnChangeMode.addEventListener('click', function() {
    gameoverOverlay.classList.add('hidden');
    scores = { 1: 0, 2: 0 };
    updateScores();
    startOverlay.classList.remove('hidden');
    if (typeof GamePlatform !== 'undefined') {
      GamePlatform.resetTimer();
    }
  });

  // Init: show start overlay
  createBoard();
  renderBoard();
  updateScores();
  btnUndo.disabled = true;

})();
