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
import { createToy } from './toy.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SPR = 'assets/sprites/';
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

// Hai kiểu xem: 'toy' = 3D đồ chơi xoay được (mặc định), 'paint' = tranh anime vẽ tay
let VIEW = 'toy';
try { VIEW = new URLSearchParams(location.search).get('view') || localStorage.getItem('view') || 'toy'; } catch {}
if (VIEW !== 'paint') VIEW = 'toy';
document.body.classList.add('view-' + VIEW);
const toy = VIEW === 'toy' ? createToy({ renderer, scene, label }) : null;

let camera, controls;
if (toy) ({ camera, controls } = toy);
else {
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.set(0, 0, 200);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.minZoom = 0.9;
  controls.maxZoom = 3.2;
  controls.zoomToCursor = true;
}

let halfW = MAP_W / 2, halfH = MAP_H / 2;
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  if (toy) { toy.resize(w, h); renderer.setSize(w, h); labels.setSize(w, h); return; }
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
  if (toy) return toy.clampView();
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
  if (toy) return toy.buildGround();
  const tex = await loadTex('map.webp');
  if (!tex) return;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, depthTest: false }));
  m.position.z = -10;
  m.renderOrder = -1;
  scene.add(m);
}

async function buildHouse(houseId, roomIds, names) {
  const plot = PLOTS[houseId];
  if (toy) { houses[houseId] = { plot, rooms: roomIds, ...toy.buildHouse(houseId, plot, names, roomIds) }; return; }
  const b = meta.buildings[houseId];
  const h = { plot, door: { x: plot.x - plot.w * 0.06, y: plot.y + 22 }, side: { x: 1, y: 0 }, out: { x: 0, y: 1 }, rooms: roomIds };
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
  if (toy) toy.buildTrees();
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
  g.add(nameTag, bubble);
  scene.add(g);

  const p = { group: g, body, shadow, nameTag, bubble, bubbleDiv, data: a, H, W, phase: Math.random() * 6,
    route: [], pos: null, dir: { x: 0, y: 1 }, walking: false, sprite: null, pose: 'front', flip: false, goal: null };
  people[a.id] = p;
  if (toy) {
    // Bản 3D: bỏ sprite, dựng nhân vật chibi; tên và bong bóng gắn trên đầu
    scene.remove(g);
    const v = p.toy = toy.buildPerson(a);
    nameTag.position.set(0, v.H + 0.2, 0);
    bubble.position.set(0, v.H + 1.1, 0);
    v.root.add(nameTag, bubble);
    p.group = v.root;
    return p;
  }
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
    setPose(p, p.pose, p.flip, true);
  });
  return p;
}

function setPose(p, pose, flip, force) {
  if (!p.sprite || (!force && p.pose === pose && p.flip === flip)) { p.pose = pose; p.flip = flip; return; }
  p.pose = pose; p.flip = flip;
  const t = p.sprite.material.map, n = 4, i = POSE[pose];
  t.repeat.x = flip ? -1 / n : 1 / n;
  t.offset.x = flip ? (i + 1) / n : i / n;
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
  const off = a.at === a.home ? (SLOT[a.id] || 0) * 80
    : 70 + (Object.values(people).filter(q => q.data.at === a.at && q.data.at !== q.data.home && q.data.id < a.id).length) * 46; // khách đứng lệch sang bên
  x += off * h.side.x; y += off * h.side.y;
  return { x, y, house: hid };
}

// Ra điểm quảng trường gần nhà, đi qua quảng trường, rồi vào cửa nhà kia
function plazaEdge(pt) {
  const dx = pt.x - PLAZA.x, dy = (pt.y - PLAZA.y) * (PLAZA.rx / PLAZA.ry);
  const l = Math.hypot(dx, dy) || 1;
  return { x: PLAZA.x + dx / l * PLAZA.rx, y: PLAZA.y + dy / l * PLAZA.ry };
}
// Đi vòng quanh đài phun nước giữa quảng trường thay vì đi xuyên qua
function viaPlaza(from, to, intoPlaza) {
  const a = plazaEdge(from), b = intoPlaza ? null : plazaEdge(to);
  const ang = pt => Math.atan2((pt.y - PLAZA.y) * PLAZA.rx / PLAZA.ry, pt.x - PLAZA.x);
  const ring = (t, k) => ({ x: PLAZA.x + Math.cos(t) * PLAZA.rx * k, y: PLAZA.y + Math.sin(t) * PLAZA.ry * k });
  const route = [a];
  const a1 = ang(a), a2 = ang(b || to);
  let d = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
  const steps = Math.floor(Math.abs(d) / 0.9);
  for (let i = 1; i <= steps; i++) route.push(ring(a1 + d * i / (steps + 1), 0.62));
  if (b) route.push(b);
  route.push(to);
  return route;
}
function goTo(p, a) {
  const s = spotFor(a);
  if (!p.pos) { p.pos = { x: s.x, y: s.y }; p.goal = s; return; }
  if (p.goal && Math.abs(p.goal.x - s.x) < 1 && Math.abs(p.goal.y - s.y) < 1) return;
  const sameHouse = p.goal && p.goal.house && p.goal.house === s.house;
  p.goal = s;
  p.wander = null; p.speed = SPEED;
  if (sameHouse || Math.hypot(s.x - p.pos.x, s.y - p.pos.y) < 120) { p.route = [s]; return; }
  p.route = viaPlaza(p.pos, s);
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
  renderOverview(s);
  renderLog(s.log);
  if (selected) renderDetail(selected);
  $('#btn-demo').classList.toggle('on', !!s.settings.demo);
  $('#btn-demo').textContent = s.settings.demo ? 'Dừng tự chạy' : 'Tự chạy';
  const pending = s.approvals.length + s.board.filter(t => t.status === 'waiting_approval').length;
  $('#btn-approve1').disabled = pending === 0;
}

