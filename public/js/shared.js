// Shared between the Node server and the browser (offline mode runs this same Room locally).
export const TICK_MS = 50;
export const PLAYER_H = 1.8, PLAYER_H_CR = 1.2, PLAYER_R = 0.4;
export const EYE = 1.6, EYE_CR = 1.0;
export const MAX_HP = 100;
export const RESPAWN_MS = 3000;
export const SCORE_LIMIT = { ffa: 20, tdm: 40 };
export const TIME_LIMIT_MS = 5 * 60 * 1000;
export const COUNTDOWN_MS = 3000;
export const END_SCREEN_MS = 8000;

export const WEAPONS = {
  ar:      { id: 'ar', name: 'Vanguard AR-7', type: 'Assault Rifle', kind: 'gun', slot: 0, damage: 28, head: 1.6, rpm: 650, mag: 30, reserve: 120, range: 55, spread: 0.04, ads: 0.006, reload: 2.1, auto: true, pellets: 1, adsFov: 55, recoil: 0.014 },
  smg:     { id: 'smg', name: 'Wasp SMG-9', type: 'Submachine Gun', kind: 'gun', slot: 0, damage: 21, head: 1.4, rpm: 900, mag: 32, reserve: 160, range: 28, spread: 0.045, ads: 0.016, reload: 1.8, auto: true, pellets: 1, adsFov: 62, recoil: 0.010 },
  shotgun: { id: 'shotgun', name: 'Breacher 12', type: 'Shotgun', kind: 'gun', slot: 0, damage: 15, head: 1.2, rpm: 75, mag: 6, reserve: 30, range: 16, spread: 0.085, ads: 0.065, reload: 2.6, auto: false, pellets: 9, adsFov: 65, recoil: 0.06 },
  sniper:  { id: 'sniper', name: 'Longshot R-50', type: 'Sniper Rifle', kind: 'gun', slot: 0, damage: 95, head: 2.0, rpm: 45, mag: 5, reserve: 25, range: 150, spread: 0.11, ads: 0.0005, reload: 3.0, auto: false, pellets: 1, adsFov: 20, recoil: 0.08, scope: true },
  pistol:  { id: 'pistol', name: 'Sidearm P9', type: 'Pistol', kind: 'gun', slot: 1, damage: 30, head: 1.5, rpm: 420, mag: 12, reserve: 60, range: 30, spread: 0.03, ads: 0.01, reload: 1.4, auto: false, pellets: 1, adsFov: 62, recoil: 0.02 },
  magnum:  { id: 'magnum', name: 'Hammer .44', type: 'Revolver', kind: 'gun', slot: 1, damage: 55, head: 1.6, rpm: 150, mag: 6, reserve: 36, range: 40, spread: 0.035, ads: 0.008, reload: 2.4, auto: false, pellets: 1, adsFov: 60, recoil: 0.05 },
  knife:   { id: 'knife', name: 'Combat Knife', type: 'Melee', kind: 'melee', slot: 2, damage: 100, rpm: 110, range: 2.4, mag: 0 },
  hatchet: { id: 'hatchet', name: 'Field Hatchet', type: 'Melee', kind: 'melee', slot: 2, damage: 100, rpm: 70, range: 3.0, mag: 0 },
  frag:    { id: 'frag', name: 'Frag Grenade', type: 'Lethal', kind: 'grenade', slot: 3, damage: 130, radius: 7, fuse: 2200, count: 2, rpm: 60, range: 7, mag: 2 },
  impact:  { id: 'impact', name: 'Impact Charge', type: 'Lethal', kind: 'grenade', slot: 3, damage: 110, radius: 5, fuse: 4000, count: 2, impact: true, rpm: 60, range: 5, mag: 2 },
};
export const SLOT_NAMES = ['Primary', 'Secondary', 'Melee', 'Lethal'];
export const SLOT_OPTIONS = [['ar', 'smg', 'shotgun', 'sniper'], ['pistol', 'magnum'], ['knife', 'hatchet'], ['frag', 'impact']];
export const DEFAULT_LOADOUT = ['ar', 'pistol', 'knife', 'frag'];

export function validLoadout(l) {
  return Array.isArray(l) && l.length === 4 && l.every((w, i) => SLOT_OPTIONS[i].includes(w));
}

