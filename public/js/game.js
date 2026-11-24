import * as THREE from 'three';
import { MAP, WEAPONS, ARENA, PLAYER_H, PLAYER_H_CR, PLAYER_R, EYE, EYE_CR, moveCollide, blockedAt, dirFrom, spread, rayMap, MAX_HP, RESPAWN_MS } from './shared.js';
import * as sfx from './audio.js';

const $ = (id) => document.getElementById(id);
const lerp = (a, b, k) => a + (b - a) * k;
const TEAM_COLORS = [0x2b6cb0, 0xc53030];
const FFA_COLORS = [0xd07a2a, 0x7a3ad0, 0x2ab07a, 0xb0b02a, 0xd02a7a, 0x2a9ad0, 0x8a5a2a, 0x5ad02a];
const r4 = (x) => Math.round(x * 10000) / 10000;

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

export class Game {
  constructor(canvas, opts) {
    this.opts = opts; this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 500); this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.vmScene = new THREE.Scene(); this.vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.keys = new Set(); this.mouse = { l: false, r: false };
    this.remotes = new Map(); this.grenades = new Map();
    this.active = false; this.ended = false; this.time = 0; this.rtt = 80;
    this.feed = []; this.scoreData = null; this.mode = 'ffa'; this.tl = 0; this.shake = 0;
    this.testMode = /autotest/.test(location.search);
    this.buildWorld(); this.buildViewmodels(); this.buildFx(); this.bindInput(); this.buildHudStatic();
    addEventListener('resize', () => this.resize()); this.resize();
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
    setInterval(() => { if (this.active) this.opts.send({ t: 'ping', c: performance.now() }); }, 2000);
  }
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false);
    this.camera.aspect = this.vmCam.aspect = w / h; this.camera.updateProjectionMatrix(); this.vmCam.updateProjectionMatrix();
  }
  // ------------------------------------------------ world
  buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x9cc7e8); s.fog = new THREE.Fog(0x9cc7e8, 70, 260);
    s.add(new THREE.HemisphereLight(0xdfefff, 0x8a7a5a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.set(40, 70, 25); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 200 });
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; s.add(sun);
    const groundTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c8b48a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},40,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
      g.strokeStyle = 'rgba(80,60,30,.25)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(25, 25); groundTex.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0xb09a70, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; s.add(outer);
    const panel = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 4, 4); }
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    });
    panel.wrapS = panel.wrapT = THREE.RepeatWrapping;
    const mats = new Map();
    for (const b of MAP) {
      const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
      const geo = new THREE.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / 2, uv.getY(i) * dims[f][1] / 2); }
      if (!mats.has(b.c)) mats.set(b.c, new THREE.MeshStandardMaterial({ color: b.c, map: panel, roughness: 0.85, metalness: 0.05 }));
      const m = new THREE.Mesh(geo, mats.get(b.c));
      m.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      m.castShadow = m.receiveShadow = true; s.add(m);
    }
    // distant low-poly hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x9c8460, flatShading: true, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2, r = 130 + Math.random() * 90, hgt = 18 + Math.random() * 40;
      const c = new THREE.Mesh(new THREE.ConeGeometry(20 + Math.random() * 25, hgt, 6 + (i % 3)), hillMat);
      c.position.set(Math.cos(a) * r, hgt / 2 - 1, Math.sin(a) * r); c.rotation.y = Math.random() * 3; s.add(c);
    }
    // gun flash light for local player
    this.flashLight = new THREE.PointLight(0xffc060, 0, 12, 2); this.camera.add(this.flashLight); this.flashLight.position.set(0.3, -0.2, -1);
  }
  // ------------------------------------------------ viewmodels
  buildViewmodels() {
    const vs = this.vmScene;
    vs.add(new THREE.HemisphereLight(0xffffff, 0x666655, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(1, 2, 1); vs.add(dl);
    this.vmRoot = new THREE.Group(); vs.add(this.vmRoot);
    const M = (c, r = 0.6, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const dark = M(0x2a2c30), metal = M(0x5a6068, 0.4, 0.7), skin = M(0xc99a72, 0.8, 0), glove = M(0x3b3a32, 0.9, 0);
    const B = (g, mat, w, h, d, x, y, z, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
    const C = (g, mat, r, len, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m); return m; };
    const hands = (g, foreZ) => { B(g, glove, 0.065, 0.09, 0.1, 0.005, -0.085, 0.06, -0.3); B(g, skin, 0.07, 0.07, 0.25, 0.03, -0.12, 0.2); if (foreZ != null) { B(g, glove, 0.075, 0.06, 0.09, -0.01, -0.055, foreZ); B(g, skin, 0.07, 0.07, 0.3, -0.12, -0.1, foreZ + 0.2, 0.15).rotation.y = -0.5; } };
    const defs = {
      ar: (g) => { const acc = M(0x4a5a3a); B(g, dark, 0.07, 0.1, 0.42, 0, 0, -0.12); B(g, acc, 0.075, 0.085, 0.22, 0, 0, -0.42); C(g, metal, 0.014, 0.22, 0, 0.01, -0.62); B(g, dark, 0.05, 0.16, 0.08, 0, -0.11, -0.16, 0.25); B(g, acc, 0.06, 0.09, 0.2, 0, -0.01, 0.17); B(g, dark, 0.02, 0.035, 0.1, 0, 0.065, -0.1); g.userData = { muzzle: -0.74, sight: 0.08 }; hands(g, -0.42); },
      smg: (g) => { const acc = M(0x303842); B(g, dark, 0.07, 0.11, 0.32, 0, 0, -0.1); C(g, metal, 0.016, 0.12, 0, 0.01, -0.31); B(g, acc, 0.045, 0.2, 0.06, 0, -0.14, -0.15); B(g, metal, 0.02, 0.05, 0.2, 0, -0.02, 0.15); B(g, dark, 0.02, 0.03, 0.08, 0, 0.07, -0.08); g.userData = { muzzle: -0.38, sight: 0.085 }; hands(g, -0.28); },
      shotgun: (g) => { const wood = M(0x6b4423, 0.8, 0); B(g, dark, 0.075, 0.1, 0.35, 0, 0, -0.1); C(g, metal, 0.024, 0.5, 0, 0.025, -0.45); B(g, wood, 0.065, 0.06, 0.18, 0, -0.04, -0.42); B(g, wood, 0.065, 0.1, 0.25, 0, -0.02, 0.18); B(g, metal, 0.01, 0.02, 0.02, 0, 0.055, -0.66); g.userData = { muzzle: -0.72, sight: 0.065 }; hands(g, -0.42); },
      sniper: (g) => { const acc = M(0x3d4a5a); B(g, acc, 0.075, 0.1, 0.55, 0, 0, -0.1); C(g, metal, 0.016, 0.45, 0, 0.015, -0.6); C(g, dark, 0.032, 0.26, 0, 0.1, -0.1); B(g, dark, 0.05, 0.12, 0.07, 0, -0.1, -0.05); B(g, acc, 0.06, 0.11, 0.22, 0, -0.01, 0.25); g.userData = { muzzle: -0.84, sight: 0.1 }; hands(g, -0.4); },
      pistol: (g) => { B(g, dark, 0.045, 0.055, 0.2, 0, 0, -0.08); B(g, metal, 0.042, 0.02, 0.19, 0, 0.032, -0.08); B(g, dark, 0.04, 0.12, 0.055, 0, -0.08, 0.0, -0.25); g.userData = { muzzle: -0.19, sight: 0.05 }; hands(g, null); },
      magnum: (g) => { C(g, metal, 0.018, 0.2, 0, 0.01, -0.15); C(g, metal, 0.03, 0.06, 0, -0.005, -0.03); B(g, M(0x5a3a22, 0.8, 0), 0.04, 0.12, 0.055, 0, -0.08, 0.02, -0.3); B(g, metal, 0.01, 0.02, 0.02, 0, 0.035, -0.23); g.userData = { muzzle: -0.26, sight: 0.045 }; hands(g, null); },
      knife: (g) => { B(g, dark, 0.03, 0.035, 0.11, 0, 0, 0); B(g, metal, 0.05, 0.05, 0.01, 0, 0, -0.06); B(g, M(0xcfd6dc, 0.25, 0.9), 0.008, 0.035, 0.2, 0, 0.005, -0.16); g.userData = { muzzle: -0.2, sight: 0 }; hands(g, null); },
      hatchet: (g) => { B(g, M(0x6b4423, 0.8, 0), 0.03, 0.03, 0.34, 0, 0, -0.12); B(g, M(0xb0b8c0, 0.3, 0.8), 0.012, 0.11, 0.07, 0, 0.05, -0.28); g.userData = { muzzle: -0.3, sight: 0 }; hands(g, null); },
      frag: (g) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), M(0x4a5a30, 0.7, 0.1)); s.position.set(0, 0.02, -0.04); g.add(s); B(g, metal, 0.015, 0.05, 0.02, 0.02, 0.07, -0.04); g.userData = { muzzle: 0, sight: 0 }; hands(g, null); },
      impact: (g) => { C(g, M(0xc9a227, 0.5, 0.3), 0.035, 0.11, 0, 0.02, -0.04).rotation.x = 0; B(g, M(0x222222), 0.04, 0.02, 0.04, 0, 0.085, -0.04); g.userData = { muzzle: 0, sight: 0 }; hands(g, null); },
    };
    this.vm = {};
    for (const [id, f] of Object.entries(defs)) { const g = new THREE.Group(); f(g); g.visible = false; this.vmRoot.add(g); this.vm[id] = g; }
    const flashTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.3, 'rgba(255,190,60,.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = gr; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? 12 : 32; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); } g.fill(); });
    this.flashTex = flashTex;
    this.vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.vmFlash.scale.set(0.18, 0.18, 1); this.vmFlash.visible = false; this.vmScene.add(this.vmFlash);
  }
  // ------------------------------------------------ fx
  buildFx() {
    this.tracers = []; this.sparks = []; this.decals = []; this.booms = []; this.flashes = [];
    const tm = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 48; i++) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(g, tm.clone()); l.visible = false; l.frustumCulled = false; this.scene.add(l); this.tracers.push({ l, life: 0 }); }
    const sparkTex = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    for (let i = 0; i < 60; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.visible = false; this.scene.add(s); this.sparks.push({ s, life: 0, v: new THREE.Vector3() }); }
    const decalTex = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(20,15,10,.95)'); gr.addColorStop(0.5, 'rgba(20,15,10,.6)'); gr.addColorStop(1, 'rgba(20,15,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    const dm = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const dg = new THREE.PlaneGeometry(0.14, 0.14);
    for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(dg, dm); m.visible = false; this.scene.add(m); this.decals.push(m); }
    this.decalIdx = 0;
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, depthWrite: false }));
      const light = new THREE.PointLight(0xff8030, 0, 25, 2); m.add(light); m.visible = false; this.scene.add(m); this.booms.push({ m, light, life: 0 });
    }
    for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(0.7, 0.7, 1); s.visible = false; this.scene.add(s); this.flashes.push({ s, life: 0 }); }
    this.nadeGeo = new THREE.IcosahedronGeometry(0.09, 1); this.nadeMat = new THREE.MeshStandardMaterial({ color: 0x4a5a30 });
  }
  tracer(a, b) { const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0]; const p = t.l.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; t.l.visible = true; t.life = 0.07; }
  spark(pos, n = 4, scale = 0.25) { for (let i = 0; i < n; i++) { const s = this.sparks.find((x) => x.life <= 0); if (!s) return; s.s.position.copy(pos); s.v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(4); s.s.scale.setScalar(scale * (0.5 + Math.random())); s.s.visible = true; s.life = 0.15 + Math.random() * 0.1; } }
  worldFlash(pos) { const f = this.flashes.find((x) => x.life <= 0); if (!f) return; f.s.position.copy(pos); f.s.visible = true; f.life = 0.05; }
  decal(pt) {
    // find surface normal
    let n = null;
    if (pt.y < 0.02) n = new THREE.Vector3(0, 1, 0);
    else for (const b of MAP) {
      const e = 0.02; if (pt.x < b.min[0] - e || pt.x > b.max[0] + e || pt.y < b.min[1] - e || pt.y > b.max[1] + e || pt.z < b.min[2] - e || pt.z > b.max[2] + e) continue;
      const ds = [[Math.abs(pt.x - b.min[0]), [-1, 0, 0]], [Math.abs(pt.x - b.max[0]), [1, 0, 0]], [Math.abs(pt.y - b.min[1]), [0, -1, 0]], [Math.abs(pt.y - b.max[1]), [0, 1, 0]], [Math.abs(pt.z - b.min[2]), [0, 0, -1]], [Math.abs(pt.z - b.max[2]), [0, 0, 1]]].sort((a, c) => a[0] - c[0]);
      n = new THREE.Vector3(...ds[0][1]); break;
    }
    if (!n) return;
    const m = this.decals[this.decalIdx++ % this.decals.length];
    m.position.copy(pt).addScaledVector(n, 0.01); m.lookAt(pt.clone().add(n)); m.visible = true;
  }
  explosion(p, w) {
    const b = this.booms.find((x) => x.life <= 0) || this.booms[0];
    b.m.position.set(p[0], p[1] + 0.3, p[2]); b.m.visible = true; b.life = 0.45; b.max = (WEAPONS[w] || WEAPONS.frag).radius * 0.55;
    this.spark(b.m.position, 14, 0.8);
    const d = this.camera.position.distanceTo(b.m.position);
    sfx.boom(sfx.distVol(d) * 1.2); this.shake = Math.max(this.shake, Math.max(0, 1 - d / 25));
  }
  // ------------------------------------------------ players
  makeModel(color, name, friendly) {
    const g = new THREE.Group();
    const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const body = M(color), dark = M(0x2d3128), skin = M(0xc99a72), gunM = M(0x222222);
    const box = (parent, mat, w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.13, 0.9, 0); legR.position.set(0.13, 0.9, 0);
    box(legL, dark, 0.22, 0.9, 0.26, 0, -0.45, 0); box(legR, dark, 0.22, 0.9, 0.26, 0, -0.45, 0); g.add(legL, legR);
    const upper = new THREE.Group(); g.add(upper);
    box(upper, body, 0.62, 0.66, 0.34, 0, 1.23, 0);
    box(upper, M(0x3c4232), 0.64, 0.2, 0.36, 0, 1.0, 0);
    box(upper, skin, 0.3, 0.32, 0.3, 0, 1.73, 0);
    box(upper, M(friendly ? 0x2a4a6a : 0x4a3a2a), 0.36, 0.15, 0.36, 0, 1.9, 0);
    box(upper, M(0x111111), 0.26, 0.06, 0.02, 0, 1.76, -0.16);
    const arms = new THREE.Group(); arms.position.set(0, 1.45, 0); upper.add(arms);
    box(arms, body, 0.14, 0.14, 0.55, 0.26, -0.05, -0.22); box(arms, body, 0.14, 0.14, 0.55, -0.12, -0.05, -0.32).rotation.y = 0.5;
    const gun = box(arms, gunM, 0.08, 0.12, 0.75, 0.12, 0.0, -0.55);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -0.4); gun.add(muzzle);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 64, (c, w, h) => { c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 8, w, 48); c.fillStyle = friendly ? '#7ab8ff' : '#ff6b5b'; c.fillText(name, w / 2, 44); }), depthWrite: false, transparent: true }));
    tag.scale.set(1.4, 0.35, 1); tag.position.y = 2.25; g.add(tag);
    this.scene.add(g);
    return { g, legL, legR, upper, arms, gun, muzzle, tag, buf: [], walk: 0, dead: 0 };
  }
  isFriendly(id) { if (id === this.opts.getMe()) return true; if (this.mode !== 'tdm') return false; const me = this.opts.roster.get(this.opts.getMe()), o = this.opts.roster.get(id); return me && o && me.team === o.team; }
  getRemote(id) {
    let r = this.remotes.get(id);
    if (!r) {
      const info = this.opts.roster.get(id) || { name: id, team: 0 };
      const friendly = this.isFriendly(id);
      const color = this.mode === 'tdm' ? TEAM_COLORS[info.team] : FFA_COLORS[hash(id) % FFA_COLORS.length];
      r = this.makeModel(color, info.name, friendly); this.remotes.set(id, r);
    }
    return r;
  }
  removeRemote(id) { const r = this.remotes.get(id); if (r) { this.scene.remove(r.g); this.remotes.delete(id); } }
  // ------------------------------------------------ match lifecycle
  start(m, loadout) {
    this.active = true; this.ended = false; this.mode = m.mode; this.limit = m.limit; this.tl = m.timeLeft;
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
    for (const g of this.grenades.values()) this.scene.remove(g); this.grenades.clear();
    this.feed = []; $('killfeed').innerHTML = '';
    this.loadout = loadout;
    this.me = { p: [0, 0, 0], v: [0, 0, 0], yaw: 0, pitch: 0, cr: false, ground: true, alive: false, hp: MAX_HP, slot: 0, ammo: {}, reloadUntil: 0, switchUntil: 0, nextFire: 0, ads: 0, nades: 0, eye: EYE, kick: 0, bob: 0, held: false, fired: false, swing: 0, lastSend: 0, stepT: 0, deathAt: 0, killer: '' };
    this.refill();
    $('hud').classList.remove('hidden'); $('death').classList.add('hidden'); $('pause').classList.add('hidden');
    if (!this.testMode && document.pointerLockElement !== this.canvas) { $('clicktoplay').classList.remove('hidden'); $('ctp-title').textContent = (m.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL') + ` — first to ${m.limit}`; }
    this.renderHotbar();
  }
  refill() { for (const id of this.loadout) { const w = WEAPONS[id]; if (w.kind === 'gun') this.me.ammo[id] = { mag: w.mag, reserve: w.reserve }; } this.me.nades = WEAPONS[this.loadout[3]].count; }
  stop() {
    this.active = false; this.ended = false; $('hud').classList.add('hidden'); $('endscreen').classList.add('hidden');
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
    for (const g of this.grenades.values()) this.scene.remove(g); this.grenades.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  end(m) {
    this.ended = true; if (document.pointerLockElement) document.exitPointerLock();
    $('pause').classList.add('hidden'); $('scoreboard').classList.add('hidden');
    const me = this.opts.getMe();
    $('end-title').textContent = m.winner === 'Draw' ? 'DRAW' : `${m.winner.toUpperCase()} WINS`;
    $('end-board').innerHTML = this.boardHtml(m.board.map((p) => ({ ...p })), m.mode, m.teams, me);
    $('endscreen').classList.remove('hidden');
  }
  // ------------------------------------------------ messages
  onMsg(m) {
    const me = this.opts.getMe(); const now = performance.now();
    switch (m.t) {
      case 'snap': {
        this.tl = m.tl; const seen = new Set();
        for (const e of m.ps) {
          const [id, x, y, z, yaw, pitch, cr, w, hp, alive] = e; seen.add(id);
          if (id === me) { this.me.hp = hp; if (!alive && this.me.alive) this.me.alive = false; continue; }
          const r = this.getRemote(id); r.buf.push({ t: now, x, y, z, yaw, pitch, cr, w, hp, alive }); if (r.buf.length > 30) r.buf.shift();
        }
        for (const id of [...this.remotes.keys()]) if (!seen.has(id)) this.removeRemote(id);
        const gs = new Set();
        for (const [id, x, y, z] of m.g) { gs.add(id); let g = this.grenades.get(id); if (!g) { g = new THREE.Mesh(this.nadeGeo, this.nadeMat); g.castShadow = true; g.position.set(x, y, z); this.scene.add(g); this.grenades.set(id, g); } g.userData.to = new THREE.Vector3(x, y, z); }
        for (const [id, g] of this.grenades) if (!gs.has(id)) { this.scene.remove(g); this.grenades.delete(id); }
        break;
      }
      case 'spawn':
        if (m.id === me) {
          Object.assign(this.me, { p: [...m.p], v: [0, 0, 0], yaw: m.yaw, pitch: 0, alive: true, hp: MAX_HP, slot: 0, reloadUntil: 0, switchUntil: now + 300, cr: false });
          this.loadout = m.loadout || this.loadout; this.refill(); this.renderHotbar(); $('death').classList.add('hidden');
        } else { const r = this.getRemote(m.id); r.buf = [{ t: now - 200, x: m.p[0], y: m.p[1], z: m.p[2], yaw: m.yaw, pitch: 0, cr: 0, w: 'ar', hp: 100, alive: 1 }]; r.dead = 0; }
        break;
      case 'shot': {
        if (m.id === me) break;
        const r = this.remotes.get(m.id); if (!r) break;
        const a = new THREE.Vector3(); r.muzzle.getWorldPosition(a); this.worldFlash(a);
        m.ends.forEach((e, i) => { const b = new THREE.Vector3(...e); if (i < 3) this.tracer(a, b); this.spark(b, 2, 0.15); });
        sfx.shot(m.w, sfx.distVol(a.distanceTo(this.camera.position)) * 0.8);
        break;
      }
      case 'swing': if (m.id !== me) { const r = this.remotes.get(m.id); if (r) { r.swingT = 0.3; sfx.swing(); } } break;
      case 'hit': this.hitmarker(m.kill, m.head); sfx.hit(m.kill, m.head); if (m.kill) { const n = this.opts.roster.get(m.target); this.popup(`${m.head ? 'HEADSHOT! ' : ''}+100 ELIMINATED ${n ? n.name.toUpperCase() : ''}`); } break;
      case 'hurt': this.me.hp = m.hp; sfx.hurt(); $('vignette').style.opacity = 0.9; setTimeout(() => ($('vignette').style.opacity = Math.max(0, (1 - this.me.hp / 100) * 0.6)), 160); break;
      case 'kill': {
        const kn = (this.opts.roster.get(m.k) || {}).name || '?', vn = (this.opts.roster.get(m.v) || {}).name || '?';
        this.addFeed(m.k, kn, m.v, vn, m.w, m.head);
        if (m.v === me) { this.me.alive = false; this.me.deathAt = now; this.me.killer = m.k === me ? 'yourself' : kn; $('death').classList.remove('hidden'); $('death-by').textContent = m.k === me ? 'YOU BLEW YOURSELF UP' : `KILLED BY ${kn.toUpperCase()}`; }
        break;
      }
      case 'score': this.scoreData = m; this.renderScoreboard(); break;
      case 'boom': this.explosion(m.p, m.w); break;
      case 'nades': this.me.nades = m.n; this.renderHotbar(); break;
      case 'corr': this.me.p = [...m.p]; this.me.v = [0, 0, 0]; break;
      case 'left': this.removeRemote(m.id); break;
      case 'pong': this.rtt = lerp(this.rtt, performance.now() - m.c, 0.3); break;
    }
  }
  addFeed(k, kn, v, vn, w, head) {
    const me = this.opts.getMe(); const wn = (WEAPONS[w] || {}).name || w;
    const div = document.createElement('div');
    const esc = (s) => s.replace(/[<>&]/g, '');
    div.innerHTML = k === v ? `<span class="${v === me ? 'me' : ''}">${esc(vn)}</span><span class="w">[${wn}]</span>` : `<span class="${k === me ? 'me' : ''}">${esc(kn)}</span><span class="w">[${wn}${head ? ' ✦HS' : ''}]</span><span class="${v === me ? 'me' : ''}">${esc(vn)}</span>`;
    const kf = $('killfeed'); kf.prepend(div); while (kf.children.length > 6) kf.lastChild.remove();
    setTimeout(() => div.remove(), 6000);
  }
  hitmarker(kill, head) { const h = $('hitmarker'); h.className = kill ? 'kill' : head ? 'head' : ''; h.style.opacity = 1; clearTimeout(this.hmT); this.hmT = setTimeout(() => (h.style.opacity = 0), kill ? 300 : 140); }
  popup(txt) { const p = $('popup'); p.textContent = txt; clearTimeout(this.popT); this.popT = setTimeout(() => (p.textContent = ''), 1800); }
  boardHtml(rows, mode, teams, me) {
    const roster = this.opts.roster;
    rows.sort((a, b) => b.k - a.k || a.d - b.d);
    const row = (p) => `<tr class="${p.id === me ? 'me' : ''} ${mode === 'tdm' ? 't' + p.team : ''}"><td>${(p.name || '').replace(/[<>&]/g, '')}${p.bot ? ' <small>BOT</small>' : ''}</td><td>${p.k}</td><td>${p.d}</td><td>${(p.k / Math.max(1, p.d)).toFixed(2)}</td></tr>`;
    const head = '<tr><th>Player</th><th>Kills</th><th>Deaths</th><th>K/D</th></tr>';
    if (mode === 'tdm') return [0, 1].map((t) => `<h3 style="color:${t ? '#ff7a7a' : '#7ab8ff'}">${t ? 'BRAVO' : 'ALPHA'} — ${teams[t]}</h3><table>${head}${rows.filter((r) => r.team === t).map(row).join('')}</table>`).join('');
    return `<table>${head}${rows.map(row).join('')}</table>`;
  }
  renderScoreboard() {
    const s = this.scoreData; if (!s) return; const roster = this.opts.roster; const me = this.opts.getMe();
    const rows = s.ps.map(([id, k, d]) => ({ id, k, d, name: (roster.get(id) || {}).name || id, team: (roster.get(id) || {}).team || 0, bot: (roster.get(id) || {}).bot }));
    $('scoreboard').innerHTML = `<h2>${s.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL'} <span class="sub">first to ${s.limit}</span></h2>` + this.boardHtml(rows, s.mode, s.teams, me);
    if (s.mode === 'tdm') {
      const myTeam = (roster.get(me) || {}).team || 0;
      $('score-a').textContent = `ALPHA ${s.teams[0]}${myTeam === 0 ? ' (you)' : ''}`; $('score-b').textContent = `BRAVO ${s.teams[1]}${myTeam === 1 ? ' (you)' : ''}`;
    } else {
      rows.sort((a, b) => b.k - a.k); const mine = rows.find((r) => r.id === me);
      $('score-a').textContent = `YOU ${mine ? mine.k : 0}`; $('score-b').textContent = rows[0] ? `LEAD ${rows[0].name} ${rows[0].k}/${s.limit}` : '';
    }
  }
  buildHudStatic() { $('hitmarker').innerHTML = '<i></i><i></i><i></i><i></i>'; }
  renderHotbar() {
    if (!this.loadout) return;
    $('hotbar').innerHTML = this.loadout.map((id, i) => {
      const w = WEAPONS[id]; const c = w.kind === 'gun' ? (this.me.ammo[id] ? `${this.me.ammo[id].mag}/${this.me.ammo[id].reserve}` : '') : w.kind === 'grenade' ? `x${this.me.nades}` : '';
      return `<div class="hb ${i === this.me.slot ? 'sel' : ''}"><span class="k">${i + 1}</span><div class="n">${w.name}</div><div class="c">${c}</div></div>`;
    }).join('');
  }
  // ------------------------------------------------ input
  bindInput() {
    const c = this.canvas;
    const lock = () => { if (this.active && !this.ended && document.pointerLockElement !== c) { sfx.initAudio(); const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } };
    c.addEventListener('click', lock); $('clicktoplay').addEventListener('click', lock); $('pause').addEventListener('click', (e) => { if (e.target.id !== 'btn-quit') lock(); });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === c;
      if (locked) { $('clicktoplay').classList.add('hidden'); $('pause').classList.add('hidden'); }
      else if (this.active && !this.ended && $('clicktoplay').classList.contains('hidden')) { $('pause').classList.remove('hidden'); this.mouse.l = this.mouse.r = false; this.keys.clear(); }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked() || !this.me) return;
      const sens = 0.0022 * (this.camera.fov / 75);
      this.me.yaw -= e.movementX * sens; this.me.pitch = Math.max(-1.55, Math.min(1.55, this.me.pitch - e.movementY * sens));
    });
    document.addEventListener('mousedown', (e) => { if (!this.active || !this.me || !this.locked()) return; if (e.button === 0) { this.mouse.l = true; this.me.fired = false; } if (e.button === 2) this.mouse.r = true; });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { if (!this.locked() || !this.me) return; this.switchSlot((this.me.slot + (e.deltaY > 0 ? 1 : 3)) % 4); });
    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Tab') { e.preventDefault(); $('scoreboard').classList.remove('hidden'); return; }
      if (!this.locked() && !this.testMode) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 4) this.switchSlot(n); }
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyG') this.throwNade();
      if (e.code === 'KeyV') this.doMelee();
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Tab') $('scoreboard').classList.add('hidden'); });
  }
  locked() { return this.testMode || document.pointerLockElement === this.canvas; }
  cur() { return WEAPONS[this.loadout[this.me.slot]]; }
  switchSlot(n) {
    const me = this.me; if (!me.alive || n === me.slot) return;
    me.slot = n; me.switchUntil = performance.now() + 280; me.reloadUntil = 0; sfx.click(); this.renderHotbar();
  }
  reload() {
    const me = this.me, w = this.cur(); if (!me.alive || w.kind !== 'gun') return; const a = me.ammo[w.id];
    if (me.reloadUntil || a.mag >= w.mag || a.reserve <= 0) return;
    me.reloadUntil = performance.now() + w.reload * 1000; sfx.reload();
  }
  throwNade() {
    const me = this.me; if (!me.alive || me.nades <= 0 || performance.now() < (me.nadeCd || 0)) return;
    me.nadeCd = performance.now() + 800; me.throwT = 1;
    this.opts.send({ t: 'nade', d: dirFrom(me.yaw, me.pitch).map(r4) }); me.nades--; this.renderHotbar(); sfx.swing();
  }
  doMelee() {
    const me = this.me; if (!me.alive || performance.now() < (me.meleeCd || 0)) return;
    const w = WEAPONS[this.loadout[2]]; me.meleeCd = performance.now() + 60000 / w.rpm; me.swing = 1; sfx.swing();
    this.opts.send({ t: 'melee', d: dirFrom(me.yaw, me.pitch).map(r4) });
  }
  fire(now) {
    const me = this.me, w = this.cur();
    if (now < me.switchUntil || now < me.nextFire) return;
    if (w.kind === 'melee') { if (me.fired) return; me.fired = true; me.nextFire = now + 60000 / w.rpm; this.doMelee(); return; }
    if (w.kind === 'grenade') { if (me.fired) return; me.fired = true; this.throwNade(); return; }
    if (me.reloadUntil) return;
    const a = me.ammo[w.id];
    if (a.mag <= 0) { if (!me.fired) { sfx.empty(); this.reload(); } me.fired = true; return; }
    if (!w.auto && me.fired) return;
    me.fired = true; me.nextFire = now + 60000 / w.rpm; a.mag--;
    const moving = Math.hypot(me.v[0], me.v[2]) > 1;
    const sp = lerp(w.spread, w.ads, me.ads) * (moving ? 1.6 : 1) * (me.cr ? 0.75 : 1) * (me.ground ? 1 : 2.2);
    const base = dirFrom(me.yaw, me.pitch);
    const dirs = []; for (let i = 0; i < w.pellets; i++) dirs.push(spread(base, w.pellets > 1 ? Math.max(sp, w.ads) : sp).map(r4));
    this.opts.send({ t: 'fire', w: w.id, d: dirs, rw: Math.round(110 + this.rtt / 2) });
    // local effects
    sfx.shot(w.id, 0.9); me.kick = 1; this.flashLight.intensity = 6; this.vmFlash.visible = true; this.vmFlashT = 0.045;
    me.pitch = Math.min(1.55, me.pitch + w.recoil * (1 - me.ads * 0.4)); me.yaw += (Math.random() - 0.5) * w.recoil * 0.5;
    const o = this.camera.position; const muzzleW = new THREE.Vector3(0.25, -0.2, -0.8).applyQuaternion(this.camera.quaternion).add(o);
    dirs.forEach((d, i) => {
      const t = rayMap([o.x, o.y, o.z], d, 250); const end = new THREE.Vector3(o.x + d[0] * t, o.y + d[1] * t, o.z + d[2] * t);
      if (i < 3 && Math.random() < 0.6) this.tracer(muzzleW, end);
      if (t < 249) { this.spark(end, 2, 0.15); this.decal(end); }
    });
    if (a.mag === 0) setTimeout(() => this.reload(), 250);
    this.renderHotbar();
  }
  // ------------------------------------------------ frame
  frame() {
    const now = performance.now(); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt;
    if (this.active && this.me) this.updatePlayer(dt, now); else this.idleCam();
    this.updateRemotes(now, dt); this.updateFx(dt);
    this.renderer.clear(); this.renderer.render(this.scene, this.camera);
    const showVm = this.active && this.me && this.me.alive && !(this.cur().scope && this.me.ads > 0.85);
    if (showVm) { this.renderer.clearDepth(); this.renderer.render(this.vmScene, this.vmCam); }
  }
  idleCam() {
    const a = this.time * 0.05; this.camera.fov = 70; this.camera.updateProjectionMatrix();
    this.camera.position.set(Math.cos(a) * 55, 24, Math.sin(a) * 55); this.camera.rotation.set(0, 0, 0); this.camera.lookAt(0, 0, 0);
  }
  updatePlayer(dt, now) {
    const me = this.me, k = this.keys, w = this.cur();
    const input = me.alive && this.locked() && !this.ended;
    // crouch
    const wantCr = input && (k.has('KeyC') || k.has('ControlLeft'));
    if (wantCr) me.cr = true; else if (me.cr && !blockedAt(me.p, PLAYER_H, PLAYER_R - 0.05)) me.cr = false;
    // move
    let fx = 0, fz = 0;
    if (input) { if (k.has('KeyW')) fz -= 1; if (k.has('KeyS')) fz += 1; if (k.has('KeyA')) fx -= 1; if (k.has('KeyD')) fx += 1; }
    const sprint = input && k.has('ShiftLeft') && fz < 0 && !me.cr && me.ads < 0.3 && !this.mouse.l;
    let speed = me.cr ? 2.6 : sprint ? 7.6 : 5.2; speed *= 1 - me.ads * 0.4;
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    let wx = fx * cy + fz * sy, wz = -fx * sy + fz * cy; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const acc = me.ground ? Math.min(1, 12 * dt) : Math.min(1, 2 * dt);
    if (me.alive) { me.v[0] = lerp(me.v[0], wx * speed, acc); me.v[2] = lerp(me.v[2], wz * speed, acc); } else { me.v[0] *= 0.9; me.v[2] *= 0.9; }
    if (input && k.has('Space') && me.ground && !me.cr) { me.v[1] = 7.2; me.ground = false; }
    me.v[1] -= 20 * dt;
    const fallV = me.v[1]; const wasGround = me.ground;
    me.ground = moveCollide(me.p, me.v, dt, me.cr ? PLAYER_H_CR : PLAYER_H, PLAYER_R);
    me.p[0] = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, me.p[0])); me.p[2] = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, me.p[2]));
    if (!wasGround && me.ground && fallV < -6) sfx.jumpLand();
    const hs = Math.hypot(me.v[0], me.v[2]);
    if (me.ground && hs > 1.5 && me.alive) { me.stepT -= dt * hs; if (me.stepT <= 0) { sfx.step(me.cr ? 0.08 : 0.18); me.stepT = 2.2; } }
    me.bob += dt * hs * 1.6;
    // eye & camera
    const targetEye = !me.alive ? 0.35 : me.cr ? EYE_CR : EYE; me.eye = lerp(me.eye, targetEye, Math.min(1, dt * 12));
    // ads
    const adsTarget = input && this.mouse.r && w.kind === 'gun' && !me.reloadUntil && now >= me.switchUntil ? 1 : 0;
    me.ads = lerp(me.ads, adsTarget, Math.min(1, dt * (w.scope ? 9 : 13)));
    const fov = lerp(75, w.adsFov || 75, me.ads); if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.shake = Math.max(0, this.shake - dt * 2);
    const bobAmt = me.ground ? (sprint ? 0.06 : 0.03) * Math.min(1, hs / 5) * (1 - me.ads) : 0;
    this.camera.position.set(me.p[0], me.p[1] + me.eye + Math.sin(me.bob * 2) * bobAmt * 0.5, me.p[2]);
    this.camera.rotation.set(me.pitch + me.kick * 0.01 + (Math.random() - 0.5) * this.shake * 0.05, me.yaw + (Math.random() - 0.5) * this.shake * 0.05, me.alive ? 0 : 0.5);
    // firing / reload
    if (input && this.mouse.l) this.fire(now);
    if (me.reloadUntil && now >= me.reloadUntil) { const a = me.ammo[w.id]; if (a) { const take = Math.min(w.mag - a.mag, a.reserve); a.mag += take; a.reserve -= take; } me.reloadUntil = 0; this.renderHotbar(); }
    // viewmodel
    for (const id in this.vm) this.vm[id].visible = id === w.id;
    const g = this.vm[w.id]; const ud = g.userData;
    me.kick = Math.max(0, me.kick - dt * 12); me.swing = Math.max(0, me.swing - dt * 3.5); me.throwT = Math.max(0, (me.throwT || 0) - dt * 3);
    const hip = new THREE.Vector3(0.21, -0.22, -0.5), ads = new THREE.Vector3(0, -ud.sight, -0.48);
    const pos = hip.lerp(ads, me.ads);
    pos.x += Math.cos(me.bob) * bobAmt * 0.6; pos.y += Math.abs(Math.sin(me.bob)) * bobAmt * 0.6;
    pos.z += me.kick * 0.05;
    let rx = me.kick * 0.12, ry = 0, rz = 0;
    if (now < me.switchUntil) pos.y -= (me.switchUntil - now) / 280 * 0.3;
    if (me.reloadUntil) { const pr = 1 - (me.reloadUntil - now) / (w.reload * 1000); const s = Math.sin(pr * Math.PI); pos.y -= s * 0.12; rx -= s * 0.6; rz += s * 0.4; }
    if (sprint) { const s = Math.min(1, hs / 7); rz += 0.6 * s; ry += 0.5 * s; pos.x -= 0.05 * s; pos.y -= 0.04 * s; }
    if (me.swing > 0) { const s = Math.sin(me.swing * Math.PI); pos.z -= s * 0.25; pos.x -= s * 0.1; ry += s * 0.9; rx -= s * 0.3; }
    if (me.throwT > 0) { const s = Math.sin(me.throwT * Math.PI); pos.y += s * 0.15; pos.z -= s * 0.2; rx += s * 0.8; }
    if (w.kind === 'melee' && !me.swing) { ry += 0.3; rz -= 0.2; }
    this.vmRoot.position.copy(pos); this.vmRoot.rotation.set(rx, ry, rz);
    if (this.vmFlashT > 0) { this.vmFlashT -= dt; this.vmFlash.position.set(pos.x, pos.y + 0.01, pos.z + ud.muzzle); this.vmFlash.material.rotation = Math.random() * 6; if (this.vmFlashT <= 0) this.vmFlash.visible = false; }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 150);
    // HUD
    const scoped = w.scope && me.ads > 0.85; $('scope').classList.toggle('hidden', !scoped);
    const gap = 6 + (w.kind === 'gun' ? lerp(w.spread, w.ads, me.ads) * 260 * (hs > 1 ? 1.6 : 1) * (me.ground ? 1 : 2) : 0) + me.kick * 6;
    const ch = $('crosshair'); ch.style.opacity = me.ads > 0.6 && w.kind === 'gun' ? 0 : 1;
    ch.children[0].style.top = -gap - 8 + 'px'; ch.children[1].style.top = gap + 'px'; ch.children[2].style.left = -gap - 8 + 'px'; ch.children[3].style.left = gap + 'px';
    $('hp-fill').style.width = me.hp + '%'; $('hp-fill').style.background = me.hp > 50 ? '' : me.hp > 25 ? '#e0a030' : '#e03030'; $('hp-text').textContent = me.hp;
    const a = me.ammo[w.id];
    $('weapon-name').textContent = w.name; $('mag').textContent = a ? a.mag : w.kind === 'grenade' ? me.nades : '∞'; $('reserve').textContent = a ? a.reserve : '-';
    $('reload-hint').textContent = me.reloadUntil ? 'RELOADING…' : a && a.mag === 0 ? (a.reserve ? 'PRESS R TO RELOAD' : 'NO AMMO') : a && a.mag <= w.mag * 0.25 ? 'LOW AMMO' : '';
    const sec = Math.max(0, Math.ceil(this.tl / 1000)); this.tl -= dt * 1000; $('timer').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    if (!me.alive && me.deathAt) $('death-timer').textContent = `Respawning in ${Math.max(0, Math.ceil((RESPAWN_MS - (now - me.deathAt)) / 1000))}…`;
    if (me.hp >= 100 && $('vignette').style.opacity !== '0') $('vignette').style.opacity = 0;
    // send state
    if (me.alive && now - me.lastSend > 50) { me.lastSend = now; this.opts.send({ t: 'st', p: me.p.map(r4), yaw: r4(me.yaw), pitch: r4(me.pitch), cr: me.cr, w: w.id }); }
  }
  updateRemotes(now, dt) {
    const rt = now - 110;
    for (const r of this.remotes.values()) {
      const b = r.buf; if (!b.length) continue;
      let s = b[b.length - 1];
      for (let i = b.length - 1; i > 0; i--) if (b[i - 1].t <= rt) { const A = b[i - 1], B = b[i]; const k = Math.min(1, Math.max(0, (rt - A.t) / Math.max(1, B.t - A.t))); let dy = B.yaw - A.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; s = { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), z: lerp(A.z, B.z, k), yaw: A.yaw + dy * k, pitch: lerp(A.pitch, B.pitch, k), cr: B.cr, alive: B.alive }; break; }
      const prev = r.g.position.clone();
      r.g.position.set(s.x, s.y, s.z); r.g.rotation.y = s.yaw;
      const spd = prev.distanceTo(r.g.position) / Math.max(dt, 0.001);
      r.walk += dt * Math.min(spd, 8) * 2.2; const sw = spd > 0.5 ? Math.sin(r.walk) * 0.6 : 0;
      r.legL.rotation.x = sw; r.legR.rotation.x = -sw;
      r.legL.scale.y = r.legR.scale.y = s.cr ? 0.45 : 1; r.legL.position.y = r.legR.position.y = s.cr ? 0.4 : 0.9;
      r.upper.position.y = s.cr ? -0.5 : 0;
      r.swingT = Math.max(0, (r.swingT || 0) - dt);
      r.arms.rotation.x = s.pitch * 0.8 + (r.swingT > 0 ? Math.sin(r.swingT / 0.3 * Math.PI) * 0.8 : 0);
      if (!s.alive) { r.dead += dt; r.g.rotation.z = lerp(r.g.rotation.z, Math.PI / 2, Math.min(1, dt * 6)); r.g.position.y += 0.3; r.g.visible = r.dead < 2.5; r.tag.visible = false; }
      else { r.dead = 0; r.g.rotation.z = 0; r.g.visible = true; r.tag.visible = true; }
    }
    for (const g of this.grenades.values()) { if (g.userData.to) g.position.lerp(g.userData.to, Math.min(1, dt * 15)); g.rotation.x += dt * 8; }
  }
  updateFx(dt) {
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; t.l.material.opacity = Math.max(0, t.life / 0.07) * 0.8; if (t.life <= 0) t.l.visible = false; }
    for (const s of this.sparks) if (s.life > 0) { s.life -= dt; s.s.position.addScaledVector(s.v, dt); s.v.y -= 9 * dt; if (s.life <= 0) s.s.visible = false; }
    for (const f of this.flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; }
    for (const b of this.booms) if (b.life > 0) { b.life -= dt; const k = 1 - b.life / 0.45; b.m.scale.setScalar(0.3 + k * b.max); b.m.material.opacity = 0.9 * (1 - k); b.light.intensity = 60 * (1 - k); if (b.life <= 0) { b.m.visible = false; b.light.intensity = 0; } }
  }
}
