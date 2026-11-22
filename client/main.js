import * as THREE from 'three';
import * as sfx from './sound.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ---------- setup ----------
const params = new URLSearchParams(location.search);
if (params.has('capture')) document.body.classList.add('capture');
const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 200);
camera.position.set(0, 8.5, 15);
camera.lookAt(0, -1.7, -1.5);

const hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(8, 20, 10); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
scene.add(sun);

let theme = null;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0xd9c49a }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
// ---- parade scene (default theme) ----
const parade = new THREE.Group(); scene.add(parade);
const road = new THREE.Mesh(new THREE.PlaneGeometry(18, 4), new THREE.MeshLambertMaterial({ color: 0xb33a3a }));
road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 2.2); parade.add(road);
const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.6, 24), new THREE.MeshLambertMaterial({ color: 0xf2e6c9 }));
podium.position.set(0, 0.3, 5.2); podium.castShadow = podium.receiveShadow = true; parade.add(podium);
// simple background buildings
for (let i = -5; i <= 5; i++) {
  const h = 3 + ((i * 7919) % 5 + 5) % 5;
  const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 3), new THREE.MeshLambertMaterial({ color: [0xe8d5b7, 0xc9a27e, 0xf0c987, 0xd4b8a0][(i + 8) % 4] }));
  b.position.set(i * 3.4, h / 2, -19); parade.add(b);
}

// ---- boxing arena (ring theme) ----
const RING = { x: 0, z: 4.2, size: 4.4, h: 0.7 };
const arena = new THREE.Group(); arena.visible = false; scene.add(arena);
{
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const base = new THREE.Mesh(new THREE.BoxGeometry(RING.size + 0.4, RING.h - 0.06, RING.size + 0.4), lam(0x1f2937));
  base.position.set(RING.x, (RING.h - 0.06) / 2, RING.z); base.castShadow = base.receiveShadow = true; arena.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(RING.size, 0.06, RING.size), lam(0x2b6cb0));
  top.position.set(RING.x, RING.h - 0.03, RING.z); top.receiveShadow = true; arena.add(top);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(RING.size * 0.55, RING.size * 0.55), lam(0x3b82c4));
  inner.rotation.x = -Math.PI / 2; inner.position.set(RING.x, RING.h + 0.001, RING.z); arena.add(inner);
  const half = RING.size / 2;
  // red corner posts on the left, blue on the right (as the camera sees it)
  for (const [cx, cz, col] of [[-half, -half, 0xef4444], [-half, half, 0xef4444], [half, -half, 0x3b82f6], [half, half, 0x3b82f6]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 10), lam(col));
    post.position.set(RING.x + cx, RING.h + 0.65, RING.z + cz); post.castShadow = true; arena.add(post);
  }
  const ropeMat = [lam(0xef4444), lam(0xf5f5f5), lam(0x3b82f6)];
  [0.4, 0.75, 1.1].forEach((y, i) => {
    for (const [dx, dz, rot] of [[0, -half, 0], [0, half, 0], [-half, 0, Math.PI / 2], [half, 0, Math.PI / 2]]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, RING.size, 6), ropeMat[i]);
      rope.rotation.z = Math.PI / 2; rope.rotation.y = rot;
      rope.position.set(RING.x + dx, RING.h + y, RING.z + dz); arena.add(rope);
    }
  });
  // ---- arena hall around the stands ----
  const W = 15.4, RZc = RING.z; // wall distance from the ring center
  const wallMat = lam(0x161b26);
  for (const [x, z, ry] of [[0, RZc - W, 0], [0, RZc + W, 0], [-W, RZc, Math.PI / 2], [W, RZc, Math.PI / 2]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 12, 0.4), wallMat); wall.position.set(x, 6, z); wall.rotation.y = ry; arena.add(wall);
    // glowing LED band along each wall (red / blue)
    const led = new THREE.Mesh(new THREE.BoxGeometry(W * 2 - 1, 0.35, 0.1), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    led.position.set(x - Math.sign(x) * 0.25, 5.6, z - Math.sign(z - RZc) * 0.25); led.rotation.y = ry; arena.add(led);
    const led2 = led.clone(); led2.material = new THREE.MeshBasicMaterial({ color: 0x2563eb }); led2.position.y = 6.2; arena.add(led2);
  }
  // floor around the ring: dark carpet with a red border
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), lam(0x111827)); carpet.rotation.x = -Math.PI / 2; carpet.position.set(RING.x, 0.005, RZc); carpet.receiveShadow = true; arena.add(carpet);
  const border = new THREE.Mesh(new THREE.RingGeometry(3.15, 3.35, 4, 1), new THREE.MeshBasicMaterial({ color: 0xb91c1c })); border.rotation.set(-Math.PI / 2, 0, Math.PI / 4); border.position.set(RING.x, 0.01, RZc); arena.add(border);
  // ring steps (red corner and blue corner)
  for (const [sx, col] of [[-1, 0xef4444], [1, 0x3b82f6]]) for (let k = 0; k < 3; k++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2 * (k + 1), 0.7), lam(k === 2 ? col : 0x374151));
    st.position.set(RING.x + sx * (RING.size / 2 + 0.85 - k * 0.3), 0.1 * (k + 1), RZc + 2.6); arena.add(st);
  }
  // lighting truss over the ring with spot cans, and a 4-sided jumbotron
  const trussMat = lam(0x9ca3af), canMat = lam(0x1f2937), lensMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6 });
  const TY = 8.2, TS = 3.6;
  for (const [dx, dz, ry] of [[0, -TS, 0], [0, TS, 0], [-TS, 0, Math.PI / 2], [TS, 0, Math.PI / 2]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(TS * 2 + 0.3, 0.22, 0.22), trussMat); bar.position.set(RING.x + dx, TY, RZc + dz); bar.rotation.y = ry; arena.add(bar);
    for (let k = -2; k <= 2; k++) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 10), canMat);
      const off = new THREE.Vector3(k * 1.4, -0.3, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      can.position.set(RING.x + dx + off.x, TY - 0.3, RZc + dz + off.z); arena.add(can);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 10), lensMat); lens.rotation.x = Math.PI / 2; lens.position.set(can.position.x, TY - 0.51, can.position.z); arena.add(lens);
    }
  }
  for (const [cx, cz] of [[-TS, -TS], [TS, -TS], [-TS, TS], [TS, TS]]) { const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4, 4), trussMat); cable.position.set(RING.x + cx, TY + 2, RZc + cz); arena.add(cable); }
  const jumbo = new THREE.Group(); jumbo.position.set(RING.x, TY + 1.6, RZc); arena.add(jumbo);
  jumbo.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 2.6), lam(0x0b0f17)));
  for (let k = 0; k < 4; k++) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.2), new THREE.MeshBasicMaterial({ color: k % 2 ? 0x1d4ed8 : 0xb91c1c }));
    scr.position.set(Math.sin(k * Math.PI / 2) * 1.31, 0, Math.cos(k * Math.PI / 2) * 1.31); scr.rotation.y = k * Math.PI / 2; jumbo.add(scr);
  }
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), trussMat); c.position.set(RING.x, TY + 3.8, RZc); arena.add(c); }
  const spot = new THREE.SpotLight(0xffffff, 120, 30, Math.PI / 7, 0.4, 1.2);
  spot.position.set(RING.x, 12, RING.z + 1); spot.target.position.set(RING.x, 0, RING.z); spot.castShadow = true;
  arena.add(spot, spot.target);
}
const CORNER_POS = { red: new THREE.Vector3(RING.x - 0.95, RING.h, RING.z), blue: new THREE.Vector3(RING.x + 0.95, RING.h, RING.z) };