const nameOf = id => state?.agents.find(a => a.id === id)?.name || id;
const statusText = { running: 'Đang chạy', queued: 'Sắp làm', waiting_approval: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị trả lại', done: 'Xong', error: 'Lỗi' };
const hhmm = ts => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function renderOverview(s) {
  const c = k => s.board.filter(t => t.status === k).length;
  $('#s-running').textContent = s.agents.filter(a => a.state === 'working').length;
  $('#s-queued').textContent = c('queued');
  $('#s-waiting').textContent = c('waiting_approval') + s.approvals.length;
  $('#s-error').textContent = c('error') + c('rejected');

  const items = [
    ...s.approvals.map(q => ({ id: q.id, title: q.summary, who: q.agent, kind: 'Xin quyền dùng ' + q.tool, ts: q.ts })),
    ...s.board.filter(t => t.status === 'waiting_approval').map(t => ({ id: t.id, title: `${t.id}: ${t.title}`, who: t.agent, kind: 'Việc chờ duyệt', ts: t.updatedAt })),
  ];
  $('#approvals').innerHTML = items.length ? items.map(i => `
    <li><div>${esc(i.title)}</div>
      <div class="meta">${esc(nameOf(i.who))} · ${esc(i.kind)} · ${hhmm(i.ts)}</div>
      <div class="row"><button class="ok" data-decide="${esc(i.id)}" data-ok="1">Duyệt</button>
      <button class="no" data-decide="${esc(i.id)}" data-ok="0">Từ chối</button></div></li>`).join('')
    : '<li class="empty">Không có gì chờ duyệt.</li>';

  const list = [...s.board].reverse().slice(0, 30);
  $('#board').innerHTML = list.length ? list.map(t => `
    <li><span class="tid">${esc(t.id)}</span><span class="ttl" title="${esc(t.title)}">${esc(t.title)}</span>
      <span class="tag ${t.status}">${statusText[t.status] || t.status}</span></li>`).join('')
    : '<li class="empty">Chưa có việc nào.</li>';
}

function renderLog(log) {
  let html = '', day = '';
  for (const e of [...log].reverse().slice(0, 120)) {
    const d = new Date(e.ts).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
    if (d !== day) { html += `<div class="day">${esc(d)}</div>`; day = d; }
    html += `<div class="e ${esc(e.kind)}"><time>${hhmm(e.ts)}</time><span class="who">${esc(nameOf(e.agent))}</span><span class="txt">${esc(e.text)}</span></div>`;
  }
  $('#logbody').innerHTML = html || '<div class="empty">Chưa có nhật ký.</div>';
}

const stateText = { idle: 'Rảnh', working: 'Đang làm', waiting: 'Chờ bạn', done: 'Vừa xong', error: 'Lỗi' };
function renderDetail(id) {
  const a = state?.agents.find(x => x.id === id);
  if (!a) return;
  const tasks = state.board.filter(t => t.agent === id).slice(-5).reverse();
  $('#detailbody').innerHTML = `
    <div class="head"><div class="swatch" style="background:${esc(a.color)}"></div>
      <div><div class="name">${esc(a.name)}</div><div class="role">${esc(a.role)}</div></div></div>
    <h3>Đang làm</h3>
    <div class="now"><b>${stateText[a.state] || a.state}</b>${a.task ? ' · ' + esc(a.task) : ''}<br>${esc(a.bubble)}</div>
    <h3>Việc gần đây</h3>
    ${tasks.length ? '<ul>' + tasks.map(t => `<li>${esc(t.id)}: ${esc(t.title)} <span class="tag ${t.status}">${statusText[t.status] || t.status}</span></li>`).join('') + '</ul>' : '<div class="empty">Chưa có.</div>'}
    <h3>Thao tác vừa rồi</h3>
    ${a.tools.length ? '<ul>' + a.tools.slice(0, 6).map(t => `<li>${hhmm(t.ts)} ${esc(t.text)}</li>`).join('') + '</ul>' : '<div class="empty">Chưa có.</div>'}
    <h3>File dùng</h3>
    <div class="chips">${a.files.map(f => `<span class="chip">${esc(f)}</span>`).join('') || '<span class="empty">Chưa có.</span>'}</div>
    <h3>Kỹ năng</h3>
    <div class="chips">${a.skills.map(f => `<span class="chip">${esc(f)}</span>`).join('') || '<span class="empty">Chưa có.</span>'}</div>`;
}
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
  rotate: b => { drift = !drift; if (toy) controls.autoRotate = drift; b.classList.toggle('on', drift); b.textContent = drift ? (toy ? 'Dừng xoay' : 'Dừng lướt') : (toy ? 'Xoay' : 'Lướt'); },
  view: () => { try { localStorage.setItem('view', toy ? 'paint' : 'toy'); } catch {} location.href = location.pathname + '?view=' + (toy ? 'paint' : 'toy'); },
  names: b => { b.classList.toggle('on', !document.body.classList.toggle('hide-names')); },
  bubbles: b => { b.classList.toggle('on', !document.body.classList.toggle('hide-bubbles')); },
  home: () => {
    if (toy) return toy.home();
    camera.position.set(0, 0, 200); camera.zoom = 1; camera.updateProjectionMatrix(); controls.target.set(0, 0, 0);
  },
  overview: b => b.classList.toggle('on', !$('#overview').classList.toggle('hidden')),
  log: b => b.classList.toggle('on', !$('#log').classList.toggle('hidden')),
  demo: () => post('/api/demo', { on: !state?.settings.demo }),
  approve1: () => {
    if (!state) return;
    const first = state.approvals[0]?.id || state.board.find(t => t.status === 'waiting_approval')?.id;
    if (first) post('/api/decide', { id: first, approve: true });
  },
};
$('#btn-view').textContent = toy ? 'Kiểu tranh' : 'Kiểu 3D';
$('#btn-rotate').textContent = toy ? 'Xoay' : 'Lướt';
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => toggles[b.dataset.act](b)));
if (innerWidth < 760) {
  for (const k of ['overview', 'log']) { $('#' + k).classList.add('hidden'); document.querySelector(`[data-act=${k}]`).classList.remove('on'); }
}

