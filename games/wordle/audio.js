(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'wordle_music', musicVolume: 0.26 });
  const { tone, noise, arpeggio } = synth;
  const ROOT = 220;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const CHORDS = [[0, 4, 7, 14], [-3, 0, 4, 11], [-7, -3, 0, 7], [-5, -1, 2, 9]];
  const BELLS = [12, -1, -1, 16, -1, 19, -1, -1, 14, -1, -1, 12, -1, 11, -1, -1];

  const SOUNDS = {
    key(c, t) {
      tone(c, 'sine', 900 + Math.random() * 120, t, 0.04, 0.035);
      noise(c, t, 0.025, 0.02, { filter: 'highpass', freq: 3500 });
    },
    del(c, t) {
      tone(c, 'sine', 600, t, 0.05, 0.03, { to: 420 });
    },
    flip(c, t, state) {
      const freq = state === 'correct' ? 880 : state === 'present' ? 660 : 440;
      noise(c, t, 0.05, 0.035, { filter: 'bandpass', freq: 1800, q: 1.5 });
      tone(c, 'triangle', freq, t + 0.02, 0.14, state === 'absent' ? 0.03 : 0.05);
    },
    invalid(c, t) {
      tone(c, 'square', 170, t, 0.09, 0.025);
      tone(c, 'square', 150, t + 0.1, 0.12, 0.025);
    },
    win(c, t, attempts) {
      const n = Math.max(3, 8 - (attempts || 6));
      const notes = [0, 4, 7, 12, 16, 19, 24].slice(0, n).map(s => f(s + 12));
      arpeggio(c, 'triangle', notes, 0.08, 0.06, t);
      noise(c, t + notes.length * 0.08, 0.6, 0.03, { filter: 'highpass', freq: 6000 });
    },
    lose(c, t) {
      const notes = [[7, 0.2], [3, 0.2], [0, 0.2], [-5, 0.6]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n), at, d * 0.95, 0.06); at += d; });
    },
    toggle(c, t, on) {
      tone(c, 'sine', on ? 700 : 900, t, 0.08, 0.04, { to: on ? 1000 : 600 });
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const beat = step % 16;
    const chord = CHORDS[bar];
    if (beat === 0) {
      tone(c, 'sine', f(chord[0] - 12), at, dur * 15, 0.045, { dest: 'music', attack: 0.5 });
      chord.forEach(n => tone(c, 'sine', f(n), at, dur * 15, 0.009, { dest: 'music', attack: 0.8 }));
    }
    const b = BELLS[beat];
    if (b >= 0) {
      tone(c, 'sine', f(chord[0] + b + 12), at, dur * 3, 0.018, { dest: 'music' });
      tone(c, 'sine', f(chord[0] + b + 24), at, dur * 1.5, 0.004, { dest: 'music' });
    }
  }

  synth.music.configure(scheduleStep, 60 / 66 / 2, 64);

  root.WordleAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
