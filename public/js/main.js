import { WEAPONS, SLOT_OPTIONS, SLOT_NAMES, DEFAULT_LOADOUT, validLoadout, Room, TICK_MS, SCORE_LIMIT, TIME_LIMIT_MS } from './shared.js';
import * as sfx from './audio.js';
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[<>&"]/g, '');
const S = { myId: null, host: null, lobby: null, loadout: loadLoadout(), selSlot: 0, net: null, offline: false, roster: new Map(), cdTimer: null };
window.__S = S;

function loadLoadout() { try { const l = JSON.parse(localStorage.getItem('sp_loadout')); if (validLoadout(l)) return l; } catch {} return [...DEFAULT_LOADOUT]; }
const send = (m) => S.net && S.net.send(m);
const game = new Game($('view'), { send, roster: S.roster, getMe: () => S.myId });
window.__game = game;

function show(id) { for (const s of ['menu', 'lobby', 'endscreen']) $(s).classList.toggle('hidden', s !== id); }
$('name').value = localStorage.getItem('sp_name') || '';

// ---------------- connections
function connectOnline(name) {
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  $('menu-msg').textContent = 'Connecting…';
  const ws = new WebSocket(url);
  const net = { ws, send: (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)), close: () => { net.closed = true; ws.close(); } };
  S.net = net; S.offline = false;
  ws.onopen = () => { $('menu-msg').textContent = ''; net.send({ t: 'hello', name }); };
  ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  ws.onclose = () => { if (S.net === net && !net.closed) { toMenu('Disconnected from server.'); } };
  ws.onerror = () => { if (S.net === net) $('menu-msg').textContent = 'Could not connect to server.'; };
}
function startOffline(name) {
  const me = 'local';
  const deliver = (m) => { const s = JSON.stringify(m); queueMicrotask(() => onMsg(JSON.parse(s))); };
  const room = new Room({ send: (id, m) => { if (id === me) deliver(m); }, broadcast: deliver });
  const iv = setInterval(() => room.tick(), TICK_MS);
  S.net = { send: (m) => { const s = JSON.stringify(m); queueMicrotask(() => room.handle(me, JSON.parse(s))); }, close: () => clearInterval(iv), room };
  S.offline = true;
  room.addPlayer(me, name); room.setBots(5);
}
function toMenu(msg) {
  if (S.net) { const n = S.net; S.net = null; n.close(); }
  game.stop(); S.myId = null; S.lobby = null; S.roster.clear();
  $('countdown').classList.add('hidden'); show('menu'); $('menu-msg').textContent = msg || '';
}

// ---------------- messages
function onMsg(m) {
  switch (m.t) {
    case 'welcome': S.myId = m.id; send({ t: 'loadout', loadout: S.loadout }); show('lobby'); renderLoadout(); break;
    case 'lobby': onLobby(m); break;
    case 'start': $('countdown').classList.add('hidden'); show(null); game.start(m, [...S.loadout]); break;
    case 'end': game.end(m); show('endscreen'); break;
    case 'tolobby': game.stop(); show('lobby'); renderLobby(); break;
    default: if (game.active) game.onMsg(m); else if (m.t === 'left' || m.t === 'score') game.onMsg(m);
  }
}
function onLobby(m) {
  S.lobby = m; S.host = m.host; S.roster.clear();
  for (const p of m.players) S.roster.set(p.id, p);
  if (game.active) { game.mode = m.mode; return; }
  renderLobby();
  const cd = $('countdown');
  clearInterval(S.cdTimer);
  if (m.state === 'countdown') {
    const end = performance.now() + m.countdown; cd.classList.remove('hidden'); let lastN = -1;
    const tickCd = () => { const n = Math.max(0, Math.ceil((end - performance.now()) / 1000)); cd.textContent = n > 0 ? n : 'GO'; if (n !== lastN) { sfx.countdownBeep(n === 0); lastN = n; } if (n <= 0) clearInterval(S.cdTimer); };
    tickCd(); S.cdTimer = setInterval(tickCd, 100);
  } else cd.classList.add('hidden');
}

