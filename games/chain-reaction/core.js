(function (root) {
  'use strict';

  const SIZES = { small: [6, 9], large: [8, 12] };
  const MAX_WAVES = 4000;

  function geometry(cols, rows) {
    const n = cols * rows;
    const neighbors = [];
    const critical = new Uint8Array(n);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const list = [];
        if (y > 0) list.push((y - 1) * cols + x);
        if (x < cols - 1) list.push(y * cols + x + 1);
        if (y < rows - 1) list.push((y + 1) * cols + x);
        if (x > 0) list.push(y * cols + x - 1);
        neighbors.push(list);
        critical[y * cols + x] = list.length;
      }
    }
    return { cols, rows, n, neighbors, critical, mark: new Uint8Array(n) };
  }

  function create(cols, rows, players) {
    const geo = geometry(cols, rows);
    const count = Math.max(2, Math.min(8, players || 2));
    return {
      geo,
      players: count,
      owner: new Int8Array(geo.n).fill(-1),
      count: new Uint8Array(geo.n),
      total: new Array(count).fill(0),
      moves: new Array(count).fill(0),
      out: new Array(count).fill(false),
      order: [],
      turn: 0,
      winner: -1,
      lastChain: 0,
      history: []
    };
  }

  function clone(s) {
    return {
      geo: s.geo,
      players: s.players,
      owner: s.owner.slice(),
      count: s.count.slice(),
      total: s.total.slice(),
      moves: s.moves.slice(),
      out: s.out.slice(),
      order: s.order.slice(),
      turn: s.turn,
      winner: s.winner,
      lastChain: s.lastChain,
      history: []
    };
  }

  function snapshot(s) {
    return { owner: s.owner.slice(), count: s.count.slice(), total: s.total.slice(), moves: s.moves.slice(), out: s.out.slice(), order: s.order.slice(), turn: s.turn, winner: s.winner, lastChain: s.lastChain };
  }

  function restore(s, snap) {
    s.owner.set(snap.owner);
    s.count.set(snap.count);
    s.total = snap.total.slice();
    s.moves = snap.moves.slice();
    s.out = snap.out.slice();
    s.order = snap.order.slice();
    s.turn = snap.turn;
    s.winner = snap.winner;
    s.lastChain = snap.lastChain;
  }

  function alive(s) {
    const list = [];
    for (let p = 0; p < s.players; p++) if (!s.out[p]) list.push(p);
    return list;
  }

  function legal(s, i, player) {
    const p = player === undefined ? s.turn : player;
    return s.winner < 0 && i >= 0 && i < s.geo.n && (s.owner[i] === -1 || s.owner[i] === p);
  }

  function legalMoves(s, player) {
    const p = player === undefined ? s.turn : player;
    const out = [];
    for (let i = 0; i < s.geo.n; i++) if (s.owner[i] === -1 || s.owner[i] === p) out.push(i);
    return out;
  }

  function eliminate(s, p) {
    let left = 0;
    for (let q = 0; q < s.players; q++) {
      if (q !== p && !s.out[q] && s.moves[q] > 0 && s.total[q] === 0) {
        s.out[q] = true;
        s.order.push(q);
      }
      if (!s.out[q]) left++;
    }
    if (left === 1) s.winner = p;
    return s.winner >= 0;
  }

  function resolve(s, p, record) {
    const { neighbors, critical, mark } = s.geo;
    const owner = s.owner, count = s.count, total = s.total;
    const waves = record ? [] : null;
    let unstable = [];
    for (let i = 0; i < s.geo.n; i++) if (owner[i] === p && count[i] >= critical[i]) unstable.push(i);
    let chain = 0;
    let guard = 0;
    while (unstable.length) {
      if (++guard > MAX_WAVES) {
        let best = p;
        for (let q = 0; q < s.players; q++) if (!s.out[q] && total[q] > total[best]) best = q;
        for (let q = 0; q < s.players; q++) if (q !== best && !s.out[q]) { s.out[q] = true; s.order.push(q); }
        s.winner = best;
        break;
      }
      chain += unstable.length;
      for (const i of unstable) {
        count[i] -= critical[i];
        if (count[i] === 0) owner[i] = -1;
      }
      for (const i of unstable) {
        for (const j of neighbors[i]) {
          const o = owner[j];
          if (o >= 0 && o !== p) {
            total[o] -= count[j];
            total[p] += count[j];
          }
          owner[j] = p;
          count[j]++;
        }
      }
      const done = eliminate(s, p);
      if (record) waves.push({ cells: unstable, owner: owner.slice(), count: count.slice(), out: s.out.slice() });
      if (done) break;
      const next = [];
      for (const i of unstable) {
        if (!mark[i] && count[i] >= critical[i]) { mark[i] = 1; next.push(i); }
        for (const j of neighbors[i]) {
          if (!mark[j] && count[j] >= critical[j]) { mark[j] = 1; next.push(j); }
        }
      }
      for (const i of next) mark[i] = 0;
      unstable = next;
    }
    s.lastChain = chain;
    return waves;
  }

  function nextTurn(s, p) {
    for (let k = 1; k <= s.players; k++) {
      const q = (p + k) % s.players;
      if (!s.out[q]) return q;
    }
    return p;
  }

  function place(s, i, record) {
    const p = s.turn;
    if (!legal(s, i, p)) return null;
    if (record) s.history.push(snapshot(s));
    const outBefore = s.out.slice();
    s.owner[i] = p;
    s.count[i]++;
    s.total[p]++;
    const waves = resolve(s, p, record);
    s.moves[p]++;
    if (s.winner < 0) s.turn = nextTurn(s, p);
    const eliminated = [];
    for (let q = 0; q < s.players; q++) if (s.out[q] && !outBefore[q]) eliminated.push(q);
    return { player: p, cell: i, waves, chain: s.lastChain, winner: s.winner, eliminated };
  }

  function undo(s) {
    const snap = s.history.pop();
    if (!snap) return false;
    restore(s, snap);
    return true;
  }

  root.ChainCore = { SIZES, create, clone, alive, legal, legalMoves, place, undo, snapshot, restore };
})(typeof window !== 'undefined' ? window : globalThis);
