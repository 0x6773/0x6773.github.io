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
  var aiTimeoutId = null;
  var gameOverTimeoutId = null;
  var startingPlayer = P1;
  var kbCol = 3;
  var Sound = window.Connect4Audio;

  // ── Audio Context ──

  function getAudioCtx() {
    return GameEngine.audio();
  }

  function playDropSound(row) {
    Sound.sfx('drop', row);
  }

  function playWinSound(player) {
    Sound.sfx(isAIMode() && player === P2 ? 'lose' : 'win');
  }

  function playDrawSound() {
    Sound.sfx('draw');
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
  var winLineEl = document.getElementById('win-line');
  var fxLayer = document.getElementById('fx-layer');

  // ── Platform Init ──
  if (typeof GamePlatform !== 'undefined') {
    GamePlatform.initHeader('Connect Four');
  }
  addMusicButton();

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
    var target = e.currentTarget;
    var col = parseInt(target.dataset.col);
    // Add temporary hover effect for mobile
    var allGhosts = ghostRowEl.querySelectorAll('.ghost-cell');
    for (var i = 0; i < allGhosts.length; i++) {
      allGhosts[i].classList.remove('touch-hover');
    }
    target.classList.add('touch-hover');
    setTimeout(function() {
      target.classList.remove('touch-hover');
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
    disc.style.setProperty('--row', row);
    disc.style.animationDuration = (0.34 + row * 0.055) + 's';
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

    setTimeout(function() { playDropSound(row); }, (0.34 + row * 0.055) * 700);

    // Check win
    var win = checkWin(row, col, player);
    if (win) {
      gameOver = true;
      winningCells = win;
      scores[player]++;
      updateScores();
      Sound.music.stop();
      var landMs = (0.34 + row * 0.055) * 1000;
      setTimeout(function() {
        if (!gameOver) return;
        highlightWin(win);
        drawWinLine(win);
        playWinSound(player);
        if (!(isAIMode() && player === P2)) confetti();
      }, landMs);

      var playerWon = player === P1;
      if (typeof GamePlatform !== 'undefined') {
        GamePlatform.recordGame('connect4', scores[P1], 0, { win: playerWon });
      }

      gameOverTimeoutId = setTimeout(function() {
        gameOverTimeoutId = null;
        showGameOver(player);
      }, landMs + 1300);
      return;
    }

    // Check draw
    if (isBoardFull()) {
      gameOver = true;
      Sound.music.stop();
      playDrawSound();
      boardEl.classList.add('draw-shake');
      gameOverTimeoutId = setTimeout(function() {
        gameOverTimeoutId = null;
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
    maybeAIMove();
  }

  function maybeAIMove() {
    if (isAIMode() && currentPlayer === P2 && !gameOver) {
      aiThinking = true;
      updateUndoButton();
      showThinking();
      var delay = 450 + Math.random() * 250;
      aiTimeoutId = setTimeout(function() {
        aiTimeoutId = null;
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
      disc.style.animationDelay = (i * 0.08) + 's';
    }
  }

  function overlayBoard(el) {
    el.style.left = boardEl.offsetLeft + 'px';
    el.style.top = boardEl.offsetTop + 'px';
    el.style.width = boardEl.offsetWidth + 'px';
    el.style.height = boardEl.offsetHeight + 'px';
  }

  function drawWinLine(cells) {
    overlayBoard(winLineEl);
    var sorted = cells.slice().sort(function(a, b) { return a.c - b.c || a.r - b.r; });
    var first = boardEl.children[sorted[0].r * COLS + sorted[0].c].getBoundingClientRect();
    var last = boardEl.children[sorted[sorted.length - 1].r * COLS + sorted[sorted.length - 1].c].getBoundingClientRect();
    var host = boardEl.getBoundingClientRect();
    var line = winLineEl.querySelector('line');
    winLineEl.setAttribute('viewBox', '0 0 ' + host.width + ' ' + host.height);
    line.setAttribute('x1', first.left + first.width / 2 - host.left);
    line.setAttribute('y1', first.top + first.height / 2 - host.top);
    line.setAttribute('x2', last.left + last.width / 2 - host.left);
    line.setAttribute('y2', last.top + last.height / 2 - host.top);
    line.setAttribute('stroke-width', Math.max(6, first.width * 0.22));
    var len = Math.hypot(last.left - first.left, last.top - first.top) + 1;
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    winLineEl.classList.remove('show');
    void winLineEl.getBoundingClientRect();
    winLineEl.classList.add('show');
  }

  function clearWinLine() {
    winLineEl.classList.remove('show');
  }

  function confetti() {
    var colors = ['#ff4d5e', '#ffd23f', '#4dc3ff', '#7ee8b0', '#c3a6ff'];
    overlayBoard(fxLayer);
    var w = fxLayer.offsetWidth, h = fxLayer.offsetHeight;
    for (var i = 0; i < 70; i++) {
      var p = document.createElement('div');
      p.className = 'fx-confetti';
      p.style.left = Math.random() * w + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() - 0.5) * 160 + 'px');
      p.style.setProperty('--dy', h * (0.8 + Math.random() * 0.4) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = Math.random() * 0.4 + 's';
      fxLayer.appendChild(p);
      p.addEventListener('animationend', function(e) { e.target.remove(); });
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
      btnUndo.disabled = moveHistory.length < 2 || aiThinking;
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
    Sound.sfx('undo');
  }

  function undoSingleMove() {
    var last = moveHistory.pop();
    if (!last) return;

    board[last.row][last.col] = EMPTY;
    currentPlayer = last.player;

    var idx = last.row * COLS + last.col;
    var disc = boardEl.children[idx].querySelector('.disc');
    disc.classList.remove('dropped', 'no-anim');
    disc.classList.add('lifted');
    setTimeout(function() {
      if (board[last.row][last.col] === EMPTY) disc.className = 'disc';
    }, 260);
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

  function clearPendingTimeouts() {
    if (aiTimeoutId !== null) {
      clearTimeout(aiTimeoutId);
      aiTimeoutId = null;
    }
    if (gameOverTimeoutId !== null) {
      clearTimeout(gameOverTimeoutId);
      gameOverTimeoutId = null;
    }
    hideThinking();
  }

  function startGame(mode) {
    clearPendingTimeouts();
    gameMode = mode;
    gameOver = false;
    aiThinking = false;
    startingPlayer = P1;
    currentPlayer = P1;
    moveHistory = [];
    winningCells = [];
    clearWinLine();
    boardEl.classList.remove('draw-shake');

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
    getAudioCtx();
    Sound.sfx('start');
    Sound.music.start();
  }

  function newGame() {
    if (!gameMode) return;
    clearPendingTimeouts();
    gameOver = false;
    aiThinking = false;
    startingPlayer = startingPlayer === P1 ? P2 : P1;
    currentPlayer = startingPlayer;
    moveHistory = [];
    winningCells = [];
    clearWinLine();
    boardEl.classList.remove('draw-shake');

    createBoard();
    renderBoard();
    updateTurnIndicator();
    updateUndoButton();
    gameoverOverlay.classList.add('hidden');

    if (typeof GamePlatform !== 'undefined') {
      GamePlatform.resetTimer();
      GamePlatform.startTimer();
    }
    Sound.sfx('start');
    Sound.music.start();
    maybeAIMove();
  }

  function syncMusicButton() {
    var btn = document.querySelector('#gp-header .gp-btn-music');
    if (!btn) return;
    var on = Sound.music.isEnabled();
    btn.classList.toggle('off', !on);
    btn.title = on ? 'Music on (M)' : 'Music off (M)';
    btn.setAttribute('aria-pressed', String(on));
  }

  function toggleMusic() {
    Sound.music.setEnabled(!Sound.music.isEnabled());
    syncMusicButton();
  }

  function addMusicButton() {
    var actions = document.querySelector('#gp-header .gp-header-actions');
    if (!actions || actions.querySelector('.gp-btn-music')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gp-btn-music';
    btn.textContent = '\u{1F3B5}';
    btn.addEventListener('click', function(event) {
      event.preventDefault();
      btn.blur();
      toggleMusic();
    });
    actions.insertBefore(btn, actions.querySelector('.gp-btn-sound'));
    syncMusicButton();
  }

  function showKbColumn() {
    var cells = ghostRowEl.querySelectorAll('.ghost-cell');
    for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('kb-hover', i === kbCol);
  }

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key;
    if (key === 'm' || key === 'M') {
      if (!e.repeat) toggleMusic();
      return;
    }
    if (!gameMode || !startOverlay.classList.contains('hidden') || !gameoverOverlay.classList.contains('hidden')) return;
    if (key === 'u' || key === 'U') { undoMove(); return; }
    if (key === 'n' || key === 'N') { newGame(); return; }
    if (gameOver || aiThinking) return;
    if (key >= '1' && key <= '7') {
      e.preventDefault();
      kbCol = parseInt(key, 10) - 1;
      showKbColumn();
      if (board[0][kbCol] === EMPTY) makeMove(kbCol);
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      kbCol = Math.max(0, Math.min(COLS - 1, kbCol + (key === 'ArrowLeft' ? -1 : 1)));
      showKbColumn();
      Sound.sfx('hover');
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
      e.preventDefault();
      showKbColumn();
      if (board[0][kbCol] === EMPTY) makeMove(kbCol);
    }
  });

  function audioLoop() {
    Sound.update();
    requestAnimationFrame(audioLoop);
  }
  requestAnimationFrame(audioLoop);

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
    clearPendingTimeouts();
    gameOver = false;
    aiThinking = false;
    Sound.music.stop();
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
