type TimerMode = "work" | "break" | "longBreak";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function makeNote(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  startAt: number,
  duration: number,
  volume: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.start(startAt);
  osc.stop(startAt + duration);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

// Gentle singing bowl — low harmonics, long decay
async function playWorkCompleteSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    makeNote(ctx, 396, "sine", t, 3.0, 0.25);        // G4 fundamental
    makeNote(ctx, 528, "sine", t + 0.05, 2.5, 0.15);  // C5 harmonic
    makeNote(ctx, 792, "sine", t + 0.1, 2.0, 0.08);   // G5 overtone
    makeNote(ctx, 396, "sine", t + 1.2, 2.5, 0.15);
    makeNote(ctx, 528, "sine", t + 1.25, 2.0, 0.10);
  } catch {}
}

// Upbeat ascending chime — bright, short
async function playBreakEndSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    makeNote(ctx, 659, "sine", t, 0.4, 0.2);          // E5
    makeNote(ctx, 784, "sine", t + 0.15, 0.4, 0.25);  // G5
    makeNote(ctx, 988, "sine", t + 0.30, 0.6, 0.3);   // B5
    makeNote(ctx, 1319, "sine", t + 0.50, 0.8, 0.2);  // E6
  } catch {}
}

export function playCompletionSound(mode: TimerMode) {
  if (mode === "work") {
    playWorkCompleteSound();
  } else {
    playBreakEndSound();
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(mode === "work" ? [200, 100, 200] : [150, 80, 150, 80, 150]);
  }
}
