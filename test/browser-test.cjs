// Headless browser test: two tabs join the online lobby, pick loadouts, ready up, play; plus offline mode.
// Usage: NODE_PATH=/path/to/node_modules node test/browser-test.cjs [baseUrl]
const puppeteer = require('puppeteer-core');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const step = (m) => console.log(new Date().toISOString().slice(11, 19), m);
const OUT = __dirname + '/../screenshots-proof';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 90000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function open(tag) {
    const p = await browser.newPage(); await p.setViewport({ width: 1366, height: 768 });
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`[${tag}] pageerror ${e.message}`));
    await p.goto(BASE + '/?autotest', { waitUntil: 'networkidle0' });
    return p;
  }
  const A = await open('A');
  await A.screenshot({ path: OUT + '/01-main-menu.png' });
  await A.type('#name', 'Jackson'); await A.click('#btn-online');
  await A.waitForSelector('#lobby:not(.hidden)'); await sleep(300);
  await A.click('#bots-plus'); await sleep(150); await A.click('#bots-plus'); await sleep(150); await A.click('#bots-plus'); await sleep(200);
  const B = await open('B');
  await B.evaluate(() => (document.getElementById('name').value = '')); await B.type('#name', 'Tab2Player'); await B.click('#btn-online');
  await B.waitForSelector('#lobby:not(.hidden)'); await sleep(300);
  step('B in lobby'); await B.bringToFront();
  // B picks shotgun + magnum
  await B.click('.opt[data-w="shotgun"]'); await B.click('.slot[data-slot="1"]'); await B.click('.opt[data-w="magnum"]'); await sleep(200);
  await B.click('#btn-ready'); await sleep(400);
  step('B ready'); await A.bringToFront();
  // A picks sniper and views primary slot
  await A.click('.slot[data-slot="0"]'); await A.click('.opt[data-w="ar"]'); await sleep(400);
  await A.screenshot({ path: OUT + '/02-lobby-loadout.png' });
  const lobbyInfo = await A.evaluate(() => [...document.querySelectorAll('#players li')].map((li) => li.textContent));
  console.log('Lobby list (tab A):', lobbyInfo);
  step('A ready'); await A.click('#btn-ready'); await sleep(1200);
  await A.screenshot({ path: OUT + '/03-countdown.png' });
  await A.waitForFunction(() => window.__game.active, { timeout: 8000 });
  await B.waitForFunction(() => window.__game.active, { timeout: 8000 });
  console.log('Match started in both tabs'); await A.bringToFront();
  await sleep(1500);
  // walk forward a bit and look at nearest remote player, then shoot
  await A.keyboard.down('KeyW'); await sleep(700); await A.keyboard.up('KeyW');
  const aimed = await A.evaluate(() => {
    const g = window.__game; let best = null, bd = 1e9;
    for (const r of g.remotes.values()) { const d = r.g.position.distanceTo(g.camera.position); if (r.g.visible && d < bd) { bd = d; best = r; } }
    if (!best) return null; const v = best.g.position.clone().sub(g.camera.position); v.y += 1.2;
    g.me.yaw = Math.atan2(-v.x, -v.z); g.me.pitch = Math.atan2(v.y, Math.hypot(v.x, v.z)); return bd.toFixed(1);
  });
  console.log('Aimed at remote player at distance', aimed);
  await sleep(300);
  await A.mouse.move(683, 384); await A.mouse.down(); await sleep(250);
  await A.screenshot({ path: OUT + '/04-ingame-firing.png' });
  await sleep(300); await A.mouse.up();
  await A.mouse.down({ button: 'right' }); await sleep(500);
  await A.screenshot({ path: OUT + '/05-ingame-ads.png' });
  await A.mouse.up({ button: 'right' });
  await A.keyboard.down('Tab'); await sleep(200); await A.screenshot({ path: OUT + '/06-scoreboard.png' }); await A.keyboard.up('Tab');
  await B.bringToFront(); await sleep(800); await B.screenshot({ path: OUT + '/07-ingame-tab2.png' }); await A.bringToFront();
  const stats = await A.evaluate(() => ({ remotes: window.__game.remotes.size, hp: window.__game.me.hp, rtt: Math.round(window.__game.rtt) }));
  const statsB = await B.evaluate(() => ({ remotes: window.__game.remotes.size, sawA: [...window.__game.remotes.keys()] }));
  console.log('Tab A sees', stats, '| Tab B sees', statsB);
  await A.close(); await B.close();
  // Offline mode
  const C = await open('C');
  await C.evaluate(() => (document.getElementById('name').value = '')); await C.type('#name', 'Solo'); await C.click('#btn-offline');
  await C.waitForSelector('#lobby:not(.hidden)'); await sleep(300);
  await C.click('.mode-btn[data-mode="tdm"]'); await sleep(200);
  await C.screenshot({ path: OUT + '/08-offline-lobby.png' });
  await C.click('#btn-ready');
  await C.waitForFunction(() => window.__game.active, { timeout: 8000 }); await sleep(4000);
  await C.screenshot({ path: OUT + '/09-offline-ingame.png' });
  const off = await C.evaluate(() => ({ bots: window.__game.remotes.size, feed: document.getElementById('killfeed').children.length }));
  console.log('Offline:', off);
  await browser.close();
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'No console errors');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
