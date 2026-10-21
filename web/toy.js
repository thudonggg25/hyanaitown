// Thị trấn 3D kiểu đồ chơi: đảo tròn, cây tròn, nhà lâu đài pastel, nhân vật chibi.
// Dùng chung toạ độ "pixel bản đồ" với bản tranh vẽ (x sang phải, y xuống dưới), nên
// đường đi, chỗ đứng, đi dạo trong app.js giữ nguyên; ở đây chỉ đổi sang không gian 3D
// và vẽ bằng hình khối. Không cần tải mô hình ngoài.
import * as THREE from 'three';
import { OrbitControls } from './vendor/addons/OrbitControls.js';

// pixel bản đồ -> mét thế giới. Ảnh bản đồ nhìn chéo nên trục y bị nén, nhân lại cho tròn.
const CX = 994, CY = 415, S = 0.05, ZS = 2.1;
export const toX = x => (x - CX) * S;
export const toZ = y => (y - CY) * S * ZS;
const fromX = X => X / S + CX;
const fromZ = Z => Z / (S * ZS) + CY;
const ISLAND_R = 44;

const mats = {};
function mat(color, opts) {
  const k = color + JSON.stringify(opts || {});
  return (mats[k] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts }));
}
function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Hộp bo góc: chia nhỏ hộp rồi đẩy đỉnh ra theo mặt cầu ở các góc
function roundedBox(w, h, d, r, seg = 4) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    v.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Màu từng nhà (mái, tường, viền), lấy theo không khí pastel trong video mẫu
const HOUSE_STYLE = {
  calm:        { roof: '#f29bb5', wall: '#fff3ea', trim: '#f7c6d4', kind: 'castle' },
  'san-pham':  { roof: '#ffc86b', wall: '#fff6e6', trim: '#ffe0a3', kind: 'tower' },
  'thiet-ke':  { roof: '#f49aa0', wall: '#fff0ee', trim: '#ffd0cc', kind: 'cottage' },
  'tiep-nhan': { roof: '#ff9f80', wall: '#fff4ec', trim: '#ffd2bd', kind: 'cottage' },
  qa:          { roof: '#9ec9f5', wall: '#f2f7ff', trim: '#cfe3fb', kind: 'tower' },
  anicca:      { roof: '#c4a2ef', wall: '#f8f2ff', trim: '#e2d2fa', kind: 'castle' },
  coder:       { roof: '#7fb8e6', wall: '#eef6ff', trim: '#bcdcf5', kind: 'workshop' },
};
// Nhân vật: màu tóc, áo, quần, đồ đội đầu
const LOOK = {
  calm:        { hair: '#5a3b2e', shirt: '#7cc9a8', pants: '#5b6f8c', hat: 'crown' },
  anicca:      { hair: '#6b3f8f', shirt: '#9b6fc9', pants: '#3f3550', long: true },
  'tiep-nhan': { hair: '#8a4a2c', shirt: '#f2a65a', pants: '#6a5546' },
  'san-pham':  { hair: '#4a3328', shirt: '#f4cf5e', pants: '#6d6d7a', long: true },
  'thiet-ke':  { hair: '#e8b35a', shirt: '#e8715f', pants: '#c85a48', hat: 'beret' },
  qa:          { hair: '#c9c4cc', shirt: '#4f8f8a', pants: '#7a6250', hat: 'glasses' },
  'coder-1':   { hair: '#7a4b2b', shirt: '#5d84c7', pants: '#4a4a55', hat: 'phones' },
  'coder-2':   { hair: '#9a4a2a', shirt: '#4f74b8', pants: '#4a4a55', hat: 'phones' },
  'coder-3':   { hair: '#3a2a24', shirt: '#6a95d6', pants: '#4a4a55', hat: 'phones' },
};
const SKIN = '#ffdcc4';