// Bấm vào nhân vật hoặc ngôi nhà để xem chi tiết (chỉ tính phần có hình, bỏ nền trong suốt)
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
function pick(e) {
  if (toy) { const id = toy.pick(e); return id ? { object: { userData: { agentId: id } } } : null; }
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(clickable, false).filter(hitOpaque);
  // trên cùng là cái vẽ sau cùng (gần camera hơn)
  hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
  return hits[0];
}
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const hit = pick(e);
  if (hit) openDetail(hit.object.userData.agentId);
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
  es.onerror = () => { $('#conn').classList.add('off'); $('#subtitle').textContent = 'Mất kết nối server, đang thử lại…'; };
}
window.__town = { openDetail, people, houses, camera, controls };

// ---------- Vòng vẽ ----------
const clock = new THREE.Clock();
const SPEED = 150; // pixel bản đồ mỗi giây
const STROLL = 60;  // đi dạo thì chậm hơn

// Lúc rảnh thì đi dạo: quanh nhà mình, ra quảng trường, thỉnh thoảng ghé nhà bạn
const canWander = a => (a.state === 'idle' || a.state === 'done') && a.at === a.home;
const rnd = (a, b) => a + Math.random() * (b - a);
function planWander(p, t) {
  const home = p.goal;
  const others = Object.entries(houses).filter(([id]) => id !== home.house);
  const r = Math.random();
  let dest, route;
  const hh = houses[home.house];
  const side = hh?.side || { x: 1, y: 0 }, out = hh?.out || { x: 0, y: 1 };
  if (r < 0.5) {
    const s = rnd(-70, 70), o = rnd(-5, 30);
    dest = { x: home.x + side.x * s + out.x * o, y: home.y + side.y * s + out.y * o };
    route = [dest];
  } else if (r < 0.85 || !others.length) {
    // quanh quảng trường, tránh đài phun nước ở giữa
    const ang = rnd(0, Math.PI * 2), k = 0.45 + Math.random() * 0.4;
    dest = { x: PLAZA.x + Math.cos(ang) * PLAZA.rx * k, y: PLAZA.y + Math.sin(ang) * PLAZA.ry * k };
    route = viaPlaza(p.pos, dest, true);
  } else {
    const h = others[Math.floor(Math.random() * others.length)][1];
    const s = rnd(-40, 40), o = rnd(0, 20);
    dest = { x: h.door.x + h.side.x * s + h.out.x * o, y: h.door.y + h.side.y * s + h.out.y * o };
    route = viaPlaza(p.pos, dest);
  }
  p.wander = { until: t + rnd(4, 9) + Math.hypot(dest.x - p.pos.x, dest.y - p.pos.y) / STROLL * 1.5 };
  p.route = route; p.speed = STROLL;
}
function goHome(p, speed) {
  const s = p.goal;
  p.speed = speed;
  p.route = Math.hypot(s.x - p.pos.x, s.y - p.pos.y) < 120 ? [s] : viaPlaza(p.pos, s);
}

