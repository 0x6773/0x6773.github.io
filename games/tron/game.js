(function() {
  'use strict';

  // ── DOM ──
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const lobby = document.getElementById('lobby');
  const gameScreen = document.getElementById('game-screen');
  const btnHost = document.getElementById('btn-host');
  const btnJoin = document.getElementById('btn-join');
  const joinCodeInput = document.getElementById('join-code');
  const lobbyWaiting = document.getElementById('lobby-waiting');
  const waitingMsg = document.getElementById('waiting-msg');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const roomCodeSpan = document.getElementById('room-code');
  const btnCopy = document.getElementById('btn-copy');
  const lobbyError = document.getElementById('lobby-error');
  const lobbyActions = document.getElementById('lobby-actions');
  const p1ScoreEl = document.getElementById('p1-score');
  const p2ScoreEl = document.getElementById('p2-score');
  const roundInfoEl = document.getElementById('round-info');
  const gameOverlay = document.getElementById('game-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const mobileControls = document.getElementById('mobile-controls');

  // ── Constants ──
  const W = canvas.width;
  const H = canvas.height;
  const CELL = 6;              // pixel size of each trail cell
  const COLS = W / CELL;       // 100
  const ROWS = H / CELL;       // 100
  const TICK_MS = 60;          // game tick interval
  const ROUNDS_TO_WIN = 5;
  const COUNTDOWN_SECS = 3;

  const P1_COLOR = '#00f0ff';
  const P1_TRAIL = 'rgba(0, 240, 255, 0.6)';
  const P2_COLOR = '#e040fb';
  const P2_TRAIL = 'rgba(224, 64, 251, 0.6)';

  // Direction vectors
  const DIRS = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
  const OPPOSITE = { up:'down', down:'up', left:'right', right:'left' };

  // ── Audio ──
  let audioCtx;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function playTone(freq, dur, type='square', vol=0.1) {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  }
  function sfxCountdown() { playTone(440, 0.15, 'triangle', 0.12); }
  function sfxGo()        { playTone(880, 0.2, 'triangle', 0.15); }
  function sfxCrash()     { playTone(120, 0.4, 'sawtooth', 0.15); setTimeout(() => playTone(80, 0.3, 'sawtooth', 0.1), 100); }
  function sfxWinRound()  { [660,880,1100].forEach((f,i) => setTimeout(() => playTone(f, 0.15, 'triangle', 0.12), i*80)); }
  function sfxMatchWin()  { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.2, 'triangle', 0.14), i*100)); }

  // ── Particles ──
  let particles = [];
  function spawnExplosion(x, y, color, count=30) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 5;
      particles.push({
        x: x * CELL + CELL/2, y: y * CELL + CELL/2,
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        r: 2 + Math.random()*3, color, life: 1, decay: 0.015 + Math.random()*0.02
      });
    }
  }
  function updateParticles() {
    for (let i = particles.length-1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Game State ──
  let isHost = false;
  let myPlayer = 0;   // 0 = P1, 1 = P2
  let peer, conn;
  let grid;            // 2D array: 0=empty, 1=P1 trail, 2=P2 trail
  let players;         // [{x, y, dir, alive}]
  let scores = [0, 0];
  let round = 1;
  let tickInterval;
  let gameRunning = false;
  let countingDown = false;
  let myDir = null;    // buffered direction input
  let gameTime = 0;

  // ── Networking ──
  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random()*chars.length)];
    return code;
  }

  function showError(msg) {
    lobbyError.textContent = msg;
    lobbyError.classList.remove('hidden');
  }
  function hideError() { lobbyError.classList.add('hidden'); }

  btnHost.addEventListener('click', () => {
    ensureAudio();
    hideError();
    const code = generateCode();
    lobbyActions.classList.add('hidden');
    lobbyWaiting.classList.remove('hidden');
    waitingMsg.textContent = 'Creating room...';

    peer = new Peer('tron-' + code, { debug: 0 });
    peer.on('open', () => {
      waitingMsg.textContent = 'Waiting for opponent...';
      roomCodeDisplay.classList.remove('hidden');
      roomCodeSpan.textContent = code;
    });
    peer.on('connection', c => {
      conn = c;
      isHost = true;
      myPlayer = 0;
      setupConnection();
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        showError('Room code taken. Try again.');
        lobbyActions.classList.remove('hidden');
        lobbyWaiting.classList.add('hidden');
        roomCodeDisplay.classList.add('hidden');
      } else {
        showError('Connection error: ' + err.type);
      }
    });
  });

  btnJoin.addEventListener('click', () => {
    ensureAudio();
    hideError();
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code || code.length < 4) { showError('Enter a valid room code'); return; }

    lobbyActions.classList.add('hidden');
    lobbyWaiting.classList.remove('hidden');
    waitingMsg.textContent = 'Connecting...';

    peer = new Peer(undefined, { debug: 0 });
    peer.on('open', () => {
      conn = peer.connect('tron-' + code, { reliable: true });
      isHost = false;
      myPlayer = 1;
      setupConnection();
    });
    peer.on('error', err => {
      const msg = err.type === 'peer-unavailable'
        ? 'Room not found. Check the code and try again.'
        : 'Connection error: ' + err.type;
      showError(msg);
      lobbyActions.classList.remove('hidden');
      lobbyWaiting.classList.add('hidden');
    });

    // Timeout if peer server itself doesn't respond
    setTimeout(() => {
      if (!peer || peer.disconnected) return;
      if (!conn || !conn.open) {
        showError('Connection timed out. Try again.');
        lobbyActions.classList.remove('hidden');
        lobbyWaiting.classList.add('hidden');
        if (peer) peer.destroy();
      }
    }, 15000);
  });

  btnCopy.addEventListener('click', () => {
    const code = roomCodeSpan.textContent;
    navigator.clipboard.writeText(code).then(() => {
      btnCopy.textContent = 'Copied!';
      setTimeout(() => btnCopy.textContent = 'Copy', 2000);
    });
  });

  function onConnected() {
    lobby.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    if (isMobile()) mobileControls.classList.remove('hidden');
    scores = [0, 0];
    round = 1;
    if (isHost) startRound();
  }

  function setupConnection() {
    // Fix race condition: connection may already be open when host
    // receives it via peer.on('connection'), so check immediately
    if (conn.open) {
      onConnected();
    } else {
      conn.on('open', () => onConnected());
    }

    conn.on('data', data => {
      if (data.type === 'state') {
        grid = data.grid;
        players = data.players;
        scores = data.scores;
        round = data.round;
        updateHUD();
      } else if (data.type === 'dir') {
        if (isHost && data.dir && DIRS[data.dir]) {
          const p = players[1];
          if (p && OPPOSITE[data.dir] !== p.dir) p.dir = data.dir;
        }
      } else if (data.type === 'countdown') {
        showCountdown(data.count);
      } else if (data.type === 'go') {
        hideOverlay();
        if (!isHost) requestAnimationFrame(renderLoop);
      } else if (data.type === 'roundEnd') {
        handleRoundEnd(data.winner, data.crashPos);
      } else if (data.type === 'matchEnd') {
        handleMatchEnd(data.winner);
      }
    });

    conn.on('close', () => {
      stopGame();
      showOverlayMsg('Disconnected', 'Opponent left the game', '#ff4d6d');
    });

    conn.on('error', err => {
      stopGame();
      showOverlayMsg('Connection Error', 'Lost connection to opponent', '#ff4d6d');
    });
  }

  // ── Game Init ──
  function initGrid() {
    grid = [];
    for (let y = 0; y < ROWS; y++) {
      grid[y] = [];
      for (let x = 0; x < COLS; x++) grid[y][x] = 0;
    }
  }

  function initPlayers() {
    players = [
      { x: Math.floor(COLS * 0.25), y: Math.floor(ROWS / 2), dir: 'right', alive: true },
      { x: Math.floor(COLS * 0.75), y: Math.floor(ROWS / 2), dir: 'left', alive: true }
    ];
    // Place starting positions on grid
    for (let i = 0; i < 2; i++) {
      grid[players[i].y][players[i].x] = i + 1;
    }
  }

  function startRound() {
    initGrid();
    initPlayers();
    particles = [];
    gameRunning = false;
    countingDown = true;
    updateHUD();

    // Broadcast initial state
    sendState();

    // Countdown
    let count = COUNTDOWN_SECS;
    showCountdown(count);
    if (conn && conn.open) conn.send({ type: 'countdown', count });

    const cdInterval = setInterval(() => {
      count--;
      if (count > 0) {
        showCountdown(count);
        if (conn && conn.open) conn.send({ type: 'countdown', count });
      } else {
        clearInterval(cdInterval);
        countingDown = false;
        gameRunning = true;
        hideOverlay();
        if (conn && conn.open) conn.send({ type: 'go' });
        startGameLoop();
        requestAnimationFrame(renderLoop);
      }
    }, 1000);
  }

  function showCountdown(n) {
    sfxCountdown();
    overlayTitle.textContent = n;
    overlayTitle.style.color = '#fff';
    overlayMsg.textContent = '';
    gameOverlay.classList.remove('hidden');
    // Also render the initial state during countdown
    render();
  }

  // ── Game Loop (Host only) ──
  function startGameLoop() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(tick, TICK_MS);
  }

  function stopGame() {
    gameRunning = false;
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
  }

  function tick() {
    if (!gameRunning) return;

    // Apply host's buffered input
    if (myDir && isHost) {
      const p = players[0];
      if (OPPOSITE[myDir] !== p.dir) p.dir = myDir;
      myDir = null;
    }

    // Move players
    for (let i = 0; i < 2; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const d = DIRS[p.dir];
      p.x += d.x;
      p.y += d.y;
    }

    // Check collisions
    let roundWinner = -1;
    let crashPositions = [];

    for (let i = 0; i < 2; i++) {
      const p = players[i];
      if (!p.alive) continue;
      // Wall collision
      if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS) {
        p.alive = false;
        crashPositions.push({ x: Math.max(0,Math.min(COLS-1,p.x)), y: Math.max(0,Math.min(ROWS-1,p.y)), player: i });
        continue;
      }
      // Trail collision
      if (grid[p.y][p.x] !== 0) {
        p.alive = false;
        crashPositions.push({ x: p.x, y: p.y, player: i });
        continue;
      }
      // Place trail
      grid[p.y][p.x] = i + 1;
    }

    // Head-on collision (both land on same cell)
    if (players[0].alive && players[1].alive && players[0].x === players[1].x && players[0].y === players[1].y) {
      players[0].alive = false;
      players[1].alive = false;
      crashPositions.push({ x: players[0].x, y: players[0].y, player: 0 });
      crashPositions.push({ x: players[1].x, y: players[1].y, player: 1 });
    }

    // Determine round result
    const p1Dead = !players[0].alive;
    const p2Dead = !players[1].alive;

    if (p1Dead || p2Dead) {
      stopGame();
      if (p1Dead && p2Dead) roundWinner = -1; // draw
      else if (p2Dead) roundWinner = 0;
      else roundWinner = 1;

      if (roundWinner >= 0) scores[roundWinner]++;
      updateHUD();

      // Send final state + round end
      sendState();
      const endData = { type: 'roundEnd', winner: roundWinner, crashPos: crashPositions };
      if (conn && conn.open) conn.send(endData);
      handleRoundEnd(roundWinner, crashPositions);
      return;
    }

    // Send state to guest
    sendState();
  }

  function sendState() {
    if (conn && conn.open) {
      conn.send({ type: 'state', grid, players, scores, round });
    }
  }

  // ── Round / Match End ──
  function handleRoundEnd(winner, crashPositions) {
    stopGame();
    sfxCrash();

    // Spawn explosions
    if (crashPositions) {
      for (const cp of crashPositions) {
        const color = cp.player === 0 ? P1_COLOR : P2_COLOR;
        spawnExplosion(cp.x, cp.y, color, 35);
      }
    }

    // Check match win
    if (scores[0] >= ROUNDS_TO_WIN || scores[1] >= ROUNDS_TO_WIN) {
      const matchWinner = scores[0] >= ROUNDS_TO_WIN ? 0 : 1;
      setTimeout(() => {
        if (isHost && conn && conn.open) conn.send({ type: 'matchEnd', winner: matchWinner });
        handleMatchEnd(matchWinner);
      }, 1500);
      return;
    }

    let msg;
    if (winner === -1) msg = 'Draw!';
    else if (winner === myPlayer) { msg = 'You won the round!'; sfxWinRound(); }
    else msg = 'You lost the round';

    const color = winner === -1 ? '#ffd700' : (winner === 0 ? P1_COLOR : P2_COLOR);

    setTimeout(() => {
      showOverlayMsg(msg, `Next round in 3s...`, color);
      setTimeout(() => {
        round++;
        updateHUD();
        if (isHost) startRound();
      }, 3000);
    }, 1000);
  }

  function handleMatchEnd(winner) {
    const isMe = winner === myPlayer;
    if (isMe) sfxMatchWin(); else sfxCrash();
    const title = isMe ? 'You Win!' : 'You Lose';
    const color = isMe ? '#ffd700' : '#ff4d6d';
    showOverlayMsg(title, `Final: ${scores[0]} - ${scores[1]}  (First to ${ROUNDS_TO_WIN})`, color);

    // Reset after delay
    setTimeout(() => {
      scores = [0, 0];
      round = 1;
      updateHUD();
      if (isHost) startRound();
    }, 5000);
  }

  // ── Overlay helpers ──
  function showOverlayMsg(title, msg, color='#fff') {
    overlayTitle.textContent = title;
    overlayTitle.style.color = color;
    overlayMsg.textContent = msg;
    gameOverlay.classList.remove('hidden');
  }
  function hideOverlay() { gameOverlay.classList.add('hidden'); }

  // ── HUD ──
  function updateHUD() {
    p1ScoreEl.textContent = 'P1: ' + scores[0];
    p2ScoreEl.textContent = 'P2: ' + scores[1];
    roundInfoEl.textContent = 'Round ' + round;
  }

  // ── Input ──
  document.addEventListener('keydown', e => {
    const map = {
      ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
      w:'up', s:'down', a:'left', d:'right',
      W:'up', S:'down', A:'left', D:'right'
    };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    handleDirInput(dir);
  });

  // Touch swipe
  let touchStart = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) handleDirInput(dx > 0 ? 'right' : 'left');
    else handleDirInput(dy > 0 ? 'down' : 'up');
  }, { passive: false });

  // Mobile d-pad buttons
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      handleDirInput(btn.dataset.dir);
    });
  });

  function handleDirInput(dir) {
    if (isHost) {
      myDir = dir;
    } else {
      // Send to host
      if (conn && conn.open) conn.send({ type: 'dir', dir });
    }
  }

  function isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // ── Rendering ──
  function renderLoop() {
    gameTime++;
    updateParticles();
    render();
    if (gameScreen.classList.contains('hidden')) return;
    requestAnimationFrame(renderLoop);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += CELL*5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += CELL*5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw trails
    if (grid) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = grid[y][x];
          if (v === 0) continue;
          ctx.fillStyle = v === 1 ? P1_TRAIL : P2_TRAIL;
          ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
        }
      }
    }

    // Draw player heads (bright glowing squares)
    if (players) {
      for (let i = 0; i < 2; i++) {
        const p = players[i];
        if (!p.alive && !countingDown) continue;
        const px = p.x * CELL;
        const py = p.y * CELL;
        const color = i === 0 ? P1_COLOR : P2_COLOR;

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, CELL, CELL);
        // Extra bright center
        ctx.fillStyle = '#fff';
        ctx.fillRect(px+1, py+1, CELL-2, CELL-2);
        ctx.restore();
      }
    }

    // Particles
    drawParticles();

    // Border glow
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W-2, H-2);
    ctx.restore();
  }

  // Start render loop for lobby idle state
  // (will be re-triggered properly when game starts)
})();
