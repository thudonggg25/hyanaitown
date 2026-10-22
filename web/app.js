// Thị trấn AI agent: phần hình 2.5D (anime vẽ tay) và bảng điều khiển.
// Đọc trạng thái từ server (Server-Sent Events) rồi vẽ nhà, nhân vật, bong bóng.
//
// Cách vẽ: bản đồ đảo là một tấm ảnh phẳng, nhà và nhân vật là sprite (ảnh nền
// trong suốt) dựng đứng trên đó. Toạ độ dùng đúng pixel của ảnh bản đồ 1920×1080
// (x sang phải, y xuống dưới). Thứ tự vẽ theo y: cái nào thấp hơn trên màn hình
// thì ở trước. Sprite tạo bằng tools/lam_sprite.py.
import * as THREE from 'three';
import { OrbitControls } from './vendor/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from './vendor/addons/CSS2DRenderer.js';
import * as sound from './sound.js';
import { initSettings, toggleSettings } from './settings.js';
import { initCalmRoom, onChat, openRoom, openTask, openFullLog, openModal, closeModal } from './phong-calm.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SPR = 'assets/sprites/';
const UI = 'assets/ui/';
const MAP_W = 1920, MAP_H = 1080;

// Ô đất trên bản đồ (pixel ảnh). x, y là tâm chân nhà; w là bề ngang nhà khi vẽ.
const PLOTS = {
  calm:        { x: 994,  y: 236, w: 330 },
  'san-pham':  { x: 655,  y: 300, w: 300 },
  'thiet-ke':  { x: 1335, y: 300, w: 300 },
  'tiep-nhan': { x: 420,  y: 440, w: 300 },
  qa:          { x: 1530, y: 450, w: 190 },
  anicca:      { x: 720,  y: 668, w: 360 },
  coder:       { x: 1300, y: 672, w: 420 },
};
const PLAZA = { x: 994, y: 415, rx: 170, ry: 80 };
// Phòng -> nhà, phòng -> nhân vật (3 Coder ở chung một xưởng)
const houseOf = id => (id.startsWith('coder') ? 'coder' : id);
const CHAR_OF = { calm: 'calm', anicca: 'anicca', 'tiep-nhan': 'tiep-nhan', 'san-pham': 'san-pham', 'thiet-ke': 'thiet-ke', qa: 'qa', 'coder-1': 'coder', 'coder-2': 'coder-b', 'coder-3': 'coder' };
const POSE = { front: 0, back: 1, left: 2, walk: 3 };
const CHAR_H = 86; // chiều cao nhân vật trên bản đồ (pixel ảnh)

// pixel bản đồ -> toạ độ thế giới
const wx = x => x - MAP_W / 2;
const wy = y => MAP_H / 2 - y;
const depth = y => y / MAP_H * 50; // càng xuống dưới càng gần camera

// ---------- Cảnh ----------
const host = $('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.domElement.style.position = 'absolute';
labels.domElement.style.inset = '0';
labels.domElement.style.pointerEvents = 'none';
host.appendChild(labels.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9c9d8'); // màu trời ngoài mép ảnh (màn hình dọc)

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
camera.position.set(0, 0, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.screenSpacePanning = true;
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
controls.minZoom = 0.9;
controls.maxZoom = 3.2;
controls.zoomToCursor = true;

let halfW = MAP_W / 2, halfH = MAP_H / 2;
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  // Màn hình ngang: phủ kín khung bằng ảnh. Màn hình dọc: giữ đủ bề ngang hòn đảo.
  if (a >= MAP_W / MAP_H) { halfW = MAP_W / 2; halfH = halfW / a; }
  else { halfH = MAP_H / 2; halfW = halfH * a; if (halfW < 500) { halfW = 500; halfH = halfW / a; } }
  Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labels.setSize(w, h);
}
addEventListener('resize', resize);
resize();

// Không cho kéo camera ra khỏi bản đồ
function clampView() {
  const vw = halfW / camera.zoom, vh = halfH / camera.zoom;
  const mx = Math.max(0, MAP_W / 2 - vw), my = Math.max(0, MAP_H / 2 - vh);
  const t = controls.target;
  const cx = THREE.MathUtils.clamp(t.x, -mx, mx), cy = THREE.MathUtils.clamp(t.y, -my, my);
  if (cx !== t.x || cy !== t.y) {
    camera.position.x += cx - t.x; camera.position.y += cy - t.y;
    t.x = cx; t.y = cy;
  }
}

// ---------- Ảnh ----------
const loader = new THREE.TextureLoader();
const maskCache = new Map(); // ảnh -> mặt nạ alpha nhỏ để bấm trúng đúng hình, không trúng nền trong
function loadTex(file, clean) {
  return new Promise(res => loader.load(SPR + file, t => {
    if (clean) { t.image = cleanSprite(t.image); t.needsUpdate = true; }
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    res(t);
  }, undefined, () => res(null)));
}

// Ảnh nhân vật còn sót nền trắng lúc tách nền: mảng trắng dưới chân, viền trắng mờ,
// và mẩu vụn của hình bên cạnh. Lọc một lần trên canvas trước khi đưa lên GPU.
function cleanSprite(img) {
  const W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data, N = W * H;
  const whitish = i => {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    return Math.min(r, gg, b) > 200 && Math.max(r, gg, b) - Math.min(r, gg, b) < 40;
  };
  // 1) Loang từ vùng trong suốt qua các điểm trắng/nhạt: nét viền đậm của tranh sẽ chặn lại
  const seen = new Uint8Array(N), q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (d[i * 4 + 3] < 8) { seen[i] = 1; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], x = i % W;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j < 0 || j >= N || seen[j] || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
      seen[j] = 1;
      if (whitish(j) || (d[j * 4 + 3] < 140 && Math.min(d[j * 4], d[j * 4 + 1], d[j * 4 + 2]) > 160)) { d[j * 4 + 3] = 0; q[qt++] = j; }
    }
  }
  // 1a) Lỗ nền trắng tinh bị kẹt giữa tóc hay giữa hai chân (không chạm vùng trong suốt)
  const pure = i => d[i * 4 + 3] > 0 && Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) > 232
    && Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < 14;
  const hole = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (hole[s] || !pure(s)) continue;
    qh = qt = 0; q[qt++] = s; hole[s] = 1;
    while (qh < qt) {
      const i = q[qh++], x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= N || hole[j] || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1) || !pure(j)) continue;
        hole[j] = 1; q[qt++] = j;
      }
    }
    if (qt >= 25) for (let n = 0; n < qt; n++) d[q[n] * 4 + 3] = 0;
  }
  // 1b) Gọt thêm một lớp viền sáng còn sót sát mép
  const edge = [];
  for (let i = 0; i < N; i++) {
    if (d[i * 4 + 3] === 0) continue;
    const x = i % W;
    const out = (x > 0 && d[(i - 1) * 4 + 3] === 0) || (x < W - 1 && d[(i + 1) * 4 + 3] === 0)
      || (i >= W && d[(i - W) * 4 + 3] === 0) || (i < N - W && d[(i + W) * 4 + 3] === 0);
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    if (out && Math.min(r, gg, b) > 150 && Math.max(r, gg, b) - Math.min(r, gg, b) < 60) edge.push(i);
  }
  for (const i of edge) d[i * 4 + 3] = 0;
  // 2) Bỏ mẩu vụn: trong mỗi ô chỉ giữ các mảng đủ lớn so với mảng lớn nhất
  const lab = new Int32Array(N).fill(-1), sizes = [];
  for (let s = 0; s < N; s++) {
    if (lab[s] >= 0 || d[s * 4 + 3] === 0) continue;
    const L = sizes.length; let n = 0; qh = qt = 0; q[qt++] = s; lab[s] = L;
    while (qh < qt) {
      const i = q[qh++], x = i % W; n++;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= N || lab[j] >= 0 || d[j * 4 + 3] === 0 || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        lab[j] = L; q[qt++] = j;
      }
    }
    sizes.push(n);
  }
  const biggest = Math.max(1, ...sizes);
  for (let i = 0; i < N; i++) if (lab[i] >= 0 && sizes[lab[i]] < biggest * 0.04) d[i * 4 + 3] = 0;
  g.putImageData(id, 0, 0);
  return c;
}
function alphaMask(tex) {
  if (!tex?.image) return null;
  if (maskCache.has(tex.image)) return maskCache.get(tex.image);
  const w = 96, h = Math.max(8, Math.round(96 * tex.image.height / tex.image.width));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(tex.image, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const m = { w, h, a: new Uint8Array(w * h) };
  for (let i = 0; i < w * h; i++) m.a[i] = d[i * 4 + 3];
  maskCache.set(tex.image, m);
  return m;
}
function hitOpaque(hit) {
  const tex = hit.object.material.map, m = hit.object.userData.mask;
  if (!m || !hit.uv) return true;
  const u = tex.offset.x + hit.uv.x * tex.repeat.x;
  const v = 1 - (tex.offset.y + hit.uv.y * tex.repeat.y);
  const x = Math.min(m.w - 1, Math.max(0, Math.floor(u * m.w))), y = Math.min(m.h - 1, Math.max(0, Math.floor(v * m.h)));
  return m.a[y * m.w + x] > 40;
}

function spriteMesh(tex, w, h) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, alphaTest: 0.02 });
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0); // gốc ở chân
  return new THREE.Mesh(geo, mat);
}

