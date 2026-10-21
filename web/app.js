// Thị trấn AI agent: phần hình 3D và bảng điều khiển.
// Đọc trạng thái từ server (Server-Sent Events) rồi vẽ nhà, nhân vật, bong bóng.
import * as THREE from 'three';
import { OrbitControls } from './vendor/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from './vendor/addons/CSS2DRenderer.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Cảnh 3D ----------
const host = $('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.domElement.style.position = 'absolute';
labels.domElement.style.inset = '0';
labels.domElement.style.pointerEvents = 'none';
host.appendChild(labels.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe8d5');

// Camera chéo kiểu isometric
const VIEW = 17;
const camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 0.1, 500);
const HOME_POS = new THREE.Vector3(40, 38, 40);
camera.position.copy(HOME_POS);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.maxPolarAngle = Math.PI * 0.42;
controls.minZoom = 0.6;
controls.maxZoom = 3;

scene.add(new THREE.HemisphereLight('#ffffff', '#7da67f', 1.6));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
sun.position.set(20, 40, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35 });
scene.add(sun);

function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  // Màn hình dọc (điện thoại): nới khung để thấy đủ cả vòng nhà
  const v = Math.max(VIEW, 19 / a);
  Object.assign(camera, { left: -v * a, right: v * a, top: v, bottom: -v });
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labels.setSize(w, h);
}
addEventListener('resize', resize);
resize();

const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
function mesh(geo, color, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

// Mặt đất, quảng trường, cây
const R = 13; // bán kính vòng nhà
const ground = mesh(new THREE.CylinderGeometry(30, 31, 1, 64), '#9fd18f', { cast: false });
ground.position.y = -0.5;
scene.add(ground);
const plaza = mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.12, 48), '#e9dfc9', { cast: false });
plaza.position.y = 0.06;
scene.add(plaza);

function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.18 * s, 0.24 * s, 1 * s, 8), '#8a6a43');
  trunk.position.y = 0.5 * s;
  const top = mesh(new THREE.ConeGeometry(0.9 * s, 2 * s, 8), ['#4f9a5a', '#5aab61', '#3f8a4f'][Math.floor(Math.random() * 3)]);
  top.position.y = 1.9 * s;
  g.add(trunk, top);
  g.position.set(x, 0, z);
  scene.add(g);
}
for (let i = 0; i < 46; i++) {
  const a = Math.random() * Math.PI * 2, r = 19 + Math.random() * 9;
  tree(Math.cos(a) * r, Math.sin(a) * r, 0.7 + Math.random() * 0.6);
}

// ---------- Nhà và nhân vật ----------
const houses = {};   // roomId -> { group, front: Vector3, angle }
const people = {};   // agentId -> { group, body, bubble, label, target, data, walkT }
const clickable = [];
let built = false;

function label(text, cls) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  return new CSS2DObject(div);
}

function buildHouse(roomId, def, angle) {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(4.2, 3, 4.2), '#fbf3e4');
  body.position.y = 1.5;
  const roof = mesh(new THREE.ConeGeometry(3.4, 2.2, 4), def.roof || def.color);
  roof.position.y = 4.1; roof.rotation.y = Math.PI / 4;
  const door = mesh(new THREE.BoxGeometry(1, 1.7, 0.12), '#8a6a43');
  door.position.set(0, 0.85, 2.12);
  const winMat = mat('#bfe3f2');
  for (const x of [-1.3, 1.3]) {
    const w = mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), winMat);
    w.position.set(x, 1.9, 2.12);
    g.add(w);
  }
  const mat2 = mesh(new THREE.BoxGeometry(1.6, 0.05, 0.9), def.color);
  mat2.position.set(0, 0.03, 2.8);
  g.add(body, roof, door, mat2);
  const sign = label(def.name, 'sign3d');
  sign.position.set(0, 6.4, 0);
  g.add(sign);
  // Nhà quay cửa vào giữa quảng trường
  const x = Math.cos(angle) * R, z = Math.sin(angle) * R;
  g.position.set(x, 0, z);
  g.lookAt(0, 0, 0);
  g.userData.agentId = roomId;
  body.userData.agentId = roomId; roof.userData.agentId = roomId;
  clickable.push(body, roof);
  scene.add(g);
  // Đường lát từ quảng trường tới cửa
  const path = mesh(new THREE.BoxGeometry(1.6, 0.08, R - 8.5), '#e3d6bb', { cast: false });
  path.position.set(Math.cos(angle) * (R - 2.2) / 2 + Math.cos(angle) * 3.1, 0.04, Math.sin(angle) * (R - 2.2) / 2 + Math.sin(angle) * 3.1);
  path.lookAt(0, 0.04, 0);
  scene.add(path);
  const front = new THREE.Vector3(Math.cos(angle) * (R - 3.8), 0, Math.sin(angle) * (R - 3.8));
  houses[roomId] = { group: g, front, angle };
}