export function createToy({ renderer, scene, label }) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene.background = new THREE.Color('#cfeee8');
  scene.fog = new THREE.Fog('#cfeee8', 120, 220);

  const camera = new THREE.PerspectiveCamera(32, 1, 1, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 25;
  controls.maxDistance = 160;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.25;
  controls.screenSpacePanning = false;
  controls.autoRotateSpeed = 0.6;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  function home() {
    camera.position.set(0, 50, 66);
    controls.target.set(0, 0, 3);
    camera.updateProjectionMatrix();
  }
  home();
  function resize(w, h) {
    camera.aspect = w / h;
    // Màn hình dọc thì lùi xa một chút cho thấy cả đảo
    camera.fov = w / h < 0.9 ? 50 : 32;
    camera.updateProjectionMatrix();
  }
  function clampView() {
    const t = controls.target, l = Math.hypot(t.x, t.z), max = 30;
    if (l > max) { const k = max / l, dx = t.x * k - t.x, dz = t.z * k - t.z; t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
  }

  // ---------- Ánh sáng ----------
  scene.add(new THREE.HemisphereLight('#fff8f2', '#b8e0c8', 1.25));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.0);
  sun.position.set(-30, 60, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 10, far: 150 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun);

  const clickable = [];
  const doors = []; // để tránh trồng cây lên đường

  // ---------- Đảo, quảng trường ----------
  function buildGround() {
    const g = new THREE.Group();
    const top = mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R, 1.2, 96), '#a9e29a');
    top.position.y = -0.6;
    const lip = mesh(new THREE.TorusGeometry(ISLAND_R, 0.6, 12, 96), '#97d78b');
    lip.rotation.x = Math.PI / 2; lip.position.y = -0.6;
    const cliff = mesh(new THREE.CylinderGeometry(ISLAND_R - 0.3, ISLAND_R * 0.72, 7, 96, 1), '#f1d3b3');
    cliff.position.y = -4.6;
    const under = mesh(new THREE.ConeGeometry(ISLAND_R * 0.72, 16, 48), '#e8bfa0');
    under.rotation.x = Math.PI; under.position.y = -16;
    // quảng trường tròn lát gạch
    const plaza = mesh(new THREE.CylinderGeometry(9.5, 9.8, 0.3, 64), '#fbe4d6');
    plaza.position.y = 0.05;
    const ring = mesh(new THREE.TorusGeometry(9.6, 0.25, 8, 64), '#f3c9b6');
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.22;
    const inner = mesh(new THREE.CylinderGeometry(4, 4, 0.34, 48), '#f8d5c6');
    inner.position.y = 0.06;
    g.add(top, lip, cliff, under, plaza, ring, inner);
    // đài phun nước nhỏ giữa quảng trường
    const basin = mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.7, 32), '#ffffff');
    basin.position.y = 0.5;
    const water = mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.1, 32), '#9fdcf0', { roughness: 0.2 });
    water.position.y = 0.82;
    const pillar = mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.6, 16), '#ffffff');
    pillar.position.y = 1.4;
    const bowl = mesh(new THREE.SphereGeometry(0.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff');
    bowl.rotation.x = Math.PI; bowl.position.y = 2.3;
    g.add(basin, water, pillar, bowl);
    scene.add(g);
  }

  function path(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    const m = mesh(roundedBox(2.6, 0.2, l, 0.09, 1), '#f7dcc8');
    m.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
    m.rotation.y = Math.atan2(dx, dz);
    m.castShadow = false;
    scene.add(m);
  }

  // ---------- Nhà ----------
  function window_(w, h, color) {
    const g = new THREE.Group();
    const f = mesh(roundedBox(w + 0.2, h + 0.2, 0.15, 0.06, 1), '#ffffff');
    const gl = mesh(roundedBox(w, h, 0.18, 0.05, 1), color, { roughness: 0.3, emissive: '#ffd9a0', emissiveIntensity: 0.15 });
    g.add(f, gl);
    return g;
  }
  function tower(r, h, wall, roof, trim) {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 24), wall);
    body.position.y = h / 2;
    const band = mesh(new THREE.TorusGeometry(r * 1.03, 0.14, 8, 24), trim);
    band.rotation.x = Math.PI / 2; band.position.y = h;
    const cone = mesh(new THREE.ConeGeometry(r * 1.35, r * 2.6, 24), roof);
    cone.position.y = h + r * 1.3;
    const ball = mesh(new THREE.SphereGeometry(r * 0.22, 12, 8), trim);
    ball.position.y = h + r * 2.65;
    g.add(body, band, cone, ball);
    return g;
  }
  function buildHouse(houseId, plot, names, rooms) {
    const st = HOUSE_STYLE[houseId] || HOUSE_STYLE['tiep-nhan'];
    const X = toX(plot.x), Z = toZ(plot.y);
    const g = new THREE.Group();
    const wide = st.kind === 'workshop';
    const W = wide ? 11 : st.kind === 'castle' ? 7 : 5.6, D = wide ? 5.4 : 5, H = st.kind === 'tower' ? 3.6 : 3.4;
    // nền đá
    const base = mesh(roundedBox(W + 1.2, 0.5, D + 1.2, 0.2, 2), '#f6e7dc');
    base.position.y = 0.25;
    const body = mesh(roundedBox(W, H, D, 0.35, 3), st.wall);
    body.position.y = 0.5 + H / 2;
    g.add(base, body);
    // mái
    const roofs = wide ? [-W / 3, 0, W / 3] : [0];
    for (const rx of roofs) {
      const rw = wide ? W / 3 + 0.5 : W + 0.7;
      const roof = mesh(new THREE.ConeGeometry(1, 1, 4, 1), st.roof);
      roof.scale.set(rw * 0.72, wide ? 2.6 : 3, (D + 0.8) * 0.72);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(rx, 0.5 + H + (wide ? 1.3 : 1.5), 0);
      g.add(roof);
    }
    // tháp lâu đài
    if (st.kind === 'castle') {
      for (const s of [-1, 1]) { const t = tower(1.25, H + 2.4, st.wall, st.roof, st.trim); t.position.set(s * (W / 2 + 0.2), 0.4, D / 2 - 0.6); g.add(t); }
    } else if (st.kind === 'tower') {
      const t = tower(1.3, H + 3.4, st.wall, st.roof, st.trim); t.position.set(W / 2 - 0.4, 0.4, -D / 2 + 1); g.add(t);
    } else if (st.kind === 'cottage') {
      const ch = mesh(roundedBox(0.8, 2, 0.8, 0.15, 1), st.trim); ch.position.set(-W / 4, H + 2.3, -0.6); g.add(ch);
    }
    // cửa, cửa sổ, mái hiên
    const door = mesh(roundedBox(1.3, 2, 0.3, 0.3, 2), '#b9805a');
    door.position.set(0, 1.5, D / 2 + 0.05);
    const step = mesh(roundedBox(2, 0.25, 0.8, 0.1, 1), '#f3d9c6');
    step.position.set(0, 0.55, D / 2 + 0.5);
    const awning = mesh(roundedBox(2, 0.18, 0.9, 0.08, 1), st.roof);
    awning.position.set(0, 2.8, D / 2 + 0.4); awning.rotation.x = 0.25;
    g.add(door, step, awning);
    const nw = wide ? 4 : 2;
    for (let i = 0; i < nw; i++) {
      const wx_ = (i - (nw - 1) / 2) * (W / (nw + 0.6));
      if (Math.abs(wx_) < 1.2) continue;
      const w = window_(0.9, 1, '#bfe4f7'); w.position.set(wx_, 2.2, D / 2 + 0.05); g.add(w);
    }
    // bụi hoa trước nhà
    for (const s of [-1, 1]) {
      const bush = mesh(new THREE.SphereGeometry(0.6, 14, 10), '#8fd18a');
      bush.position.set(s * (W / 2 - 0.3), 0.8, D / 2 + 0.7); bush.scale.y = 0.8;
      const fl = mesh(new THREE.SphereGeometry(0.17, 8, 6), st.roof);
      fl.position.set(s * (W / 2 - 0.3), 1.3, D / 2 + 0.95);
      g.add(bush, fl);
    }
    // Quay mặt về phía quảng trường
    const yaw = Math.atan2(-X, -Z);
    g.rotation.y = yaw;
    g.position.set(X, 0, Z);
    g.traverse(o => { if (o.isMesh) o.userData.agentId = rooms[0]; });
    scene.add(g);
    clickable.push(g);
    const sign = label(names, 'sign3d');
    sign.position.set(0, 0.5 + H + 4.4, 0);
    g.add(sign);
    // chỗ đứng trước cửa (đổi lại ra pixel bản đồ cho phần logic đi lại)
    const fx = Math.sin(yaw), fz = Math.cos(yaw), out = D / 2 + 1.8;
    const dX = X + fx * out, dZ = Z + fz * out;
    const l = Math.hypot(dX, dZ) || 1;
    path(X + fx * (D / 2 + 0.8), Z + fz * (D / 2 + 0.8), dX / l * 9, dZ / l * 9);
    doors.push([dX, dZ, X, Z]);
    // side: dọc mặt tiền, out: hướng ra ngoài cửa (đơn vị pixel bản đồ, mỗi 20px ≈ 1m)
    return { door: { x: fromX(dX), y: fromZ(dZ) }, side: { x: Math.cos(yaw), y: -Math.sin(yaw) / ZS }, out: { x: fx, y: fz / ZS } };
  }

  // ---------- Cây (vẽ hàng loạt cho nhẹ) ----------
  function buildTrees() {
    const spots = [];
    const near = (x, z) => {
      if (Math.hypot(x, z) < 12.5) return true;
      for (const [dx, dz, hx, hz] of doors) {
        if (Math.hypot(x - hx, z - hz) < 8.5) return true;
        // gần đường từ cửa ra quảng trường
        const l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, t = x * ux + z * uz;
        if (t > 8 && t < l + 1 && Math.abs(-x * uz + z * ux) < 3.4) return true;
      }
      return spots.some(([a, b, s]) => Math.hypot(x - a, z - b) < 2.6 * s);
    };
    let tries = 0;
    while (spots.length < 65 && tries++ < 3000) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (ISLAND_R - 2.5);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.75 + Math.random() * 0.6;
      if (!near(x, z)) spots.push([x, z, s]);
    }
    const leaves = ['#8fd18a', '#a5dd8f', '#7cc68a', '#f7b6c8', '#c6e8a0', '#9ad6b0'];
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8); trunkGeo.translate(0, 0.7, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1.25, 2); crownGeo.translate(0, 2.3, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, mat('#c4936c'), spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, mat('#ffffff'), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    spots.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)), new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, c.set(leaves[Math.floor(Math.random() * leaves.length)]));
    });
    for (const im of [trunks, crowns]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
    // vài khóm hoa nhỏ rải trên cỏ
    const fGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const flowers = new THREE.InstancedMesh(fGeo, mat('#ffffff'), 160);
    const fc = ['#ff9fb8', '#fff08a', '#ffffff', '#c7a6ff', '#ffb68a'];
    let n = 0;
    for (let i = 0; i < 600 && n < 160; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (ISLAND_R - 1.5);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x, z) < 11 || doors.some(([, , hx, hz]) => Math.hypot(x - hx, z - hz) < 6.5)) continue;
      m.makeTranslation(x, 0.12, z); flowers.setMatrixAt(n, m); flowers.setColorAt(n++, c.set(fc[n % fc.length]));
    }
    flowers.count = n;
    scene.add(flowers);
  }

  // ---------- Nhân vật chibi ----------
  function buildPerson(a, colorFallback) {
    const look = LOOK[a.id] || { hair: '#5a4034', shirt: a.color || colorFallback || '#9ab', pants: '#556' };
    const scale = a.isGuest ? 0.85 : 1;
    const root = new THREE.Group();
    const body = new THREE.Group(); // phần nhún nhảy, xoay hướng
    root.add(body);
    const legGeo = new THREE.CapsuleGeometry(0.17, 0.35, 4, 8); legGeo.translate(0, -0.3, 0);
    const legs = [-1, 1].map(s => { const l = mesh(legGeo, look.pants); l.position.set(s * 0.2, 0.62, 0); body.add(l); return l; });
    for (const l of legs) { const shoe = mesh(new THREE.SphereGeometry(0.2, 10, 8), '#5b4a44'); shoe.scale.set(1, 0.6, 1.3); shoe.position.set(0, -0.62, 0.06); l.add(shoe); }
    const torso = mesh(new THREE.CapsuleGeometry(0.42, 0.45, 6, 14), look.shirt);
    torso.position.y = 1.05;
    body.add(torso);
    const armGeo = new THREE.CapsuleGeometry(0.12, 0.4, 4, 8); armGeo.translate(0, -0.25, 0);
    const arms = [-1, 1].map(s => { const ar = mesh(armGeo, look.shirt); ar.position.set(s * 0.5, 1.3, 0); ar.rotation.z = s * 0.15; body.add(ar);
      const hand = mesh(new THREE.SphereGeometry(0.12, 8, 6), SKIN); hand.position.y = -0.52; ar.add(hand); return ar; });
    const head = new THREE.Group();
    head.position.y = 2.05;
    body.add(head);
    const face = mesh(new THREE.SphereGeometry(0.62, 24, 18), SKIN);
    face.scale.set(1, 0.95, 0.95);
    const hair = mesh(new THREE.SphereGeometry(0.68, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), look.hair);
    hair.position.y = 0.06; hair.rotation.x = -0.25;
    const back = mesh(new THREE.SphereGeometry(0.66, 20, 14), look.hair);
    back.position.set(0, 0.02, -0.14); back.scale.set(1, look.long ? 1.35 : 0.95, 0.85);
    if (look.long) back.position.y = -0.25;
    head.add(face, hair, back);
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.085, 10, 8), '#3a2a2a', { roughness: 0.3 });
      eye.position.set(s * 0.22, -0.02, 0.56); eye.scale.set(0.85, 1.25, 0.6);
      const shine = mesh(new THREE.SphereGeometry(0.03, 6, 4), '#ffffff');
      shine.position.set(0.02, 0.04, 0.06); eye.add(shine);
      const blush = mesh(new THREE.SphereGeometry(0.1, 10, 6), '#ffb3b3', { transparent: true, opacity: 0.6 });
      blush.position.set(s * 0.36, -0.17, 0.48); blush.scale.set(1, 0.5, 0.4);
      head.add(eye, blush);
    }
    if (look.hat === 'crown') {
      const cr = mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.25, 5, 1, true), '#ffd35a', { metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide });
      cr.position.y = 0.68; head.add(cr);
    } else if (look.hat === 'beret') {
      const b = mesh(new THREE.SphereGeometry(0.6, 18, 10), '#e05a4c'); b.scale.set(1.05, 0.35, 1.05); b.position.set(0.08, 0.55, -0.02); b.rotation.z = -0.2; head.add(b);
    } else if (look.hat === 'phones') {
      const band = mesh(new THREE.TorusGeometry(0.66, 0.06, 6, 20, Math.PI), '#4b5c8a'); band.position.y = 0.05; head.add(band);
      for (const s of [-1, 1]) { const cup = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 14), '#4b5c8a'); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.66, 0, 0); head.add(cup); }
    } else if (look.hat === 'glasses') {
      for (const s of [-1, 1]) { const ring = mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), '#7a5a3a'); ring.position.set(s * 0.22, -0.02, 0.6); head.add(ring); }
    }
    body.scale.setScalar(scale);
    root.traverse(o => { if (o.isMesh) o.userData.agentId = a.id; });
    scene.add(root);
    clickable.push(root);
    return { root, body, legs, arms, head, H: 2.9 * scale, yaw: 0 };
  }

  function placePerson(v, x, y) { v.root.position.set(toX(x), 0, toZ(y)); }

  // Đi: hai chân, hai tay đánh qua lại, người nghiêng nhẹ; đứng: thở, làm việc thì gật gù
  function animatePerson(v, { moving, dir, stride, st, t, phase, dt }) {
    if (moving) {
      const target = Math.atan2(dir.x, dir.y * ZS);
      let d = target - v.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      v.yaw += d * Math.min(1, dt * 10);
    } else {
      // đứng yên thì từ từ quay mặt ra phía camera cho dễ nhìn
      let d = Math.atan2(camera.position.x - v.root.position.x, camera.position.z - v.root.position.z) - v.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.yaw += d * Math.min(1, dt * 2);
    }
    v.body.rotation.y = v.yaw;
    const ph = stride * Math.PI * 2;
    const sw = moving ? Math.sin(ph) * 0.7 : 0;
    v.legs[0].rotation.x += (sw - v.legs[0].rotation.x) * 0.3;
    v.legs[1].rotation.x += (-sw - v.legs[1].rotation.x) * 0.3;
    v.arms[0].rotation.x += (-sw * 0.8 - v.arms[0].rotation.x) * 0.3;
    v.arms[1].rotation.x += (sw * 0.8 - v.arms[1].rotation.x) * 0.3;
    if (moving) {
      v.body.position.y = Math.abs(Math.sin(ph)) * 0.12;
      v.body.rotation.z = Math.sin(ph) * 0.05;
      v.head.rotation.x = 0;
    } else {
      v.body.position.y = st === 'waiting' ? Math.abs(Math.sin(t * 3.2)) * 0.35 : 0;
      v.body.rotation.z *= 0.9;
      v.head.rotation.x = st === 'working' ? Math.sin(t * 6 + phase) * 0.12 : Math.sin(t * 1.5 + phase) * 0.03;
      const b = 1 + Math.sin(t * 2 + phase) * 0.015;
      v.body.scale.y = (v.body.scale.x) * b;
    }
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(clickable, true)[0];
    return hit ? hit.object.userData.agentId : null;
  }

  return { camera, controls, home, resize, clampView, buildGround, buildHouse, buildTrees, buildPerson, placePerson, animatePerson, pick };
}
