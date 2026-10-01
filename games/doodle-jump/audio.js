(function (root) {
  'use strict';

  const synth = root.GameSynth.create({ musicKey: 'doodlejump_music', musicVolume: 0.45 });
  const { tone, noise, arpeggio } = synth;
  const NOTE = {
    F2: 87.31, G2: 98.0, A2: 110.0, C3: 130.81,
    A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5, D6: 1174.66
  };
  const CHORDS = ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'];
  const LEAD = [
    'C5', 'E5', 'G5', 'E5', 'C6', '', 'G5', '',
    'B4', 'D5', 'G5', 'D5', 'B5', '', 'G5', '',
    'A4', 'C5', 'E5', 'C5', 'A5', '', 'E5', '',
    'F5', 'E5', 'D5', 'C5', 'A4', 'C5', 'D5', '',
    'E5', '', 'G5', 'E5', 'C6', 'B5', 'A5', 'G5',
    'D5', '', 'G5', 'D5', 'B5', 'A5', 'G5', 'D5',
    'C5', 'D5', 'F5', 'A5', 'C6', 'A5', 'F5', 'D5',
    'B4', 'D5', 'G5', 'B5', 'D6', '', '', ''
  ];
  const BASS_SHAPE = [0, 12, 7, 12, 0, 12, 7, 12];
  const EIGHTH = 60 / 150 / 2;

  let loopVoice = null;
  synth.onReset(() => { loopVoice = null; });

  const SOUNDS = {
    bounce(c, t) {
      const k = 0.94 + Math.random() * 0.12;
      tone(c, 'sine', 330 * k, t, 0.12, 0.13, { to: 720 * k, slide: 0.08 });
      tone(c, 'triangle', 660 * k, t, 0.06, 0.03, { to: 1300 * k });
    },
    shoes(c, t) {
      tone(c, 'sine', 260, t, 0.22, 0.12, { to: 900, slide: 0.16, vibrato: 18 });
    },
    spring(c, t) {
      tone(c, 'sine', 240, t, 0.38, 0.13, { to: 1250, slide: 0.3, vibrato: 22 });
      tone(c, 'triangle', 1800, t, 0.08, 0.03);
    },
    trampoline(c, t) {
      tone(c, 'sine', 150, t, 0.12, 0.16, { to: 70 });
      noise(c, t, 0.5, 0.06, { filter: 'bandpass', freq: 400, to: 3000, q: 2, attack: 0.05 });
      tone(c, 'triangle', 300, t + 0.04, 0.45, 0.07, { to: 1400, slide: 0.4 });
    },
    crack(c, t) {
      noise(c, t, 0.12, 0.14, { filter: 'bandpass', freq: 1400, q: 1.5 });
      tone(c, 'triangle', 180, t, 0.12, 0.08, { to: 80 });
    },
    trap(c, t) {
      noise(c, t, 0.18, 0.14, { filter: 'bandpass', freq: 900, q: 1.2 });
      tone(c, 'triangle', 220, t, 0.3, 0.08, { to: 70 });
    },
    poof(c, t) {
      noise(c, t, 0.3, 0.08, { filter: 'lowpass', freq: 1500, to: 300 });
    },
    pickup(c, t) {
      arpeggio(c, 'triangle', [784, 988, 1175, 1568, 1976], 0.05, 0.06, t);
    },
    jetpack(c, t) {
      noise(c, t, 0.4, 0.1, { filter: 'lowpass', freq: 300, to: 3000, attack: 0.2 });
      arpeggio(c, 'square', [392, 523, 659, 784], 0.05, 0.03, t);
    },
    propeller(c, t) {
      tone(c, 'triangle', 500, t, 0.35, 0.05, { to: 900, vibrato: 30 });
      arpeggio(c, 'triangle', [659, 880, 1047], 0.06, 0.04, t + 0.1);
    },
    shield(c, t) {
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(c, 'sine', f, t + i * 0.03, 0.5, 0.035));
    },
    powerEnd(c, t) {
      noise(c, t, 0.25, 0.05, { filter: 'lowpass', freq: 2000, to: 200 });
      tone(c, 'triangle', 600, t, 0.2, 0.04, { to: 250 });
    },
    stomp(c, t) {
      noise(c, t, 0.12, 0.13, { filter: 'lowpass', freq: 700 });
      tone(c, 'sine', 320, t, 0.18, 0.14, { to: 110 });
      tone(c, 'square', 880, t + 0.06, 0.08, 0.03, { to: 1400 });
    },
    smash(c, t) {
      noise(c, t, 0.2, 0.15, { filter: 'lowpass', freq: 1200, to: 300 });
      tone(c, 'sine', 260, t, 0.25, 0.16, { to: 60 });
    },
    shieldHit(c, t) {
      tone(c, 'sine', 700, t, 0.2, 0.06, { to: 1300 });
      noise(c, t, 0.06, 0.04, { filter: 'highpass', freq: 4000 });
    },
    hit(c, t) {
      tone(c, 'triangle', 620, t, 0.12, 0.12, { to: 200 });
      tone(c, 'sine', 900, t + 0.12, 1.0, 0.07, { to: 120, slide: 0.95 });
    },
    blackhole(c, t) {
      tone(c, 'sine', 700, t, 1.2, 0.09, { to: 50, slide: 1.1, vibrato: 9 });
      noise(c, t, 1.1, 0.06, { filter: 'lowpass', freq: 3000, to: 120 });
    },
    fall(c, t) {
      tone(c, 'sine', 1100, t, 1.2, 0.07, { to: 140, slide: 1.15 });
    },
    milestone(c, t) {
      const notes = [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.2], [988, 0.09], [1047, 0.35]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'square', f, at, d * 0.95, 0.035); tone(c, 'triangle', f / 2, at, d * 0.95, 0.05); at += d; });
    },
    start(c, t) {
      arpeggio(c, 'triangle', [523, 659, 784, 1047], 0.06, 0.06, t);
    },
    gameover(c, t) {
      const notes = [[523, 0.16], [440, 0.16], [349, 0.16], [262, 0.4]];
      let at = t;
      notes.forEach(([f, d]) => { tone(c, 'triangle', f, at, d * 0.95, 0.07); at += d; });
    }
  };

  function loop(kind) {
    const c = synth.context && synth.ready();
    if (!c) return;
    const now = c.currentTime;
    if (loopVoice && loopVoice.kind !== kind) {
      const v = loopVoice;
      loopVoice = null;
      v.gain.gain.setTargetAtTime(0.0001, now, 0.06);
      setTimeout(() => { v.nodes.forEach(n => { try { n.stop(); } catch (e) { } }); }, 400);
    }
    if (!kind || loopVoice) return;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.connect(synth.sfxBus);
    const nodes = [];
    if (kind === 'jetpack') {
      const src = c.createBufferSource();
      src.buffer = synth.noiseBuffer;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      src.connect(filter);
      filter.connect(gain);
      const rumble = c.createOscillator();
      rumble.type = 'sawtooth';
      rumble.frequency.value = 55;
      const rumbleGain = c.createGain();
      rumbleGain.gain.value = 0.25;
      rumble.connect(rumbleGain);
      rumbleGain.connect(filter);
      src.start();
      rumble.start();
      nodes.push(src, rumble);
      gain.gain.setTargetAtTime(0.09, now, 0.08);
    } else {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 180;
      const am = c.createGain();
      am.gain.value = 0.5;
      const lfo = c.createOscillator();
      lfo.frequency.value = 22;
      const depth = c.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth);
      depth.connect(am.gain);
      osc.connect(am);
      am.connect(gain);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
      gain.gain.setTargetAtTime(0.05, now, 0.08);
    }
    loopVoice = { kind, gain, nodes };
  }

  function scheduleStep(c, step, at) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    const rootNote = NOTE[CHORDS[bar]];
    tone(c, 'triangle', rootNote * Math.pow(2, BASS_SHAPE[beat] / 12), at, EIGHTH * 0.85, 0.08, { dest: 'music' });
    const lead = LEAD[(bar * 8 + beat) % LEAD.length];
    if (lead) {
      tone(c, 'triangle', NOTE[lead], at, EIGHTH * 0.9, 0.05, { dest: 'music' });
      tone(c, 'square', NOTE[lead], at, EIGHTH * 0.6, 0.01, { dest: 'music' });
    }
    if (beat === 0 || beat === 4) tone(c, 'sine', 140, at, 0.1, 0.1, { to: 50, dest: 'music' });
    if (beat === 2 || beat === 6) noise(c, at, 0.08, 0.035, { filter: 'bandpass', freq: 2200, q: 0.8, dest: 'music' });
    if (beat % 2 === 1) noise(c, at, 0.03, 0.018, { filter: 'highpass', freq: 8000, dest: 'music' });
  }

  synth.music.configure(scheduleStep, EIGHTH, 64);

  root.DoodleAudio = {
    sfx: name => synth.play(SOUNDS[name]),
    loop,
    update: synth.update,
    music: synth.music
  };
})(typeof window !== 'undefined' ? window : globalThis);
