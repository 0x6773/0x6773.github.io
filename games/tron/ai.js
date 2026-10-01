(function (root) {
  'use strict';

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const OPTIONS = {
    up: ['up', 'left', 'right'],
    down: ['down', 'right', 'left'],
    left: ['left', 'down', 'up'],
    right: ['right', 'up', 'down']
  };
  const DEAD = -1e9;
  const WIN = 1e9;
  const DRAW = -5000;

  function createTronAI(cols, rows) {
    const size = cols * rows;
    const occ = new Uint8Array(size);
    const queue = new Int32Array(size);
    const distA = new Int32Array(size);
    const distB = new Int32Array(size);
    const seenA = new Uint32Array(size);
    const seenB = new Uint32Array(size);
    let stamp = 0;

    function load(grid) {
      for (let y = 0; y < rows; y++) {
        const row = grid[y];
        for (let x = 0; x < cols; x++) occ[y * cols + x] = row[x] ? 1 : 0;
      }
    }

    function isFree(x, y) {
      return x >= 0 && y >= 0 && x < cols && y < rows && !occ[y * cols + x];
    }

    function nextStamp() {
      stamp++;
      if (stamp === 0xffffffff) {
        seenA.fill(0);
        seenB.fill(0);
        stamp = 1;
      }
      return stamp;
    }

    function bfs(start, dist, seen, mark, limit) {
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      seen[start] = mark;
      dist[start] = 0;
      while (head < tail && tail < limit) {
        const cell = queue[head++];
        const x = cell % cols;
        const y = (cell - x) / cols;
        const d = dist[cell] + 1;
        if (x > 0) { const n = cell - 1; if (!occ[n] && seen[n] !== mark) { seen[n] = mark; dist[n] = d; queue[tail++] = n; } }
        if (x < cols - 1) { const n = cell + 1; if (!occ[n] && seen[n] !== mark) { seen[n] = mark; dist[n] = d; queue[tail++] = n; } }
        if (y > 0) { const n = cell - cols; if (!occ[n] && seen[n] !== mark) { seen[n] = mark; dist[n] = d; queue[tail++] = n; } }
        if (y < rows - 1) { const n = cell + cols; if (!occ[n] && seen[n] !== mark) { seen[n] = mark; dist[n] = d; queue[tail++] = n; } }
      }
      return tail;
    }

    function space(x, y, limit) {
      return bfs(y * cols + x, distA, seenA, nextStamp(), limit || size);
    }

    function territory(ax, ay, bx, by) {
      const markA = nextStamp();
      const countA = bfs(ay * cols + ax, distA, seenA, markA, size);
      const markB = nextStamp();
      const countB = bfs(by * cols + bx, distB, seenB, markB, size);
      let mine = 0;
      let theirs = 0;
      let shared = false;
      if (!countA || !countB) return { mine: countA, theirs: countB, shared };
      for (let i = 0; i < size; i++) {
        const a = seenA[i] === markA;
        const b = seenB[i] === markB;
        if (a && b) {
          shared = true;
          if (distA[i] < distB[i]) mine++;
          else if (distB[i] < distA[i]) theirs++;
        } else if (a) {
          mine++;
        } else if (b) {
          theirs++;
        }
      }
      return { mine, theirs, shared };
    }

    function wallContact(x, y) {
      let n = 0;
      if (!isFree(x - 1, y)) n++;
      if (!isFree(x + 1, y)) n++;
      if (!isFree(x, y - 1)) n++;
      if (!isFree(x, y + 1)) n++;
      return n;
    }

    function moves(p) {
      return OPTIONS[p.dir].map((dir, i) => {
        const d = DIRS[dir];
        const x = p.x + d[0];
        const y = p.y + d[1];
        return { dir, x, y, straight: i === 0, free: isFree(x, y) };
      });
    }

    function chooseEasy(me, rng) {
      const options = moves(me);
      const safe = options.filter(m => m.free);
      if (!safe.length) return me.dir;
      const straight = options[0];
      const d = DIRS[me.dir];
      const clearAhead = straight.free && isFree(me.x + d[0] * 2, me.y + d[1] * 2);
      if (clearAhead && rng() > 0.05) return me.dir;
      const roomy = safe.filter(m => space(m.x, m.y, 30) >= 30);
      const pool = roomy.length && rng() > 0.25 ? roomy : safe;
      return pool[Math.floor(rng() * pool.length)].dir;
    }

    function chooseMedium(me, opp, rng) {
      const options = moves(me).filter(m => m.free);
      if (!options.length) return me.dir;
      const od = DIRS[opp.dir];
      const oppAhead = (opp.y + od[1]) * cols + (opp.x + od[0]);
      const predicted = isFree(opp.x + od[0], opp.y + od[1]);
      if (predicted) occ[oppAhead] = 1;
      const scored = options.map(m => {
        if (!isFree(m.x, m.y)) return { m, score: DEAD };
        occ[m.y * cols + m.x] = 1;
        const room = space(m.x, m.y, 2500);
        occ[m.y * cols + m.x] = 0;
        return { m, score: room * 10 + (m.straight ? 4 : 0) + wallContact(m.x, m.y) };
      });
      if (predicted) occ[oppAhead] = 0;
      scored.sort((a, b) => b.score - a.score);
      if (scored.length > 1 && scored[1].score > 0 && scored[1].score >= scored[0].score * 0.85 && rng() < 0.08) return scored[1].m.dir;
      return scored[0].score === DEAD ? options[0].dir : scored[0].m.dir;
    }

    function chooseHard(me, opp) {
      const mine = moves(me).filter(m => m.free);
      if (!mine.length) return me.dir;
      const theirs = moves(opp).filter(m => m.free);
      const base = territory(me.x, me.y, opp.x, opp.y);
      if (!base.shared) {
        let best = null;
        for (const m of mine) {
          occ[m.y * cols + m.x] = 1;
          const room = space(m.x, m.y);
          occ[m.y * cols + m.x] = 0;
          const score = room * 8 + wallContact(m.x, m.y) * 3 + (m.straight ? 1 : 0);
          if (!best || score > best.score) best = { m, score };
        }
        return best.m.dir;
      }
      let best = null;
      for (const m of mine) {
        let worst = WIN;
        occ[m.y * cols + m.x] = 1;
        if (!theirs.length) {
          worst = WIN / 2;
        }
        for (const o of theirs) {
          let value;
          if (o.x === m.x && o.y === m.y) {
            value = DRAW;
          } else {
            occ[o.y * cols + o.x] = 1;
            const t = territory(m.x, m.y, o.x, o.y);
            occ[o.y * cols + o.x] = 0;
            value = (t.mine - t.theirs) * 4 + t.mine + (m.straight ? 1 : 0);
          }
          if (value < worst) worst = value;
        }
        occ[m.y * cols + m.x] = 0;
        if (!best || worst > best.score) best = { m, score: worst };
      }
      return best.m.dir;
    }

    function choose(grid, me, opp, level, rng) {
      const random = rng || Math.random;
      load(grid);
      if (level === 'easy') return chooseEasy(me, random);
      if (level === 'hard') return chooseHard(me, opp);
      return chooseMedium(me, opp, random);
    }

    return { choose };
  }

  root.TronAI = { create: createTronAI, DIRS, OPPOSITE };
})(typeof window !== 'undefined' ? window : globalThis);
