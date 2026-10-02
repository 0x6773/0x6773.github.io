(function (root) {
  'use strict';

  const Core = root.ChainCore;
  const WIN = 100000;

  function side(s, p) {
    const { n, neighbors, critical, mark } = s.geo;
    const owner = s.owner, count = s.count;
    let score = 0;
    for (let i = 0; i < n; i++) {
      if (owner[i] !== p) continue;
      const c = count[i], crit = critical[i];
      score += c;
      let threatened = false;
      for (const j of neighbors[i]) {
        if (owner[j] >= 0 && owner[j] !== p && count[j] === critical[j] - 1) {
          score -= 5 - crit;
          threatened = true;
        }
      }
      if (!threatened) {
        if (crit === 2) score += 3;
        else if (crit === 3) score += 2;
        if (c === crit - 1) score += 2;
      }
    }
    const stack = [];
    for (let i = 0; i < n; i++) {
      if (mark[i] || owner[i] !== p || count[i] !== critical[i] - 1) continue;
      let size = 0;
      mark[i] = 1;
      stack.push(i);
      while (stack.length) {
        const k = stack.pop();
        size++;
        for (const j of neighbors[k]) {
          if (!mark[j] && owner[j] === p && count[j] === critical[j] - 1) { mark[j] = 1; stack.push(j); }
        }
      }
      if (size > 1) score += 2 * size;
    }
    mark.fill(0);
    return score;
  }

  function evaluate(s, p) {
    if (s.winner === p) return WIN;
    if (s.winner >= 0 || s.out[p]) return -WIN;
    let rival = -Infinity;
    for (let q = 0; q < s.players; q++) if (q !== p && !s.out[q]) rival = Math.max(rival, side(s, q));
    return side(s, p) - rival;
  }

  function after(s, move) {
    const t = Core.clone(s);
    Core.place(t, move, false);
    return t;
  }

  function ranked(s, p) {
    return Core.legalMoves(s).map(move => {
      const t = after(s, move);
      return { move, t, score: evaluate(t, p) };
    }).sort((a, b) => b.score - a.score);
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  function easy(s, rng) {
    const moves = Core.legalMoves(s);
    if (rng() < 0.4) {
      const best = ranked(s, s.turn);
      return best[0].score >= WIN ? best[0].move : pick(best.slice(0, Math.max(1, Math.ceil(best.length / 3))), rng).move;
    }
    return pick(moves, rng);
  }

  function medium(s, rng) {
    const p = s.turn;
    let best = null, bestScore = -Infinity;
    for (const move of Core.legalMoves(s)) {
      const score = evaluate(after(s, move), p) + rng() * 1.5;
      if (score > bestScore) { bestScore = score; best = move; }
    }
    return best;
  }

  function hard(s, rng, budgetMs) {
    const p = s.turn;
    const start = Date.now();
    const mine = ranked(s, p);
    if (mine[0].score >= WIN) return mine[0].move;
    const candidates = mine.slice(0, 14);
    let best = candidates[0].move, bestScore = -Infinity;
    for (const c of candidates) {
      if (Date.now() - start > budgetMs) break;
      let worst = Infinity;
      const q = c.t.turn;
      const replies = c.t.winner >= 0 ? [] : Core.legalMoves(c.t).map(move => {
        const t = after(c.t, move);
        return { t, score: evaluate(t, q) };
      }).sort((a, b) => b.score - a.score).slice(0, 10);
      for (const r of replies) {
        const score = evaluate(r.t, p);
        if (score < worst) worst = score;
        if (worst <= bestScore) break;
      }
      if (!replies.length) worst = evaluate(c.t, p);
      worst += rng() * 0.5;
      if (worst > bestScore) { bestScore = worst; best = c.move; }
    }
    return best;
  }

  function choose(s, level, rng, budgetMs) {
    const r = rng || Math.random;
    if (level === 'easy') return easy(s, r);
    if (level === 'hard') return hard(s, r, budgetMs || 220);
    return medium(s, r);
  }

  root.ChainAI = { choose, evaluate };
})(typeof window !== 'undefined' ? window : globalThis);
