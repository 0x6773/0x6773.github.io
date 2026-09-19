// ============================================
// Game Platform - Stats, Achievements & Tracking
// ============================================
(function() {
  'use strict';

  const STORAGE_KEY = 'gamePlatformData';

  const GAME_NAMES = {
    'breakout': 'Breakout',
    'snake': 'Snake',
    'flappy': 'Flappy Bird',
    'minesweeper': 'Minesweeper',
    '2048': '2048',
    'tron': 'Tron',
    'tron-online': 'Tron Online',
    'tetris': 'Tetris',
    'ludo': 'Ludo'
  };

  const GAME_EMOJIS = {
    'breakout': '\u{1F9F1}',
    'snake': '\u{1F40D}',
    'flappy': '\u{1F426}',
    'minesweeper': '\u{1F4A3}',
    '2048': '\u{1F522}',
    'tron': '\u{1F3CD}\uFE0F',
    'tron-online': '\u{1F310}',
    'tetris': '\u{1F7E6}',
    'ludo': '\u{1F3B2}'
  };

  const ACHIEVEMENT_DEFS = [
    { id: 'first-game',      name: 'First Steps',       desc: 'Play your first game',        icon: '\u{1F476}' },
    { id: 'five-games',      name: 'Getting Warmed Up',  desc: 'Play 5 games',               icon: '\u{1F525}' },
    { id: 'twenty-five',     name: 'Dedicated',          desc: 'Play 25 games',              icon: '\u{1F4AA}' },
    { id: 'hundred',         name: 'Centurion',          desc: 'Play 100 games',             icon: '\u{1F4AF}' },
    { id: 'try-3',           name: 'Explorer',           desc: 'Try 3 different games',      icon: '\u{1F9ED}' },
    { id: 'try-all',         name: 'Completionist',      desc: 'Play all 9 games',           icon: '\u{1F31F}' },
    { id: 'score-1k',        name: 'High Scorer',        desc: 'Score over 1,000',           icon: '\u{1F3AF}' },
    { id: 'breakout-500',    name: 'Brick Breaker',      desc: 'Score 500+ in Breakout',     icon: '\u{1F9F1}' },
    { id: 'snake-50',        name: 'Snake Charmer',      desc: 'Score 50+ in Snake',         icon: '\u{1F40D}' },
    { id: 'flappy-10',       name: 'Sky High',           desc: 'Score 10+ in Flappy Bird',   icon: '\u{1F426}' },
    { id: 'minesweeper-win', name: 'Bomb Squad',         desc: 'Win a Minesweeper game',     icon: '\u{1F4A3}' },
    { id: 'reach-1024',      name: 'Number Cruncher',    desc: 'Reach 1024 in 2048',         icon: '\u{1F522}' },
    { id: 'reach-2048',      name: 'The 2048',           desc: 'Reach the 2048 tile',        icon: '\u{1F451}' },
    { id: 'tron-5wins',      name: 'Light Rider',        desc: 'Win 5 Tron matches',         icon: '\u{1F3CD}\uFE0F' },
    { id: 'tetris-lines',    name: 'Line Clear',         desc: 'Clear 10 lines in Tetris',   icon: '\u{1F4CF}' },
    { id: 'time-30m',        name: 'Marathon',            desc: 'Play for 30 min total',     icon: '\u{23F1}\uFE0F' },
    { id: 'night-owl',       name: 'Night Owl',           desc: 'Play after midnight',       icon: '\u{1F989}' },
    { id: 'early-bird',      name: 'Early Bird',          desc: 'Play before 7 AM',          icon: '\u{1F305}' },
    { id: 'streak-3',        name: 'On a Roll',           desc: 'Play 3 days in a row',      icon: '\u{1F4C5}' },
    { id: 'speed-5',         name: 'Speed Demon',         desc: 'Play 5 games in one hour',  icon: '\u26A1' }
  ];

  // ── Data persistence ──

  function getDefaultData() {
    return {
      playerName: 'Player',
      gameStats: {},
      recentGames: [],
      achievements: {},
      dailyLog: [],
      sessionGames: 0,
      sessionStart: Date.now()
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultData();
      const data = JSON.parse(raw);
      // Ensure all fields exist
      return Object.assign(getDefaultData(), data);
    } catch (e) {
      return getDefaultData();
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* quota exceeded, silently fail */ }
  }

  // ── Achievement checking ──

  function checkAndUnlock(data) {
    const stats = computeOverall(data);
    const gs = data.gameStats || {};
    const now = Date.now();
    const newlyUnlocked = [];

    function tryUnlock(id) {
      if (data.achievements[id]) return;
      data.achievements[id] = { unlocked: true, date: now };
      newlyUnlocked.push(id);
    }

    // Game count achievements
    if (stats.totalGames >= 1)   tryUnlock('first-game');
    if (stats.totalGames >= 5)   tryUnlock('five-games');
    if (stats.totalGames >= 25)  tryUnlock('twenty-five');
    if (stats.totalGames >= 100) tryUnlock('hundred');

    // Titles played
    if (stats.titlesPlayed >= 3) tryUnlock('try-3');
    if (stats.titlesPlayed >= 9) tryUnlock('try-all');

    // Score achievements
    let anyOver1k = false;
    for (const [id, s] of Object.entries(gs)) {
      if ((s.bestScore || 0) >= 1000) anyOver1k = true;
    }
    if (anyOver1k) tryUnlock('score-1k');
    if ((gs['breakout']?.bestScore || 0) >= 500)  tryUnlock('breakout-500');
    if ((gs['snake']?.bestScore || 0) >= 50)       tryUnlock('snake-50');
    if ((gs['flappy']?.bestScore || 0) >= 10)      tryUnlock('flappy-10');
    if ((gs['minesweeper']?.wins || 0) >= 1)       tryUnlock('minesweeper-win');
    if ((gs['2048']?.bestScore || 0) >= 1024)      tryUnlock('reach-1024');
    if ((gs['2048']?.bestScore || 0) >= 2048)      tryUnlock('reach-2048');
    if ((gs['tron']?.wins || 0) >= 5)              tryUnlock('tron-5wins');
    if ((gs['tetris']?.linesCleared || 0) >= 10)   tryUnlock('tetris-lines');

    // Time achievement
    if (stats.totalTime >= 30 * 60 * 1000) tryUnlock('time-30m');

    // Time-of-day
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5)  tryUnlock('night-owl');
    if (hour >= 4 && hour < 7)  tryUnlock('early-bird');

    // Streak
    const days = (data.dailyLog || []).sort();
    if (days.length >= 3) {
      const last3 = days.slice(-3);
      const d0 = new Date(last3[0]), d1 = new Date(last3[1]), d2 = new Date(last3[2]);
      const oneDay = 86400000;
      if (d2 - d1 <= oneDay && d1 - d0 <= oneDay) tryUnlock('streak-3');
    }

    // Speed demon: 5 games in current session (within 1 hour)
    if ((data.sessionGames || 0) >= 5) {
      const elapsed = Date.now() - (data.sessionStart || Date.now());
      if (elapsed <= 3600000) tryUnlock('speed-5');
    }

    return newlyUnlocked;
  }

  function computeOverall(data) {
    const gs = data.gameStats || {};
    let totalGames = 0, totalTime = 0, titlesPlayed = 0;
    let favoriteGame = null, maxPlays = 0;
    for (const [id, s] of Object.entries(gs)) {
      const played = s.timesPlayed || 0;
      totalGames += played;
      totalTime += s.totalPlayTime || 0;
      if (played > 0) titlesPlayed++;
      if (played > maxPlays) { maxPlays = played; favoriteGame = id; }
    }
    const achievements = data.achievements || {};
    const unlocked = Object.values(achievements).filter(a => a && a.unlocked).length;
    return {
      totalGames,
      totalTime,
      titlesPlayed,
      favoriteGame,
      achievementsUnlocked: unlocked,
      achievementsTotal: ACHIEVEMENT_DEFS.length
    };
  }

  // ── Hash helper for daily challenges ──

  function hashDate(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // ── Toast notifications ──

  function showToast(html, type) {
    let toast = document.querySelector('.gp-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'gp-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = html;
    toast.className = 'gp-toast' + (type ? ' gp-toast-' + type : '');
    requestAnimationFrame(() => {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3500);
    });
  }

  // ── Header for individual game pages ──

  function initHeader(gameName) {
    const data = loadData();
    const gs = data.gameStats || {};

    const header = document.createElement('div');
    header.id = 'gp-header';
    var muted = localStorage.getItem('gp_muted') === '1';
    var bestScore = '--';
    var gameId = Object.keys(GAME_NAMES).find(function(k) { return GAME_NAMES[k] === gameName; }) || '';
    var gStats = gameId ? ((data.gameStats || {})[gameId] || null) : null;
    if (gStats && gStats.bestScore) bestScore = gStats.bestScore;

    header.innerHTML =
      '<div class="gp-header-top">' +
        '<a href="/games/" class="gp-back">\u2190 Game Hub</a>' +
        '<span class="gp-game-name">' + gameName + '</span>' +
        '<div class="gp-header-actions">' +
          '<button class="gp-btn-sound" title="Toggle Sound">' + (muted ? '\uD83D\uDD07' : '\uD83D\uDD0A') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="gp-header-stats">' +
        '<span class="gp-stat">Score: <strong id="gp-score">0</strong></span>' +
        '<span class="gp-stat">Best: <strong id="gp-best">' + bestScore + '</strong></span>' +
        '<span class="gp-stat">\u23F1 <strong id="gp-timer">00:00</strong></span>' +
      '</div>';

    // Sound toggle click handler
    setTimeout(function() {
      var soundBtn = header.querySelector('.gp-btn-sound');
      if (soundBtn) soundBtn.addEventListener('click', function(e) {
        e.preventDefault();
        GamePlatform.toggleMute();
      });
    }, 0);

    // Remove old inline back buttons
    var oldBacks = document.querySelectorAll('a[href="/games/"]');
    oldBacks.forEach(function(el) {
      if (el.style.position === 'fixed') el.remove();
    });

    document.body.prepend(header);
    document.body.classList.add('gp-has-header');

    // Auto-start session timing
    if (gameId) {
      GamePlatform.startSession(gameId);
    }

    // Auto-save session time when user leaves
    var self = GamePlatform;
    window.addEventListener('beforeunload', function() {
      if (self._sessionGameId) {
        var time = self.endSession();
        // Don't double-record if the game already called recordGame
        // Just save the time to the existing stats
        var data = loadData();
        if (data.gameStats && data.gameStats[self._sessionGameId]) {
          data.gameStats[self._sessionGameId].totalPlayTime =
            (data.gameStats[self._sessionGameId].totalPlayTime || 0) + time;
          saveData(data);
        }
      }
    });
  }

  // ── Public API ──

  const GamePlatform = {
    GAME_NAMES: GAME_NAMES,
    GAME_EMOJIS: GAME_EMOJIS,
    ACHIEVEMENT_DEFS: ACHIEVEMENT_DEFS,

    getPlayerName: function() {
      return loadData().playerName || 'Player';
    },

    setPlayerName: function(name) {
      const data = loadData();
      data.playerName = (name || '').trim() || 'Player';
      saveData(data);
    },

    getGameStats: function(gameId) {
      const data = loadData();
      return (data.gameStats || {})[gameId] || null;
    },

    getAllStats: function() {
      return loadData().gameStats || {};
    },

    getOverallStats: function() {
      return computeOverall(loadData());
    },

    getAchievements: function() {
      const data = loadData();
      const unlocked = data.achievements || {};
      return ACHIEVEMENT_DEFS.map(function(def) {
        const u = unlocked[def.id];
        return {
          id: def.id,
          name: def.name,
          desc: def.desc,
          icon: def.icon,
          unlocked: !!(u && u.unlocked),
          date: u ? u.date : null
        };
      });
    },

    getRecentGames: function(limit) {
      const data = loadData();
      const recent = data.recentGames || [];
      return recent.slice(0, limit || 10);
    },

    recordGame: function(gameId, score, playTimeMs, extra) {
      var pt = playTimeMs || this.getSessionTime();
      const data = loadData();
      if (!data.gameStats) data.gameStats = {};
      if (!data.gameStats[gameId]) {
        data.gameStats[gameId] = { timesPlayed: 0, bestScore: 0, totalPlayTime: 0, lastPlayed: 0, wins: 0, linesCleared: 0 };
      }
      const gs = data.gameStats[gameId];
      gs.timesPlayed = (gs.timesPlayed || 0) + 1;
      if (score > (gs.bestScore || 0)) gs.bestScore = score;
      gs.totalPlayTime = (gs.totalPlayTime || 0) + (pt || 0);
      gs.lastPlayed = Date.now();

      if (extra) {
        if (extra.win) gs.wins = (gs.wins || 0) + 1;
        if (extra.linesCleared) gs.linesCleared = (gs.linesCleared || 0) + extra.linesCleared;
      }

      // Recent games (keep last 50)
      if (!data.recentGames) data.recentGames = [];
      data.recentGames.unshift({
        gameId: gameId,
        score: score || 0,
        playTime: pt || 0,
        timestamp: Date.now()
      });
      if (data.recentGames.length > 50) data.recentGames = data.recentGames.slice(0, 50);

      // Daily log for streak
      const today = new Date().toISOString().slice(0, 10);
      if (!data.dailyLog) data.dailyLog = [];
      if (data.dailyLog[data.dailyLog.length - 1] !== today) {
        data.dailyLog.push(today);
        if (data.dailyLog.length > 30) data.dailyLog = data.dailyLog.slice(-30);
      }

      // Session tracking
      if (!data.sessionStart || (Date.now() - data.sessionStart > 3600000)) {
        data.sessionStart = Date.now();
        data.sessionGames = 1;
      } else {
        data.sessionGames = (data.sessionGames || 0) + 1;
      }

      // Check achievements
      const newlyUnlocked = checkAndUnlock(data);
      saveData(data);

      // Show toast for new achievements
      for (const id of newlyUnlocked) {
        const def = ACHIEVEMENT_DEFS.find(function(a) { return a.id === id; });
        if (def) {
          showToast(
            '<span class="gp-toast-icon">' + def.icon + '</span>' +
            '<span class="gp-toast-title">Achievement Unlocked!</span>' +
            '<span class="gp-toast-desc">' + def.name + ' \u2014 ' + def.desc + '</span>',
            'achievement'
          );
        }
      }

      // Check daily challenges
      if (GamePlatform.checkDailyChallenge) {
        var ch = GamePlatform.checkDailyChallenge(gameId, score);
        if (ch) {
          showToast(
            '<span class="gp-toast-icon">\uD83C\uDFAF</span>' +
            '<span class="gp-toast-title">Daily Challenge Complete!</span>' +
            '<span class="gp-toast-desc">' + (GAME_NAMES[gameId] || gameId) + ': ' + ch.desc + '</span>',
            'achievement'
          );
        }
      }

      return newlyUnlocked;
    },

    initHeader: initHeader,

    toast: function(message, type) {
      showToast(message, type || 'success');
    },

    updateScore: function(score) {
      var el = document.getElementById('gp-score');
      if (el) el.textContent = score;
    },

    updateBest: function(score) {
      var el = document.getElementById('gp-best');
      if (el) el.textContent = score;
    },

    updateTimer: function(seconds) {
      var el = document.getElementById('gp-timer');
      if (!el) return;
      var m = Math.floor(seconds / 60);
      var s = seconds % 60;
      el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    },

    _timerInterval: null,
    _timerSeconds: 0,

    startTimer: function() {
      var self = this;
      self._timerSeconds = 0;
      self.updateTimer(0);
      if (self._timerInterval) clearInterval(self._timerInterval);
      self._timerInterval = setInterval(function() {
        self._timerSeconds++;
        self.updateTimer(self._timerSeconds);
      }, 1000);
    },

    stopTimer: function() {
      if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
      return this._timerSeconds;
    },

    resetTimer: function() {
      this.stopTimer();
      this._timerSeconds = 0;
      this.updateTimer(0);
    },

    isMuted: function() {
      return localStorage.getItem('gp_muted') === '1';
    },

    resetAllData: function() {
      var data = loadData();
      var playerName = data.playerName || 'Player';
      // Clear platform data but keep the player name
      var fresh = { playerName: playerName, gameStats: {}, achievements: {}, recentGames: [], dailyLog: [] };
      saveData(fresh);
      // Clear all game-specific localStorage keys
      var gameKeys = [
        'breakout_highscores', 'breakout_progress',
        'snake_highscores',
        'flappybird_highscores', 'flappy_ghost',
        'minesweeper_scores_easy', 'minesweeper_scores_medium', 'minesweeper_scores_hard',
        '2048_highest_tile_ever', '2048_total_moves_ever',
        '2048_best_classic', '2048_best_mini', '2048_best_big', '2048_best_timeattack',
        'tetris_highscores',
      ];
      for (var i = 0; i < gameKeys.length; i++) {
        localStorage.removeItem(gameKeys[i]);
      }
    },

    toggleMute: function() {
      var muted = !this.isMuted();
      localStorage.setItem('gp_muted', muted ? '1' : '0');
      var btn = document.querySelector('.gp-btn-sound');
      if (btn) btn.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
      return muted;
    },

    // ── Auto Play-Time Tracking ──

    _sessionGameId: null,
    _sessionStart: 0,
    _sessionHiddenTime: 0,
    _sessionHiddenAt: 0,

    startSession: function(gameId) {
      this._sessionGameId = gameId;
      this._sessionStart = Date.now();
      this._sessionHiddenTime = 0;
      this._sessionHiddenAt = 0;

      // Track tab visibility to subtract hidden time
      var self = this;
      document.addEventListener('visibilitychange', self._onVisChange = function() {
        if (document.hidden) {
          self._sessionHiddenAt = Date.now();
        } else if (self._sessionHiddenAt > 0) {
          self._sessionHiddenTime += Date.now() - self._sessionHiddenAt;
          self._sessionHiddenAt = 0;
        }
      });
    },

    endSession: function() {
      if (!this._sessionGameId || !this._sessionStart) return 0;
      var total = Date.now() - this._sessionStart;
      if (this._sessionHiddenAt > 0) {
        this._sessionHiddenTime += Date.now() - this._sessionHiddenAt;
      }
      var activeTime = Math.max(0, total - this._sessionHiddenTime);
      // Clean up
      if (this._onVisChange) {
        document.removeEventListener('visibilitychange', this._onVisChange);
      }
      this._sessionGameId = null;
      this._sessionStart = 0;
      return activeTime;
    },

    getSessionTime: function() {
      if (!this._sessionStart) return 0;
      var total = Date.now() - this._sessionStart;
      var hidden = this._sessionHiddenTime;
      if (this._sessionHiddenAt > 0) {
        hidden += Date.now() - this._sessionHiddenAt;
      }
      return Math.max(0, total - hidden);
    },

    // ── Daily Challenges ──

    getDailyChallenges: function() {
      var today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      var seed = hashDate(today);

      // Define possible challenges per game
      var allChallenges = [
        { gameId: 'breakout', desc: 'Complete World 1-3', type: 'play' },
        { gameId: 'snake', desc: 'Score 50+', type: 'score', target: 50 },
        { gameId: 'flappy', desc: 'Score 15+', type: 'score', target: 15 },
        { gameId: 'minesweeper', desc: 'Win on Easy', type: 'win' },
        { gameId: '2048', desc: 'Reach 512 tile', type: 'play' },
        { gameId: 'tetris', desc: 'Clear 10 lines', type: 'play' },
        { gameId: 'snake', desc: 'Score 100+', type: 'score', target: 100 },
        { gameId: 'flappy', desc: 'Score 25+', type: 'score', target: 25 },
        { gameId: 'breakout', desc: 'Score 300+', type: 'score', target: 300 },
        { gameId: 'tetris', desc: 'Score 1000+', type: 'score', target: 1000 },
        { gameId: '2048', desc: 'Score 5000+', type: 'score', target: 5000 },
        { gameId: 'minesweeper', desc: 'Win on Medium', type: 'win' },
        { gameId: 'snake', desc: 'Score 200+', type: 'score', target: 200 },
        { gameId: 'flappy', desc: 'Score 50+', type: 'score', target: 50 },
        { gameId: 'tetris', desc: 'Score 3000+', type: 'score', target: 3000 },
      ];

      // Pick 5 challenges for today using seeded selection
      var selected = [];
      var usedGames = {};
      var idx = seed;
      while (selected.length < 5) {
        idx = (idx * 1103515245 + 12345) & 0x7fffffff;
        var pick = allChallenges[idx % allChallenges.length];
        if (!usedGames[pick.gameId]) {
          usedGames[pick.gameId] = true;
          selected.push(pick);
        }
      }

      return { date: today, challenges: selected };
    },

    checkDailyChallenge: function(gameId, score) {
      var daily = this.getDailyChallenges();
      var data = loadData();
      if (!data.dailyChallenges) data.dailyChallenges = {};
      if (!data.dailyChallenges[daily.date]) data.dailyChallenges[daily.date] = {};

      for (var i = 0; i < daily.challenges.length; i++) {
        var ch = daily.challenges[i];
        if (ch.gameId !== gameId) continue;
        var key = ch.gameId + '_' + i;
        if (data.dailyChallenges[daily.date][key]) continue; // already completed

        var completed = false;
        if (ch.type === 'score' && score >= ch.target) completed = true;
        if (ch.type === 'win') completed = true; // just playing counts
        if (ch.type === 'play') completed = true; // just playing counts

        if (completed) {
          data.dailyChallenges[daily.date][key] = { completedAt: Date.now() };
          saveData(data);
          return ch;
        }
      }
      return null;
    },

    getDailyProgress: function() {
      var daily = this.getDailyChallenges();
      var data = loadData();
      var completed = (data.dailyChallenges && data.dailyChallenges[daily.date]) || {};
      var count = 0;
      for (var i = 0; i < daily.challenges.length; i++) {
        var key = daily.challenges[i].gameId + '_' + i;
        if (completed[key]) count++;
      }
      return { total: daily.challenges.length, completed: count, challenges: daily.challenges, completedMap: completed };
    }
  };

  window.GamePlatform = GamePlatform;
})();