// ---------------- Map ----------------
export const ARENA = 50;
function buildMap() {
  const boxes = [];
  const add = (x0, y0, z0, x1, y1, z1, c) => boxes.push({ min: [x0, y0, z0], max: [x1, y1, z1], c });
  const box = (cx, cz, w, d, h, c, y = 0) => add(cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2, c);
  const WALL = 0x8a7f6e, CRATE = 0xa0703c, CRATE2 = 0x7d5a32, CONC = 0x9a9a92, BLD = 0xc9b48a, ROOF = 0x6b4f3a;
  const S = ARENA, T = 1.5;
  add(-S - T, 0, -S - T, S + T, 7, -S, WALL); add(-S - T, 0, S, S + T, 7, S + T, WALL);
  add(-S - T, 0, -S, -S, 7, S, WALL); add(S, 0, -S, S + T, 7, S, WALL);

  function building(cx, cz, w, d, h, doors, c) {
    const t = 0.4, dw = 2.4, dh = 2.6;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const wallX = (z, door) => { // wall running along x
      if (!door) return add(x0, 0, z - t / 2, x1, h, z + t / 2, c);
      const m = cx; add(x0, 0, z - t / 2, m - dw / 2, h, z + t / 2, c); add(m + dw / 2, 0, z - t / 2, x1, h, z + t / 2, c); add(m - dw / 2, dh, z - t / 2, m + dw / 2, h, z + t / 2, c);
    };
    const wallZ = (x, door) => {
      if (!door) return add(x - t / 2, 0, z0, x + t / 2, h, z1, c);
      const m = cz; add(x - t / 2, 0, z0, x + t / 2, h, m - dw / 2, c); add(x - t / 2, 0, m + dw / 2, x + t / 2, h, z1, c); add(x - t / 2, dh, m - dw / 2, x + t / 2, h, m + dw / 2, c);
    };
    wallX(z0, doors.includes('n')); wallX(z1, doors.includes('s'));
    wallZ(x0, doors.includes('w')); wallZ(x1, doors.includes('e'));
    add(x0 - 0.3, h, z0 - 0.3, x1 + 0.3, h + 0.35, z1 + 0.3, ROOF);
  }
  building(-26, -26, 12, 10, 4, 'se', BLD); building(26, 26, 12, 10, 4, 'nw', BLD);
  building(26, -26, 10, 12, 4, 'sw', 0xb8a27a); building(-26, 26, 10, 12, 4, 'ne', 0xb8a27a);
  // interior cover
  box(-27, -27, 1.2, 1.2, 1.2, CRATE); box(27, 27, 1.2, 1.2, 1.2, CRATE); box(27, -24, 1.2, 1.2, 1.2, CRATE2); box(-27, 24, 1.2, 1.2, 1.2, CRATE2);
  // center plaza
  box(0, 0, 6, 6, 1.0, CONC); box(0, 0, 2.5, 2.5, 2.2, CONC, 1.0);
  box(-7, 3, 1.5, 1.5, 1.5, CRATE); box(7, -3, 1.5, 1.5, 1.5, CRATE); box(4, 7, 2, 1.2, 1.1, CRATE2); box(-4, -7, 2, 1.2, 1.1, CRATE2);
  // low walls
  box(0, -16, 14, 0.6, 1.2, CONC); box(0, 16, 14, 0.6, 1.2, CONC); box(-16, 0, 0.6, 14, 1.2, CONC); box(16, 0, 0.6, 14, 1.2, CONC);
  // shipping containers
  box(-12, -36, 7, 2.6, 2.6, 0x3d6b8c); box(12, 36, 7, 2.6, 2.6, 0x8c3d3d); box(-38, 10, 2.6, 7, 2.6, 0x4d7a3d); box(38, -10, 2.6, 7, 2.6, 0x8c7a3d);
  box(-12, -36, 7, 2.6, 2.6, 0x2f5a78, 2.6);
  // climbable crate stacks near containers
  box(-17, -36, 1.2, 1.2, 1.0, CRATE); box(-17, -34.6, 1.2, 1.2, 2.0, CRATE2);
  box(17, 36, 1.2, 1.2, 1.0, CRATE); box(17, 34.6, 1.2, 1.2, 2.0, CRATE2);
  // scattered crates
  const crates = [[-35, -15], [35, 15], [-20, 40], [20, -40], [-40, -30], [40, 30], [10, -24], [-10, 24], [-30, 0], [30, 0], [0, -30], [0, 30], [-22, 12], [22, -12], [-44, 40], [44, -40]];
  crates.forEach(([x, z], i) => box(x, z, 1.4, 1.4, i % 3 === 0 ? 2.2 : 1.3, i % 2 ? CRATE : CRATE2));
  // pillars / barriers
  [[-8, -24], [8, 24], [-24, -8], [24, 8]].forEach(([x, z]) => box(x, z, 1, 1, 3, CONC));
  [[-36, -42], [36, 42], [-42, 22], [42, -22]].forEach(([x, z]) => box(x, z, 4, 0.8, 1.3, 0x777770));
  return boxes;
}
export const MAP = buildMap();
export const SPAWNS = [[-42, -42], [42, 42], [-42, 42], [42, -42], [0, -44], [0, 44], [-44, 0], [44, 0], [-20, -44], [20, 44], [-44, 18], [44, -18], [-12, -20], [12, 20], [-34, -8], [34, 8]];