// Bóng mềm dưới chân (một texture dùng chung)
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(40,30,30,.45)'); gr.addColorStop(1, 'rgba(40,30,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, depthTest: false });
const shadowGeo = new THREE.PlaneGeometry(1, 1);

// ---------- Bản đồ, nhà, nhân vật ----------
const houses = {};   // houseId -> { mesh, door: {x,y}, plot }
const people = {};   // agentId -> { ... }
const clickable = [];
let built = false;
let meta = null;
const charTex = {};  // charId -> Promise<Texture>

function label(text, cls) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  return new CSS2DObject(div);
}

async function buildMap() {
  const tex = await loadTex('map.webp');
  if (!tex) return;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, depthTest: false }));
  m.position.z = -10;
  m.renderOrder = -1;
  scene.add(m);
}

async function buildHouse(houseId, roomIds, names) {
  const plot = PLOTS[houseId];
  const b = meta.buildings[houseId];
  const h = { plot, door: { x: plot.x - plot.w * 0.06, y: plot.y + 22 }, rooms: roomIds };
  houses[houseId] = h;
  const sign = label(names, 'sign3d');
  if (!b) return;
  const tex = await loadTex(b.file);
  if (!tex) return;
  const w = plot.w, hh = w * b.h / b.w;
  const mesh = spriteMesh(tex, w, hh);
  // Chân nhà (đảo cỏ nhỏ dưới nhà) nằm cao hơn mép dưới ảnh khoảng 17%
  mesh.position.set(wx(plot.x), wy(plot.y) - hh * 0.17, depth(plot.y));
  mesh.renderOrder = Math.round(plot.y * 10);
  mesh.userData.agentId = roomIds[0];
  mesh.userData.house = houseId;
  mesh.userData.mask = alphaMask(tex);
  sign.position.set(0, hh * 1.02, 0);
  mesh.add(sign);
  scene.add(mesh);
  clickable.push(mesh);
  h.mesh = mesh;
}

function build(state) {
  const defs = {};
  for (const a of state.agents) defs[a.id] = a;
  const groups = {};
  for (const r of state.rooms) (groups[houseOf(r)] ||= []).push(r);
  for (const [hid, rooms] of Object.entries(groups)) {
    if (!PLOTS[hid]) continue;
    const names = hid === 'coder' && rooms.length > 1 ? 'Xưởng Code' : rooms.map(r => defs[r]?.name || r).join(' · ');
    buildHouse(hid, rooms, names);
  }
  built = true;
}

function charFor(a) {
  if (CHAR_OF[a.id]) return CHAR_OF[a.id];
  if (a.isGuest) return 'khach';
  return meta.chars[houseOf(a.id)] ? houseOf(a.id) : 'khach';
}

