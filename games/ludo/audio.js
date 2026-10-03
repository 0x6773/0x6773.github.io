(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'ludo_music', musicVolume: 0.32 });
  const { tone, noise, arpeggio } = synth;
  const ROOT = 261.63;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const CHORDS = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
  const MARIMBA = [12, 16, 19, 16, 14, 12, -1, 7, 9, 12, 14, -1, 16, 14, 12, -1];

  const SOUNDS = {
    diceRoll(c, t) {
      for (let i = 0; i < 7; i++) {
        noise(c, t + i * 0.07 + Math.random() * 0.02, 0.03, 0.06, { filter: 'bandpass', freq: 1800 + Math.random() * 1600, q: 3 });
      }
    },
    diceResult(c, t, value) {
      noise(c, t, 0.05, 0.08, { filter: 'lowpass', freq: 1400 });
      tone(c, 'triangle', value === 6 ? 880 : 520, t, 0.12, 0.06);
      if (value === 6) arpeggio(c, 'sine', [f(24), f(28), f(31)], 0.05, 0.03, t + 0.06);
    },
    step(c, t, n) {
      const k = (n || 0) % 8;
      tone(c, 'triangle', f(12 + [0, 2, 4, 5, 7, 9, 11, 12][k]), t, 0.06, 0.05);
      noise(c, t, 0.025, 0.02, { filter: 'bandpass', freq: 2500, q: 2 });
    },
    enter(c, t) {
      tone(c, 'sine', 300, t, 0.14, 0.08, { to: 900 });
      noise(c, t, 0.06, 0.03, { filter: 'highpass', freq: 3000 });
    },
    capture(c, t) {
      noise(c, t, 0.12, 0.12, { filter: 'lowpass', freq: 1200 });
      tone(c, 'square', 200, t, 0.1, 0.05, { to: 120 });
      tone(c, 'sine', 1400, t + 0.08, 0.5, 0.05, { to: 200 });
    },
    home(c, t) {
      arpeggio(c, 'triangle', [f(12), f(16), f(19), f(24)], 0.07, 0.06, t);
      noise(c, t + 0.2, 0.4, 0.02, { filter: 'highpass', freq: 6000 });
    },
    win(c, t) {
      const notes = [[0, 0.12], [4, 0.12], [7, 0.12], [12, 0.24], [7, 0.12], [12, 0.6]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'square', f(n + 12), at, d * 0.9, 0.03); tone(c, 'triangle', f(n + 12), at, d, 0.07); at += d; });
      noise(c, t + 0.5, 0.8, 0.03, { filter: 'highpass', freq: 6000 });
    },
    lose(c, t) {
      const notes = [[7, 0.2], [5, 0.2], [4, 0.2], [0, 0.6]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n), at, d * 0.95, 0.06); at += d; });
    },
    turn(c, t) {
      tone(c, 'sine', f(19), t, 0.12, 0.05);
      tone(c, 'sine', f(24), t + 0.09, 0.18, 0.045);
    },
    chat(c, t) {
      tone(c, 'sine', 880, t, 0.08, 0.04);
    },
    emoji(c, t) {
      tone(c, 'sine', 1200, t, 0.08, 0.05, { to: 1600 });
    },
    tick(c, t) {
      tone(c, 'square', 1000, t, 0.04, 0.03);
    },
    error(c, t) {
      tone(c, 'square', 180, t, 0.15, 0.04);
    },
    start(c, t) {
      arpeggio(c, 'triangle', [f(0), f(4), f(7), f(12)], 0.06, 0.05, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const beat = step % 16;
    const chord = CHORDS[bar];
    if (beat % 4 === 0) tone(c, 'triangle', f(chord[0] - 24), at, dur * 1.6, 0.07, { dest: 'music' });
    if (beat % 4 === 2) tone(c, 'triangle', f(chord[2] - 24), at, dur * 1.2, 0.05, { dest: 'music' });
    if (beat % 8 === 4) chord.forEach(n => tone(c, 'sine', f(n), at, dur * 0.8, 0.012, { dest: 'music' }));
    const m = MARIMBA[beat];
    if (m >= 0) {
      tone(c, 'sine', f(chord[0] + m), at, dur * 0.9, 0.028, { dest: 'music' });
      tone(c, 'sine', f(chord[0] + m + 24), at, dur * 0.3, 0.006, { dest: 'music' });
    }
    if (beat % 2 === 1) noise(c, at, 0.02, 0.008, { filter: 'highpass', freq: 7500, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / 118 / 2, 64);

  root.LudoAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