// ---------------- Math helpers ----------------
export function dirFrom(yaw, pitch) {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}
export function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
export function rayAABB(o, d, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < min[i] || o[i] > max[i]) return Infinity; continue; }
    let t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (tmax < 0) return Infinity;
  return tmin >= 0 ? tmin : 0;
}
export function rayMap(o, d, maxT = 300) {
  let best = maxT;
  if (d[1] < -1e-6) { const t = -o[1] / d[1]; if (t >= 0 && t < best) best = t; }
  for (const b of MAP) { const t = rayAABB(o, d, b.min, b.max); if (t < best) best = t; }
  return best;
}
export function spread(d, amt) {
  if (amt <= 0) return d;
  const r = () => (Math.random() * 2 - 1);
  let x, y; do { x = r(); y = r(); } while (x * x + y * y > 1);
  return norm([d[0] + x * amt + (Math.random() - 0.5) * amt * 0.2, d[1] + y * amt, d[2] + (Math.random() - 0.5) * amt * 0.6]);
}
function overlaps(p, h, r, b) {
  return p[0] + r > b.min[0] && p[0] - r < b.max[0] && p[2] + r > b.min[2] && p[2] - r < b.max[2] && p[1] + h > b.min[1] + 1e-4 && p[1] < b.max[1] - 1e-4;
}
export function blockedAt(p, h, r) { return MAP.some(b => overlaps(p, h, r, b)); }
// Moves p by v*dt with per-axis AABB collision. Mutates p and v. Returns true if on ground.
export function moveCollide(p, v, dt, h, r) {
  let ground = false;
  for (const ax of [0, 2, 1]) {
    const delta = v[ax] * dt; if (delta === 0 && ax !== 1) continue;
    p[ax] += delta;
    if (ax === 1 && p[1] <= 0) { p[1] = 0; if (v[1] < 0) v[1] = 0; ground = true; }
    for (const b of MAP) {
      if (!overlaps(p, h, r, b)) continue;
      if (ax === 1) {
        if (delta <= 0) { p[1] = b.max[1]; v[1] = 0; ground = true; } else { p[1] = b.min[1] - h; v[1] = 0; }
      } else {
        // auto step-up small ledges (<0.45m)
        if (b.max[1] - p[1] <= 0.45 && !blockedAt([p[0], b.max[1], p[2]], h, r)) { p[1] = b.max[1]; continue; }
        if (delta > 0) p[ax] = b.min[ax] - r - 1e-4; else p[ax] = b.max[ax] + r + 1e-4;
        v[ax] = 0;
      }
    }
  }
  return ground;
}
function hitboxes(p, cr, tol) {
  const top = p[1] + (cr ? PLAYER_H_CR : PLAYER_H);
  return {
    head: { min: [p[0] - 0.22 - tol, top - 0.42 - tol, p[2] - 0.22 - tol], max: [p[0] + 0.22 + tol, top + tol, p[2] + 0.22 + tol] },
    body: { min: [p[0] - 0.38 - tol, p[1], p[2] - 0.38 - tol], max: [p[0] + 0.38 + tol, top - 0.42, p[2] + 0.38 + tol] },
  };
}

// ---------------- Room (authoritative game state) ----------------
const BOT_NAMES = ['Viper', 'Rook', 'Ghosthawk', 'Mako', 'Ironside', 'Kestrel', 'Nomad', 'Sable', 'Talon', 'Bishop', 'Cinder', 'Havoc'];
const r2 = (x) => Math.round(x * 100) / 100;