function buildPerson(a) {
  const cid = charFor(a);
  const info = meta.chars[cid];
  const scale = a.isGuest ? 0.85 : 1;
  const H = CHAR_H * scale, W = H * info.cellW / info.cellH;
  const g = new THREE.Group();
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.scale.set(W * 0.7, H * 0.16, 1);
  shadow.position.y = 2;
  const body = new THREE.Group(); // nhún nhảy riêng phần người
  g.add(shadow, body);

  const nameTag = label(a.name, 'label3d');
  nameTag.position.set(0, H + 8, 0);
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'bubble3d';
  const bubble = new CSS2DObject(bubbleDiv);
  bubble.position.set(0, H + 34, 0);
  const zzzDiv = document.createElement('div');
  zzzDiv.className = 'zzz';
  zzzDiv.innerHTML = '<span>z</span><span>z</span><span>Z</span>';
  const zzz = new CSS2DObject(zzzDiv);
  zzz.position.set(-W * 0.35, H * 0.62, 0);
  zzz.visible = false;
  g.add(nameTag, bubble, zzz);
  scene.add(g);

  const p = { group: g, body, shadow, nameTag, bubble, bubbleDiv, data: a, H, W, phase: Math.random() * 6,
    route: [], pos: null, dir: { x: 0, y: 1 }, walking: false, sprite: null, walkSprite: null,
    want: { pose: 'front', flip: false }, shown: null, turn: null, goal: null,
    stride: 0, gait: 0, look: null, hop: 0, settle: 0, zzz, sleepSprite: null, sleep: null };
  people[a.id] = p;
  (charTex[cid] ||= loadTex(info.file, true)).then(base => {
    if (!base) return;
    const tex = base.clone(); // dùng chung ảnh, mỗi người một khung hình riêng
    tex.repeat.set(1 / info.poses.length, 1);
    const sprite = spriteMesh(tex, W, H);
    sprite.userData.agentId = a.id;
    sprite.userData.mask = alphaMask(base);
    body.add(sprite);
    clickable.push(sprite);
    p.sprite = sprite;
    showPose(p, p.want);
  });
  // Dáng nằm ngủ giữa sân (nếu đã có ảnh)
  if (info.sleep) (charTex[cid + ':sleep'] ||= loadTex(info.sleep.file, true)).then(base => {
    if (!base) return;
    const sw = H * 1.15, sh = sw * base.image.height / base.image.width;
    const ss = spriteMesh(base, sw, sh);
    ss.position.y = -sh * 0.25; // chân ảnh (mép tấm chăn) hơi thấp hơn điểm đứng
    ss.userData.agentId = a.id;
    ss.userData.mask = alphaMask(base);
    ss.visible = false;
    body.add(ss);
    clickable.push(ss);
    p.sleepSprite = ss;
  });
  // Bảng dáng đi nhiều khung (nếu đã có ảnh): mỗi hàng một hướng, mỗi cột một khung
  const wk = info.walk;
  if (wk) (charTex[cid + ':walk'] ||= loadTex(wk.file, true)).then(base => {
    if (!base) return;
    const tex = base.clone();
    tex.repeat.set(1 / wk.cols, 1 / wk.rows.length);
    const ww = H * (base.image.width / wk.cols) / (base.image.height / wk.rows.length);
    const ws = spriteMesh(tex, ww, H);
    ws.userData.agentId = a.id;
    ws.userData.mask = alphaMask(base);
    ws.visible = false;
    body.add(ws);
    clickable.push(ws);
    p.walkSprite = ws;
  });
  return p;
}

// Đổi hướng kiểu game 2D: thay khung hình ngay, không bóp méo hình (bóp trông như tờ giấy).
// Quay ngược hẳn lại (trái ↔ phải, lên ↔ xuống) thì đi qua một khung ở giữa thật nhanh,
// như người quay người thật, kèm nhún nhẹ một cái.
const TURN_MID = 0.075;
const samePose = (a, b) => a && b && a.pose === b.pose && a.flip === b.flip;
const faceOf = w => w.pose === 'front' ? 'down' : w.pose === 'back' ? 'up'
  : w.pose === 'left' ? (w.flip ? 'right' : 'left') : (w.flip ? 'left' : 'right');
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
function setPose(p, pose, flip) { p.want = { pose, flip }; }
function showPose(p, w) {
  p.shown = { ...w };
  if (!p.sprite) return;
  const t = p.sprite.material.map, n = 4;
  t.offset.x = POSE[w.pose] / n;
}
function animTurn(p, dt) {
  if (!p.sprite) return;
  if (p.turn) {
    p.turn.t += dt;
    if (p.turn.t < TURN_MID) return;
    p.turn = null;
  }
  if (samePose(p.shown, p.want)) return;
  const from = p.shown && faceOf(p.shown), to = faceOf(p.want);
  p.kick = 1;
  if (from && OPPOSITE[from] === to) {
    // khung giữa: quay mặt ra phía người xem khi đổi trái/phải, nghiêng khi đổi lên/xuống
    showPose(p, from === 'left' || from === 'right' ? { pose: 'front', flip: false } : { pose: 'left', flip: to === 'up' });
    p.turn = { t: 0 };
  } else showPose(p, p.want);
}

// Chỗ đứng: trước cửa nhà mình, hoặc cạnh cửa nhà đang tới bàn giao
let guestIndex = 0;
const guestSpot = {};
const SLOT = { 'coder-1': -1, 'coder-2': 0, 'coder-3': 1 };
function spotFor(a) {
  if (a.isGuest && a.at === a.home) {
    if (guestSpot[a.id] === undefined) guestSpot[a.id] = guestIndex++;
    const ang = guestSpot[a.id] * 1.1 + 0.4;
    return { x: PLAZA.x + Math.cos(ang) * PLAZA.rx * 0.6, y: PLAZA.y + Math.sin(ang) * PLAZA.ry * 0.6, house: null };
  }
  const hid = houseOf(a.at || a.home);
  const h = houses[hid] || houses[houseOf(a.home)];
  if (!h) return { x: PLAZA.x, y: PLAZA.y, house: null };
  let x = h.door.x, y = h.door.y;
  if (a.at === a.home) x += (SLOT[a.id] || 0) * 80;
  else x += 70 + (Object.values(people).filter(q => q.data.at === a.at && q.data.at !== q.data.home && q.data.id < a.id).length) * 46; // khách đứng lệch sang bên
  return { x, y, house: hid };
}

// Ra điểm quảng trường gần nhà, đi qua quảng trường, rồi vào cửa nhà kia
function plazaEdge(pt) {
  const dx = pt.x - PLAZA.x, dy = (pt.y - PLAZA.y) * (PLAZA.rx / PLAZA.ry);
  const l = Math.hypot(dx, dy) || 1;
  return { x: PLAZA.x + dx / l * PLAZA.rx, y: PLAZA.y + dy / l * PLAZA.ry };
}
function goTo(p, a) {
  const s = spotFor(a);
  if (!p.pos) { p.pos = { x: s.x, y: s.y }; p.goal = s; return; }
  if (p.goal && Math.abs(p.goal.x - s.x) < 1 && Math.abs(p.goal.y - s.y) < 1) return;
  const sameHouse = p.goal && p.goal.house && p.goal.house === s.house;
  p.goal = s;
  if (p.sleep) wakeUp(p);
  p.wander = null; p.speed = SPEED;
  if (sameHouse || Math.hypot(s.x - p.pos.x, s.y - p.pos.y) < 120) { p.route = [s]; return; }
  p.route = [plazaEdge(p.pos), plazaEdge(s), s];
}

