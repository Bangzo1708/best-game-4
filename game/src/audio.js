// All sound is synthesised with WebAudio: short oscillator blips, no audio files.
// The context is created on the first user gesture; before that every call is a
// no-op, so screenshot scenes (which never gesture) stay silent.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  /** A single blip: frequency slides from `from` to `to` over `seconds`. */
  function blip(from, to, seconds, gainValue, type) {
    if (muted) return;
    const audio = ensure();
    if (!audio) return;
    try {
      if (audio.state === 'suspended') void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type || 'sine';
      oscillator.frequency.setValueAtTime(from, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), audio.currentTime + seconds);
      gain.gain.setValueAtTime(gainValue, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + seconds);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + seconds);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    shoot(kind) {
      if (kind === 'spark') blip(520, 180, 0.14, 0.05, 'square');
      else if (kind === 'frost') blip(880, 620, 0.1, 0.035, 'sine');
      else blip(700, 900, 0.05, 0.025, 'triangle');
    },
    kill() { blip(340, 90, 0.12, 0.06, 'triangle'); },
    coin() { blip(980, 1320, 0.09, 0.04, 'sine'); },
    build() { blip(220, 440, 0.12, 0.06, 'triangle'); },
    denied() { blip(160, 110, 0.15, 0.06, 'sawtooth'); },
    wave() { blip(330, 660, 0.25, 0.07, 'triangle'); },
    leak() { blip(300, 70, 0.35, 0.09, 'sawtooth'); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, f, 0.22, 0.07, 'sine'), i * 130)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, f * 0.9, 0.28, 0.07, 'sine'), i * 160)); },
  };
}
