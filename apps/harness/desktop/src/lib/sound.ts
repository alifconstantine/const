/**
 * Audio synthesis helper using Web Audio API for task completion and notification sounds.
 * Works natively without requiring any external audio assets or network requests.
 */

export function playTaskCompletionSound(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Friendly, crisp two-tone chime (D5 -> A5)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880.0, now + 0.08); // A5

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6 harmonic sparkle

    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.4);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);

    // Clean up context after playback
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 600);
  } catch {
    // Silently ignore audio playback failures (e.g. strict autoplay policy before user interaction)
  }
}