// ---------- Cập nhật theo dữ liệu ----------
let state = null;
let selected = null;

function apply(s) {
  state = s;
  if (!built) build(s);
  $('#title').textContent = s.title;
  $('#subtitle').textContent = s.subtitle || '';
  for (const a of s.agents) {
    const p = people[a.id] || buildPerson(a);
    p.data = a;
    goTo(p, a);
    if (p.bubbleDiv.textContent !== a.bubble) p.bubbleDiv.textContent = a.bubble || '';
    p.bubbleDiv.className = 'bubble3d ' + a.state;
    // Ở nhà thì biển tên trên mái đã đủ, chỉ hiện tên khi đi sang phòng khác
    p.nameTag.element.style.visibility = (a.isBoss || a.isGuest || a.at !== a.home || houseOf(a.id) !== a.id) ? '' : 'hidden';
    p.bubbleDiv.style.display = a.bubble ? '' : 'none';
  }
  announce(s);
  renderOverview(s);
  renderLog(s.log);
  if (selected) renderDetail(selected);
  $('#btn-demo').classList.toggle('on', !!s.settings.demo);
  $('#btn-demo span').textContent = s.settings.demo ? 'Dừng tự chạy' : 'Tự chạy';
  $('#btn-demo img').src = UI + (s.settings.demo ? 'icon-no.webp' : 'icon-play.webp');
  const pending = s.approvals.length + s.board.filter(t => t.status === 'waiting_approval').length;
  $('#btn-approve1').disabled = pending === 0;
}

// ---------- Tiếng báo + thông báo nổi theo sự kiện thật ----------
// So nhật ký mới với lần trước: mục nào mới thì kêu đúng loại tiếng
const seenLog = new Set();
const logKey = e => e.ts + '|' + e.agent + '|' + e.text;
let firstState = true, lastPending = 0;
function announce(s) {
  const fresh = [];
  for (const e of s.log) if (!seenLog.has(logKey(e))) { seenLog.add(logKey(e)); fresh.push(e); }
  if (seenLog.size > 2000) { seenLog.clear(); for (const e of s.log) seenLog.add(logKey(e)); }
  const pending = s.approvals.length + s.board.filter(t => t.status === 'waiting_approval').length;
  const more = pending > lastPending;
  lastPending = pending;
  if (firstState) { firstState = false; return; } // mở trang thì không kêu lại chuyện cũ
  // Mỗi mục nhật ký mới thuộc một loại; mỗi loại bật/tắt thông báo và tiếng riêng (bảng Cài đặt thông báo).
  // Nhiều sự kiện cùng lúc thì chỉ kêu tiếng quan trọng nhất.
  const rank = { notify: 0, ok: 1, handoff: 2, done: 3, error: 4, alert: 5 };
  let snd = null;
  const fire = (ev, who, text) => {
    const c = sound.settings.events[ev];
    if (c?.toast && text) { toast(ev, who, text); sound.desktopNotify(who, text); }
    if (c?.sound && (snd === null || rank[ev] > rank[snd])) snd = ev;
  };
  for (const e of fresh) {
    const who = nameOf(e.agent);
    if (e.kind === 'error') { fire('error', who, e.text); showErr(who, e.text); }
    else if (e.kind === 'done') fire('done', who, /^Xong /.test(e.text) ? e.text : null);
    else if (e.kind === 'handoff') fire('handoff', who, e.text);
    else if (e.kind === 'start') fire('notify', who, e.text);
    else if (e.kind === 'approval') {
      if (/^(Xin quyền|Gửi )/.test(e.text)) fire('alert', who, e.text);
      else if (/duyệt/.test(e.text) && !/từ chối/.test(e.text)) fire('ok', who, e.text);
    }
  }
  if (more && snd !== 'alert' && sound.settings.events.alert.sound) snd = 'alert';
  if (snd) sound.play(snd);
}
const TOAST_ICON = { alert: 'bell', error: 'warn', done: 'ok', ok: 'ok', handoff: 'mail', notify: 'play', info: 'mail', calm: 'mail', choice: 'bell' };
const TOAST_TITLE = { alert: 'Cần bạn duyệt', error: 'Có lỗi', done: 'Xong việc', ok: 'Đã được duyệt', handoff: 'Bàn giao', notify: 'Việc mới', calm: 'Calm trả lời' };
function toast(kind, who, text, onClick) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const title = TOAST_TITLE[kind] ? `${TOAST_TITLE[kind]} · ${who}` : who;
  el.innerHTML = `<img class="ic" src="${UI}icon-${TOAST_ICON[kind] || 'mail'}.webp" alt=""><div><b>${esc(title)}</b><div class="tx">${esc(text)}</div></div><span class="x">×</span>`;
  el.onclick = e => { el.remove(); if (!e.target.classList.contains('x')) onClick?.(); };
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'alert' ? 9000 : 6000);
}
// Hộp lỗi: ở lại tới khi bạn bấm; có nút nhờ Calm xem và làm lại
function showErr(who, text) {
  const box = $('#errbox');
  box.innerHTML = `<button class="x" aria-label="Đóng">×</button>
    <div class="eh"><img src="${UI}icon-warn.webp" alt=""><div><b>${esc(who)} gặp lỗi</b><div class="tx">${esc(text)}</div></div></div>
    <div class="row"><button class="later">Để sau</button><button class="retry">Nhờ Calm xử lý</button></div>`;
  box.classList.remove('hidden');
  box.querySelector('.x').onclick = box.querySelector('.later').onclick = () => box.classList.add('hidden');
  box.querySelector('.retry').onclick = () => {
    box.classList.add('hidden');
    post('/api/chat/send', { text: `Có lỗi trong thị trấn: ${who}: "${text}". Bạn xem nguyên nhân rồi làm lại giúp mình, xong báo mình kết quả.` });
    openRoom();
  };
}