export class Room {
  constructor({ send, broadcast }) {
    this.send = send; this.broadcast = broadcast;
    this.players = new Map(); this.state = 'lobby'; this.mode = 'ffa'; this.hostId = null;
    this.grenades = []; this.gid = 0; this.botSeq = 0; this.teamScores = [0, 0];
    this.countdownEnd = 0; this.matchEnd = 0; this.endUntil = 0; this.last = Date.now();
  }
  humans() { return [...this.players.values()].filter(p => !p.bot); }
  bots() { return [...this.players.values()].filter(p => p.bot); }
  addPlayer(id, name, bot = false) {
    const pl = {
      id, name: String(name || 'Player').replace(/[<>&"]/g, '').slice(0, 16) || 'Player', bot, ready: bot, loadout: [...DEFAULT_LOADOUT],
      team: 0, p: [0, 0, 0], yaw: 0, pitch: 0, cr: false, w: 'ar', hp: MAX_HP, alive: false, inMatch: false,
      kills: 0, deaths: 0, respawnAt: 0, lastFire: {}, nades: 0, lastSt: 0, hist: [], ai: null,
    };
    if (bot) pl.loadout = SLOT_OPTIONS.map(o => o[Math.floor(Math.random() * o.length)]);
    this.players.set(id, pl);
    if (!bot) {
      if (!this.hostId) this.hostId = id;
      this.send(id, { t: 'welcome', id, host: this.hostId === id });
    }
    if (this.state === 'playing' && bot) this.dropIn(pl);
    this.lobby(); this.scores();
    return pl;
  }
  removePlayer(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this.broadcast({ t: 'left', id });
    if (this.hostId === id) { const h = this.humans()[0]; this.hostId = h ? h.id : null; }
    if (this.humans().length === 0) { for (const b of this.bots()) this.players.delete(b.id); this.state = 'lobby'; this.grenades = []; this.mode = 'ffa'; return; }
    if (this.state === 'countdown') this.checkStart();
    if (this.state === 'playing' && !this.humans().some(h => h.inMatch)) this.backToLobby();
    this.lobby(); this.scores();
  }
  lobby() {
    const now = Date.now();
    this.broadcast({
      t: 'lobby', state: this.state, mode: this.mode, host: this.hostId,
      countdown: this.state === 'countdown' ? this.countdownEnd - now : 0,
      timeLeft: this.state === 'playing' ? this.matchEnd - now : 0,
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, ready: p.ready, loadout: p.loadout, team: p.team, bot: p.bot, inMatch: p.inMatch })),
    });
  }
  scores() {
    this.broadcast({ t: 'score', mode: this.mode, teams: this.teamScores, limit: SCORE_LIMIT[this.mode], ps: [...this.players.values()].filter(p => p.inMatch).map(p => [p.id, p.kills, p.deaths]) });
  }
  setBots(n) {
    n = Math.max(0, Math.min(11, n | 0));
    const bots = this.bots();
    while (bots.length > n) { const b = bots.pop(); this.players.delete(b.id); this.broadcast({ t: 'left', id: b.id }); }
    for (let i = bots.length; i < n; i++) { const k = this.botSeq++; this.addPlayer('bot' + k, 'Bot ' + BOT_NAMES[k % BOT_NAMES.length], true); }
    this.lobby(); this.scores();
  }
  handle(id, m) {
    const pl = this.players.get(id); if (!pl || !m || typeof m.t !== 'string') return;
    const isHost = id === this.hostId;
    switch (m.t) {
      case 'ping': this.send(id, { t: 'pong', c: m.c }); break;
      case 'loadout': if (validLoadout(m.loadout) && (!pl.inMatch || !pl.alive || this.state !== 'playing')) { pl.loadout = [...m.loadout]; this.lobby(); } break;
      case 'ready':
        pl.ready = !!m.ready;
        if (this.state === 'playing' && pl.ready && !pl.inMatch) { this.dropIn(pl); this.send(id, this.startMsg()); this.spawn(pl); this.scores(); }
        this.checkStart(); this.lobby(); break;
      case 'start': if (isHost && this.state === 'lobby') { pl.ready = true; this.beginCountdown(); } break;
      case 'mode': if (isHost && this.state === 'lobby' && (m.mode === 'ffa' || m.mode === 'tdm')) { this.mode = m.mode; this.lobby(); } break;
      case 'bots': if (isHost && this.state !== 'ended') this.setBots(m.n); break;
      case 'leave': // leave match back to lobby
        pl.ready = false; pl.inMatch = false; pl.alive = false; this.broadcast({ t: 'left', id, soft: true });
        if (this.state === 'playing' && !this.humans().some(h => h.inMatch)) this.backToLobby();
        this.lobby(); this.scores(); break;
      case 'st': this.onState(pl, m); break;
      case 'fire': this.fire(pl, m); break;
      case 'melee': this.melee(pl, m); break;
      case 'nade': this.nade(pl, m); break;
    }
  }
  checkStart() {
    const hs = this.humans();
    if (this.state === 'lobby' && hs.length >= 1 && hs.every(h => h.ready)) this.beginCountdown();
    else if (this.state === 'countdown' && !hs.every(h => h.ready)) { this.state = 'lobby'; this.lobby(); }
  }
  beginCountdown() { this.state = 'countdown'; this.countdownEnd = Date.now() + COUNTDOWN_MS; this.lobby(); }
  startMsg() { return { t: 'start', mode: this.mode, timeLeft: this.matchEnd - Date.now(), limit: SCORE_LIMIT[this.mode] }; }
  startMatch() {
    this.state = 'playing'; this.matchEnd = Date.now() + TIME_LIMIT_MS; this.teamScores = [0, 0]; this.grenades = [];
    const parts = [...this.players.values()].filter(p => p.bot || p.ready);
    const hs = parts.filter(p => !p.bot).sort(() => Math.random() - 0.5), bs = parts.filter(p => p.bot);
    [...hs, ...bs].forEach((p, i) => { p.team = this.mode === 'tdm' ? i % 2 : 0; p.inMatch = true; p.kills = 0; p.deaths = 0; p.alive = false; p.ai = null; });
    for (const p of this.players.values()) if (!parts.includes(p)) p.inMatch = false;
    this.lobby();
    for (const p of parts) if (!p.bot) this.send(p.id, this.startMsg());
    for (const p of parts) this.spawn(p);
    this.scores();
  }
  dropIn(pl) {
    if (this.mode === 'tdm') { const c = [0, 0]; for (const p of this.players.values()) if (p.inMatch) c[p.team]++; pl.team = c[0] <= c[1] ? 0 : 1; } else pl.team = 0;
    pl.inMatch = true; pl.kills = 0; pl.deaths = 0; pl.ai = null;
    if (pl.bot) this.spawn(pl);
    this.lobby();
  }
  isEnemy(a, b) { return a !== b && b.inMatch && (this.mode === 'ffa' || a.team !== b.team); }
  spawn(pl) {
    const enemies = [...this.players.values()].filter(o => o.alive && this.isEnemy(pl, o));
    let pts = SPAWNS;
    if (this.mode === 'tdm') pts = SPAWNS.filter(s => (pl.team === 0 ? s[1] <= 0 : s[1] >= 0));
    const scored = pts.map(s => [s, enemies.length ? Math.min(...enemies.map(e => Math.hypot(e.p[0] - s[0], e.p[2] - s[1]))) : Math.random() * 100]).sort((a, b) => b[1] - a[1]);
    const s = scored[Math.floor(Math.random() * Math.min(3, scored.length))][0];
    pl.p = [s[0] + (Math.random() - 0.5), 0, s[1] + (Math.random() - 0.5)]; pl.yaw = Math.atan2(s[0], s[1]); pl.pitch = 0; pl.cr = false;
    pl.hp = MAX_HP; pl.alive = true; pl.nades = WEAPONS[pl.loadout[3]].count; pl.w = pl.loadout[0]; pl.lastSt = Date.now(); pl.hist = [];
    pl.spawnProtect = Date.now() + 1500;
    this.broadcast({ t: 'spawn', id: pl.id, p: pl.p, yaw: pl.yaw, loadout: pl.loadout });
  }
  onState(pl, m) {
    if (!pl.alive || !pl.inMatch || this.state !== 'playing') return;
    const p = m.p; if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return;
    const now = Date.now(), dt = Math.min(1, (now - pl.lastSt) / 1000);
    const hd = Math.hypot(p[0] - pl.p[0], p[2] - pl.p[2]);
    if (hd > 10 * dt + 1.2 || Math.abs(p[0]) > ARENA || Math.abs(p[2]) > ARENA || p[1] < -0.5 || p[1] > 12) { this.send(pl.id, { t: 'corr', p: pl.p }); pl.lastSt = now; return; }
    pl.p = [p[0], p[1], p[2]]; pl.lastSt = now;
    if (Number.isFinite(m.yaw)) pl.yaw = m.yaw; if (Number.isFinite(m.pitch)) pl.pitch = Math.max(-1.55, Math.min(1.55, m.pitch));
    pl.cr = !!m.cr; if (pl.loadout.includes(m.w)) pl.w = m.w;
  }
  eye(pl) { return [pl.p[0], pl.p[1] + (pl.cr ? EYE_CR : EYE), pl.p[2]]; }
  posAt(pl, t) {
    const h = pl.hist; if (!h.length || t >= h[h.length - 1][0]) return { p: pl.p, cr: pl.cr };
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1][0] <= t) { const a = h[i - 1], b = h[i], k = (t - a[0]) / Math.max(1, b[0] - a[0]); return { p: [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k], cr: b[4] }; }
    }
    return { p: [h[0][1], h[0][2], h[0][3]], cr: h[0][4] };
  }
  trace(shooter, o, d, rewind) {
    const mapT = rayMap(o, d, 300);
    let best = { t: mapT, target: null, head: false };
    const at = Date.now() - Math.max(0, Math.min(300, rewind || 0));
    for (const tg of this.players.values()) {
      if (!tg.alive || !this.isEnemy(shooter, tg)) continue;
      const { p, cr } = this.posAt(tg, at);
      const hb = hitboxes(p, cr, tg.bot ? 0.05 : 0.12);
      const th = rayAABB(o, d, hb.head.min, hb.head.max), tb = rayAABB(o, d, hb.body.min, hb.body.max);
      if (th < best.t && th <= tb + 0.3) best = { t: th, target: tg, head: true };
      else if (tb < best.t) best = { t: tb, target: tg, head: false };
    }
    best.end = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t];
    return best;
  }
  fire(pl, m) {
    if (!pl.alive || !pl.inMatch || this.state !== 'playing') return;
    const w = WEAPONS[m.w]; if (!w || w.kind !== 'gun' || (pl.loadout[0] !== w.id && pl.loadout[1] !== w.id)) return;
    const now = Date.now(); if (now - (pl.lastFire[w.id] || 0) < 60000 / w.rpm * 0.75) return;
    pl.lastFire[w.id] = now; pl.w = w.id; pl.spawnProtect = 0;
    const dirs = (Array.isArray(m.d) ? m.d : []).slice(0, w.pellets).filter(d => Array.isArray(d) && d.length === 3 && d.every(Number.isFinite)).map(norm);
    if (!dirs.length) return;
    const o = this.eye(pl); const dmg = new Map(); const ends = [];
    for (const d of dirs) {
      const h = this.trace(pl, o, d, m.rw);
      ends.push(h.end.map(r2));
      if (h.target) {
        const fall = h.t <= w.range * 0.5 ? 1 : h.t >= w.range ? 0.55 : 1 - 0.45 * (h.t - w.range * 0.5) / (w.range * 0.5);
        const e = dmg.get(h.target) || { a: 0, head: false };
        e.a += w.damage * fall * (h.head ? w.head : 1); e.head = e.head || h.head; dmg.set(h.target, e);
      }
    }
    this.broadcast({ t: 'shot', id: pl.id, w: w.id, ends });
    for (const [tg, e] of dmg) this.damage(tg, Math.round(e.a), pl, w.id, e.head);
  }
  melee(pl, m) {
    if (!pl.alive || !pl.inMatch || this.state !== 'playing') return;
    const w = WEAPONS[pl.loadout[2]]; const now = Date.now();
    if (now - (pl.lastFire[w.id] || 0) < 60000 / w.rpm * 0.75) return;
    pl.lastFire[w.id] = now; pl.spawnProtect = 0;
    const d = Array.isArray(m.d) && m.d.length === 3 && m.d.every(Number.isFinite) ? norm(m.d) : dirFrom(pl.yaw, pl.pitch);
    const o = this.eye(pl); let best = null, bd = Infinity;
    for (const tg of this.players.values()) {
      if (!tg.alive || !this.isEnemy(pl, tg)) continue;
      const c = [tg.p[0], tg.p[1] + (tg.cr ? 0.7 : 1.1), tg.p[2]]; const v = [c[0] - o[0], c[1] - o[1], c[2] - o[2]]; const dist = Math.hypot(...v);
      if (dist > w.range + 0.5 || dist >= bd) continue;
      const n = norm(v); if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < 0.55) continue;
      if (rayMap(o, n, dist) < dist - 0.3) continue;
      best = tg; bd = dist;
    }
    this.broadcast({ t: 'swing', id: pl.id, w: w.id });
    if (best) this.damage(best, w.damage, pl, w.id, false);
  }
  nade(pl, m) {
    if (!pl.alive || !pl.inMatch || this.state !== 'playing' || pl.nades <= 0) return;
    const w = WEAPONS[pl.loadout[3]]; const now = Date.now();
    if (now - (pl.lastFire[w.id] || 0) < 700) return;
    pl.lastFire[w.id] = now; pl.nades--; pl.spawnProtect = 0;
    const d = Array.isArray(m.d) && m.d.length === 3 && m.d.every(Number.isFinite) ? norm(m.d) : dirFrom(pl.yaw, pl.pitch);
    const o = this.eye(pl);
    this.grenades.push({ id: ++this.gid, owner: pl.id, w: w.id, p: [o[0] + d[0] * 0.6, o[1] + d[1] * 0.6, o[2] + d[2] * 0.6], v: [d[0] * 17, d[1] * 17 + 4, d[2] * 17], boom: now + w.fuse });
    this.send(pl.id, { t: 'nades', n: pl.nades });
  }
  damage(tg, amt, from, wid, head) {
    if (!tg.alive || amt <= 0) return;
    if (tg.spawnProtect && Date.now() < tg.spawnProtect && from !== tg) amt = Math.round(amt * 0.3);
    tg.hp = Math.max(0, tg.hp - amt); tg.lastHurt = Date.now();
    const kill = tg.hp <= 0;
    if (from !== tg) this.send(from.id, { t: 'hit', target: tg.id, dmg: amt, head, kill });
    this.send(tg.id, { t: 'hurt', from: from.id, hp: Math.round(tg.hp), src: [r2(from.p[0]), r2(from.p[2])] });
    if (tg.bot && tg.ai) { tg.ai.target = from !== tg ? from.id : tg.ai.target; tg.ai.reactAt = Math.min(tg.ai.reactAt, Date.now() + 250); }
    if (!kill) return;
    tg.alive = false; tg.deaths++; tg.respawnAt = Date.now() + RESPAWN_MS;
    if (from !== tg) { from.kills++; if (this.mode === 'tdm') this.teamScores[from.team]++; }
    this.broadcast({ t: 'kill', k: from.id, v: tg.id, w: wid, head });
    this.scores(); this.checkEnd();
  }
  explode(g) {
    const w = WEAPONS[g.w]; const owner = this.players.get(g.owner);
    this.broadcast({ t: 'boom', p: g.p.map(r2), w: g.w });
    if (!owner) return;
    const o = [g.p[0], g.p[1] + 0.3, g.p[2]];
    for (const tg of [...this.players.values()]) {
      if (!tg.alive || !tg.inMatch || (tg !== owner && !this.isEnemy(owner, tg))) continue;
      const c = [tg.p[0], tg.p[1] + 0.9, tg.p[2]]; const v = [c[0] - o[0], c[1] - o[1], c[2] - o[2]]; const dist = Math.hypot(...v);
      if (dist > w.radius) continue;
      if (rayMap(o, norm(v), dist) < dist - 0.2) continue;
      const amt = Math.round(w.damage * (1 - dist / w.radius) * (tg === owner ? 0.6 : 1));
      this.damage(tg, amt, owner, g.w, false);
    }
  }
  tickGrenades(dt, now) {
    const keep = [];
    for (const g of this.grenades) {
      let bounced = false;
      g.v[1] -= 20 * dt;
      for (const ax of [0, 2, 1]) {
        const prev = g.p[ax]; g.p[ax] += g.v[ax] * dt;
        const inside = (ax === 1 && g.p[1] < 0.1) || MAP.some(b => g.p[0] > b.min[0] - 0.1 && g.p[0] < b.max[0] + 0.1 && g.p[1] > b.min[1] - 0.1 && g.p[1] < b.max[1] + 0.1 && g.p[2] > b.min[2] - 0.1 && g.p[2] < b.max[2] + 0.1);
        if (inside) { g.p[ax] = prev; if (Math.abs(g.v[ax]) > 1.5) bounced = true; g.v[ax] *= ax === 1 ? -0.35 : -0.4; if (ax === 1) { g.v[0] *= 0.7; g.v[2] *= 0.7; } }
      }
      if ((WEAPONS[g.w].impact && bounced) || now >= g.boom) this.explode(g); else keep.push(g);
    }
    this.grenades = keep;
  }
  checkEnd() {
    if (this.state !== 'playing') return;
    const lim = SCORE_LIMIT[this.mode]; const ps = [...this.players.values()].filter(p => p.inMatch);
    const reached = this.mode === 'ffa' ? ps.some(p => p.kills >= lim) : this.teamScores.some(s => s >= lim);
    if (reached || Date.now() >= this.matchEnd) this.endMatch();
  }
  endMatch() {
    this.state = 'ended'; this.endUntil = Date.now() + END_SCREEN_MS; this.grenades = [];
    const ps = [...this.players.values()].filter(p => p.inMatch).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    let winner;
    if (this.mode === 'ffa') winner = ps[0] ? ps[0].name : 'Nobody';
    else winner = this.teamScores[0] === this.teamScores[1] ? 'Draw' : this.teamScores[0] > this.teamScores[1] ? 'Team Alpha' : 'Team Bravo';
    this.broadcast({ t: 'end', mode: this.mode, winner, teams: this.teamScores, board: ps.map(p => ({ id: p.id, name: p.name, k: p.kills, d: p.deaths, team: p.team, bot: p.bot })) });
    this.lobby();
  }
  backToLobby() {
    this.state = 'lobby'; this.grenades = [];
    for (const p of this.players.values()) { p.inMatch = false; p.alive = false; p.ready = p.bot; }
    this.broadcast({ t: 'tolobby' }); this.lobby();
  }
  // -------- bots --------
  botThink(b, dt, now) {
    const w = WEAPONS[b.loadout[0]];
    const ai = b.ai || (b.ai = { mag: w.mag, reloadUntil: 0, wp: null, strafe: 1, strafeT: 0, reactAt: 0, target: null, retarget: 0, nextShot: 0, burst: 0, stuckT: 0, lastP: [...b.p], v: [0, 0, 0], ground: true });
    b.w = w.id;
    const eye = this.eye(b);
    if (now >= ai.retarget) {
      ai.retarget = now + 300;
      let best = null, bd = 70;
      for (const o of this.players.values()) {
        if (!o.alive || !this.isEnemy(b, o)) continue;
        const head = [o.p[0], o.p[1] + (o.cr ? 1.0 : 1.55), o.p[2]]; const v = [head[0] - eye[0], head[1] - eye[1], head[2] - eye[2]]; const dist = Math.hypot(...v);
        if (dist >= bd) continue;
        const fwd = dirFrom(b.yaw, 0); const n = norm(v); const facing = fwd[0] * n[0] + fwd[2] * n[2];
        if (facing < -0.2 && dist > 12 && ai.target !== o.id) continue; // can't see behind
        if (rayMap(eye, n, dist) < dist - 0.2) continue;
        best = o; bd = dist;
      }
      const newId = best ? best.id : null;
      if (newId !== ai.target && newId) ai.reactAt = now + 300 + Math.random() * 350;
      ai.target = newId;
    }
    const tg = ai.target && this.players.get(ai.target);
    let move = [0, 0];
    if (tg && tg.alive) {
      const aim = [tg.p[0], tg.p[1] + (tg.cr ? 0.8 : 1.25), tg.p[2]]; const v = [aim[0] - eye[0], aim[1] - eye[1], aim[2] - eye[2]]; const dist = Math.hypot(...v);
      const wantYaw = Math.atan2(-v[0], -v[2]); const wantPitch = Math.atan2(v[1], Math.hypot(v[0], v[2]));
      let dy = wantYaw - b.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      const turn = 5 * dt; b.yaw += Math.max(-turn, Math.min(turn, dy)); b.pitch += (wantPitch - b.pitch) * Math.min(1, 8 * dt);
      if (dist < 2.2) { this.melee(b, { d: norm(v) }); }
      else if (now >= ai.reactAt && Math.abs(dy) < 0.12 && now >= ai.nextShot && now >= ai.reloadUntil) {
        const acc = 0.035 + Math.min(0.03, dist * 0.0006);
        const base = norm(v); const ds = []; for (let i = 0; i < w.pellets; i++) ds.push(spread(base, acc + (w.pellets > 1 ? w.spread : 0)));
        b.lastFire[w.id] = 0; this.fire(b, { w: w.id, d: ds });
        ai.mag--; ai.burst++;
        ai.nextShot = now + 60000 / w.rpm * (w.auto ? 1.15 : 1.6) + (ai.burst % 7 === 0 ? 450 : 0);
        if (ai.mag <= 0) { ai.reloadUntil = now + w.reload * 1000; ai.mag = w.mag; }
      }
      ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = 0.6 + Math.random(); }
      const ideal = w.id === 'sniper' ? 30 : w.id === 'shotgun' ? 5 : w.id === 'smg' ? 10 : 18;
      const f = dirFrom(b.yaw, 0); const rgt = [-f[2], f[0]];
      const fwdAmt = dist > ideal + 4 ? 1 : dist < ideal - 4 ? -0.6 : 0;
      move = [f[0] * fwdAmt + rgt[0] * ai.strafe * 0.8, f[2] * fwdAmt + rgt[1] * ai.strafe * 0.8];
      b.cr = false;
    } else {
      if (!ai.wp || Math.hypot(ai.wp[0] - b.p[0], ai.wp[1] - b.p[2]) < 2) {
        const s = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
        ai.wp = Math.random() < 0.5 ? [s[0] * 0.6, s[1] * 0.6] : [(Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80];
      }
      const v = [ai.wp[0] - b.p[0], ai.wp[1] - b.p[2]]; const l = Math.hypot(...v) || 1;
      const wantYaw = Math.atan2(-v[0], -v[1]); let dy = wantYaw - b.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      b.yaw += Math.max(-3 * dt, Math.min(3 * dt, dy)); b.pitch *= 0.9;
      move = [v[0] / l, v[1] / l];
    }
    const sp = tg && tg.alive ? 4.2 : 5;
    ai.v[0] = move[0] * sp; ai.v[2] = move[1] * sp; ai.v[1] -= 20 * dt;
    ai.ground = moveCollide(b.p, ai.v, dt, PLAYER_H, PLAYER_R);
    b.p[0] = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, b.p[0])); b.p[2] = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, b.p[2]));
    ai.stuckT += dt;
    if (ai.stuckT > 1) {
      if (Math.hypot(b.p[0] - ai.lastP[0], b.p[2] - ai.lastP[2]) < 0.6) { ai.wp = null; if (ai.ground) ai.v[1] = 7; ai.strafe *= -1; }
      ai.lastP = [...b.p]; ai.stuckT = 0;
    }
  }
  tick() {
    const now = Date.now(); const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.state === 'countdown' && now >= this.countdownEnd) this.startMatch();
    if (this.state === 'ended' && now >= this.endUntil) this.backToLobby();
    if (this.state !== 'playing') return;
    for (const p of this.players.values()) {
      if (!p.inMatch) continue;
      if (!p.alive && now >= p.respawnAt) this.spawn(p);
      if (p.alive && p.hp < MAX_HP && now - (p.lastHurt || 0) > 4500) p.hp = Math.min(MAX_HP, p.hp + 35 * dt);
      if (p.bot && p.alive) this.botThink(p, dt, now);
      p.hist.push([now, p.p[0], p.p[1], p.p[2], p.cr]); if (p.hist.length > 24) p.hist.shift();
    }
    this.tickGrenades(dt, now);
    this.checkEnd();
    if (this.state !== 'playing') return;
    this.broadcast({
      t: 'snap', tl: this.matchEnd - now,
      ps: [...this.players.values()].filter(p => p.inMatch).map(p => [p.id, r2(p.p[0]), r2(p.p[1]), r2(p.p[2]), r2(p.yaw), r2(p.pitch), p.cr ? 1 : 0, p.w, Math.round(p.hp), p.alive ? 1 : 0]),
      g: this.grenades.map(g => [g.id, r2(g.p[0]), r2(g.p[1]), r2(g.p[2])]),
    });
  }
}