function resize() {
  const r = $('stage').getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
}
addEventListener('resize', resize); resize();

// ---------- avatars ----------
const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.6, 4, 8);
const headGeo = new THREE.SphereGeometry(0.28, 12, 10);
const crownGeo = new THREE.ConeGeometry(0.22, 0.35, 6);
const skin = new THREE.MeshLambertMaterial({ color: 0xf1c27d });
const gold = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x553300 });
const matCache = new Map();
const mat = (hex) => { if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshLambertMaterial({ color: hex })); return matCache.get(hex); };
// ---------- character models (Kenney Mini Characters, CC0) ----------
const MODEL_NAMES = ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f', 'male-g', 'worker', 'knight', 'soldier'];
const CHAR_HEIGHT = 1.5; // world units
const models = []; // {scene, clips, scale}
async function loadModels() {
  const loader = new GLTFLoader();
  await Promise.all(MODEL_NAMES.map(async (n, i) => {
    const g = await loader.loadAsync(`assets/models/character-${n}.glb`);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(g.scene);
    const h = box.max.y - box.min.y || 1;
    models[i] = { scene: g.scene, clips: Object.fromEntries(g.animations.map((c) => [c.name, c])), scale: CHAR_HEIGHT / h };
  }));
}
const ringGeo = new THREE.RingGeometry(0.32, 0.46, 24).rotateX(-Math.PI / 2);
const ringMat = new Map();
const ringMaterial = (hex) => { if (!ringMat.has(hex)) ringMat.set(hex, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.85 })); return ringMat.get(hex); };

function playAction(a, name, { once = false, fade = 0.2, holdMs = 0 } = {}) {
  if (a.removed) return;
  const next = a.actions[name]; if (!next || a.current === next && !once) return;
  next.reset();
  if (once) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = holdMs > 0; }
  next.fadeIn(fade).play();
  if (a.current && a.current !== next) a.current.fadeOut(fade);
  a.current = next;
  if (once) a.oneShotUntil = performance.now() + Math.max(holdMs, next.getClip().duration * 1000);
}

const PALETTE = ['#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#64748b', '#a16207', '#0ea5e9'];
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) | 0; return Math.abs(h); };

// Name tags: front/hero always shown; crowd tags show for a few seconds after
// joining or acting, max MAX_CROWD_LABELS at once (newest win).
const LABEL_MS = 5000, MAX_CROWD_LABELS = 10;
function updateLabels(now) {
  const recent = [];
  for (const a of avatars.values()) {
    if (a.data.slot !== 'crowd') { a.label.visible = true; continue; }
    a.label.visible = false;
    if (now < a.labelUntil) recent.push(a);
  }
  recent.sort((x, y) => y.labelUntil - x.labelUntil);
  for (let i = 0; i < Math.min(MAX_CROWD_LABELS, recent.length); i++) recent[i].label.visible = true;
}
const avatars = new Map(); // id -> {data, group, body, label, target, crown}
window.__game = { avatars }; // debug handle (dev only)