const nameOf = id => state?.agents.find(a => a.id === id)?.name || id;
const colorOf = id => state?.agents.find(a => a.id === id)?.color || '#c9b79c';
const statusText = { running: 'Đang chạy', queued: 'Sắp làm', waiting_approval: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị trả lại', done: 'Xong', error: 'Lỗi', answered: 'Đã trả lời' };
const hhmm = ts => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function renderOverview(s) {
  const c = k => s.board.filter(t => t.status === k).length;
  $('#s-running').textContent = s.agents.filter(a => a.state === 'working').length;
  $('#s-queued').textContent = c('queued');
  $('#s-waiting').textContent = c('waiting_approval') + s.approvals.length;
  $('#s-error').textContent = c('error') + c('rejected');

  const items = [
    ...s.approvals.map(q => ({ id: q.id, title: q.summary, who: q.agent, kind: 'Xin quyền dùng ' + q.tool, ts: q.ts })),
    ...s.board.filter(t => t.status === 'waiting_approval').map(t => ({ id: t.id, task: true, title: t.title, who: t.agent, kind: 'Cần bạn duyệt', ts: t.updatedAt })),
  ];
  $('#approvals').innerHTML = items.length ? items.map(i => `
    <li><div class="${i.task ? 'link' : ''}"${i.task ? ` data-task="${esc(i.id)}"` : ''}>
        <div class="ap-id">${esc(i.task ? i.id : 'Xin quyền')}</div><div class="ap-title">${esc(i.title)}</div></div>
      <div class="meta">${esc(nameOf(i.who))} · ${esc(i.kind)} · ${hhmm(i.ts)}</div>
      <div class="row"><button class="btn-ok" data-decide="${esc(i.id)}" data-ok="1">Duyệt</button>
      <button class="btn-no" data-decide="${esc(i.id)}" data-ok="0">Từ chối</button></div></li>`).join('')
    : '<li class="empty">Không có gì chờ duyệt.</li>';

  const list = [...s.board].reverse().slice(0, 30);
  $('#board-count').textContent = list.length ? `${list.length} việc gần đây` : '';
  $('#board').innerHTML = list.length ? list.map(t => `
    <li class="link" data-task="${esc(t.id)}"><span class="tid">${esc(t.id)}</span><span class="ttl" title="${esc(t.title)}">${esc(t.title)}</span>
      <span class="tag ${t.status}">${statusText[t.status] || t.status}</span></li>`).join('')
    : '<li class="empty">Chưa có việc nào.</li>';
}

function renderLog(log) {
  let html = '', day = '';
  for (const e of [...log].reverse().slice(0, 120)) {
    const d = new Date(e.ts).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
    if (d !== day) { html += `<div class="day">${esc(d)}</div>`; day = d; }
    const tid = (e.text.match(/\b[A-Z]{2,5}-\d{3,}\b/) || [])[0];
    html += `<div class="e ${esc(e.kind)}${tid ? ' link' : ''}"${tid ? ` data-task="${tid}"` : ''}><i class="d" style="background:${esc(colorOf(e.agent))}"></i><time>${hhmm(e.ts)}</time><span class="who">${esc(nameOf(e.agent))}</span><span class="txt">${esc(e.text)}</span></div>`;
  }
  $('#logbody').innerHTML = html || '<div class="empty">Chưa có nhật ký.</div>';
}

const stateText = { idle: 'Rảnh', working: 'Đang làm', waiting: 'Chờ bạn', done: 'Vừa xong', error: 'Lỗi' };
function renderDetail(id) {
  const a = state?.agents.find(x => x.id === id);
  if (!a) return;
  const tasks = state.board.filter(t => t.agent === id).slice(-4).reverse();
  const cur = a.task && state.board.find(t => t.id === a.task);
  const face = meta?.chars[charFor(a)]?.face;
  const busy = a.state === 'working' || cur?.status === 'running';
  $('#detailbody').innerHTML = `
    <div class="ag-head">
      <div class="ag-face">${face ? `<img src="${SPR + face}" alt="">` : ''}</div>
      <div>
        <div class="ag-name">${esc(a.name)}</div>
        <div class="ag-role">${esc(a.role)}</div>
        <span class="st-pill ${esc(a.state)}">${stateText[a.state] || a.state}</span>
        <div class="ag-task" style="margin-top:8px">${cur ? `<span class="tid link" data-task="${esc(cur.id)}">${esc(cur.id)}</span> · ${esc(cur.title)}` : esc(a.bubble || 'Chưa có việc')}</div>
        ${cur ? `<div class="progress"><div class="bar${busy ? ' busy' : ''}"><i style="${busy ? '' : `width:${cur.status === 'done' || cur.status === 'approved' ? 100 : 60}%`}"></i></div><b>${busy ? 'Đang làm' : statusText[cur.status] || ''}</b></div>` : ''}
      </div>
    </div>
    <div class="ag-sec"><h4>Việc gần đây</h4>
      ${tasks.length ? '<ul>' + tasks.map(t => `<li class="link" data-task="${esc(t.id)}"><span class="ck">${t.status === 'done' || t.status === 'approved' ? '✔' : '•'}</span><b>${esc(t.id)}</b><span class="tt">${esc(t.title)}</span><span class="tag ${t.status}">${statusText[t.status] || t.status}</span></li>`).join('') + '</ul>' : '<div class="empty">Chưa có.</div>'}
    </div>
    ${routinesHtml(a)}
    <div class="ag-sec"><h4>Giao việc</h4><div class="empty">${picked === a.id ? 'Đã chọn. Bấm vào một ngôi nhà để giao việc thật.' : 'Bấm nhân vật để chọn, rồi bấm một nhà để đi giao việc.'}</div></div>
    <div class="ag-sec"><details><summary>Thao tác vừa rồi, tệp và kỹ năng</summary>
      ${a.tools.length ? '<ul style="margin-top:6px">' + a.tools.slice(0, 8).map(t => `<li><time>${hhmm(t.ts)}</time> ${esc(t.text)}</li>`).join('') + '</ul>' : '<div class="empty">Chưa có thao tác.</div>'}
      <div class="chips">${[...a.files, ...a.skills].map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div>
    </details></div>`;
}
// Lịch định kỳ của nhân vật (town.config.json → routines)
function routinesHtml(a) {
  const rs = (state.routines || []).filter(r => (r.agent || state.boss) === a.id || r.house === a.id);
  if (!rs.length) return '';
  return `<div class="ag-sec routine"><h4>Lịch định kỳ</h4><ul>${rs.map(r => `<li><time>${esc(r.when || '')}</time><span class="tt">${esc(r.title || '/' + r.skill)}${(r.agent || state.boss) !== a.id ? ` <i>(${esc(nameOf(r.agent || state.boss))} sang)</i>` : ''}</span></li>`).join('')}</ul></div>`;
}

// ---------- Chọn nhân vật rồi bấm nhà để giao việc thật ----------
let picked = null, pendingSend = null;
function setPicked(id) {
  if (picked && people[picked]) people[picked].nameTag.element.classList.remove('picked');
  picked = id;
  if (id && people[id]) people[id].nameTag.element.classList.add('picked');
}
function askSend(agentId, houseAgent) {
  const who = state.agents.find(x => x.id === agentId), where = state.agents.find(x => x.id === houseAgent);
  const plan = state.dispatch?.plans?.[houseAgent] || {};
  pendingSend = { agent: agentId, house: houseAgent };
  $('#send-body').innerHTML = `<p><b>${esc(who?.name)}</b> sẽ đi sang <b>${esc(where?.name)}</b> và chạy Claude Code thật (<code>claude -p</code>) trong thư mục đội Calm${state.calm?.dir ? ` (<code>${esc(state.calm.dir)}</code>)` : ''}.</p>
    <p><b>${esc(plan.title || 'Việc mới')}</b></p><pre>${esc(plan.prompt || '')}</pre>`;
  openModal('send-wrap');
}
$('#send-ok').onclick = async () => {
  closeModal('send-wrap');
  if (!pendingSend) return;
  const r = await post('/api/dispatch', { ...pendingSend, confirm: true });
  if (r.ok) toast('handoff', nameOf(pendingSend.agent), `Đã giao ${r.task}`, () => openTask(r.task));
  else showErr(nameOf(pendingSend.agent), r.error || 'Không giao được việc');
  pendingSend = null; setPicked(null);
};

function openDetail(id) {
  selected = id;
  $('#detail').classList.remove('hidden');
  renderDetail(id);
}
$('#detail-close').onclick = () => { selected = null; $('#detail').classList.add('hidden'); };

// ---------- Nút bấm ----------
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}
document.addEventListener('click', e => {
  const d = e.target.closest('[data-decide]');
  if (d) post('/api/decide', { id: d.dataset.decide, approve: d.dataset.ok === '1' });
});

