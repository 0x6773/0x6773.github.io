(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'minesweeper_music', musicVolume: 0.3 });
  const { tone, noise, arpeggio } = synth;
  const ROOT = 146.83;
  const f = semis => ROOT * Math.pow(2, semis / 12);
  const CHORDS = [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 7]];
  const ARP = [0, 2, 1, 3, 2, 1, 3, 0];

  const SOUNDS = {
    reveal(c, t, n) {
      const k = 0.9 + Math.random() * 0.2;
      tone(c, 'sine', 820 * k, t, 0.05, 0.05);
      noise(c, t, 0.03, 0.02, { filter: 'highpass', freq: 4000 });
      if (n > 1) {
        const steps = Math.min(8, 2 + Math.floor(Math.log2(n)));
        for (let i = 0; i < steps; i++) tone(c, 'triangle', f(24 + [0, 3, 7, 10, 12, 15, 19, 22][i]), t + i * 0.045, 0.12, 0.025);
      }
    },
    flag(c, t) {
      tone(c, 'triangle', 660, t, 0.06, 0.06, { to: 990 });
      noise(c, t, 0.04, 0.03, { filter: 'bandpass', freq: 2200, q: 2 });
    },
    unflag(c, t) {
      tone(c, 'triangle', 990, t, 0.06, 0.05, { to: 600 });
    },
    chord(c, t) {
      tone(c, 'sine', 700, t, 0.05, 0.05);
      tone(c, 'sine', 940, t + 0.04, 0.07, 0.045);
    },
    deny(c, t) {
      tone(c, 'square', 160, t, 0.08, 0.025);
    },
    boom(c, t) {
      noise(c, t, 0.7, 0.2, { filter: 'lowpass', freq: 2200, to: 80 });
      tone(c, 'sine', 110, t, 0.6, 0.2, { to: 30 });
      tone(c, 'sawtooth', 220, t, 0.25, 0.04, { to: 60 });
    },
    pop(c, t) {
      noise(c, t, 0.18, 0.06, { filter: 'lowpass', freq: 1600, to: 200 });
      tone(c, 'sine', 160, t, 0.15, 0.06, { to: 60 });
    },
    hint(c, t) {
      tone(c, 'sine', 1046, t, 0.1, 0.04);
      tone(c, 'sine', 1568, t + 0.08, 0.16, 0.035);
    },
    mode(c, t, on) {
      tone(c, 'triangle', on ? 520 : 780, t, 0.06, 0.04, { to: on ? 780 : 520 });
    },
    win(c, t) {
      const notes = [[0, 0.12], [7, 0.12], [12, 0.12], [16, 0.12], [19, 0.5]];
      let at = t;
      notes.forEach(([n, d]) => { tone(c, 'triangle', f(n + 12), at, d * 0.95, 0.07); tone(c, 'sine', f(n + 24), at, d, 0.02); at += d; });
      noise(c, t, 0.9, 0.03, { filter: 'highpass', freq: 6000 });
    },
    start(c, t) {
      arpeggio(c, 'sine', [f(12), f(19), f(24)], 0.06, 0.04, t);
    }
  };

  function scheduleStep(c, step, at, dur) {
    const bar = Math.floor(step / 8) % CHORDS.length;
    const beat = step % 8;
    const chord = CHORDS[bar];
    if (beat === 0) {
      tone(c, 'sine', f(chord[0] - 12), at, dur * 7.5, 0.06, { dest: 'music', attack: 0.3 });
      chord.forEach(n => tone(c, 'sine', f(n), at, dur * 7.8, 0.011, { dest: 'music', attack: 0.5 }));
    }
    tone(c, 'triangle', f(chord[ARP[beat]] + 12), at, dur * 1.4, 0.018, { dest: 'music' });
    if (beat === 4) noise(c, at, 0.05, 0.01, { filter: 'bandpass', freq: 3000, q: 1, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 60 / 76 / 2, 64);

  root.MinesAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
