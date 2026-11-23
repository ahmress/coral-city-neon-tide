// audio.js — every sound in Coral City is synthesized with WebAudio.
// No audio files: an oscillator engine hum that follows your speed, a
// two-tone siren, filtered noise for drift and gunfire, little chimes for
// pickups and deliveries, and a slow night pad under everything.
'use strict';

const Snd = {
  ctx: null, master: null, muted: false,
  engOsc: null, engGain: null, sirOsc: null, sirGain: null,
  driftSrc: null, driftGain: null, noiseBuf: null, sirenT: 0,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.4;
      this.master.connect(ctx.destination);
      // a shared noise buffer for drift, crashes and gunshots
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._engine();
      this._siren();
      this._drift();
      this._pad();
    } catch (e) {
      this.ctx = null;
    }
  },

  _engine() {
    const ctx = this.ctx;
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc.frequency.value = 55;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(lp); lp.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engOsc.start();
  },

  _siren() {
    const ctx = this.ctx;
    this.sirOsc = ctx.createOscillator();
    this.sirOsc.type = 'triangle';
    this.sirOsc.frequency.value = 760;
    this.sirGain = ctx.createGain();
    this.sirGain.gain.value = 0;
    this.sirOsc.connect(this.sirGain);
    this.sirGain.connect(this.master);
    this.sirOsc.start();
  },

  _drift() {
    const ctx = this.ctx;
    this.driftSrc = ctx.createBufferSource();
    this.driftSrc.buffer = this.noiseBuf;
    this.driftSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    this.driftGain = ctx.createGain();
    this.driftGain.gain.value = 0;
    this.driftSrc.connect(bp); bp.connect(this.driftGain);
    this.driftGain.connect(this.master);
    this.driftSrc.start();
  },

  _pad() {
    // two detuned triangles breathing slowly: the night under the city
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.016;
    g.connect(this.master);
    [110, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = i ? 6 : -4;
      o.connect(g);
      o.start();
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.007;
    lfo.connect(lg); lg.connect(g.gain);
    lfo.start();
  },

  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(dur, vol, freq) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); src.stop(ctx.currentTime + dur + 0.02);
  },

  chime(kind) {
    if (!this.ctx) return;
    if (kind === 'pickup') { this.tone(660, 0.1, 'square', 0.1); this.tone(880, 0.14, 'square', 0.1, 0, 0.08); }
    else if (kind === 'deliver') { this.tone(523, 0.1, 'square', 0.1); this.tone(659, 0.1, 'square', 0.1, 0, 0.09); this.tone(784, 0.2, 'square', 0.12, 0, 0.18); }
    else if (kind === 'fail') { this.tone(300, 0.2, 'sawtooth', 0.1, 180); this.tone(200, 0.3, 'sawtooth', 0.1, 120, 0.15); }
    else if (kind === 'shot') { this.noise(0.09, 0.22, 2600); this.tone(180, 0.06, 'square', 0.1, 60); }
    else if (kind === 'crash') { this.noise(0.25, 0.25, 500); }
    else if (kind === 'stinger') { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, 0, i * 0.09)); }
    else if (kind === 'crime') { this.tone(196, 0.12, 'square', 0.09); this.tone(185, 0.16, 'square', 0.09, 0, 0.1); }
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.4;
  },

  // Called every frame: engine pitch follows speed, the siren swells with
  // the nearest police car, and the drift loop follows the tires.
  update(dt, o) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engGain) {
      const on = o.engineOn && !this.muted;
      this.engGain.gain.setTargetAtTime(on ? 0.055 : 0, t, 0.08);
      if (o.engineOn) this.engOsc.frequency.setTargetAtTime(52 + o.engineNorm * 165, t, 0.05);
    }
    if (this.sirGain) {
      this.sirenT += dt * 5.2;
      const near = clamp(1 - o.sirenDist / 620, 0, 1);
      this.sirGain.gain.setTargetAtTime(near * 0.05, t, 0.1);
      this.sirOsc.frequency.setTargetAtTime(720 + Math.sin(this.sirenT) * 240, t, 0.03);
    }
    if (this.driftGain) {
      this.driftGain.gain.setTargetAtTime(o.drifting ? 0.06 : 0, t, 0.05);
    }
  }
};