let drift = false;
const toggles = {
  rotate: b => { drift = !drift; b.classList.toggle('on', drift); b.querySelector('span').textContent = drift ? 'Dừng lướt' : 'Lướt'; },
  names: b => { b.classList.toggle('on', !document.body.classList.toggle('hide-names')); },
  bubbles: b => { b.classList.toggle('on', !document.body.classList.toggle('hide-bubbles')); },
  home: () => { camera.position.set(0, 0, 200); camera.zoom = 1; camera.updateProjectionMatrix(); controls.target.set(0, 0, 0); },
  overview: b => b.classList.toggle('on', !$('#overview').classList.toggle('hidden')),
  log: b => b.classList.toggle('on', !$('#log').classList.toggle('hidden')),
  demo: () => post('/api/demo', { on: !state?.settings.demo }),
  sound: b => {
    const pop = $('#soundpop'), open = pop.classList.toggle('hidden') === false;
    b.classList.toggle('on', open);
    // đặt thẻ ngay dưới nút Âm thanh, mũi nhọn chỉ vào nút
    const r = b.getBoundingClientRect(), base = $('#leftcol').getBoundingClientRect();
    const left = Math.max(0, Math.min(r.left + r.width / 2 - base.left - 165, base.width - 330));
    pop.style.left = left + 'px';
    pop.style.setProperty('--arrow', (r.left + r.width / 2 - base.left - left - 8) + 'px');
  },
  calm: () => openRoom(),
  approve1: () => {
    if (!state) return;
    const first = state.approvals[0]?.id || state.board.find(t => t.status === 'waiting_approval')?.id;
    if (first) post('/api/decide', { id: first, approve: true });
  },
};
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => { sound.play('click'); toggles[b.dataset.act](b); }));

// Bảng cài đặt thông báo; icon loa trên thanh công cụ đổi theo tắt/mở tiếng
initSettings();
initCalmRoom({
  getState: () => state, nameOf, toast,
  onUnread: n => { $('#calm-badge').textContent = n; $('#calm-badge').classList.toggle('hidden', !n); },
});
$('#log-full').onclick = () => openFullLog();
// Thẻ âm thanh nhanh dưới lưới nút
const fill = el => el.style.setProperty('--v', el.value + '%');
const syncSoundIcon = () => {
  const st = sound.settings;
  $('#btn-sound img').src = UI + (st.muted ? 'icon-mute.webp' : 'icon-sound.webp');
  $('#q-on').checked = !st.muted;
  $('#q-music').value = Math.round(st.music * 100); $('#q-music-v').textContent = $('#q-music').value + '%'; fill($('#q-music'));
  $('#q-sfx').value = Math.round(st.sfx * 100); $('#q-sfx-v').textContent = $('#q-sfx').value + '%'; fill($('#q-sfx'));
};
// Thanh trượt: phần đã kéo tô màu xanh
document.addEventListener('input', e => { if (e.target.type === 'range') fill(e.target); });
$('#q-on').onchange = e => sound.set('muted', !e.target.checked);
$('#q-music').oninput = e => { sound.set('music', e.target.value / 100); if (!sound.settings.musicOn) sound.set('musicOn', true); };
$('#q-sfx').oninput = e => sound.set('sfx', e.target.value / 100);
$('#q-music-try').onclick = () => { if (!sound.settings.musicOn) sound.set('musicOn', true); sound.playVoice('dan'); };
$('#q-sfx-try').onclick = () => sound.playVoice(sound.settings.events.alert.voice);
$('#q-more').onclick = () => { $('#soundpop').classList.add('hidden'); $('#btn-sound').classList.remove('on'); toggleSettings(true); };
sound.onChange(syncSoundIcon);
syncSoundIcon();
if (innerWidth < 760) {
  for (const k of ['overview', 'log']) { $('#' + k).classList.add('hidden'); document.querySelector(`[data-act=${k}]`).classList.remove('on'); }
}

