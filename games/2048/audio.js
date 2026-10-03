(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: '2048_music', musicVolume: 0.32 });
  const { tone, noise, arpeggio } = synth;
  const ROOT = 220;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const CHORDS = [[0, 4, 7, 11, 14], [-3, 0, 4, 7, 11], [-7, -3, 0, 4, 9], [-5, -1, 2, 5, 9]];
  const MELODY = [12, -1, 16, -1, 14, 12, -1, 7, 9, -1, 12, -1, 11, -1, 7, -1];
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

  const SOUNDS = {
    slide(c, t) {
      noise(c, t, 0.08, 0.025, { filter: 'bandpass', freq: 700, to: 1500, q: 1.4 });
    },
    merge(c, t, value) {
      const n = SCALE[Math.min(SCALE.length - 1, Math.max(0, Math.log2(value || 4) - 2))];
      tone(c, 'triangle', f(n + 12), t, 0.12, 0.08, { to: f(n + 14) });
      tone(c, 'sine', f(n + 24), t + 0.02, 0.16, 0.035);
      if (value >= 128) tone(c, 'sine', f(n + 31), t + 0.05, 0.3, 0.025);
    },
    combo(c, t, n) {
      arpeggio(c, 'triangle', [f(12), f(16), f(19), f(24)].slice(0, Math.min(4, n + 1)), 0.05, 0.04, t);
    },
    spawn(c, t) {
      tone(c, 'sine', 1400, t, 0.04, 0.015);
    },
    undo(c, t) {
      tone(c, 'sine', 900, t, 0.16, 0.05, { to: 350 });
    },
    hint(c, t) {
      tone(c, 'sine', 880, t, 0.1, 0.04);
      tone(c, 'sine', 1320, t + 0.08, 0.14, 0.035);
    },
    best(c, t) {
      arpeggio(c, 'triangle', [f(12), f(16), f(19), f(24)], 0.06, 0.05, t);
    },
    win(c, t) {
      const notes = [[12, 0.12], [16, 0.12], [19, 0.12], [24, 0.5]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n), at, d * 0.95, 0.08); tone(c, 'sine', f(n + 12), at, d, 0.03); at += d; });
      noise(c, t, 0.8, 0.03, { filter: 'highpass', freq: 6000 });
    },
    gameover(c, t) {
      const notes = [[7, 0.2], [4, 0.2], [0, 0.2], [-5, 0.55]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n), at, d * 0.95, 0.06); at += d; });
    },
    start(c, t) {
      arpeggio(c, 'sine', [f(0), f(7), f(12), f(16)], 0.05, 0.045, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const beat = step % 16;
    const chord = CHORDS[bar];
    if (beat === 0 || beat === 10) chord.forEach((n, i) => tone(c, 'triangle', f(n - 12), at + i * 0.012, dur * 6, 0.016, { dest: 'music' }));
    if (beat % 8 === 0) tone(c, 'sine', f(chord[0] - 24), at, dur * 7, 0.07, { dest: 'music' });
    const m = MELODY[beat];
    if (m >= 0 && bar % 2 === 1) tone(c, 'sine', f(chord[0] + m), at, dur * 1.6, 0.025, { dest: 'music' });
    if (beat % 8 === 0) tone(c, 'sine', 120, at, 0.1, 0.06, { to: 50, dest: 'music' });
    if (beat % 8 === 4) noise(c, at, 0.05, 0.018, { filter: 'bandpass', freq: 2600, q: 0.8, dest: 'music' });
    if (beat % 2 === 1) noise(c, at, 0.02, 0.008, { filter: 'highpass', freq: 8000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / 84 / 2, 64);

  root.Audio2048 = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
