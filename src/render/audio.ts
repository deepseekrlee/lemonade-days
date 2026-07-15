/**
 * All audio is synthesized with WebAudio — no samples, no licenses to clear.
 * One chill 4-chord loop (~84 BPM), vinyl crackle, rain layer, and tiny SFX.
 */
const BPM = 84;
const EIGHTH = 60 / BPM / 2;
// Fmaj7 / Am7 / Dm7 / Gm7-ish — summer porch chords (as MIDI notes)
const CHORDS: number[][] = [
  [53, 57, 60, 64],
  [57, 60, 64, 67],
  [50, 53, 57, 60],
  [55, 58, 62, 65],
];
const ARP_ORDER = [0, 1, 2, 3, 2, 3, 1, 2];
const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private music!: GainNode;
  private sfx!: GainNode;
  private rainGain!: GainNode;
  private musicOn = true;
  private sfxOn = true;
  private rainOn = false;
  private beat = 0;
  private nextT = 0;
  private lastCoin = 0;

  setPrefs(music: boolean, sfx: boolean): void {
    this.musicOn = music;
    this.sfxOn = sfx;
    if (this.ctx) {
      this.music.gain.value = music ? 0.5 : 0;
      this.sfx.gain.value = sfx ? 0.55 : 0;
    }
  }

  setRain(on: boolean): void {
    this.rainOn = on;
    if (this.ctx) this.rainGain.gain.linearRampToValueAtTime(on ? 0.06 : 0, this.ctx.currentTime + 1.2);
  }

  /** Must be called from a user gesture (autoplay policy). Safe to call repeatedly. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.rainGain = ctx.createGain();
    this.music.connect(master);
    this.sfx.connect(master);
    this.rainGain.connect(master);
    this.setPrefs(this.musicOn, this.sfxOn);

    // noise bed: vinyl crackle + rain (same buffer, different filters)
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const crackleSrc = ctx.createBufferSource();
    crackleSrc.buffer = noise;
    crackleSrc.loop = true;
    const crackleHP = ctx.createBiquadFilter();
    crackleHP.type = 'highpass';
    crackleHP.frequency.value = 2600;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.012;
    crackleSrc.connect(crackleHP).connect(crackleGain).connect(this.music);
    crackleSrc.start();

    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noise;
    rainSrc.loop = true;
    const rainBP = ctx.createBiquadFilter();
    rainBP.type = 'bandpass';
    rainBP.frequency.value = 620;
    rainBP.Q.value = 0.6;
    this.rainGain.gain.value = this.rainOn ? 0.06 : 0;
    rainSrc.connect(rainBP).connect(this.rainGain);
    rainSrc.start();

    this.nextT = ctx.currentTime + 0.1;
    window.setInterval(() => this.schedule(), 40);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextT < ctx.currentTime + 0.14) {
      this.beatAt(this.beat, this.nextT);
      this.beat++;
      this.nextT += EIGHTH;
    }
  }

  private beatAt(b: number, t: number): void {
    const bar = Math.floor(b / 8) % CHORDS.length;
    const i = b % 8;
    const chord = CHORDS[bar];
    if (i === 0) this.tone(midi(chord[0] - 12), 'sine', t, EIGHTH * 7, 0.11, this.music);
    const note = chord[ARP_ORDER[i]] + (Math.floor(b / 32) % 2 === 1 && i === 7 ? 12 : 0);
    this.tone(midi(note), 'triangle', t, EIGHTH * 1.6, 0.045, this.music);
    if (i % 2 === 1) this.hat(t);
  }

  private tone(freq: number, type: OscillatorType, t: number, dur: number, gain: number, out: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private hat(t: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(hp).connect(g).connect(this.music);
    src.start(t);
  }

  coin(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const now = performance.now();
    if (now - this.lastCoin < 90) return; // don't machine-gun on busy days
    this.lastCoin = now;
    this.tone(988, 'square', ctx.currentTime, 0.07, 0.05, this.sfx);
    this.tone(1319, 'square', ctx.currentTime + 0.07, 0.12, 0.05, this.sfx);
  }

  click(): void {
    if (this.ctx && this.sfxOn) this.tone(240, 'square', this.ctx.currentTime, 0.04, 0.04, this.sfx);
  }

  chime(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    [523, 659, 784].forEach((f, i) => this.tone(f, 'triangle', ctx.currentTime + i * 0.09, 0.25, 0.05, this.sfx));
  }

  dayEnd(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    [784, 659, 523, 659].forEach((f, i) => this.tone(f, 'triangle', ctx.currentTime + i * 0.13, 0.3, 0.05, this.sfx));
  }
}
