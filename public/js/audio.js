// All sounds are synthesized with WebAudio at runtime (no audio files).
let ctx = null, master = null, noise = null;
export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function noiseHit(vol, freq, dec, type = 'lowpass', q = 0.7) {
  if (!ctx || vol <= 0.01) return; const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.003, vol, dec);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dec + 0.05);
}
function tone(vol, f0, f1, dec, type = 'sine', delay = 0) {
  if (!ctx || vol <= 0.01) return; const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dec);
  const g = ctx.createGain(); env(g, t, 0.002, vol, dec); o.connect(g); g.connect(master); o.start(t); o.stop(t + dec + 0.05);
}
const SHOT = {
  ar: [3500, 0.18, 120], smg: [4200, 0.12, 150], shotgun: [1800, 0.4, 70], sniper: [2600, 0.6, 60], pistol: [3800, 0.14, 160], magnum: [2400, 0.32, 90],
};
export function shot(w, vol = 1) {
  const s = SHOT[w] || SHOT.ar; noiseHit(0.9 * vol, s[0], s[1]); tone(0.6 * vol, s[2] * 2, s[2] * 0.4, s[1] * 0.8, 'triangle');
}
export function distVol(d) { return Math.max(0, Math.min(1, 1 / (1 + d * 0.06))); }
export function hit(kill, head) { tone(0.35, kill ? 900 : head ? 1600 : 1200, kill ? 500 : 1100, 0.07, 'square'); if (kill) tone(0.3, 600, 300, 0.15, 'sine', 0.05); }
export function hurt() { noiseHit(0.5, 600, 0.12); tone(0.25, 180, 90, 0.15, 'sawtooth'); }
export function reload() { tone(0.2, 900, 700, 0.04, 'square'); tone(0.2, 600, 500, 0.05, 'square', 0.35); tone(0.25, 1200, 900, 0.04, 'square', 0.7); }
export function empty() { tone(0.2, 1500, 1400, 0.02, 'square'); }
export function step(vol = 0.25) { noiseHit(vol, 300, 0.06); }
export function swing() { noiseHit(0.4, 2500, 0.15, 'bandpass', 2); }
export function boom(vol = 1) { noiseHit(1.2 * vol, 500, 1.2); tone(0.9 * vol, 90, 25, 0.9, 'sine'); }
export function click() { tone(0.15, 700, 650, 0.03, 'square'); }
export function countdownBeep(hi) { tone(0.25, hi ? 1320 : 880, hi ? 1320 : 880, hi ? 0.3 : 0.12, 'sine'); }
export function jumpLand() { noiseHit(0.3, 200, 0.08); }
