(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'spaceinvaders_music', musicVolume: 0.42 });
  const { tone, noise, arpeggio } = synth;
  const MARCH = [98.0, 87.31, 77.78, 73.42];
  const PAD = [[196, 233.08, 293.66], [174.61, 220, 261.63], [155.56, 196, 233.08], [146.83, 185, 220]];
  let pace = 1;
  let ufoVoice = null;
  synth.onReset(() => { ufoVoice = null; });

  const SOUNDS = {
    shoot(c, t, kind) {
      if (kind === 'laser') {
        tone(c, 'sawtooth', 1400, t, 0.16, 0.035, { to: 500 });
        tone(c, 'sine', 2200, t, 0.1, 0.02, { to: 900 });
      } else {
        tone(c, 'square', 1100, t, 0.08, 0.03, { to: 380 });
        tone(c, 'sine', 1600, t, 0.05, 0.015, { to: 700 });
      }
    },
    kill(c, t, row) {
      const k = 1 + (row || 0) * 0.08;
      noise(c, t, 0.16, 0.08, { filter: 'bandpass', freq: 1600 * k, to: 300, q: 1.1 });
      tone(c, 'square', 330 * k, t, 0.12, 0.035, { to: 90 });
    },
    bossHit(c, t) {
      tone(c, 'square', 180, t, 0.07, 0.04, { to: 120 });
      noise(c, t, 0.06, 0.04, { filter: 'highpass', freq: 2500 });
    },
    bigBoom(c, t) {
      noise(c, t, 0.9, 0.2, { filter: 'lowpass', freq: 2200, to: 90 });
      tone(c, 'sine', 120, t, 0.8, 0.22, { to: 30 });
      noise(c, t + 0.15, 0.6, 0.1, { filter: 'lowpass', freq: 900, to: 80 });
    },
    playerHit(c, t) {
      noise(c, t, 0.6, 0.18, { filter: 'lowpass', freq: 1800, to: 120 });
      tone(c, 'sawtooth', 440, t, 0.5, 0.06, { to: 60 });
    },
    shield(c, t) {
      noise(c, t, 0.07, 0.05, { filter: 'highpass', freq: 3000 });
      tone(c, 'triangle', 240, t, 0.06, 0.03, { to: 160 });
    },
    powerup(c, t) {
      arpeggio(c, 'triangle', [740, 988, 1319, 1760], 0.05, 0.055, t);
    },
    ufoHit(c, t) {
      arpeggio(c, 'square', [523, 659, 784, 1047, 1319, 1568], 0.045, 0.035, t);
      noise(c, t, 0.4, 0.08, { filter: 'bandpass', freq: 2000, to: 400, q: 1 });
    },
    wave(c, t) {
      arpeggio(c, 'triangle', [440, 554, 659, 880], 0.07, 0.06, t);
    },
    boss(c, t) {
      for (let i = 0; i < 3; i++) tone(c, 'sawtooth', 380, t + i * 0.32, 0.3, 0.05, { to: 190 });
    },
    life(c, t) {
      arpeggio(c, 'triangle', [523, 659, 784, 1047, 1319], 0.06, 0.06, t);
    },
    gameover(c, t) {
      const notes = [[330, 0.22], [262, 0.22], [196, 0.22], [131, 0.6]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'sawtooth', f, at, d * 0.95, 0.05); tone(c, 'triangle', f / 2, at, d, 0.07); at += d; });
    },
    start(c, t) {
      tone(c, 'sine', 300, t, 0.35, 0.06, { to: 1200 });
      noise(c, t, 0.3, 0.03, { filter: 'bandpass', freq: 600, to: 4000, q: 2 });
    }
  };

  function scheduleStep(c, step, at, dur) {
    const beat = step % 4;
    tone(c, 'triangle', MARCH[beat], at, Math.min(0.22, dur * 0.8), 0.16, { dest: 'music' });
    tone(c, 'square', MARCH[beat], at, Math.min(0.12, dur * 0.5), 0.025, { dest: 'music' });
    if (step % 16 === 0) {
      const chord = PAD[Math.floor(step / 16) % 4];
      chord.forEach(f => tone(c, 'sine', f, at, dur * 15, 0.012, { dest: 'music', attack: 0.4 }));
    }
    if (pace > 1.6 && step % 2 === 1) noise(c, at, 0.03, 0.012, { filter: 'highpass', freq: 7000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, 0.6, 64);

  function ufo(on) {
    const c = synth.context && synth.ready();
    if (!c) return;
    if (!on) {
      if (ufoVoice) {
        const v = ufoVoice;
        ufoVoice = null;
        v.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.05);
        setTimeout(() => v.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 400);
      }
      return;
    }
    if (ufoVoice || (root.GamePlatform && root.GamePlatform.isMuted())) return;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.connect(synth.sfxBus);
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 520;
    const lfo = c.createOscillator();
    lfo.frequency.value = 7;
    const depth = c.createGain();
    depth.gain.value = 160;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.connect(filter);
    filter.connect(gain);
    osc.start();
    lfo.start();
    gain.gain.setTargetAtTime(0.03, c.currentTime, 0.08);
    ufoVoice = { gain, nodes: [osc, lfo] };
  }

  root.InvadersAudio = {
    sfx: (name, arg) => synth.play(SOUNDS[name], arg),
    update: synth.update,
    setPace(p) {
      pace = p;
      synth.music.setStepSeconds(Math.max(0.12, 0.6 / p));
    },
    ufo,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
