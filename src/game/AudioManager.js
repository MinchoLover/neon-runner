export class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.enabled = true;
    this.volume = 0.22;
    this.lastPlayed = new Map();
  }

  async unlock() {
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
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  _canPlay(type, cooldownMs) {
    const now = performance.now();
    const last = this.lastPlayed.get(type) || 0;
    if (now - last < cooldownMs) return false;
    this.lastPlayed.set(type, now);
    return true;
  }

  playNearMiss() {
    if (!this._canPlay('nearMiss', 100)) return;
    void this.unlock().then(() => {
      if (!this.context) return;
      this._tone([980, 1320], this.context.currentTime, 0.1, 'triangle', 0.052);
    });
  }

  playHit() {
    if (!this._canPlay('hit', 200)) return;
    void this.unlock().then(() => {
      if (!this.context) return;
      this._noiseHit(this.context.currentTime, 0.22);
    });
  }

  playHyperReady() {
    if (!this._canPlay('hyperReady', 1000)) return;
    void this.unlock().then(() => {
      if (!this.context) return;
      this._tone([660, 990, 1320], this.context.currentTime, 0.24, 'triangle', 0.058);
    });
  }

  playHyperStart() {
    if (!this._canPlay('hyperStart', 2000)) return;
    void this.unlock().then(() => {
      if (!this.context) return;
      this._sweep(220, 1460, this.context.currentTime, 0.62, 'sawtooth', 0.075);
    });
  }

  playGameOver() {
    if (!this._canPlay('gameover', 2000)) return;
    void this.unlock().then(() => {
      if (!this.context) return;
      this._tone([260, 190, 120], this.context.currentTime, 0.7, 'sawtooth', 0.1);
    });
  }

  playPass() {
    if (!this._canPlay('pass', 50)) return;
    void this.unlock().then(() => {
      if (!this.context) return;
      this._tone([620], this.context.currentTime, 0.06, 'triangle', 0.02);
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
    
    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;
      const sounds = {
        start: () => this._tone([220, 440, 880], now, 0.42, 'triangle', 0.12),
        move: () => this._tone([520, 780], now, 0.09, 'square', 0.06),
        boost: () => this._sweep(180, 920, now, 0.34, 'sawtooth', 0.09),
        countdown: () => this._tone([520], now, 0.08, 'square', 0.045),
        go: () => this._tone([440, 880, 1320], now, 0.22, 'triangle', 0.07),
        combo: () => this._tone([720, 960], now, 0.12, 'triangle', 0.045),
        openingCue: () => this._tone([420, 630], now, 0.1, 'triangle', 0.026),
        openingDodge: () => this._tone([620, 930, 1240], now, 0.16, 'triangle', 0.045),
        hyperCharge: () => this._sweep(520, 980, now, 0.2, 'triangle', 0.038),
        warning: () => this._tone([160, 120], now, 0.18, 'sawtooth', 0.045),
        zoneEnter: () => this._tone([580, 870, 1160], now, 0.18, 'triangle', 0.034),
        hyperEnd: () => this._sweep(960, 260, now, 0.42, 'triangle', 0.052),
      };
      sounds[type]?.();
    });
  }

  _tone(frequencies, start, duration, type, gainValue) {
    frequencies.forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const t = start + index * 0.045;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(gainValue, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(t);
      oscillator.stop(t + duration + 0.03);
    });
  }

  _sweep(from, to, start, duration, type, gainValue) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  _noiseHit(start, duration) {
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, start);
    filter.frequency.exponentialRampToValueAtTime(110, start + duration);
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(start);
  }
}