function stepPerson(p, dt, t) {
  if (!p.pos) return;
  const st = p.data.state;
  if (p.goal) {
    // Có việc thì đi nhanh về chỗ; rảnh thì nghỉ một lúc rồi đi dạo tiếp
    if (!canWander(p.data)) { if (p.wander) { p.wander = null; goHome(p, SPEED); } }
    else if (!p.wander) p.wander = { until: t + rnd(2, 8) };
    else if (!p.route.length && t > p.wander.until) {
      if (Math.random() < 0.3) { goHome(p, STROLL); p.wander.until = t + rnd(8, 16); }
      else planWander(p, t);
    }
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
    let sp = (p.speed || SPEED) * (lastPt ? Math.min(1, 0.25 + d / 40) : 1);
    // Bản 3D: trục y của bản đồ dài gấp đôi ngoài đời, chỉnh để đi đều mọi hướng
    if (toy) sp *= 0.7 * d / Math.hypot(dx, dy * 2.1);
    tx = dx / d * sp; ty = dy / d * sp;
    break;
  }
  const k = 1 - Math.exp(-dt * (p.route.length ? 5 : 12));
  v.x += (tx - v.x) * k; v.y += (ty - v.y) * k;
  p.pos.x += v.x * dt; p.pos.y += v.y * dt;
  const sp = Math.hypot(v.x, v.y);
  const moving = sp > 6;
  p.walking = moving;
  if (p.toy) {
    if (moving) { p.dir.x = v.x / sp; p.dir.y = v.y / sp; p.stride = (p.stride || 0) + dt * (1.2 + sp / 70); }
    toy.animatePerson(p.toy, { moving, dir: p.dir, stride: p.stride || 0, st, t, phase: p.phase, dt });
    toy.placePerson(p.toy, p.pos.x, p.pos.y);
    return;
  }
  const b = p.body;
  if (moving) {
    p.dir.x = v.x / sp; p.dir.y = v.y / sp;
    // Nhịp bước theo tốc độ; hướng chỉ đổi khi lệch rõ để không chớp hình
    p.stride = (p.stride || 0) + dt * (1.6 + sp / 40);
    const ax = Math.abs(p.dir.x), ay = Math.abs(p.dir.y) * 1.6;
    const vertical = p.facing === 'v' ? ay > ax * 0.7 : ay > ax * 1.4;
    p.facing = vertical ? 'v' : 'h';
    const step = Math.floor(p.stride * 2) % 2;
    if (vertical) setPose(p, p.dir.y < 0 ? 'back' : 'front', false);
    else setPose(p, step ? 'walk' : 'left', p.dir.x > 0 ? !step : !!step);
    const ph = p.stride * Math.PI * 2;
    b.position.y = Math.abs(Math.sin(ph)) * 3;
    b.rotation.z = Math.sin(ph) * (vertical ? 0.06 : 0.03);
    b.scale.set(1, 1 - Math.abs(Math.sin(ph)) * 0.02, 1);
  } else {
    p.facing = null;
    setPose(p, 'front', false);
    b.position.y = st === 'working' ? Math.abs(Math.sin(t * 7 + p.phase)) * 3
      : st === 'waiting' ? Math.abs(Math.sin(t * 3.2)) * 10 : 0;
    b.rotation.z *= 1 - k;
    const breathe = 1 + Math.sin(t * 2 + p.phase) * 0.012;
    b.scale.set(1 / breathe, breathe, 1);
  }
  p.group.position.set(wx(p.pos.x), wy(p.pos.y), depth(p.pos.y) + 0.01);
  const ro = Math.round(p.pos.y * 10) + 1;
  if (p.sprite) p.sprite.renderOrder = ro;
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
  if (drift && !toy) {
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
