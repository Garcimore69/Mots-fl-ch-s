// Vibrations et sons discrets (Web Audio, rien à télécharger).
import type { Settings } from '../store/db';

let ctx: AudioContext | null = null;

function tone(freq: number, dur: number, when = 0, vol = 0.05) {
  ctx ??= new AudioContext();
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export type Fx = 'key' | 'word' | 'error' | 'hint' | 'complete';

export function feedback(fx: Fx, s: Settings) {
  if (s.vibration && 'vibrate' in navigator) {
    const pat: Record<Fx, number | number[]> = { key: 8, word: 25, error: [30, 40, 30], hint: 15, complete: [40, 60, 80] };
    navigator.vibrate(pat[fx]);
  }
  if (s.sounds) {
    try {
      if (fx === 'key') tone(660, 0.04, 0, 0.03);
      else if (fx === 'word') { tone(660, 0.08); tone(880, 0.1, 0.07); }
      else if (fx === 'error') tone(220, 0.15, 0, 0.06);
      else if (fx === 'hint') tone(990, 0.12);
      else { tone(523, 0.12); tone(659, 0.12, 0.1); tone(784, 0.25, 0.2); }
    } catch { /* audio indisponible */ }
  }
}