// Bấm vào nhân vật hoặc ngôi nhà để xem chi tiết (chỉ tính phần có hình, bỏ nền trong suốt)
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
function pick(e) {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(clickable, false).filter(h => h.object.visible && hitOpaque(h));
  // trên cùng là cái vẽ sau cùng (gần camera hơn)
  hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
  return hits[0];
}
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const hit = pick(e);
  if (!hit) return setPicked(null);
  const id = hit.object.userData.agentId;
  if (hit.object.userData.house) {
    if (picked) return askSend(picked, id);
    return openDetail(id);
  }
  setPicked(picked === id ? null : id);
  openDetail(id);
});
let hoverAt = 0;
renderer.domElement.addEventListener('pointermove', e => {
  if (e.buttons || e.timeStamp - hoverAt < 80) return;
  hoverAt = e.timeStamp;
  renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab';
});

// ---------- Nối với server ----------
function connect() {
  const es = new EventSource('/events');
  es.onopen = () => $('#conn').classList.remove('off');
  es.onmessage = e => apply(JSON.parse(e.data));
  es.addEventListener('chat', e => onChat(JSON.parse(e.data)));
  es.onerror = () => { $('#conn').classList.add('off'); $('#subtitle').textContent = 'Mất kết nối server, đang thử lại…'; };
}
window.__town = { openDetail, people, houses, toast };

// ---------- Vòng vẽ ----------
const clock = new THREE.Clock();
const SPEED = 150; // pixel bản đồ mỗi giây
const STROLL = 60;  // đi dạo thì chậm hơn
const STEP_LEN = 22; // mỗi bước dài bao nhiêu pixel bản đồ

// Lúc rảnh: đứng chơi một lúc trước cửa, rồi ra giữa sân nằm ngủ. Có việc thì dậy, chạy về làm.
const canWander = a => (a.state === 'idle' || a.state === 'done') && a.at === a.home;
const rnd = (a, b) => a + Math.random() * (b - a);
// Chỗ nằm trên quảng trường (lệch so với tâm), mỗi người một chỗ cố định
const BEDS = [[-95, -38], [10, -46], [110, -34], [-135, 4], [-40, 2], [60, 6], [150, 10], [-90, 44], [15, 50], [115, 46]];
function bedFor(p) {
  const i = Object.keys(people).indexOf(p.data.id) % BEDS.length;
  return { x: PLAZA.x + BEDS[i][0], y: PLAZA.y + BEDS[i][1] };
}
function goSleep(p, t) {
  const bed = bedFor(p);
  p.route = Math.hypot(bed.x - p.pos.x, bed.y - p.pos.y) < 120 ? [bed] : [plazaEdge(p.pos), bed];
  p.speed = STROLL;
  p.wander = { phase: 'going' };
}
function wakeUp(p) {
  p.sleep = null;
  p.kick = 1.6; // bật dậy
  p.stopAt = clock.elapsedTime;
}
function goHome(p, speed) {
  const s = p.goal;
  p.speed = speed;
  p.route = Math.hypot(s.x - p.pos.x, s.y - p.pos.y) < 120 ? [s] : [plazaEdge(p.pos), plazaEdge(s), s];
}

