(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'sudoku_music', musicVolume: 0.3 });
  const { tone, noise, arpeggio } = synth;
  const ROOT = 196;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  const CHORDS = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]];
  const PHRASE = [7, -1, 9, 12, -1, 9, 7, -1, 4, -1, 7, -1, 2, -1, -1, -1];

  function piano(c, freq, at, dur, vol) {
    tone(c, 'triangle', freq, at, dur, vol, { dest: 'music' });
    tone(c, 'sine', freq * 2, at, dur * 0.6, vol * 0.25, { dest: 'music' });
  }

  const SOUNDS = {
    place(c, t, num) {
      const n = PENTA[((num || 1) - 1) % PENTA.length];
      tone(c, 'triangle', f(n + 12), t, 0.18, 0.06);
      tone(c, 'sine', f(n + 24), t, 0.1, 0.02);
      noise(c, t, 0.04, 0.02, { filter: 'bandpass', freq: 3000, q: 1.5 });
    },
    note(c, t) {
      noise(c, t, 0.05, 0.035, { filter: 'bandpass', freq: 4200, q: 2.5 });
    },
    erase(c, t) {
      noise(c, t, 0.12, 0.03, { filter: 'bandpass', freq: 1800, to: 900, q: 1.2 });
    },
    error(c, t) {
      tone(c, 'sine', 180, t, 0.18, 0.08, { to: 130 });
      tone(c, 'triangle', 233, t, 0.12, 0.03);
    },
    complete(c, t, count) {
      const notes = [f(12), f(16), f(19), f(24), f(28)].slice(0, 3 + Math.min(2, (count || 1) - 1));
      arpeggio(c, 'triangle', notes, 0.06, 0.045, t);
    },
    autonotes(c, t) {
      for (let i = 0; i < 6; i++) noise(c, t + i * 0.035, 0.03, 0.02, { filter: 'bandpass', freq: 3800 + i * 200, q: 3 });
    },
    hint(c, t) {
      tone(c, 'sine', 1175, t, 0.12, 0.04);
      tone(c, 'sine', 1568, t + 0.09, 0.18, 0.035);
    },
    undo(c, t) {
      tone(c, 'sine', 700, t, 0.12, 0.04, { to: 420 });
    },
    win(c, t) {
      const notes = [[0, 0.14], [4, 0.14], [7, 0.14], [12, 0.14], [16, 0.6]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n + 12), at, d * 1.2, 0.07); tone(c, 'sine', f(n + 24), at, d, 0.02); at += d; });
    },
    start(c, t) {
      arpeggio(c, 'triangle', [f(12), f(19), f(24)], 0.07, 0.04, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const beat = step % 16;
    const chord = CHORDS[bar];
    if (beat === 0) {
      tone(c, 'sine', f(chord[0] - 12), at, dur * 15, 0.05, { dest: 'music', attack: 0.4 });
      chord.forEach((n, i) => piano(c, f(n), at + i * 0.05, dur * 6, 0.014));
    }
    if (beat === 8) chord.slice(1).forEach((n, i) => piano(c, f(n), at + i * 0.04, dur * 5, 0.01));
    const p = PHRASE[beat];
    if (p >= 0 && bar % 2 === 0) piano(c, f(chord[0] + p + 12), at, dur * 2.5, 0.022);
  }

  synth.music.configure(scheduleStep, 60 / 70 / 2, 64);

  root.SudokuAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