function buildBossDesk(color) {
  const desk = mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), '#c9a36b');
  desk.position.set(0, 0.45, -1.2);
  const screen = mesh(new THREE.BoxGeometry(1.2, 0.8, 0.08), '#2b2a33');
  screen.position.set(0, 1.35, -1.45);
  const flag = mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.5, 6), '#8a6a43');
  flag.position.set(1.9, 1.75, -1.6);
  const cloth = mesh(new THREE.BoxGeometry(1, 0.6, 0.04), color);
  cloth.position.set(2.4, 3.2, -1.6);
  scene.add(desk, screen, flag, cloth);
  houses.__boss = { front: new THREE.Vector3(0, 0, 0), angle: Math.PI / 2 };
}

function buildPerson(a) {
  const g = new THREE.Group();
  const s = a.isGuest ? 0.85 : 1;
  const body = mesh(new THREE.CapsuleGeometry(0.45 * s, 0.7 * s, 4, 12), a.color);
  body.position.y = 0.9 * s;
  const head = mesh(new THREE.SphereGeometry(0.42 * s, 16, 12), '#f6d3b3');
  head.position.y = 1.85 * s;
  const eyeMat = mat('#2b2a33');
  for (const x of [-0.14, 0.14]) {
    const e = mesh(new THREE.SphereGeometry(0.05 * s, 8, 6), eyeMat, { cast: false });
    e.position.set(x * s, 1.9 * s, 0.38 * s);
    g.add(e);
  }
  const hat = a.isBoss
    ? mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.35, 5), '#f2b134')
    : mesh(new THREE.SphereGeometry(0.44 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Color(a.color).multiplyScalar(0.7).getStyle());
  hat.position.y = a.isBoss ? 2.35 : 1.95 * s;
  const inner = new THREE.Group();
  inner.add(body, head, hat);
  g.add(inner);
  for (const m of [body, head, hat]) { m.userData.agentId = a.id; clickable.push(m); }

  const nameTag = label(a.name, 'label3d');
  nameTag.position.set(0, 2.6, 0);
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'bubble3d';
  const bubble = new CSS2DObject(bubbleDiv);
  bubble.position.set(0, 3.2, 0);
  g.add(nameTag, bubble);
  g.scale.setScalar(1.35);
  scene.add(g);

  const p = { group: g, nameTag, inner, bubble, bubbleDiv, target: new THREE.Vector3(), data: a, phase: Math.random() * 6, walking: false };
  people[a.id] = p;
  return p;
}

// Vị trí đứng: trước cửa nhà mình, hoặc trước cửa nhà đang tới bàn giao
let guestIndex = 0;
const guestSpot = {};
function spotFor(a) {
  if (a.isBoss) return new THREE.Vector3(0, 0, 0);
  if (a.isGuest && a.at === a.home) {
    if (guestSpot[a.id] === undefined) guestSpot[a.id] = guestIndex++;
    const ang = guestSpot[a.id] * 1.1 + 0.4;
    return new THREE.Vector3(Math.cos(ang) * 3.6, 0, Math.sin(ang) * 3.6);
  }
  const h = houses[a.at] || houses[a.home];
  if (!h) return new THREE.Vector3();
  const v = h.front.clone();
  if (a.at !== a.home) {
    // khách đứng lệch sang một bên cửa
    const side = new THREE.Vector3(-Math.sin(h.angle), 0, Math.cos(h.angle)).multiplyScalar(1.3);
    v.add(side);
  }
  return v;
}