function stepPerson(p, dt, t) {
  if (!p.pos) return;
  const st = p.data.state;
  if (p.goal) {
    const w = p.wander;
    if (!canWander(p.data)) {
      // Có việc: đang ngủ thì dậy, vươn vai một chút rồi đi nhanh về chỗ
      if (p.sleep) { wakeUp(p); p.wander = { phase: 'waking', until: t + 0.7 }; p.route = []; }
      else if (w && (w.phase !== 'waking' || t > w.until)) { p.wander = null; goHome(p, SPEED); }
    } else if (!w) p.wander = { phase: 'idle', until: t + rnd(5, 12) };
    else if (w.phase === 'idle' && t > w.until && !p.route.length) goSleep(p, t);
    else if (w.phase === 'going' && !p.route.length && !p.walking) { p.sleep = { since: t }; w.phase = 'sleeping'; }
    else if (w.phase === 'waking' && t > w.until) { p.wander = null; goHome(p, SPEED); }
  }
  // Vận tốc đổi dần (tăng tốc, giảm tốc, ôm cua) thay vì giật theo đường thẳng
  const v = p.vel ||= { x: 0, y: 0 };
  let tx = 0, ty = 0;
  while (p.route.length) {
    const w = p.route[0], lastPt = p.route.length === 1;
    const dx = w.x - p.pos.x, dy = w.y - p.pos.y, d = Math.hypot(dx, dy);
    if (d < (lastPt ? 1.5 : 14)) {
      if (lastPt) { p.pos.x = w.x; p.pos.y = w.y; v.x = v.y = 0; }
      p.route.shift(); continue;
    }
    const sp = (p.speed || SPEED) * (lastPt ? Math.min(1, 0.25 + d / 40) : 1);
    tx = dx / d * sp; ty = dy / d * sp;
    break;
  }
  const k = 1 - Math.exp(-dt * (p.route.length ? 5 : 12));
  v.x += (tx - v.x) * k; v.y += (ty - v.y) * k;
  p.pos.x += v.x * dt; p.pos.y += v.y * dt;
  const sp = Math.hypot(v.x, v.y);
  const moving = sp > 6;
  if (p.walking && !moving) p.stopAt = t; // vừa dừng: nhún nhẹ một cái
  p.walking = moving;
  // gait: 0 là đứng, 1 là đi đều. Đổi mượt nên bước chân không bật/tắt đột ngột
  p.gait += ((moving ? Math.min(1, sp / 90) : 0) - p.gait) * (1 - Math.exp(-dt * 8));
  const g = p.gait;
  let vertical = false;
  if (moving) {
    p.dir.x = v.x / sp; p.dir.y = v.y / sp;
    p.stride += sp * dt / STEP_LEN; // đếm số bước theo quãng đường, chân không trượt
    // Hướng chỉ đổi khi lệch rõ để không lắc qua lắc lại
    const ax = Math.abs(p.dir.x), ay = Math.abs(p.dir.y) * 1.6;
    vertical = p.facing === 'v' ? ay > ax * 0.7 : ay > ax * 1.4;
    p.facing = vertical ? 'v' : 'h';
    p.look = null;
    if (vertical) setPose(p, p.dir.y < 0 ? 'back' : 'front', false);
    else setPose(p, 'walk', p.dir.x < 0);
  } else {
    p.facing = null;
    // Rảnh thì thỉnh thoảng quay sang ngó nghiêng
    if (st === 'idle' || st === 'done') {
      if (!p.look || t > p.look.until) {
        const side = Math.random() < 0.4;
        p.look = { pose: side ? 'left' : 'front', flip: side && Math.random() < 0.5, until: t + rnd(side ? 2 : 4, side ? 4 : 9) };
      }
    } else p.look = null;
    setPose(p, p.look?.pose || 'front', !!p.look?.flip);
  }
  animTurn(p, dt);
  p.kick = (p.kick || 0) * Math.exp(-dt * 14);

  // Bước đi giả bằng chuyển động: nhấp nhô, bẹp lúc chạm đất, vươn lúc nhấc chân,
  // lắc nhẹ hai bên và ngả người theo hướng đi
  // Hàng khung vẽ thật theo hướng đang quay mặt (thiếu hàng sang phải thì lật hàng sang trái)
  const flip = !!p.shown?.flip;
  let walkRow = null, walkFlip = false;
  const wk = p.walkSprite && meta.chars[charFor(p.data)].walk;
  if (wk && g > 0.15) {
    const pose = p.shown?.pose;
    walkRow = pose === 'back' ? 'up' : pose === 'walk' ? (flip ? 'left' : 'right') : 'down';
    if (walkRow === 'right' && !wk.rows.includes('right')) { walkRow = 'left'; walkFlip = true; }
    if (!wk.rows.includes(walkRow)) walkRow = null; // hướng này chưa vẽ thì dùng dáng đứng + nhún giả
  }
  const walkSheet = !!walkRow;
  const amp = walkSheet ? 0.35 : 1; // có khung vẽ thật thì bớt nhún giả
  const ph = p.stride * Math.PI;    // mỗi bước là nửa vòng
  const s = Math.abs(Math.sin(ph)); // 0 lúc chạm đất, 1 giữa bước
  let bob = s * 5 * g * amp;
  let sq = (s - 0.55) * 0.08 * g * amp; // dương là vươn cao, âm là bẹp xuống
  let rot = Math.sin(ph) * 0.03 * g * amp * (p.facing === 'v' ? 1.5 : 0.7) - p.dir.x * 0.075 * g;
  if (st === 'working' && !moving) { // gõ phím: nhún nhanh, nhỏ
    const w = Math.abs(Math.sin(t * 7 + p.phase));
    bob += w * 2; sq += (w - 0.5) * 0.025;
  }
  if (st === 'waiting' && !moving) { // chờ duyệt: nhảy lên gọi bạn, có lấy đà và tiếp đất
    const h = (t * 0.85 + p.phase) % 1;
    if (h < 0.38) { const k = Math.sin(Math.PI * h / 0.38); bob += k * 12; sq += k * 0.06; }
    else if (h < 0.6) sq -= 0.07 * Math.exp(-(h - 0.38) * 25);
    else if (h > 0.88) sq -= 0.05 * Math.sin(Math.PI * (h - 0.88) / 0.12);
  }
  sq += Math.sin(t * 2 + p.phase) * 0.012 * (1 - g); // thở
  sq -= (p.kick || 0) * 0.035; bob += (p.kick || 0) * 1.5; // nhún nhẹ khi đổi hướng
  if (p.stopAt) { const ts = t - p.stopAt; if (ts < 0.6) sq -= 0.05 * Math.exp(-ts * 8) * Math.cos(ts * 20); }

  const b = p.body;
  const sy = 1 + sq;
  b.position.y = bob;
  b.rotation.z += (rot - b.rotation.z) * (1 - Math.exp(-dt * 14));
  b.scale.set(1 - sq * 0.8, sy, 1);
  if (p.sprite) { p.sprite.scale.x = flip ? -1 : 1; p.sprite.visible = !walkSheet; }
  if (p.walkSprite) {
    const ws = p.walkSprite;
    ws.visible = walkSheet;
    if (walkSheet) {
      const r = wk.rows.indexOf(walkRow), n = wk.rows.length;
      const f = Math.floor(p.stride / 2 * wk.cols) % wk.cols; // một vòng = 2 bước
      ws.material.map.offset.set(f / wk.cols, 1 - (r + 1) / n);
      ws.scale.x = walkFlip ? -1 : 1;
    }
  }
  const asleep = !!p.sleep;
  const lying = asleep && !!p.sleepSprite;
  if (p.sleepSprite) p.sleepSprite.visible = lying;
  if (lying) {
    if (p.sprite) p.sprite.visible = false;
    if (p.walkSprite) p.walkSprite.visible = false;
    const br = Math.sin(t * 1.7 + p.phase) * 0.018; // thở chậm, ngực phồng xẹp
    b.position.y = 0; b.rotation.z = 0;
    b.scale.set(1 - br * 0.5, 1 + br, 1);
  }
  p.zzz.visible = asleep;
  p.zzz.position.y = lying ? p.H * 0.62 : p.H + 10;
  p.bubbleDiv.style.visibility = asleep ? 'hidden' : '';
  p.nameTag.position.y = lying ? p.H * 0.75 : p.H + 8;
  const lift = 1 - Math.min(0.35, bob / 40); // nhảy lên thì bóng nhỏ lại
  p.shadow.scale.set(p.W * (lying ? 1.5 : 0.7) * lift, p.H * (lying ? 0.3 : 0.16) * lift, 1);
  p.group.position.set(wx(p.pos.x), wy(p.pos.y), depth(p.pos.y) + 0.01);
  const ro = Math.round(p.pos.y * 10) + 1;
  if (p.sprite) p.sprite.renderOrder = ro;
  if (p.walkSprite) p.walkSprite.renderOrder = ro;
  if (p.sleepSprite) p.sleepSprite.renderOrder = ro;
  p.shadow.renderOrder = ro - 1;
}

let last = 0;
function tick(now) {
  requestAnimationFrame(tick);
  // Tab ẩn thì trình duyệt tự dừng; ở đây giới hạn ~60 khung/giây cho màn hình 120Hz
  if (now - last < 15) return;
  last = now;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  for (const p of Object.values(people)) stepPerson(p, dt, t);
  if (drift) {
    const ox = Math.sin(t * 0.08) * 0.35 * dt * 60, oy = Math.cos(t * 0.11) * 0.15 * dt * 60;
    camera.position.x += ox; controls.target.x += ox;
    camera.position.y += oy; controls.target.y += oy;
  }
  controls.update();
  clampView();
  renderer.render(scene, camera);
  labels.render(scene, camera);
}

// Nạp danh sách sprite trước rồi mới nối server
buildMap();
fetch(SPR + 'sprites.json').then(r => r.json()).then(m => { meta = m; connect(); })
  .catch(() => { $('#subtitle').textContent = 'Không tải được ảnh sprite (web/assets/sprites)'; });
requestAnimationFrame(tick);