function makeLabel(text, color = '#fff', size = 40) {
  const t = [...text].length > 14 ? [...text].slice(0, 13).join('') + '…' : text;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `700 ${size}px system-ui, "Segoe UI", "Noto Sans", "Segoe UI Emoji", sans-serif`;
  const w = Math.ceil(ctx.measureText(t).width) + 24;
  c.width = w; c.height = size + 20;
  ctx.font = `700 ${size}px system-ui, "Segoe UI", "Noto Sans", "Segoe UI Emoji", sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, 14); ctx.fill();
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(t, w / 2, c.height / 2 + 2); // plain text only: no HTML injection possible
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set((w / c.height) * 0.38, 0.38, 1);
  s.renderOrder = 10;
  return s;
}

// crowd grid cells behind the road
// ---------- crowd places ----------
// Parade: standing grid. Ring: red seats on rising tiers behind and beside the ring.
let cells = [];
let ringMode = false;
const SIT_Y = 0.22; // how high a seated character's origin sits above the tier floor (tuned visually)
const seatGroup = new THREE.Group(); seatGroup.visible = false; scene.add(seatGroup);
const ringCells = [];
{
  const seatMat = new THREE.MeshLambertMaterial({ color: 0xc81e1e });
  const tierMat = new THREE.MeshLambertMaterial({ color: 0x2a303c });
  const seatGeo = new THREE.BoxGeometry(0.62, 0.1, 0.55);
  const backGeo = new THREE.BoxGeometry(0.62, 0.55, 0.08);
  const spots = [];
  // four equal stands (12 rising rows each) around the ring; the corners are left open for stairs
  const RZ0 = 4.2, ROWS = 12;
  const stairMat = new THREE.MeshLambertMaterial({ color: 0x4b5563 }), edgeMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
  for (let r = 0; r < ROWS; r++) {
    const d = 3.5 + r * 0.95, y = r * 0.42, len = d - 0.75; // len = half length of the row (gap at the corners)
    const ty = Math.max(0.05, y);
    // [center x, center z, rotation, row along x?]
    for (const [cx, cz, rot, alongX] of [[0, RZ0 - d, 0, true], [0, RZ0 + d, Math.PI, true], [-d, RZ0, Math.PI / 2, false], [d, RZ0, -Math.PI / 2, false]]) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len * 2 : 0.95, ty, alongX ? 0.95 : len * 2), tierMat);
      tier.position.set(cx, ty / 2, cz); tier.receiveShadow = true; seatGroup.add(tier);
      for (let t = -len + 0.45; t <= len - 0.45 + 0.01; t += 0.9) spots.push(alongX ? { x: t, y, z: cz, rot } : { x: cx, y, z: RZ0 + t, rot });
    }
    // corner stairs: one step per row, grey with a yellow edge
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, ty, 1.5), stairMat);
      step.position.set(sx * (d - 0.05), ty / 2, RZ0 + sz * (d - 0.05)); step.rotation.y = Math.PI / 4; step.receiveShadow = true; seatGroup.add(step);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.06), edgeMat);
      edge.position.set(sx * (d - 0.05 - 0.5), ty + 0.015, RZ0 + sz * (d - 0.05 - 0.5)); edge.rotation.y = sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4; seatGroup.add(edge);
    }
  }
  const seats = new THREE.InstancedMesh(seatGeo, seatMat, spots.length);
  const backs = new THREE.InstancedMesh(backGeo, seatMat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  spots.forEach((sp, i) => {
    q.setFromAxisAngle(up, sp.rot);
    m.compose(new THREE.Vector3(sp.x, sp.y + 0.32, sp.z), q, one); seats.setMatrixAt(i, m);
    const off = new THREE.Vector3(0, 0, -0.27).applyQuaternion(q);
    m.compose(new THREE.Vector3(sp.x + off.x, sp.y + 0.6, sp.z + off.z), q, one); backs.setMatrixAt(i, m);
    ringCells.push({ x: sp.x, y: sp.y + SIT_Y, z: sp.z, rot: sp.rot, seat: true, used: null });
  });
  seats.castShadow = seats.receiveShadow = backs.castShadow = true;
  seatGroup.add(seats, backs);
  const RZ = 4.2; // fill seats closest to the ring first
  ringCells.sort((a, b) => Math.hypot(a.x, a.z - RZ) - Math.hypot(b.x, b.z - RZ));
}
const paradeCells = [];
for (let z = -1.2; z >= -15; z -= 1.15) for (let x = -7.5; x <= 7.5; x += 1.1) paradeCells.push({ x: x + (Math.abs(z * 10) % 2 ? 0.5 : 0), y: 0, z, rot: 0, used: null });
paradeCells.sort((a, b) => (a.x * a.x + a.z * a.z * 0.6) - (b.x * b.x + b.z * b.z * 0.6)); // fill near center first
cells = paradeCells;
function useCells(isRing) {
  ringMode = isRing;
  for (const c of ringCells) c.used = null;
  for (const c of paradeCells) c.used = null;
  cells = isRing ? ringCells : paradeCells;
  seatGroup.visible = isRing;
}

function freeCell(id) {
  const free = cells.filter((c) => !c.used);
  if (!free.length) return { x: (Math.random() - 0.5) * 14, y: 0, z: -15 - Math.random() * 2, rot: 0 };
  const c = free[Math.min(free.length - 1, Math.floor(Math.random() * Math.min(ringMode ? 4 : 12, free.length)))];
  c.used = id; return c;
}
function releaseCell(id) { for (const c of cells) if (c.used === id) c.used = null; }


// ---------- boxer gear (fighters only) ----------
const gloveGeo = new THREE.SphereGeometry(0.1, 16, 12);
const thumbGeo = new THREE.SphereGeometry(0.04, 10, 8);
const trunkGeo = new THREE.CylinderGeometry(1, 1, 1, 20); // scaled to the torso below
const gearMat = { red: new THREE.MeshLambertMaterial({ color: 0xdc2626 }), blue: new THREE.MeshLambertMaterial({ color: 0x2563eb }) };
const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
function setGear(a, corner) {
  if (a.gearCorner === corner) return;
  for (const g of a.gear ?? []) g.parent?.remove(g);
  a.gear = []; a.gearCorner = corner;
  if (!corner) return;
  const mat = gearMat[corner];
  for (const side of ['arm-left', 'arm-right']) {
    const bone = a.model.getObjectByName(side); if (!bone) continue;
    // bind pose is a T-pose: the hand is at the end of the arm along local X
    const dir = side === 'arm-left' ? 1 : -1;
    const glove = new THREE.Mesh(gloveGeo, mat); glove.position.set(dir * 0.31, -0.005, 0.02); glove.scale.set(1.15, 1, 1.2); glove.castShadow = true;
    const thumb = new THREE.Mesh(thumbGeo, mat); thumb.position.set(-dir * 0.05, 0.04, 0.07); glove.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 12), whiteMat); cuff.rotation.z = Math.PI / 2; cuff.scale.set(1.1, 1.6, 1.1); cuff.position.set(dir * 0.215, -0.005, 0.01);
    bone.add(glove, cuff); a.gear.push(glove, cuff);
  }
  const torso = a.model.getObjectByName('torso');
  if (torso) {
    const trunks = new THREE.Mesh(trunkGeo, mat); trunks.position.set(0, 0.035, 0.0); trunks.scale.set(0.162, 0.07, 0.143); trunks.castShadow = true;
    const band = new THREE.Mesh(trunkGeo, whiteMat); band.position.set(0, 0.077, 0); band.scale.set(0.165, 0.018, 0.146);
    torso.add(trunks, band); a.gear.push(trunks, band);
  }
  // headgear: padded helmet in the corner colour (head mesh spans about x ±0.23, y -0.08..0.32, z -0.16..0.23 in head-bone space)
  const head = a.model.getObjectByName('head');
  if (head) {
    const pad = (w, h, d, x, y, z, m = mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; head.add(b); a.gear.push(b); };
    pad(0.42, 0.035, 0.34, 0, 0.335, 0.02);        // crown pad
    pad(0.47, 0.06, 0.035, 0, 0.27, 0.245);        // brow band (face stays open)
    pad(0.47, 0.2, 0.035, 0, 0.2, -0.178);         // back of the head
    for (const sx of [-1, 1]) pad(0.035, 0.2, 0.3, sx * 0.245, 0.17, 0.04); // ear / cheek pads
    pad(0.03, 0.02, 0.36, 0, 0.36, 0.02, whiteMat); // white stripe on top
  }
}

function colorFor(d) { return (d.team && theme?.teams?.[d.team]) || PALETTE[hash(d.id) % PALETTE.length]; }

function spawn(d) {
  if (avatars.has(d.id)) return update(d);
  const group = new THREE.Group();
  const m = models[hash(d.id) % models.length];
  const model = SkeletonUtils.clone(m.scene); model.scale.setScalar(m.scale);
  const ring = new THREE.Mesh(ringGeo, ringMaterial(colorFor(d))); ring.position.y = 0.02;
  const label = makeLabel(d.name); label.position.y = CHAR_HEIGHT + 0.35;
  group.add(model, ring, label);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const n of ['idle', 'walk', 'sprint', 'jump', 'emote-yes', 'attack-melee-right', 'attack-melee-left', 'die', 'sit', 'holding-both']) if (m.clips[n]) actions[n] = mixer.clipAction(m.clips[n]);
  const a = { data: d, group, model, ring, label, mixer, actions, current: null, oneShotUntil: 0, crown: null, target: new THREE.Vector3(), phase: Math.random() * 6, jump: 0, labelUntil: performance.now() + LABEL_MS };
  mixer.setTime(Math.random() * 2);
  const start = freeCell(d.id);
  group.position.set(ringMode ? Math.sign(start.x || 1) * 10 : start.x, 0, ringMode ? start.z : -16.5); // walk in (from the side in the arena)
  scene.add(group);
  avatars.set(d.id, a);
  place(a, start);
}

function frontPositions() { return [...avatars.values()].filter((a) => a.data.slot === 'front').sort((x, y) => x.data.id.localeCompare(y.data.id)); }

function place(a, cell) {
  const d = a.data;
  if (d.slot === 'hero') { releaseCell(d.id); a.target.set(0, 0.6, 5.2); }
  else if (d.slot === 'red' || d.slot === 'blue') { releaseCell(d.id); a.target.copy(CORNER_POS[d.slot]); a.seat = null; }
  else if (d.slot === 'front') { releaseCell(d.id); /* set in layoutFront */ }
  else { const c = cell ?? cells.find((c) => c.used === d.id) ?? freeCell(d.id); a.target.set(c.x, c.y ?? 0, c.z); a.seat = c.seat ? c : null; a.seatRot = c.rot ?? 0; }
  setGear(a, d.slot === 'red' || d.slot === 'blue' ? d.slot : null);
  // crown for hero
  if (d.slot === 'hero' && !a.crown) { a.crown = new THREE.Mesh(crownGeo, gold); a.crown.position.y = CHAR_HEIGHT + 0.22; a.group.add(a.crown); }
  if (d.slot !== 'hero' && a.crown) { a.group.remove(a.crown); a.crown = null; }
  layoutFront();
}

function layoutFront() {
  const f = frontPositions();
  f.forEach((a, i) => { const x = (i - (f.length - 1) / 2) * 1.5; a.target.set(x, 0, 2.2); });
}

function update(d) {
  const a = avatars.get(d.id);
  if (!a) return spawn(d);
  const teamChanged = a.data.team !== d.team;
  a.data = d;
  a.labelUntil = performance.now() + LABEL_MS;
  if (teamChanged) a.ring.material = ringMaterial(colorFor(d));
  place(a);
}

function remove(id) {
  const a = avatars.get(id); if (!a) return;
  a.removed = true;
  releaseCell(id); scene.remove(a.group); a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.model);
  a.label.material.map.dispose(); a.label.material.dispose();
  avatars.delete(id); layoutFront();
}

function say(id, text) {
  const a = avatars.get(id); if (!a) return;
  a.labelUntil = performance.now() + LABEL_MS;
  playAction(a, 'emote-yes', { once: true });
  const s = makeLabel(text, '#fff', 64); s.position.y = CHAR_HEIGHT + 0.85; a.group.add(s);
  setTimeout(() => { a.group.remove(s); s.material.map.dispose(); s.material.dispose(); }, 2500);
}

// ---------- effects ----------
const particles = [];
function burst(origin, count, colors, speed = 6, life = 1.6) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), vel = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos.set([origin.x, origin.y, origin.z], i * 3);
    c.set(colors[i % colors.length]); col.set([c.r, c.g, c.b], i * 3);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.6));
    vel.push(v);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true }));
  scene.add(pts); particles.push({ pts, vel, life, age: 0 });
}
const CONF = ['#ff5a5f', '#ffd700', '#3b82f6', '#22c55e', '#ec4899', '#ffffff'];
let effectTimer;
function showText(t) { const e = $('effectText'); e.textContent = t; e.classList.add('show'); clearTimeout(effectTimer); effectTimer = setTimeout(() => e.classList.remove('show'), 1800); }

function effect(op) {
  const a = op.id && avatars.get(op.id);
  if (op.effect === 'confetti') { for (let i = 0; i < 4; i++) burst(new THREE.Vector3((i - 1.5) * 4, 7, -2), 70, CONF, 5, 2.5); showText(`${op.by} followed!`); sfx.play('follow'); }
  else if (op.effect === 'fireworks') { for (let i = 0; i < 5; i++) setTimeout(() => burst(new THREE.Vector3((Math.random() - 0.5) * 12, 8 + Math.random() * 3, -6), 120, [CONF[i % 6], '#fff'], 7, 1.8), i * 250); showText(`👑 ${op.by} leads the parade!`); sfx.play('bigGift'); for (let i = 0; i < 3; i++) setTimeout(() => sfx.play('firework'), 400 + i * 450); }
  else if (op.effect === 'sparkle' && a) { burst(a.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 40, ['#ffd700', '#fff'], 3, 1); sfx.play('gift'); }
  else if (op.effect === 'cheer') { for (const x of avatars.values()) { x.jump = 1; setTimeout(() => playAction(x, 'jump', { once: true }), Math.random() * 300); } showText('🎉 Crowd cheers!'); sfx.play('cheer'); }
}

// ---------- HUD ----------
let bannerTimer;
function applyTheme(t) {
  theme = t;
  $('title').textContent = t.title;
  const lines = $('lines'); lines.replaceChildren(...t.hud.map((s) => { const d = document.createElement('div'); d.textContent = s; return d; }));
  const isRing = t.scene === 'ring';
  useCells(isRing);
  arena.visible = isRing; parade.visible = !isRing;
  document.body.classList.toggle('ring-mode', isRing);
  if (!isRing) $('ringHud').hidden = true;
  if (t.colors) { scene.background = new THREE.Color(t.colors.sky); scene.fog = new THREE.Fog(t.colors.sky, 30, 70); ground.material.color.set(t.colors.ground); }
}
// Gift banners queue up so a burst of gifts doesn't overwrite each other (max 6 waiting).
const bannerQueue = [];
function banner(text) { if (bannerQueue.length < 6) bannerQueue.push(text); if (!bannerTimer) nextBanner(); }
function nextBanner() {
  const b = $('banner'), text = bannerQueue.shift();
  if (!text) { b.classList.remove('show'); bannerTimer = null; return; }
  b.classList.remove('show'); void b.offsetWidth; // restart the pop animation
  b.textContent = text; b.classList.add('show');
  bannerTimer = setTimeout(nextBanner, bannerQueue.length > 2 ? 1200 : 2200);
}
const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.'];
function board(list) {
  $('board').replaceChildren(...list.map((s, i) => {
    const li = document.createElement('li');
    const m = document.createElement('span'); m.className = 'medal'; m.textContent = MEDALS[i];
    const n = document.createElement('span'); n.className = 'name'; n.textContent = [...s.name].slice(0, 14).join('');
    const d = document.createElement('span'); d.className = 'dia'; d.textContent = `${s.diamonds}${theme?.scoreUnit ?? '💎'}`;
    li.append(m, n, d); return li;
  }));
}

// ---------- ring HUD & fight ----------
function ringHud(r) {
  const box = $('ringHud');
  if (!r) { box.hidden = true; return; }
  box.hidden = false;
  for (const c of ['red', 'blue']) {
    const f = r[c];
    $(`${c}Name`).textContent = f ? [...f.name].slice(0, 12).join('') + (f.wins ? ` · ${f.wins}🏆` : '') : 'waiting…';
    $(`${c}Hp`).style.width = (f ? f.hp : 0) + '%';
    $(`${c}Pow`).textContent = f && f.power ? `⚡+${f.power}%` : '';
  }
  $('ringPhase').textContent = r.phase === 'starting' ? 'READY' : r.phase === 'ko' ? 'K.O.' : 'VS';
  $('ringNext').textContent = r.next?.length ? 'Next: ' + r.next.map((n) => [...n].slice(0, 10).join('')).join(' · ') : (r.red && r.blue ? '' : 'Send gifts or likes to climb in!');
}
let lastRing = null;
function setHp(id, hp) {
  if (!lastRing) return;
  for (const c of ['red', 'blue']) if (lastRing[c]?.id === id) lastRing[c].hp = hp;
  ringHud(lastRing);
}
function floatText(a, text, color) {
  const s = makeLabel(text, color, 56); s.position.set(0, CHAR_HEIGHT + 0.6, 0); a.group.add(s);
  const t0 = performance.now();
  const step = () => {
    const k = (performance.now() - t0) / 900;
    s.position.y = CHAR_HEIGHT + 0.6 + k * 0.8; s.material.opacity = 1 - k;
    if (k < 1 && !a.removed) requestAnimationFrame(step); else { a.group.remove(s); s.material.map.dispose(); s.material.dispose(); }
  };
  requestAnimationFrame(step);
}
function punch(op) {
  const att = avatars.get(op.by), def = avatars.get(op.target);
  if (att) playAction(att, op.hand === 'left' ? 'attack-melee-left' : 'attack-melee-right', { once: true, fade: 0.08 });
  setTimeout(() => {
    setHp(op.target, op.hp);
    if (!def || def.removed) return;
    if (op.miss) { floatText(def, 'MISS', '#cbd5e1'); sfx.play('whoosh'); if (Math.random() < 0.35) sfx.play('aww'); return; }
    const big = op.dmg >= 14;
    floatText(def, `-${op.dmg}`, big ? '#fbbf24' : '#f87171');
    def.hit = 1; sfx.play(big ? 'bigPunch' : 'punch');
    if (big || op.hp < 25) sfx.play('ohh'); else if (Math.random() < 0.6) sfx.play('ooh');
    lightHit(big);
    if (big) crowdReact(chantSettings().punchReact); else if (Math.random() < 0.5) groupCheer(Math.round(chantSettings().groupSize / 2), false);
    if (big) burst(def.group.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 25, ['#fbbf24', '#fff'], 3, 0.6);
  }, 250);
}

// ---------- cinematic camera ----------
// base: the normal TikTok framing. tour: a flyover around the arena every N seconds.
// ko: a quick push-in on the ring after a knockout.
const BASE_POS = new THREE.Vector3(0, 8.5, 15), BASE_LOOK = new THREE.Vector3(0, -1.7, -1.5);
const cam = { mode: 'base', t: 0, dur: 0, nextTour: 0, look: BASE_LOOK.clone() };
const smooth = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
function camSettings() { return { tourEverySec: 45, tourSec: 9, koZoom: true, zoom: 1, height: 0, ...(theme?.camera ?? {}) }; }
// base framing after the dev-panel zoom/height: move along the look line, then up/down
const _base = new THREE.Vector3();
function basePos() { const S = camSettings(); return _base.copy(BASE_POS).sub(BASE_LOOK).multiplyScalar(S.zoom).add(BASE_LOOK).add(new THREE.Vector3(0, S.height, 0)); }
function startTour() { if (cam.mode !== 'base') return; cam.mode = 'tour'; cam.t = 0; cam.dur = camSettings().tourSec; }
function startKoCam() { if (!camSettings().koZoom) return; cam.mode = 'ko'; cam.t = 0; cam.dur = 3.2; }
function focusPoint() { return ringMode ? new THREE.Vector3(0, 1.2, 4.2) : new THREE.Vector3(0, 1, 0); }
const _p = new THREE.Vector3(), _l = new THREE.Vector3();

// ---------- arena light show ----------
// Photo flashes popping in the stands, coloured beams sweeping the arena, LED walls pulsing,
// a white flash on big punches, strobe + pyro on a K.O. Strength comes from theme.lights.show (dev panel slider).
function lightSettings() { return { show: 1, ...(theme?.lights ?? {}) }; }
const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,240,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const flashes = [];
for (let i = 0; i < 60; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.visible = false; arena.add(sp); flashes.push({ sp, t: 1, size: 1 });
}
let flashIdx = 0;
function photoFlash(n = 1) {
  const seats = ringCells.filter((c) => c.used); const pool = seats.length > 5 ? seats : ringCells;
  for (let k = 0; k < n; k++) {
    const c = pool[Math.floor(Math.random() * pool.length)]; const f = flashes[flashIdx++ % flashes.length];
    f.sp.position.set(c.x + (Math.random() - 0.5) * 0.4, c.y + 1.0 + Math.random() * 0.4, c.z + (Math.random() - 0.5) * 0.4);
    f.t = 0; f.size = 0.9 + Math.random() * 0.9; f.sp.visible = true;
  }
}
// sweeping beams: a real spotlight plus a soft visible cone for each
const beams = [];
[0xff2d2d, 0x3b82f6, 0xffffff, 0xc026d3].forEach((col, i) => {
  const ang = i * Math.PI / 2 + Math.PI / 4, from = new THREE.Vector3(RING.x + Math.cos(ang) * 4.5, 8.4, RING.z + Math.sin(ang) * 4.5);
  const light = new THREE.SpotLight(col, 60, 40, Math.PI / 14, 0.5, 1.2); light.position.copy(from); arena.add(light, light.target);
  const coneGeo = new THREE.ConeGeometry(1.4, 12, 20, 1, true); coneGeo.translate(0, -6, 0); coneGeo.rotateX(-Math.PI / 2); // tip at origin, opening along +Z (lookAt direction)
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.copy(from); arena.add(cone);
  beams.push({ light, cone, from, phase: i * 1.7 });
});
const ledMats = []; arena.traverse((o) => { if (o.isMesh && o.material?.isMeshBasicMaterial && o.geometry?.parameters?.height === 0.35) ledMats.push({ m: o.material, base: o.material.color.clone() }); });
let strobeUntil = 0, punchFlash = 0, hype = 0;
function lightHit(big) { const S = lightSettings(); if (!S.show) return; punchFlash = big ? 1 : 0.4; photoFlash(Math.round((big ? 12 : 3) * S.show)); hype = Math.min(1, hype + (big ? 0.35 : 0.1)); }
function lightKo() {
  const S = lightSettings(); if (!S.show) return;
  strobeUntil = performance.now() + 1800; hype = 1;
  for (let i = 0; i < 6; i++) setTimeout(() => photoFlash(Math.round(10 * S.show)), i * 200);
  // pyro: gold sparks shooting up from the four ring posts
  const h = RING.size / 2;
  for (let w = 0; w < 3; w++) setTimeout(() => { for (const [cx, cz] of [[-h, -h], [-h, h], [h, -h], [h, h]]) burst(new THREE.Vector3(RING.x + cx, RING.h + 1.4, RING.z + cz), 30, ['#fbbf24', '#fff7d6', '#f97316'], 6, 1.2); }, w * 350);
}
const _tg = new THREE.Vector3(), _white = new THREE.Color(0xffffff);
function updateLights(dt, now) {
  const S = lightSettings(), on = ringMode && S.show > 0;
  const fighting = ringMode && lastRing?.phase === 'fighting';
  hype = Math.max(fighting ? 0.35 : 0.1, hype - dt * 0.15);
  if (on && Math.random() < dt * S.show * (fighting ? 10 : 3)) photoFlash(1); // random photo flashes, more during a fight
  for (const f of flashes) {
    if (!f.sp.visible) continue;
    f.t += dt / 0.16; const k = f.t < 0.3 ? f.t / 0.3 : 1 - (f.t - 0.3) / 0.7;
    f.sp.material.opacity = Math.max(0, k); f.sp.scale.setScalar(f.size * (0.6 + k * 0.6));
    if (f.t >= 1) f.sp.visible = false;
  }
  const strobe = now < strobeUntil && Math.floor(now / 70) % 2 === 0;
  for (const b of beams) {
    b.light.visible = b.cone.visible = on;
    if (!on) continue;
    const t = now / 1000 * (0.35 + hype * 0.9) + b.phase;
    const r = now < strobeUntil ? 0.6 : 3 + Math.sin(t * 0.7) * 5; // sweep the crowd; lock on the ring during a strobe
    _tg.set(RING.x + Math.cos(t) * r, 0.5, RING.z + Math.sin(t * 1.3) * r);
    b.light.target.position.copy(_tg); b.cone.lookAt(_tg);
    b.cone.scale.set(1, 1, b.from.distanceTo(_tg) / 12);
    b.light.intensity = (strobe ? 200 : 40 + hype * 60) * S.show;
    b.cone.material.opacity = (strobe ? 0.16 : 0.04 + hype * 0.06) * Math.min(1.5, S.show);
  }
  // LED walls pulse with the hype, flash white on a strobe
  const pulse = 0.55 + 0.45 * Math.sin(now / 1000 * (2 + hype * 6));
  for (const l of ledMats) { if (strobe && on) l.m.color.copy(_white); else l.m.color.copy(l.base).multiplyScalar(on ? 0.4 + pulse * 0.6 * (0.5 + hype) : 1); }
  punchFlash = Math.max(0, punchFlash - dt * 5);
  hemi.intensity = 1.1 + (on ? punchFlash * 0.8 * S.show + (strobe ? 1.2 : 0) : 0);
}

function updateCamera(dt, now) {
  const S = camSettings();
  if (!cam.nextTour) cam.nextTour = now + S.tourEverySec * 1000;
  if (cam.mode === 'base' && S.tourEverySec > 0 && now > cam.nextTour) startTour();
  if (cam.mode === 'base') { _p.copy(basePos()); _l.copy(BASE_LOOK); }
  else {
    cam.t += dt;
    const u = Math.min(1, cam.t / cam.dur);
    const F = focusPoint();
    if (cam.mode === 'tour') {
      // one full orbit; blend in/out of the base framing at the ends
      const ang = Math.PI * 2 * smooth(u);
      const r = ringMode ? 8 : 12, h = (ringMode ? 6.5 : 7) + Math.sin(u * Math.PI) * 2;
      const orbit = new THREE.Vector3(F.x + Math.sin(ang) * r, h, F.z + Math.cos(ang) * r);
      const edge = smooth(Math.min(u, 1 - u) / 0.15);
      _p.copy(basePos()).lerp(orbit, edge);
      _l.copy(BASE_LOOK).lerp(F, edge);
    } else { // ko push-in
      const k = u < 0.2 ? smooth(u / 0.2) : u > 0.75 ? 1 - smooth((u - 0.75) / 0.25) : 1;
      const close = new THREE.Vector3(F.x + 1.5, F.y + 2.6, F.z + 5.5);
      _p.copy(basePos()).lerp(close, k);
      _l.copy(BASE_LOOK).lerp(F, k);
    }
    if (u >= 1) { cam.mode = 'base'; cam.nextTour = now + S.tourEverySec * 1000; }
  }
  camera.position.lerp(_p, Math.min(1, dt * 6));
  cam.look.lerp(_l, Math.min(1, dt * 6));
  camera.lookAt(cam.look);
}

// ---------- crowd chants ----------
// Every N seconds the seated crowd chants: a stadium wave (left to right) plus a chant line and sound.
// Between chants a few spectators randomly cheer, and big punches make the closest rows jump.
function chantSettings() { return { everySec: 20, texts: ['OLÉ! OLÉ! OLÉ!', 'FIGHT! FIGHT! FIGHT!', 'WE WANT K.O.!'], fighterChant: true, randomCheer: 0.02, supportEverySec: 6, groupEverySec: 2.5, groupSize: 14, fightGroupBoost: 2, punchReact: 0.45, koReact: 0.95, ...(theme?.chant ?? {}) }; }
let nextChant = 0, lastCheer = 0;
function spectators() { return [...avatars.values()].filter((a) => a.data.slot === 'crowd' && !a.removed); }
function crowdJump(a, delay) {
  setTimeout(() => { if (a.removed || a.data.slot !== 'crowd') return; a.jump = 1; playAction(a, a.actions['emote-yes'] && Math.random() < 0.4 ? 'emote-yes' : 'jump', { once: true }); }, delay);
}
function chant() {
  const S = chantSettings();
  let text = S.texts[Math.floor(Math.random() * S.texts.length)];
  if (S.fighterChant && lastRing && Math.random() < 0.5) {
    const f = lastRing.red && lastRing.blue ? (Math.random() < 0.5 ? lastRing.red : lastRing.blue) : (lastRing.red || lastRing.blue);
    if (f) { const n = [...f.name.replace(/[^\p{L}\p{N}]/gu, '')].slice(0, 8).join('').toUpperCase(); if (n.length >= 2) { const half = Math.ceil(n.length / 2); text = `${n.slice(0, half)}-${n.slice(half)}! ${n.slice(0, half)}-${n.slice(half)}!`; } }
  }
  showText('📣 ' + text);
  sfx.play('chant');
  const list = spectators().sort((x, y) => x.group.position.x - y.group.position.x);
  const minX = list[0]?.group.position.x ?? 0;
  for (const a of list) crowdJump(a, (a.group.position.x - minX) * 90 + Math.random() * 60);
}
let nextSupport = 0, nextGroup = 0;
function groupCheer(size, sound = true) {
  const list = spectators(); if (!list.length) return;
  const c = list[Math.floor(Math.random() * list.length)].group.position;
  list.sort((x, y) => x.group.position.distanceToSquared(c) - y.group.position.distanceToSquared(c));
  for (const a of list.slice(0, size)) crowdJump(a, Math.random() * 250);
  if (sound) sfx.play('oley');
}
function updateCrowd(now) {
  const S = chantSettings();
  // arena murmur: quiet between fights, louder in a fight, loudest when someone is nearly K.O.
  const fighting = ringMode && lastRing?.phase === 'fighting';
  const lowHp = fighting && Math.min(lastRing.red?.hp ?? 100, lastRing.blue?.hp ?? 100) < 30;
  sfx.setCrowd(!ringMode ? 0.03 : lowHp ? 0.16 : fighting ? 0.1 : 0.045);
  // during a fight the crowd keeps a clap-clap-HEY! rhythm going
  if (fighting && S.supportEverySec > 0 && now > nextSupport) { nextSupport = now + S.supportEverySec * 1000 * (0.7 + Math.random() * 0.6); sfx.play('support'); }
  if (!nextChant) nextChant = now + S.everySec * 1000;
  if (S.everySec > 0 && now > nextChant) { nextChant = now + S.everySec * 1000; chant(); }
  if (now - lastCheer > 1000) {
    lastCheer = now;
    for (const a of spectators()) if (Math.random() < S.randomCheer && now > a.oneShotUntil) crowdJump(a, Math.random() * 800);
  }
  // groups of neighbours jump up together (more often during a fight)
  const every = S.groupEverySec / (fighting ? S.fightGroupBoost : 1);
  if (S.groupEverySec > 0 && now > nextGroup) { nextGroup = now + every * 1000 * (0.6 + Math.random() * 0.8); groupCheer(S.groupSize); }
}
function crowdReact(strength) { for (const a of spectators()) if (Math.random() < strength) crowdJump(a, Math.random() * 300); }

function ko(op) {
  startKoCam(); crowdReact(chantSettings().koReact); lightKo();
  const w = avatars.get(op.winner), l = avatars.get(op.loser);
  if (l) playAction(l, 'die', { once: true, holdMs: 2900 });
  if (w) setTimeout(() => playAction(w, 'emote-yes', { once: true }), 400);
  showText(`💥 K.O.! ${op.winnerName} wins${op.wins > 1 ? ` (${op.wins} in a row)` : ''}`);
  sfx.play('ko'); sfx.play('roar');
  for (let i = 0; i < 3; i++) setTimeout(() => burst(new THREE.Vector3(RING.x + (Math.random() - 0.5) * 3, 5, RING.z), 80, CONF, 5, 1.8), i * 300);
}

// ---------- network ----------
let ws, retry = 1000;
function connect() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.onopen = () => { retry = 1000; $('dot').classList.add('ok'); };
  ws.onclose = () => { $('dot').classList.remove('ok'); $('statusText').textContent = `disconnected, retrying in ${retry / 1000}s`; setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); };
  ws.onmessage = (m) => handle(JSON.parse(m.data));
}
function send(o) { if (ws?.readyState === 1) ws.send(JSON.stringify(o)); }

// ---- live settings sliders (dev panel) ----
const getSet = (path) => { const [sec, key] = path.split('.'); return (sec === 'camera' ? camSettings() : sec === 'lights' ? lightSettings() : chantSettings())[key]; };
function syncSliders() {
  for (const el of document.querySelectorAll('[data-set]')) if (document.activeElement !== el) el.value = getSet(el.dataset.set);
  for (const el of document.querySelectorAll('[data-out]')) el.textContent = getSet(el.dataset.out);
}
function applySettings(op) {
  if (!theme) return;
  theme.camera = op.camera; theme.chant = op.chant; theme.lights = op.lights;
  // restart the timers so a new frequency takes effect right away
  cam.nextTour = 0; nextChant = 0; nextGroup = 0; nextSupport = 0;
  syncSliders();
}
for (const el of document.querySelectorAll('[data-set]')) {
  el.addEventListener('input', () => {
    const [section, key] = el.dataset.set.split('.');
    document.querySelector(`[data-out="${el.dataset.set}"]`).textContent = el.value;
    send({ cmd: 'settings', section, key, value: Number(el.value) });
  });
}

function handle(op) {
  switch (op.op) {
    case 'sync':
      for (const id of [...avatars.keys()]) remove(id);
      applyTheme(op.theme); op.avatars.forEach(spawn); board(op.leaderboard); lastRing = op.ring; ringHud(op.ring); syncSliders(); break;
    case 'settings': applySettings(op); break;
    case 'spawn': spawn(op.avatar); sfx.play('join'); break;
    case 'update': update(op.avatar); break;
    case 'remove': remove(op.id); break;
    case 'say': say(op.id, op.text); sfx.play('pop'); break;
    case 'effect': effect(op); break;
    case 'banner': banner(op.text); break;
    case 'leaderboard': board(op.leaderboard); break;
    case 'ringState': lastRing = op.ring; ringHud(op.ring); break;
    case 'fightStart': lastRing = op.ring; ringHud(op.ring); showText('🔔 FIGHT!'); sfx.play('bell'); break;
    case 'punch': punch(op); break;
    case 'heal': { // a fighter sent gifts/likes: green +HP text, small sparkle (texts merged so like spam stays readable)
      setHp(op.id, op.hp);
      const a = avatars.get(op.id); if (!a) break;
      const now = performance.now();
      a.healSum = (now - (a.healAt ?? 0) < 600 ? a.healSum : 0) + op.amount;
      if (now - (a.healShown ?? 0) > 400) { a.healShown = now; floatText(a, `+${Math.round(a.healSum)} ❤️`, '#4ade80'); a.healSum = 0; if (op.amount >= 5) burst(a.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 20, ['#4ade80', '#fff'], 2, 0.7); }
      a.healAt = now;
      break;
    }
    case 'ko': ko(op); break;
    case 'status': $('statusText').textContent = op.source === 'tiktok' ? `TikTok @${op.username}: ${op.connected ? 'LIVE ✓' : op.connecting ? 'connecting…' : (op.error || 'off')}` : 'simulator only (TikTok off)'; $('dot').classList.toggle('ok', op.source !== 'tiktok' || op.connected); $('rate').value = op.rate; $('rateVal').textContent = op.rate; break;
    case 'stats': $('stats').textContent = `fps: ${fps}\navatars: ${op.avatars}  (in scene: ${avatars.size})\nspawn queue: ${op.queue}\nevents: ${op.stats.events}\nspawned: ${op.stats.spawned}  evicted: ${op.stats.evicted}  dropped: ${op.stats.dropped}`; break;
  }
}
loadModels().then(connect, (e) => { console.error('model load failed', e); $('statusText').textContent = 'model load failed: ' + e.message; });

// ---------- dev panel ----------
const user = () => $('u').value.trim() || undefined;
$('dev').addEventListener('click', (e) => {
  const act = e.target.dataset?.act; if (!act) return;
  if (act === 'chat') send({ cmd: 'inject', event: { type: 'chat', username: user(), text: $('chatText').value } });
  if (act === 'gift') send({ cmd: 'inject', event: { type: 'gift', username: user(), gift: $('gift').value, count: $('giftCount').value } });
  if (act === 'follow') send({ cmd: 'inject', event: { type: 'follow', username: user() } });
  if (act === 'like') send({ cmd: 'inject', event: { type: 'like', username: user(), count: 100 } });
  if (act === 'share') send({ cmd: 'inject', event: { type: 'share', username: user() } });
  if (act === 'join10') for (let i = 0; i < 10; i++) send({ cmd: 'inject', event: { type: 'chat', text: 'JOIN' } });
  if (act === 'reset') send({ cmd: 'reset' });
  if (act === 'ttConnect') send({ cmd: 'tiktok', username: $('ttUser').value.trim() });
  if (act === 'ttStop') send({ cmd: 'tiktokStop' });
  if (act === 'safe') $('safe').hidden = !$('safe').hidden;
  if (act === 'tour') startTour();
  if (act === 'chant') chant();
  if (act === 'mute') { sfx.setMuted(!sfx.isMuted()); e.target.textContent = sfx.isMuted() ? 'Sound: off' : 'Sound: on'; }
});
$('rate').addEventListener('input', (e) => { $('rateVal').textContent = e.target.value; send({ cmd: 'chaos', rate: Number(e.target.value) }); });
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'd' && e.target.tagName !== 'INPUT') { document.body.classList.toggle('nodev'); requestAnimationFrame(resize); } });

// ---------- loop ----------
const clock = new THREE.Clock();
let fps = 0, frames = 0, fpsT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  frames++; fpsT += dt; if (fpsT >= 1) { fps = frames; frames = 0; fpsT = 0; }
  updateLabels(performance.now());
  for (const a of avatars.values()) {
    const p = a.group.position;
    const dx = a.target.x - p.x, dz = a.target.z - p.z, dist = Math.hypot(dx, dz);
    const moving = dist > 0.05;
    const running = dist > 4; // far away (e.g. promoted to podium): run there
    if (moving) { const s = Math.min(dist, (running ? 11 : 4) * dt); p.x += (dx / dist) * s; p.z += (dz / dist) * s; }
    // face walking direction, otherwise turn toward the camera
    const want = moving ? Math.atan2(dx, dz) : a.data.slot === 'red' ? Math.PI / 2 : a.data.slot === 'blue' ? -Math.PI / 2 : (a.seatRot ?? 0);
    let dr = want - a.model.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    a.model.rotation.y += dr * Math.min(1, dt * 8);
    const seated = !moving && a.seat && a.actions.sit;
    const fighter = a.data.slot === 'red' || a.data.slot === 'blue';
    if (performance.now() > a.oneShotUntil) playAction(a, seated ? 'sit' : !moving ? (fighter && a.actions['holding-both'] ? 'holding-both' : 'idle') : running && a.actions.sprint ? 'sprint' : 'walk');
    a.mixer.update(dt);
    // climb up to seats / ring only near the end of the walk
    const baseY = dist < 0.6 ? a.target.y : dist < 1.6 ? a.target.y * (1.6 - dist) : 0;
    if (a.jump > 0) a.jump = Math.max(0, a.jump - dt * 1.2);
    p.y = baseY + Math.sin(a.jump * Math.PI) * 0.35;
    if (a.hit > 0) { a.hit = Math.max(0, a.hit - dt * 4); const dir = a.data.slot === 'red' ? -1 : 1; a.model.position.x = dir * Math.sin(a.hit * Math.PI) * 0.12; a.model.rotation.z = -dir * Math.sin(a.hit * Math.PI) * 0.15; }
    else if (a.model.rotation.z) { a.model.rotation.z = 0; a.model.position.x = 0; }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]; q.age += dt;
    const pos = q.pts.geometry.attributes.position;
    for (let k = 0; k < q.vel.length; k++) { q.vel[k].y -= 6 * dt; pos.array[k * 3] += q.vel[k].x * dt; pos.array[k * 3 + 1] += q.vel[k].y * dt; pos.array[k * 3 + 2] += q.vel[k].z * dt; }
    pos.needsUpdate = true; q.pts.material.opacity = 1 - q.age / q.life;
    if (q.age >= q.life) { scene.remove(q.pts); q.pts.geometry.dispose(); q.pts.material.dispose(); particles.splice(i, 1); }
  }
  updateCamera(dt, performance.now());
  updateLights(dt, performance.now());
  updateCrowd(performance.now());
  renderer.render(scene, camera);
});
document.getElementById('vol').addEventListener('input', (e) => sfx.setVolume(e.target.value / 100));
