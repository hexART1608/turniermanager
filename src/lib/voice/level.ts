// Piper liefert eher leise Sprache. Vor dem Abspielen wird sie auf eine feste Lautheit gebracht
// (Effektivwert), damit sie sich gegen Musik durchsetzt; Spitzen bleiben unter 1.
export const TARGET_RMS = 0.2;
export const PEAK_LIMIT = 0.98;

/** Skaliert die Samples in place; gibt den verwendeten Faktor zurück. */
export function normalizeSpeech(samples: Float32Array): number {
  let sum = 0, peak = 0;
  for (const x of samples) { sum += x * x; const a = Math.abs(x); if (a > peak) peak = a; }
  if (!samples.length || peak === 0) return 1;
  const rms = Math.sqrt(sum / samples.length);
  const k = Math.min(TARGET_RMS / rms, PEAK_LIMIT / peak);
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * k;
  return k;
}
