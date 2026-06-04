export class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.enabled = true;
    this.volume = 0.22;
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

  play(type) {
    if (!this.enabled) return;
    void this.unlock().then(() => {
      if (!this.context) return;
      const now = this.context.currentTime;
      const sounds = {
        start: () => this._tone([220, 440, 880], now, 0.42, 'triangle', 0.12),
        move: () => this._tone([520, 780], now, 0.09, 'square', 0.06),
        boost: () => this._sweep(180, 920, now, 0.34, 'sawtooth', 0.09),
        countdown: () => this._tone([520], now, 0.08, 'square', 0.045),
        go: () => this._tone([440, 880, 1320], now, 0.22, 'triangle', 0.07),
        near: () => this._tone([980, 1320], now, 0.1, 'triangle', 0.052),
        hit: () => this._noiseHit(now, 0.18),
        shieldBreak: () => this._noiseHit(now, 0.26),
        gameover: () => this._tone([260, 190, 120], now, 0.7, 'sawtooth', 0.1),
        combo: () => this._tone([720, 960], now, 0.12, 'triangle', 0.045),
        pass: () => this._tone([620], now, 0.08, 'triangle', 0.028),
        turn: () => this._sweep(360, 1240, now, 0.32, 'triangle', 0.058),
        warning: () => this._tone([160, 120], now, 0.18, 'sawtooth', 0.045),
        turnWarning: () => this._tone([360, 540], now, 0.12, 'square', 0.034),
        turnSuccess: () => this._sweep(420, 1380, now, 0.3, 'triangle', 0.052),
        turnFail: () => this._tone([170, 120, 90], now, 0.26, 'sawtooth', 0.05),
        tunnelTransition: () => this._sweep(260, 1040, now, 0.48, 'sawtooth', 0.038),
        zoneEnter: () => this._tone([580, 870, 1160], now, 0.18, 'triangle', 0.034),
        hyperStart: () => this._sweep(220, 1460, now, 0.62, 'sawtooth', 0.075),
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
