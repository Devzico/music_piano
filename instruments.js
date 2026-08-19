/* ========================================================================
   instruments.js — a small synthesis engine (Web Audio API), one voice
   recipe per instrument. No samples, no downloads — every timbre is
   generated on the fly from oscillators, noise and envelopes.
   ======================================================================== */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let volume = 0.7;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setVolume(percent) {
    volume = Math.max(0, Math.min(100, percent)) / 100;
    if (masterGain) masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  }

  /** A short burst of filtered noise, used for breathy/pluck attacks. */
  function noiseBuffer(context, duration) {
    const size = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, size, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function applyEnvelope(gainNode, startTime, { attack, decay, sustainLevel, release, hold }) {
    const g = gainNode.gain;
    g.cancelScheduledValues(startTime);
    g.setValueAtTime(0.0001, startTime);
    g.exponentialRampToValueAtTime(1, startTime + attack);
    g.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.0001), startTime + attack + decay);
    const releaseStart = startTime + attack + decay + hold;
    g.setValueAtTime(Math.max(sustainLevel, 0.0001), releaseStart);
    g.exponentialRampToValueAtTime(0.0001, releaseStart + release);
  }

  /* ---- Per-instrument voice recipes ---- */
  const RECIPES = {
    piano: {
      osc: [{ type: 'triangle', ratio: 1, gain: 0.8 }, { type: 'sine', ratio: 2, gain: 0.15 }],
      env: { attack: 0.004, decay: 0.35, sustainLevel: 0.15, release: 0.25, hold: 0.05 },
      filterFreq: 5200, filterQ: 0.4,
    },
    violin: {
      osc: [{ type: 'sawtooth', ratio: 1, gain: 0.5 }, { type: 'sawtooth', ratio: 1.003, gain: 0.35 }],
      env: { attack: 0.09, decay: 0.12, sustainLevel: 0.55, release: 0.35, hold: 0.18 },
      filterFreq: 3200, filterQ: 1.2,
      vibrato: { rate: 5.4, depth: 4.5 },
    },
    flute: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.7 }, { type: 'sine', ratio: 2, gain: 0.08 }],
      env: { attack: 0.07, decay: 0.1, sustainLevel: 0.45, release: 0.28, hold: 0.14 },
      filterFreq: 2600, filterQ: 0.6,
      noiseMix: 0.05,
      vibrato: { rate: 4.5, depth: 2.5 },
    },
    trumpet: {
      osc: [{ type: 'square', ratio: 1, gain: 0.35 }, { type: 'sawtooth', ratio: 1, gain: 0.3 }],
      env: { attack: 0.02, decay: 0.08, sustainLevel: 0.5, release: 0.18, hold: 0.14 },
      filterFreq: 2800, filterQ: 2.2,
    },
    guitar: {
      osc: [{ type: 'triangle', ratio: 1, gain: 0.7 }, { type: 'square', ratio: 2, gain: 0.06 }],
      env: { attack: 0.003, decay: 0.5, sustainLevel: 0.05, release: 0.2, hold: 0.02 },
      filterFreq: 4200, filterQ: 0.7,
      noiseMix: 0.06,
    },
    xylophone: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.9 }, { type: 'sine', ratio: 3.2, gain: 0.2 }],
      env: { attack: 0.002, decay: 0.22, sustainLevel: 0.01, release: 0.1, hold: 0 },
      filterFreq: 7000, filterQ: 0.3,
    },
    harpsichord: {
      osc: [{ type: 'square', ratio: 1, gain: 0.4 }, { type: 'square', ratio: 2, gain: 0.15 }],
      env: { attack: 0.002, decay: 0.28, sustainLevel: 0.02, release: 0.12, hold: 0 },
      filterFreq: 6200, filterQ: 0.5,
    },
    bells: {
      osc: [{ type: 'sine', ratio: 1, gain: 0.6 }, { type: 'sine', ratio: 2.76, gain: 0.3 }, { type: 'sine', ratio: 4.1, gain: 0.15 }],
      env: { attack: 0.004, decay: 0.9, sustainLevel: 0.05, release: 0.8, hold: 0.1 },
      filterFreq: 8000, filterQ: 0.2,
    },
  };

  function playNote(instrumentKey, frequency, durationSeconds = 0.5) {
    const context = ensureContext();
    const recipe = RECIPES[instrumentKey] || RECIPES.piano;
    const now = context.currentTime;
    const voiceBus = context.createGain();
    voiceBus.gain.value = 1;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = recipe.filterFreq;
    filter.Q.value = recipe.filterQ;
    filter.connect(voiceBus);

    let vibratoLFO = null;
    if (recipe.vibrato) {
      vibratoLFO = context.createOscillator();
      vibratoLFO.frequency.value = recipe.vibrato.rate;
      const vibratoGain = context.createGain();
      vibratoGain.gain.value = recipe.vibrato.depth;
      vibratoLFO.connect(vibratoGain);
      vibratoLFO.start(now);
      vibratoLFO.stop(now + durationSeconds + 1);
    }

    const oscillators = recipe.osc.map((layer) => {
      const osc = context.createOscillator();
      osc.type = layer.type;
      osc.frequency.value = frequency * layer.ratio;
      if (vibratoLFO) {
        const layerVibratoGain = context.createGain();
        layerVibratoGain.gain.value = recipe.vibrato.depth;
        vibratoLFO.connect(layerVibratoGain);
        layerVibratoGain.connect(osc.detune);
      }
      const layerGain = context.createGain();
      layerGain.gain.value = layer.gain;
      osc.connect(layerGain);
      layerGain.connect(filter);
      osc.start(now);
      osc.stop(now + durationSeconds + 1);
      return osc;
    });

    if (recipe.noiseMix) {
      const noise = context.createBufferSource();
      noise.buffer = noiseBuffer(context, durationSeconds + 1);
      const noiseFilter = context.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = frequency * 2;
      noiseFilter.Q.value = 1.5;
      const noiseGain = context.createGain();
      noiseGain.gain.value = recipe.noiseMix;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(filter);
      noise.start(now);
      noise.stop(now + durationSeconds + 1);
    }

    applyEnvelope(voiceBus, now, {
      attack: recipe.env.attack,
      decay: recipe.env.decay,
      sustainLevel: recipe.env.sustainLevel,
      release: recipe.env.release,
      hold: Math.max(0, durationSeconds - recipe.env.attack - recipe.env.decay) + recipe.env.hold,
    });

    voiceBus.connect(masterGain);

    const stopAt = now + durationSeconds + recipe.env.release + 1;
    oscillators.forEach((osc) => {
      osc.onended = () => { osc.disconnect(); };
    });
    setTimeout(() => { try { voiceBus.disconnect(); filter.disconnect(); } catch (e) {} }, (stopAt - now) * 1000 + 50);
  }

  return { ensureContext, setVolume, playNote, instruments: Object.keys(RECIPES) };
})();
