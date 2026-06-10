export class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.engineBus = null;

    this.enabled = true;
    this.volume = 0.24;
    this.sfxVolume = 0.92;
    this.engineVolume = 0.26;

    this.lastPlayed = new Map();
    this.buffers = new Map();
    this.engineNodes = null;

    this.audioFiles = {
      boost: '/assets/audio/boost.ogg',
      nearMiss: '/assets/audio/near_miss.ogg',
      solarCore: '/assets/audio/solar_core.ogg',
      hyperReady: '/assets/audio/surge_ready.ogg',
      hyperStart: '/assets/audio/surge_start.ogg',
      hit: '/assets/audio/hit.ogg',
      gameover: '/assets/audio/game_over.ogg',
      engine: '/assets/audio/engine_loop.ogg',
    };
  }

  async load() {
    if (!this.enabled) return;
    await this._ensureContext(false);
    if (!this.context) return;

    const loadFile = async (name, path) => {
      try {
        const response = await fetch(path);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
      } catch {
        // External files are optional. Procedural synth fallback handles all sounds.
      }
    };

    await Promise.all(
      Object.entries(this.audioFiles).map(([name, path]) => loadFile(name, path)),
    );
  }

  async unlock() {
    if (!this.enabled) return;
    await this._ensureContext(true);
    if (!this.context) return;

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async _ensureContext(resume = false) {
    if (!this.enabled) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      this.enabled = false;
      return;
    }

    if (!this.context) {
      this.context = new AudioContext();

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.volume;

      this.sfxGain = this.context.createGain();
      this.sfxGain.gain.value = this.sfxVolume;

      this.engineBus = this.context.createGain();
      this.engineBus.gain.value = this.engineVolume;

      this.sfxGain.connect(this.masterGain);
      this.engineBus.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
    }

    if (resume && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  _canPlay(type, cooldownMs = 40) {
    const now = performance.now();
    const last = this.lastPlayed.get(type) || 0;
    if (now - last < cooldownMs) return false;
    this.lastPlayed.set(type, now);
    return true;
  }

  _playBuffer(name, gainValue = 1, loop = false, destination = this.sfxGain) {
    if (!this.context || !this.buffers.has(name)) return null;

    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(name);
    source.loop = loop;

    const gain = this.context.createGain();
    gain.gain.value = gainValue;

    source.connect(gain);
    gain.connect(destination);

    source.start(0);
    return { source, gain };
  }

  playEngine() {
    if (!this.enabled || this.engineNodes) return;

    void this.unlock().then(() => {
      if (!this.context || this.engineNodes) return;

      const bufferEngine = this._playBuffer('engine', 0.18, true, this.engineBus);
      if (bufferEngine) {
        this.engineNodes = {
          type: 'buffer',
          sources: [bufferEngine.source],
          gains: [bufferEngine.gain],
        };
        return;
      }

      this._startProceduralEngine();
    });
  }

  stopEngine() {
    if (!this.context || !this.engineNodes) return;

    const now = this.context.currentTime;
    const stopAt = now + 0.22;

    for (const gain of this.engineNodes.gains || []) {
      try {
        const current = Math.max(gain.gain.value, 0.0001);
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(current, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      } catch {
        // ignore stopped nodes
      }
    }

    for (const source of this.engineNodes.sources || []) {
      try {
        source.stop(stopAt + 0.03);
      } catch {
        // ignore already stopped nodes
      }
    }

    this.engineNodes = null;
  }

  _startProceduralEngine() {
    const now = this.context.currentTime;

    const low = this.context.createOscillator();
    const mid = this.context.createOscillator();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    low.type = 'sawtooth';
    mid.type = 'triangle';
    lfo.type = 'sine';

    low.frequency.setValueAtTime(68, now);
    mid.frequency.setValueAtTime(103, now);
    lfo.frequency.setValueAtTime(7.2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.setValueAtTime(0.8, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.044, now + 0.35);

    lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    low.connect(filter);
    mid.connect(filter);
    filter.connect(gain);
    gain.connect(this.engineBus);

    low.start(now);
    mid.start(now);
    lfo.start(now);

    this.engineNodes = {
      type: 'procedural',
      sources: [low, mid, lfo],
      gains: [gain],
    };
  }

  playNearMiss() {
    if (!this._canPlay('nearMiss', 90)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;

      const played = this._playBuffer('nearMiss', 0.62);
      this._noiseBurst(now, 0.13, played ? 0.035 : 0.07, 'bandpass', 2600, 1.6, 5200);
      this._sweep(1320, 2200, now + 0.012, 0.09, 'triangle', played ? 0.018 : 0.04);
    });
  }

  playHit() {
    if (!this._canPlay('hit', 170)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;

      const played = this._playBuffer('hit', 0.82);
      this._impact(now, played ? 0.52 : 1);
    });
  }

  playHyperReady() {
    if (!this._canPlay('hyperReady', 850)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;

      const played = this._playBuffer('hyperReady', 0.75);
      this._tone([520, 780, 1040, 1560], now, 0.24, 'triangle', played ? 0.018 : 0.05, 0.045);
      this._sparkle(now + 0.04, played ? 0.025 : 0.048);
    });
  }

  playHyperStart() {
    if (!this._canPlay('hyperStart', 1300)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;

      const played = this._playBuffer('hyperStart', 0.85);
      this._sweep(95, 180, now, 0.34, 'sawtooth', played ? 0.028 : 0.07);
      this._sweep(360, 1640, now + 0.03, 0.56, 'sawtooth', played ? 0.03 : 0.075);
      this._noiseBurst(now + 0.08, 0.42, played ? 0.035 : 0.075, 'lowpass', 1800, 0.85, 420);
      this._sparkle(now + 0.18, played ? 0.022 : 0.044);
    });
  }

  playSurgeBreak() {
    if (!this._canPlay('surgeBreak', 65)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;

      this._impact(now, 0.72);
      this._tone([220, 440, 880], now + 0.012, 0.12, 'square', 0.024, 0.018);
      this._noiseBurst(now + 0.02, 0.16, 0.052, 'bandpass', 1450, 1.1, 680);
    });
  }

  playGameOver() {
    if (!this._canPlay('gameover', 1500)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;

      const played = this._playBuffer('gameover', 0.85);
      this._tone([240, 170, 105], now, 0.68, 'sawtooth', played ? 0.03 : 0.08, 0.14);
      this._noiseBurst(now + 0.04, 0.52, played ? 0.028 : 0.06, 'lowpass', 520, 0.6, 90);
    });
  }

  playPass() {
    if (!this._canPlay('pass', 45)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;
      this._tone([650], now, 0.055, 'triangle', 0.018);
    });
  }

  play(type) {
    if (!this.enabled) return;

    if (type === 'near') return this.playNearMiss();
    if (type === 'hit' || type === 'shieldBreak') return this.playHit();
    if (type === 'hyperReady') return this.playHyperReady();
    if (type === 'hyperStart') return this.playHyperStart();
    if (type === 'gameover') return this.playGameOver();
    if (type === 'pass') return this.playPass();

    const cooldowns = {
      move: 55,
      boost: 180,
      countdown: 120,
      go: 250,
      combo: 160,
      solarCore: 90,
      openingCue: 140,
      openingDodge: 120,
      hyperCharge: 130,
      warning: 220,
      zoneEnter: 360,
      hyperEnd: 600,
      start: 350,
    };

    if (!this._canPlay(type, cooldowns[type] ?? 40)) return;

    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;

      const sounds = {
        start: () => {
          this._tone([196, 392, 784], now, 0.36, 'triangle', 0.055, 0.065);
          this._sweep(88, 132, now, 0.36, 'sine', 0.045);
        },

        move: () => {
          this._noiseBurst(now, 0.085, 0.032, 'bandpass', 1800, 1.2, 3100);
          this._sweep(420, 760, now + 0.005, 0.075, 'triangle', 0.025);
        },

        boost: () => {
          const played = this._playBuffer('boost', 0.7);
          this._thrust(now, played ? 0.55 : 1);
        },

        countdown: () => {
          this._tone([520], now, 0.075, 'square', 0.038);
          this._noiseBurst(now, 0.045, 0.018, 'bandpass', 1200, 1.4);
        },

        go: () => {
          this._tone([440, 880, 1320], now, 0.18, 'triangle', 0.052, 0.032);
          this._sweep(180, 980, now, 0.22, 'sawtooth', 0.055);
        },

        combo: () => {
          this._tone([760, 1020], now, 0.11, 'triangle', 0.035, 0.04);
          this._sparkle(now + 0.02, 0.024);
        },

        solarCore: () => {
          const played = this._playBuffer('solarCore', 0.66);
          this._solarCollect(now, played ? 0.58 : 1);
        },

        openingCue: () => {
          this._tone([430, 645], now, 0.1, 'triangle', 0.026, 0.035);
        },

        openingDodge: () => {
          this._tone([640, 960, 1280], now, 0.15, 'triangle', 0.04, 0.036);
          this._noiseBurst(now, 0.11, 0.03, 'bandpass', 2600, 1.2);
        },

        hyperCharge: () => {
          this._sweep(520, 1060, now, 0.18, 'triangle', 0.034);
          this._tone([1480], now + 0.12, 0.08, 'sine', 0.02);
        },

        warning: () => {
          this._tone([155, 116], now, 0.18, 'sawtooth', 0.04, 0.06);
          this._noiseBurst(now, 0.14, 0.025, 'bandpass', 520, 1.6, 220);
        },

        zoneEnter: () => {
          this._tone([520, 780, 1040], now, 0.18, 'triangle', 0.03, 0.045);
          this._sweep(160, 420, now, 0.22, 'sine', 0.025);
        },

        hyperEnd: () => {
          this._sweep(1040, 240, now, 0.38, 'triangle', 0.046);
          this._noiseBurst(now + 0.02, 0.2, 0.022, 'lowpass', 900, 0.8, 180);
        },
      };

      sounds[type]?.();
    });
  }

  _tone(frequencies, start, duration, type, gainValue, spacing = 0.045) {
    const list = Array.isArray(frequencies) ? frequencies : [frequencies];

    list.forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const t = start + index * spacing;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      oscillator.connect(gain);
      gain.connect(this.sfxGain);

      oscillator.start(t);
      oscillator.stop(t + duration + 0.04);
    });
  }

  _sweep(from, to, start, duration, type, gainValue) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, from), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(this.sfxGain);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  _noiseBurst(start, duration, gainValue = 0.06, filterType = 'bandpass', frequency = 900, q = 1, endFrequency = null) {
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;

    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, frequency), start);
    filter.Q.setValueAtTime(q, start);

    if (endFrequency) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }

    gain.gain.setValueAtTime(Math.max(0.0001, gainValue), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(start);
  }

  _impact(start, strength = 1) {
    this._sweep(96, 48, start, 0.18, 'sine', 0.075 * strength);
    this._noiseBurst(start, 0.22, 0.08 * strength, 'lowpass', 760, 0.9, 120);
    this._noiseBurst(start + 0.025, 0.12, 0.035 * strength, 'bandpass', 1800, 1.4, 580);
  }

  _thrust(start, strength = 1) {
    this._sweep(78, 142, start, 0.28, 'sawtooth', 0.06 * strength);
    this._sweep(260, 980, start + 0.015, 0.26, 'sawtooth', 0.055 * strength);
    this._noiseBurst(start + 0.02, 0.26, 0.052 * strength, 'lowpass', 1800, 0.75, 420);
  }

  _solarCollect(start, strength = 1) {
    this._tone([740, 1040, 1480, 1975], start, 0.18, 'sine', 0.034 * strength, 0.035);
    this._tone([2960], start + 0.09, 0.12, 'triangle', 0.018 * strength);
    this._noiseBurst(start + 0.02, 0.14, 0.022 * strength, 'bandpass', 3400, 1.1, 1900);
  }

  _sparkle(start, gainValue = 0.035) {
    const notes = [1320, 1760, 2217, 2640];

    notes.forEach((frequency, index) => {
      const t = start + index * 0.025;
      this._tone([frequency], t, 0.08, 'sine', gainValue * (1 - index * 0.13));
    });
  }
}
