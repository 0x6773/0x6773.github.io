(function (root) {
  'use strict';

  /* ── Direction vectors ── */
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const BASE_SPEED = 130;
  const MIN_SPEED = 55;
  const SPEED_STEP = 2;
  const SLOW_FACTOR = 1.6;
  const EFFECT_MS = 6000;
  const POWER_TTL = 7000;
  const POWER_CHANCE = 0.2;
  const POWERS = ['gold', 'slow', 'ghost', 'shrink'];

  function create(options) {
    const o = options || {};
    const cols = o.cols || 30, rows = o.rows || 30;
    const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
    const s = {
      cols, rows,
      mode: o.mode || 'classic',
      rng: o.rng || Math.random,
      snake: [{ x: mx, y: my }, { x: mx - 1, y: my }, { x: mx - 2, y: my }],
      dir: 'right',
      queue: [],
      food: null,
      power: null,
      effect: null,
      obstacles: [],
      score: 0,
      speed: BASE_SPEED,
      eaten: 0,
      nearCooldown: 0,
      alive: true,
      ticks: 0
    };
    s.food = freeCell(s);
    return s;
  }

  function occupied(s, x, y) {
    return s.snake.some(c => c.x === x && c.y === y) ||
      s.obstacles.some(c => c.x === x && c.y === y) ||
      (s.food && s.food.x === x && s.food.y === y) ||
      (s.power && s.power.x === x && s.power.y === y);
  }

  function freeCell(s) {
    for (let k = 0; k < 2000; k++) {
      const x = Math.floor(s.rng() * s.cols), y = Math.floor(s.rng() * s.rows);
      if (!occupied(s, x, y)) return { x, y };
    }
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (!occupied(s, x, y)) return { x, y };
    return null;
  }

  function opposite(a, b) {
    return DIRS[a].x + DIRS[b].x === 0 && DIRS[a].y + DIRS[b].y === 0;
  }

  function turn(s, dir) {
    if (!DIRS[dir] || !s.alive) return false;
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    // prevent 180-degree reversal
    if (dir === last || opposite(dir, last) || s.queue.length >= 3) return false;
    s.queue.push(dir);
    return true;
  }

  function tickMs(s) {
    return s.effect && s.effect.type === 'slow' ? s.speed * SLOW_FACTOR : s.speed;
  }

  /* ── Obstacle Mode helpers ── */
  function spawnCluster(s) {
    if (s.obstacles.length >= 30) return false;
    const len = 2 + Math.floor(s.rng() * 2);
    const horizontal = s.rng() > 0.5;
    const head = s.snake[0];
    for (let attempt = 0; attempt < 80; attempt++) {
      const sx = Math.floor(s.rng() * (s.cols - 4)) + 2;
      const sy = Math.floor(s.rng() * (s.rows - 4)) + 2;
      const cells = [];
      for (let i = 0; i < len; i++) {
        const cx = horizontal ? sx + i : sx, cy = horizontal ? sy : sy + i;
        if (cx < 1 || cx >= s.cols - 1 || cy < 1 || cy >= s.rows - 1 || occupied(s, cx, cy)) break;
        // don't spawn adjacent to the snake head
        if (Math.abs(cx - head.x) <= 2 && Math.abs(cy - head.y) <= 2) break;
        cells.push({ x: cx, y: cy });
      }
      if (cells.length === len) {
        s.obstacles.push(...cells);
        return cells;
      }
    }
    return false;
  }

  /* ── Tick / Update ── */
  function step(s) {
    const events = [];
    if (!s.alive) return events;
    const dt = tickMs(s);
    s.ticks++;
    if (s.queue.length) s.dir = s.queue.shift();
    const d = DIRS[s.dir];
    const old = s.snake[0];
    let head = { x: old.x + d.x, y: old.y + d.y };
    if (s.mode === 'portal') {
      // Wrap coordinates
      const wrapped = { x: (head.x + s.cols) % s.cols, y: (head.y + s.rows) % s.rows };
      if (wrapped.x !== head.x || wrapped.y !== head.y) events.push({ type: 'wrap', from: { x: old.x, y: old.y }, to: wrapped });
      head = wrapped;
    } else if (head.x < 0 || head.x >= s.cols || head.y < 0 || head.y >= s.rows) {
      // Wall collision (classic & obstacle modes)
      return die(s, events, 'wall');
    }
    // Obstacle collision (obstacle mode)
    if (s.obstacles.some(c => c.x === head.x && c.y === head.y)) return die(s, events, 'obstacle');
    // Eat food?
    const eating = s.food && head.x === s.food.x && head.y === s.food.y;
    const ghost = s.effect && s.effect.type === 'ghost';
    // Self collision (all modes)
    // When not eating, exclude the tail tip (last segment) because it will
    // vacate this tick — moving into that cell is safe.
    const body = eating ? s.snake : s.snake.slice(0, -1);
    if (!ghost && body.some(c => c.x === head.x && c.y === head.y)) return die(s, events, 'self');
    s.snake.unshift(head);
    if (eating) {
      s.score += 10;
      s.eaten++;
      s.speed = Math.max(MIN_SPEED, s.speed - SPEED_STEP);
      events.push({ type: 'eat', x: head.x, y: head.y, eaten: s.eaten });
      // Obstacle mode: spawn obstacles every 5 food eaten
      if (s.mode === 'obstacle' && s.eaten % 5 === 0) {
        const cells = spawnCluster(s);
        if (cells) events.push({ type: 'obstacles', cells });
      }
      s.food = freeCell(s);
      if (!s.power && s.rng() < POWER_CHANCE) {
        const cell = freeCell(s);
        if (cell) {
          s.power = { type: POWERS[Math.floor(s.rng() * POWERS.length)], x: cell.x, y: cell.y, ttl: POWER_TTL, max: POWER_TTL };
          events.push({ type: 'powerSpawn', power: s.power });
        }
      }
    } else {
      s.snake.pop();
    }
    if (s.power) {
      if (head.x === s.power.x && head.y === s.power.y) {
        const p = s.power;
        s.power = null;
        if (p.type === 'gold') s.score += 50;
        else if (p.type === 'shrink') {
          const cut = Math.max(0, Math.min(4, s.snake.length - 3));
          const removed = s.snake.splice(s.snake.length - cut, cut);
          s.score += 5;
          events.push({ type: 'shrunk', cells: removed });
        } else s.effect = { type: p.type, ms: EFFECT_MS, max: EFFECT_MS };
        events.push({ type: 'power', kind: p.type, x: head.x, y: head.y });
      } else {
        s.power.ttl -= dt;
        if (s.power.ttl <= 0) {
          events.push({ type: 'powerExpire', power: s.power });
          s.power = null;
        }
      }
    }
    if (s.effect) {
      s.effect.ms -= dt;
      if (s.effect.ms <= 0) {
        events.push({ type: 'effectEnd', kind: s.effect.type });
        s.effect = null;
      }
    }
    // Near-miss check (all modes)
    if (s.nearCooldown > 0) s.nearCooldown--;
    else {
      // Skip first 5 segments: neck + recent turns are naturally adjacent
      for (let i = 5; i < s.snake.length; i++) {
        const dx = Math.abs(head.x - s.snake[i].x), dy = Math.abs(head.y - s.snake[i].y);
        if (dx + dy === 1) {
          s.nearCooldown = 8;
          s.score += 2;
          events.push({ type: 'near', x: head.x, y: head.y });
          break;
        }
      }
    }
    return events;
  }

  function die(s, events, cause) {
    s.alive = false;
    events.push({ type: 'die', cause });
    return events;
  }

  root.SnakeCore = { DIRS, BASE_SPEED, MIN_SPEED, EFFECT_MS, POWER_TTL, POWERS, create, turn, step, tickMs, freeCell };
})(typeof window !== 'undefined' ? window : globalThis);
