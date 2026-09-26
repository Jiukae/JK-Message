// Web Audio API & HTML5 Audio Notification sound manager with mobile auto-unlock and haptic vibration

function createChimeWavUri(): string {
  const sampleRate = 22050;
  const duration = 0.45;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Generate pleasant 2-tone melodic chime: Tone 1 (659Hz / E5) -> Tone 2 (1046Hz / C6)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (t < 0.18) {
      // First bell note (E5 = 659.25Hz) with quick attack & smooth decay
      const env = Math.exp(-t * 14);
      sample += Math.sin(2 * Math.PI * 659.25 * t) * 0.4 * env;
      sample += Math.sin(2 * Math.PI * 1318.5 * t) * 0.15 * env; // harmonic
    }

    if (t >= 0.08) {
      // Second bell note (C6 = 1046.5Hz)
      const t2 = t - 0.08;
      const env2 = Math.exp(-t2 * 9);
      sample += Math.sin(2 * Math.PI * 1046.5 * t2) * 0.5 * env2;
      sample += Math.sin(2 * Math.PI * 2093.0 * t2) * 0.18 * env2; // harmonic
    }

    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

class SoundEffectManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private isUnlocked: boolean = false;
  private fallbackAudio: HTMLAudioElement | null = null;
  private chimeUri: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jk_sound_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }

      // Initialize global touch/click audio unlocking on mobile
      const unlock = () => {
        this.unlockAudio();
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('touchend', unlock);
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
      };

      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('touchend', unlock, { passive: true });
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  public unlockAudio() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      // Pre-warm fallback audio element
      if (!this.fallbackAudio) {
        if (!this.chimeUri) this.chimeUri = createChimeWavUri();
        this.fallbackAudio = new Audio(this.chimeUri);
        this.fallbackAudio.volume = 0.8;
        this.fallbackAudio.load();
      }

      this.isUnlocked = true;
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleSound(enabled?: boolean) {
    this.soundEnabled = enabled !== undefined ? enabled : !this.soundEnabled;
    try {
      localStorage.setItem('jk_sound_enabled', String(this.soundEnabled));
    } catch {}
    return this.soundEnabled;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public triggerHaptic(pattern: number | number[] = [120, 60, 160]) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {}
  }

  /**
   * Play mobile-friendly, rich incoming message chime ("카톡/메신저 스타일 띠링~")
   */
  public playIncomingMessage() {
    if (!this.soundEnabled) return;

    // Mobile vibration first
    this.triggerHaptic([150, 70, 180]);

    let playedWithWebAudio = false;

    try {
      const ctx = this.getContext();
      if (ctx && ctx.state !== 'suspended') {
        const now = ctx.currentTime;

        // Tone 1: E5 (659.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.1); // subtle rise to G5

        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.3);

        // Tone 2: C6 (1046.5 Hz) crisp chime bell
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.5, now + 0.08);

        gain2.gain.setValueAtTime(0.001, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.35, now + 0.11);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.45);

        playedWithWebAudio = true;
      }
    } catch (e) {
      console.warn('Web Audio playback failed, trying HTML5 Audio fallback:', e);
    }

    // If Web Audio was suspended or failed, play HTML5 Audio element fallback!
    if (!playedWithWebAudio) {
      try {
        if (!this.fallbackAudio) {
          if (!this.chimeUri) this.chimeUri = createChimeWavUri();
          this.fallbackAudio = new Audio(this.chimeUri);
          this.fallbackAudio.volume = 0.85;
        }
        this.fallbackAudio.currentTime = 0;
        const playPromise = this.fallbackAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('HTML5 audio play blocked:', err);
          });
        }
      } catch (err) {
        console.warn('Fallback audio failed:', err);
      }
    }
  }

  public playSentMessage() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.09); // E5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } catch {}
  }

  /**
   * Explicit test trigger called from user click (always unlocks audio)
   */
  public testSound() {
    this.unlockAudio();
    this.playIncomingMessage();
    return true;
  }
}

export const sounds = new SoundEffectManager();
