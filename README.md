# STRIKEPOINT

A low-poly, browser-based arena FPS with an online lobby, a loadout/hotbar selection screen before ready-up, and offline practice against bots. All art is built from Three.js primitives, and all sounds are synthesized with WebAudio. There are no external assets and no build step.

## Run it (self-host)

```bash
npm install
npm start            # serves http://localhost:8080  (PORT=xxxx npm start to change)
```

Open `http://localhost:8080` in one or more tabs or browsers. Friends on your LAN can use `http://<your-ip>:8080`.
To share it over the internet, run `scripts/start-public.sh`, which needs `cloudflared` (it starts a Cloudflare quick tunnel and prints a `https://….trycloudflare.com` URL), or use any reverse proxy. The client connects to `wss://<same host>/ws` automatically when the page is served over https.

Tests:
```bash
npm test                                   # 2 WebSocket clients: lobby → loadouts → ready → match → position sync → hit/kill → respawn → disconnect
node test/bots-sim.js                      # bot AI sanity simulation
NODE_PATH=<dir with puppeteer-core> node test/browser-test.cjs http://localhost:8080   # headless browser + screenshots
```

## How to play

1. **Main menu:** enter a callsign, then pick **Online Match** (the shared server lobby) or **Offline Practice** (bots, runs entirely in your browser).
2. **Lobby/loadout:** click a hotbar slot (1 Primary, 2 Secondary, 3 Melee, 4 Lethal) and pick a weapon. Each weapon shows its damage, fire rate, mag size and range. The player list shows everyone's ready status. The host can switch between Free-for-all and Team Deathmatch, add or remove bots, or force-start. Once every human player is ready, a 3-second countdown starts the match. If a match is already running, readying up drops you into it.
3. **Match:** FFA ends at 20 kills and TDM at 40 team kills, or when the 5-minute timer runs out. Then a results screen shows and everyone returns to the lobby.

| Control | Action |
|---|---|
| Mouse | Look (click the game to lock the pointer; Esc to pause or leave) |
| W A S D | Move |
| Shift | Sprint |
| Space | Jump |
| C (or Left Ctrl) | Crouch |
| Left mouse | Fire / slash / throw |
| Right mouse | Aim down sights (the sniper uses a scope) |
| R | Reload |
| 1–4 / mouse wheel | Switch hotbar slot |
| G | Quick-throw grenade |
| V | Quick melee |
| Tab | Scoreboard |

Weapons: Vanguard AR-7 (AR), Wasp SMG-9, Breacher 12 (shotgun), Longshot R-50 (sniper), Sidearm P9, Hammer .44, Combat Knife, Field Hatchet, Frag Grenade, Impact Charge.

## Architecture

- `server.js`: static file server and `ws` WebSocket server on `/ws`. It runs a 20 Hz tick of the shared `Room`.
- `public/js/shared.js`: weapons, map, collision, and the authoritative `Room`. The `Room` handles lobby, ready-up, loadout validation, spawns, server-side hit scans with lag compensation (up to 300 ms rewind), fire-rate limits, movement sanity checks, grenades, health and regen, kills, scores, the match timer, and bot AI. Offline mode runs this same `Room` inside the browser.
- `public/js/game.js`: Three.js renderer, player controller, viewmodels, remote-player interpolation (about 110 ms buffer), effects and HUD.
- `public/js/main.js`: menu, lobby and loadout UI, plus networking.
- `public/js/audio.js`: WebAudio sound effects.
- `public/vendor/three.module.min.js`: a vendored copy of Three.js r160.

## Known limitations

- Ammo counts are tracked on the client. The server enforces fire rate, range falloff, line of sight and damage, but not magazine size.
- Movement is validated loosely (speed and teleport checks), not fully simulated on the server.
- There is one shared lobby per server, with up to 12 bots.
- A Cloudflare quick-tunnel URL changes every time the tunnel restarts.
