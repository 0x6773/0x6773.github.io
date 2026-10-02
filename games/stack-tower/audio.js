(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'stacktower_music', musicVolume: 0.34 });
  const { tone, noise, arpeggio } = synth;
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const CHORDS = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]];
  const ROOT = 261.63;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const PLUCKS = [12, -1, 16, 19, -1, 16, 14, -1, 12, -1, 9, 12, -1, 14, 16, -1];

  const SOUNDS = {
    place(c, t, level) {
      const n = PENTA[(level || 0) % PENTA.length];
      tone(c, 'triangle', f(n - 12), t, 0.12, 0.09, { to: f(n - 14) });
      tone(c, 'sine', f(n + 12), t, 0.08, 0.025);
      noise(c, t, 0.04, 0.05, { filter: 'bandpass', freq: 1200, q: 2 });
    },
    perfect(c, t, streak) {
      const n = PENTA[Math.min(PENTA.length - 1, streak || 0)];
      tone(c, 'triangle', f(n + 12), t, 0.35, 0.07);
      tone(c, 'sine', f(n + 24), t + 0.03, 0.4, 0.035);
      tone(c, 'sine', f(n + 19), t + 0.06, 0.45, 0.02);
    },
    grow(c, t) {
      arpeggio(c, 'triangle', [f(24), f(28), f(31), f(36)], 0.04, 0.04, t);
    },
    cut(c, t) {
      noise(c, t, 0.12, 0.07, { filter: 'highpass', freq: 2500, to: 900 });
      tone(c, 'square', 300, t, 0.06, 0.02, { to: 180 });
    },
    miss(c, t) {
      tone(c, 'sine', 600, t, 0.6, 0.05, { to: 120 });
      noise(c, t, 0.5, 0.04, { filter: 'bandpass', freq: 1500, to: 300, q: 1 });
    },
    mission(c, t) {
      arpeggio(c, 'triangle', [f(12), f(16), f(19), f(24), f(28)], 0.07, 0.06, t);
    },
    gameover(c, t) {
      const notes = [[16, 0.22], [12, 0.22], [7, 0.22], [0, 0.6]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n), at, d * 0.95, 0.06); tone(c, 'sine', f(n - 12), at, d, 0.05); at += d; });
    },
    start(c, t) {
      arpeggio(c, 'sine', [f(0), f(7), f(12), f(19)], 0.06, 0.05, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const beat = step % 16;
    if (beat === 0) CHORDS[bar].forEach((n, i) => tone(c, 'sine', f(n - 12), at, dur * 15.5, 0.022 - i * 0.003, { dest: 'music', attack: 0.6 }));
    if (beat % 4 === 0) tone(c, 'triangle', f(CHORDS[bar][0] - 24), at, dur * 3.5, 0.06, { dest: 'music' });
    const p = PLUCKS[beat];
    if (p >= 0) {
      const n = CHORDS[bar][0] + p;
      tone(c, 'triangle', f(n), at, dur * 1.8, 0.03, { dest: 'music' });
      tone(c, 'sine', f(n + 12), at + dur * 0.5, dur * 1.2, 0.008, { dest: 'music' });
    }
    if (beat % 8 === 4) noise(c, at, 0.06, 0.012, { filter: 'bandpass', freq: 3200, q: 1, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / 92 / 2, 64);

  root.StackAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