function build(state) {
  const defs = {};
  for (const a of state.agents) defs[a.id] = a;
  const rooms = state.rooms.filter(r => r !== state.boss);
  rooms.forEach((r, i) => {
    const angle = (i / rooms.length) * Math.PI * 2 - Math.PI / 2;
    const def = { ...defs[r] };
    buildHouse(r, { name: def.name, color: def.color, roof: shade(def.color) }, angle);
  });
  houses[state.boss] = { front: new THREE.Vector3(0, 0, 0), angle: Math.PI / 2 };
  buildBossDesk(defs[state.boss]?.color || '#f2b134');
  built = true;
}
function shade(hex) { return new THREE.Color(hex).multiplyScalar(0.72).getStyle(); }

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
    const t = spotFor(a);
    if (!p.placed) { p.group.position.copy(t); p.placed = true; }
    p.target.copy(t);
    if (p.bubbleDiv.textContent !== a.bubble) p.bubbleDiv.textContent = a.bubble || '';
    p.bubbleDiv.className = 'bubble3d ' + a.state;
    // Ở nhà thì biển tên trên mái đã đủ, chỉ hiện tên khi đi sang phòng khác
    p.nameTag.element.style.visibility = (a.isBoss || a.isGuest || a.at !== a.home) ? '' : 'hidden';
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
const toggles = {
  rotate: b => { controls.autoRotate = !controls.autoRotate; b.classList.toggle('on', controls.autoRotate); b.textContent = controls.autoRotate ? 'Dừng xoay' : 'Xoay'; },
  names: b => { b.classList.toggle('on', !document.body.classList.toggle('hide-names')); },
  bubbles: b => { b.classList.toggle('on', !document.body.classList.toggle('hide-bubbles')); },
  home: () => { camera.position.copy(HOME_POS); camera.zoom = 1; camera.updateProjectionMatrix(); controls.target.set(0, 0, 0); },
  overview: b => b.classList.toggle('on', !$('#overview').classList.toggle('hidden')),
  log: b => b.classList.toggle('on', !$('#log').classList.toggle('hidden')),
  demo: () => post('/api/demo', { on: !state?.settings.demo }),
  approve1: () => {
    if (!state) return;
    const first = state.approvals[0]?.id || state.board.find(t => t.status === 'waiting_approval')?.id;
    if (first) post('/api/decide', { id: first, approve: true });
  },
};
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => toggles[b.dataset.act](b)));
if (innerWidth < 760) {
  for (const k of ['overview', 'log']) { $('#' + k).classList.add('hidden'); document.querySelector(`[data-act=${k}]`).classList.remove('on'); }
}

// Bấm vào nhân vật hoặc ngôi nhà để xem chi tiết
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(clickable, false)[0];
  if (hit) openDetail(hit.object.userData.agentId);
});

// ---------- Nối với server ----------
function connect() {
  const es = new EventSource('/events');
  es.onopen = () => $('#conn').classList.remove('off');
  es.onmessage = e => apply(JSON.parse(e.data));
  es.onerror = () => { $('#conn').classList.add('off'); $('#subtitle').textContent = 'Mất kết nối server, đang thử lại…'; };
}
connect();
window.__town = { openDetail };

// ---------- Vòng vẽ ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  for (const p of Object.values(people)) {
    const pos = p.group.position;
    tmp.subVectors(p.target, pos); tmp.y = 0;
    const dist = tmp.length();
    p.walking = dist > 0.05;
    if (p.walking) {
      const step = Math.min(dist, 3.2 * dt);
      tmp.normalize();
      pos.addScaledVector(tmp, step);
      p.group.rotation.y = Math.atan2(tmp.x, tmp.z);
      p.inner.position.y = Math.abs(Math.sin(t * 10 + p.phase)) * 0.25;
      p.inner.rotation.z = Math.sin(t * 10 + p.phase) * 0.08;
    } else {
      // Đứng yên thì quay mặt vào quảng trường
      const st = p.data.state;
      p.inner.rotation.z = 0;
      p.inner.position.y = st === 'working' ? Math.abs(Math.sin(t * 6 + p.phase)) * 0.12
        : st === 'waiting' ? Math.abs(Math.sin(t * 3)) * 0.3 : 0;
      if (!p.data.isBoss && pos.lengthSq() > 1) p.group.rotation.y = Math.atan2(-pos.x, -pos.z);
    }
  }
  controls.update();
  renderer.render(scene, camera);
  labels.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