// ---------------- lobby UI
function statRow(label, val, max, txt) { return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, (val / max) * 100)}%"></i></div><b>${txt}</b></div>`; }
function statsHtml(w) {
  if (w.kind === 'gun') return statRow('Damage', w.damage * w.pellets, 140, w.pellets > 1 ? `${w.damage}×${w.pellets}` : w.damage) + statRow('Fire rate', w.rpm, 950, `${w.rpm} rpm`) + statRow('Mag size', w.mag, 40, w.mag) + statRow('Range', w.range, 150, `${w.range} m`) + statRow('Accuracy', 1 - w.spread * 7, 1, Math.round((1 - w.spread * 7) * 100));
  if (w.kind === 'melee') return statRow('Damage', w.damage, 140, w.damage) + statRow('Swing rate', w.rpm, 140, `${w.rpm} /min`) + statRow('Mag size', 0, 1, '—') + statRow('Range', w.range, 4, `${w.range} m`);
  return statRow('Damage', w.damage, 140, w.damage) + statRow('Fuse', w.impact ? 0.2 : w.fuse / 1000, 4, w.impact ? 'impact' : `${w.fuse / 1000}s`) + statRow('Count', w.count, 3, w.count) + statRow('Blast radius', w.radius, 8, `${w.radius} m`);
}
function renderLoadout() {
  $('slots').innerHTML = S.loadout.map((id, i) => { const w = WEAPONS[id]; return `<div class="slot ${i === S.selSlot ? 'sel' : ''}" data-slot="${i}"><span class="key">${i + 1}</span><div class="lbl">${SLOT_NAMES[i]}</div><div class="wn">${w.name}</div><div class="wt">${w.type}</div></div>`; }).join('');
  $('options').innerHTML = SLOT_OPTIONS[S.selSlot].map((id) => { const w = WEAPONS[id]; return `<div class="opt ${S.loadout[S.selSlot] === id ? 'sel' : ''}" data-w="${id}"><div class="wn">${w.name}</div><div class="wt">${w.type}</div>${statsHtml(w)}</div>`; }).join('');
}
$('slots').addEventListener('click', (e) => { const el = e.target.closest('.slot'); if (!el) return; S.selSlot = +el.dataset.slot; sfx.initAudio(); sfx.click(); renderLoadout(); });
$('options').addEventListener('click', (e) => {
  const el = e.target.closest('.opt'); if (!el) return;
  S.loadout[S.selSlot] = el.dataset.w; localStorage.setItem('sp_loadout', JSON.stringify(S.loadout));
  sfx.initAudio(); sfx.click(); send({ t: 'loadout', loadout: S.loadout }); renderLoadout();
});
function renderLobby() {
  const m = S.lobby; if (!m) return;
  const me = S.roster.get(S.myId); const isHost = S.host === S.myId;
  $('lobby-title').textContent = S.offline ? 'PRACTICE LOBBY' : 'ONLINE LOBBY';
  const modeName = m.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-all';
  $('mode-info').textContent = `${modeName} · first to ${SCORE_LIMIT[m.mode]} kills${m.mode === 'tdm' ? ' (team)' : ''} · ${TIME_LIMIT_MS / 60000} min limit`;
  const st = { lobby: 'Waiting for all players to ready up…', countdown: 'Match starting!', playing: me && me.inMatch ? 'In match' : 'Match in progress — ready up to drop in', ended: 'Match ending…' }[m.state];
  $('lobby-status').textContent = st;
  $('host-controls').classList.toggle('hidden', !isHost);
  document.querySelectorAll('.mode-btn').forEach((b) => { b.classList.toggle('on', b.dataset.mode === m.mode); b.disabled = m.state !== 'lobby'; });
  $('bots-n').textContent = m.players.filter((p) => p.bot).length;
  $('players').innerHTML = m.players.map((p) => `<li class="${p.id === S.myId ? 'me' : ''}"><span class="nm">${esc(p.name)}${p.id === S.myId ? ' (you)' : ''}</span>${p.id === m.host ? '<span class="badge host">HOST</span>' : ''}${p.bot ? '<span class="badge">BOT</span>' : ''}${m.mode === 'tdm' && (p.inMatch || m.state !== 'lobby') ? `<span class="badge t${p.team}">${p.team ? 'BRAVO' : 'ALPHA'}</span>` : ''}<span class="badge">${WEAPONS[p.loadout[0]].name.split(' ')[0]}</span><span class="rd ${p.ready ? 'y' : ''}">${p.ready ? 'READY' : 'NOT READY'}</span></li>`).join('');
  const ready = me && me.ready;
  const rb = $('btn-ready'); rb.classList.toggle('on', !!ready);
  rb.textContent = m.state === 'playing' && !(me && me.inMatch) ? 'READY UP & DROP IN' : ready ? 'READY ✓ (click to cancel)' : 'READY UP';
  $('btn-start').classList.toggle('hidden', !isHost || m.state !== 'lobby');
}
$('btn-ready').addEventListener('click', () => { sfx.initAudio(); sfx.click(); const me = S.roster.get(S.myId); send({ t: 'ready', ready: !(me && me.ready) || (S.lobby.state === 'playing' && !me.inMatch) }); });
$('btn-start').addEventListener('click', () => { sfx.initAudio(); send({ t: 'start' }); });
$('btn-leave').addEventListener('click', () => toMenu());
document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => send({ t: 'mode', mode: b.dataset.mode })));
$('bots-minus').addEventListener('click', () => send({ t: 'bots', n: S.lobby.players.filter((p) => p.bot).length - 1 }));
$('bots-plus').addEventListener('click', () => send({ t: 'bots', n: S.lobby.players.filter((p) => p.bot).length + 1 }));
$('btn-quit').addEventListener('click', (e) => { e.stopPropagation(); send({ t: 'leave' }); game.stop(); show('lobby'); renderLobby(); });

// ---------------- menu
function getName() { const n = $('name').value.trim() || 'Player' + Math.floor(Math.random() * 1000); localStorage.setItem('sp_name', n); return n; }
$('btn-online').addEventListener('click', () => { sfx.initAudio(); connectOnline(getName()); });
$('btn-offline').addEventListener('click', () => { sfx.initAudio(); startOffline(getName()); });
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-online').click(); });
show('menu');
