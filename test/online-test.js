// Automated online test: two WebSocket clients join, set loadouts, ready up, and verify
// the match starts, positions sync, and server-validated hits/kills are registered.
import WebSocket from 'ws';
const BASE = process.argv[2] || 'ws://localhost:8080';
const url = BASE.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); };

function client(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const c = { ws, name, msgs: [], id: null, on: {}, send: (m) => ws.send(JSON.stringify(m)) };
    ws.on('open', () => c.send({ t: 'hello', name }));
    ws.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'welcome') { c.id = m.id; resolve(c); } });
    ws.on('error', reject);
  });
}
const last = (c, t) => [...c.msgs].reverse().find((m) => m.t === t);
const count = (c, t) => c.msgs.filter((m) => m.t === t).length;

const A = await client('Alpha'); const B = await client('Bravo');
check('both clients welcomed', !!A.id && !!B.id, `${A.id} ${B.id}`);
await sleep(200);
const lob = last(B, 'lobby');
check('lobby lists both players', lob && lob.players.some((p) => p.id === A.id) && lob.players.some((p) => p.id === B.id), JSON.stringify(lob && lob.players.map((p) => p.name)));
const hostIsA = lob.host === A.id;
if (hostIsA) A.send({ t: 'bots', n: 0 });
A.send({ t: 'loadout', loadout: ['sniper', 'magnum', 'knife', 'frag'] });
B.send({ t: 'loadout', loadout: ['smg', 'pistol', 'hatchet', 'impact'] });
B.send({ t: 'loadout', loadout: ['bad', 'pistol', 'hatchet', 'impact'] }); // invalid -> ignored
await sleep(200);
let l2 = last(A, 'lobby');
check('loadouts stored & invalid rejected', l2.players.find((p) => p.id === A.id).loadout[0] === 'sniper' && l2.players.find((p) => p.id === B.id).loadout[0] === 'smg');
A.send({ t: 'ready', ready: true }); await sleep(150);
check('not started with only one ready', last(A, 'lobby').state === 'lobby');
check('ready status visible to others', last(B, 'lobby').players.find((p) => p.id === A.id).ready === true);
B.send({ t: 'ready', ready: true }); await sleep(150);
check('countdown begins when all ready', last(A, 'lobby').state === 'countdown');
await sleep(3300);
check('match start message received', !!last(A, 'start') && !!last(B, 'start'), JSON.stringify(last(A, 'start')));
const spA = [...A.msgs].reverse().find((m) => m.t === 'spawn' && m.id === A.id), spB = [...A.msgs].reverse().find((m) => m.t === 'spawn' && m.id === B.id);
check('both players spawned', !!spA && !!spB);
// place both players in the open on the north-west side facing each other (x=-38, z from -6..6 is clear?)
// move gradually to respect server speed validation
async function walk(c, from, to, steps = 40) { for (let i = 1; i <= steps; i++) { const k = i / steps; c.send({ t: 'st', p: [from[0] + (to[0] - from[0]) * k, 0, from[2] + (to[2] - from[2]) * k], yaw: 0, pitch: 0, cr: false, w: c === A ? 'sniper' : 'smg' }); await sleep(60); } }
const PA = [-5, 0, 40], PB = [5, 0, 40]; // open lane near the south wall (verified clear below)
const { rayMap, blockedAt } = await import('../public/js/shared.js');
await Promise.all([walk(A, spA.p, PA, 60), walk(B, spB.p, PB, 60)]);
await sleep(300);
const snap = last(B, 'snap');
const aInSnap = snap.ps.find((e) => e[0] === A.id);
check('position sync via snapshots', aInSnap && Math.abs(aInSnap[1] - PA[0]) < 0.5 && Math.abs(aInSnap[3] - PA[2]) < 0.5, JSON.stringify(aInSnap));
// teleport check -> server should correct
const corrBefore = count(A, 'corr');
A.send({ t: 'st', p: [40, 0, -40], yaw: 0, pitch: 0, cr: false, w: 'sniper' }); await sleep(150);
check('server rejects teleport (corr)', count(A, 'corr') > corrBefore);
// A shoots B: direction from A eye to B chest
const eyeA = [PA[0], 1.6, PA[2]], chestB = [PB[0], 1.1, PB[2]];
const d = [chestB[0] - eyeA[0], chestB[1] - eyeA[1], chestB[2] - eyeA[2]]; const L = Math.hypot(...d); const dir = d.map((x) => x / L);
const clear = rayMap(eyeA, dir, L) >= L - 0.1;
check('test lane has line of sight', clear, `mapT=${rayMap(eyeA, dir, L).toFixed(2)} dist=${L.toFixed(2)}`);
A.send({ t: 'fire', w: 'sniper', d: [dir], rw: 0 }); await sleep(200);
const hit = last(A, 'hit'), hurt = last(B, 'hurt'), shotSeen = B.msgs.some((m) => m.t === 'shot' && m.id === A.id);
check('shot broadcast to other client', shotSeen);
check('hit registered by server', hit && hit.target === B.id, JSON.stringify(hit));
check('victim notified with reduced hp', hurt && hurt.hp < 100, JSON.stringify(hurt));
// rate limit: immediate second sniper shot should be ignored
const hitsBefore = count(A, 'hit'); A.send({ t: 'fire', w: 'sniper', d: [dir], rw: 0 }); await sleep(150);
check('fire-rate validated (spam ignored)', count(A, 'hit') === hitsBefore);
// a shot aimed away should miss
await sleep(1400); const away = [-dir[0], 0, -dir[2]];
A.send({ t: 'fire', w: 'sniper', d: [away], rw: 0 }); await sleep(150);
check('missed shot does no damage', count(A, 'hit') === hitsBefore);
await sleep(1400);
A.send({ t: 'fire', w: 'sniper', d: [dir], rw: 0 }); await sleep(250);
const kill = [...B.msgs].reverse().find((m) => m.t === 'kill');
check('kill registered & broadcast', kill && kill.k === A.id && kill.v === B.id, JSON.stringify(kill));
const sc = last(B, 'score'); const rowA = sc && sc.ps.find((r) => r[0] === A.id);
check('scoreboard updated', rowA && rowA[1] === 1, JSON.stringify(sc && sc.ps));
await sleep(3300);
check('victim respawned', B.msgs.filter((m) => m.t === 'spawn' && m.id === B.id).length >= 2);
// disconnect handling
B.ws.close(); await sleep(300);
check('disconnect broadcast', A.msgs.some((m) => m.t === 'left' && m.id === B.id));
check('disconnected player removed from lobby', !last(A, 'lobby').players.some((p) => p.id === B.id));
A.ws.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
