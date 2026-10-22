// Kéo – thả và đổi cỡ các bảng/thanh. Vị trí, kích thước lưu trong trình duyệt (localStorage).
// Màn hình hẹp (< 700px): giữ nguyên chỗ cũ, không kéo được, chỉ cuộn.
const KEY = 'town.layout';
const MOBILE = 700;
// sel: phần tử; handle: chỗ nắm để kéo (null = thêm nút nắm nhỏ); resize: có đổi cỡ không
const ITEMS = [
  { sel: '#chat', handle: '#chat-head', resize: true },
  { sel: '#notifs', handle: 'h2', resize: true },
  { sel: '#overview', handle: 'h2', resize: true },
  { sel: '#report', handle: 'h2', resize: true },
  { sel: '#log', handle: 'h2', resize: true },
  { sel: '#detail', handle: null, resize: true },
  { sel: '#topleft', handle: null, resize: false },
  { sel: '#topbar', handle: null, resize: false },
  { sel: '#leftbar', handle: null, resize: false },
];

let saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
const mobile = () => innerWidth < MOBILE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function apply(el) {
  const s = saved[el.id];
  const on = s && !mobile();
  el.classList.toggle('lay-moved', !!(on && s.x != null));
  el.classList.toggle('lay-sized', !!(on && s.w != null));
  if (!on) { el.style.left = el.style.top = el.style.width = el.style.height = el.style.maxHeight = ''; return; }
  if (s.w != null) {
    s.w = clamp(s.w, 200, innerWidth - 8); s.h = clamp(s.h, 90, innerHeight - 8);
    el.style.width = s.w + 'px'; el.style.height = s.h + 'px';
  }
  if (s.x != null) {
    const w = el.offsetWidth || s.w || 100, h = el.offsetHeight || s.h || 40;
    // giữ ít nhất một phần trong màn hình
    s.x = clamp(s.x, 0, Math.max(0, innerWidth - Math.min(w, innerWidth)));
    s.y = clamp(s.y, 0, Math.max(0, innerHeight - Math.min(h, 40)));
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    // bảng chưa đổi cỡ: không cho tràn khỏi đáy màn hình, phần thừa thì cuộn
    el.style.maxHeight = s.w == null && el.classList.contains('panel') ? Math.max(120, innerHeight - s.y - 8) + 'px' : '';
  }
}

function drag(e, el, mode) {
  if (mobile() || e.button > 0) return;
  if (mode === 'move' && e.target.closest('button,input,select,textarea,a')) return;
  e.preventDefault(); e.stopPropagation();
  const r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
  const s = saved[el.id] ||= {};
  const tgt = e.currentTarget; tgt.setPointerCapture?.(e.pointerId);
  document.body.classList.add('lay-dragging');
  if (mode === 'move' || s.x == null) { s.x = r.left; s.y = r.top; }
  const move = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (mode === 'move') {
      s.x = clamp(r.left + dx, 0, innerWidth - r.width); s.y = clamp(r.top + dy, 0, innerHeight - Math.min(r.height, 40));
    } else {
      s.x = r.left; s.y = r.top;
      s.w = clamp(r.width + dx, 200, innerWidth - r.left); s.h = clamp(r.height + dy, 90, innerHeight - r.top);
    }
    apply(el);
  };
  const up = () => {
    tgt.removeEventListener('pointermove', move); tgt.removeEventListener('pointerup', up); tgt.removeEventListener('pointercancel', up);
    document.body.classList.remove('lay-dragging'); save();
  };
  tgt.addEventListener('pointermove', move); tgt.addEventListener('pointerup', up); tgt.addEventListener('pointercancel', up);
}

export function initLayout() {
  for (const it of ITEMS) {
    const el = document.querySelector(it.sel); if (!el) continue;
    el.classList.add('lay');
    let h = it.handle && el.querySelector(it.handle);
    if (!h) {
      h = document.createElement('div'); h.className = 'lay-grip'; h.title = 'Kéo để di chuyển'; h.innerHTML = '⠿';
      el.prepend(h);
    }
    h.classList.add('lay-handle');
    h.addEventListener('pointerdown', e => drag(e, el, 'move'));
    if (it.resize) {
      const rz = document.createElement('div'); rz.className = 'lay-rz'; rz.title = 'Kéo để đổi cỡ';
      el.append(rz);
      rz.addEventListener('pointerdown', e => drag(e, el, 'size'));
    }
    // không để thao tác trên bảng lọt xuống bản đồ
    for (const t of ['pointerdown', 'wheel']) el.addEventListener(t, e => e.stopPropagation(), { passive: true });
    apply(el);
    // bảng đang ẩn: áp lại khi hiện ra (để kẹp theo cỡ thật)
    let shown = !el.classList.contains('hidden');
    new MutationObserver(() => { const now = !el.classList.contains('hidden'); if (now && !shown) apply(el); shown = now; }).observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { ITEMS.forEach(it => { const el = document.querySelector(it.sel); el && apply(el); }); save(); }, 80); });
}

export function resetLayout() {
  saved = {}; save();
  ITEMS.forEach(it => { const el = document.querySelector(it.sel); el && apply(el); });
}
