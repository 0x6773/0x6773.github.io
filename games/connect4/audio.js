(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'connect4_music', musicVolume: 0.32 });
  const { tone, noise, arpeggio } = synth;
  const ROOT = 196;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const CHORDS = [[0, 4, 7, 10], [5, 9, 12, 15], [0, 4, 7, 10], [7, 11, 14, 17]];
  const BASS = [0, -1, 7, -1, 10, -1, 7, -1, 0, -1, 7, -1, 12, -1, 10, 7];
  const LEAD = [12, -1, 16, -1, 19, 16, -1, 12, 14, -1, 10, -1, 12, -1, -1, -1];

  const SOUNDS = {
    drop(c, t, row) {
      const depth = (row == null ? 3 : row) / 5;
      noise(c, t, 0.06, 0.08, { filter: 'bandpass', freq: 2400 - depth * 900, q: 2 });
      tone(c, 'triangle', 520 - depth * 220, t, 0.1, 0.09, { to: 260 - depth * 90 });
      noise(c, t + 0.09, 0.03, 0.03, { filter: 'bandpass', freq: 2600, q: 3 });
      tone(c, 'triangle', 420 - depth * 140, t + 0.1, 0.05, 0.03);
    },
    hover(c, t) {
      tone(c, 'sine', 1300, t, 0.025, 0.012);
    },
    undo(c, t) {
      tone(c, 'sine', 320, t, 0.18, 0.05, { to: 900 });
    },
    win(c, t) {
      const notes = [[0, 0.1], [4, 0.1], [7, 0.1], [12, 0.1], [7, 0.1], [12, 0.5]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'square', f(n + 12), at, d * 0.9, 0.035); tone(c, 'triangle', f(n + 12), at, d, 0.06); at += d; });
      noise(c, t + 0.4, 0.7, 0.03, { filter: 'highpass', freq: 6000 });
    },
    lose(c, t) {
      const notes = [[7, 0.2], [6, 0.2], [5, 0.2], [0, 0.55]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n), at, d * 0.95, 0.06); at += d; });
    },
    draw(c, t) {
      arpeggio(c, 'triangle', [f(7), f(5), f(7)], 0.14, 0.05, t);
    },
    start(c, t) {
      arpeggio(c, 'triangle', [f(0), f(4), f(7), f(12)], 0.06, 0.05, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const beat = step % 16;
    const chord = CHORDS[bar];
    const bass = BASS[beat];
    if (bass >= 0) tone(c, 'triangle', f(chord[0] + bass - 24), at, dur * 0.9, 0.06, { dest: 'music' });
    if (beat % 4 === 2) chord.slice(1).forEach(n => tone(c, 'square', f(n), at, dur * 0.5, 0.008, { dest: 'music' }));
    if (beat % 8 === 0) tone(c, 'sine', 140, at, 0.12, 0.08, { to: 50, dest: 'music' });
    if (beat % 8 === 4) noise(c, at, 0.08, 0.03, { filter: 'bandpass', freq: 2200, q: 0.9, dest: 'music' });
    if (beat % 2 === 1) noise(c, at, 0.02, 0.01, { filter: 'highpass', freq: 8000, dest: 'music' });
    const lead = LEAD[beat];
    if (lead >= 0 && bar % 2 === 1) tone(c, 'triangle', f(chord[0] + lead), at, dur * 1.4, 0.022, { dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / 112 / 2, 64);

  root.Connect4Audio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
