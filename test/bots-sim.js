// Runs an offline-style Room with 1 idle human + 7 bots for ~20s and reports bot kills (sanity check for AI + no exceptions).
import { Room, TICK_MS } from '../public/js/shared.js';
let kills = 0, shots = 0, booms = 0;
const room = new Room({ send: () => {}, broadcast: (m) => { if (m.t === 'kill') kills++; if (m.t === 'shot') shots++; if (m.t === 'boom') booms++; } });
room.addPlayer('h', 'Human'); room.setBots(7); room.handle('h', { t: 'mode', mode: 'tdm' }); room.handle('h', { t: 'ready', ready: true });
const iv = setInterval(() => room.tick(), TICK_MS);
setTimeout(() => { clearInterval(iv); console.log(`state=${room.state} shots=${shots} kills=${kills} booms=${booms} teams=${room.teamScores}`); process.exit(kills > 0 ? 0 : 1); }, 20000);
