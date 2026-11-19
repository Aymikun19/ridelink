let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture (e.g. going online) so later alerts can play. */
export function unlockAudio() {
  try {
    audio();
  } catch {
    /* audio unavailable */
  }
}

function tone(freq: number, start: number, duration: number, gain = 0.18) {
  const c = audio();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.05);
}

/** Attention chime for new ride requests. */
export function playRequestAlert() {
  try {
    tone(880, 0, 0.18);
    tone(1175, 0.2, 0.18);
    tone(1568, 0.4, 0.32);
  } catch {
    /* ignore */
  }
}

/** Short soft ping for messages and status updates. */
export function playPing() {
  try {
    tone(1046, 0, 0.14, 0.12);
    tone(1318, 0.12, 0.2, 0.1);
  } catch {
    /* ignore */
  }
}
