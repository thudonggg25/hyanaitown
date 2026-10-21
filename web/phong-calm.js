// Các cửa sổ đọc giữa màn hình: Phòng Calm (giao việc, đọc trả lời đầy đủ, chọn phương án),
// hộp "Calm hỏi bạn", chi tiết một việc, nhật ký đầy đủ.
import { md } from './md.js';
import * as sound from './sound.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hhmm = ts => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const dayOf = ts => new Date(ts).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(r => r.json()).catch(() => ({}));
const statusText = { running: 'Đang chạy', queued: 'Sắp làm', waiting_approval: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị trả lại', done: 'Xong', error: 'Lỗi' };

let ctx = null;           // { getState, nameOf, toast, onUnread }
let msgs = [];            // hội thoại đã tải
let status = { running: false, queue: 0 };
let showSteps = true;
let unread = 0;
let loaded = false;

// ---------- Cửa sổ giữa màn hình dùng chung ----------
export function openModal(id) {
  for (const m of document.querySelectorAll('.modal-wrap')) if (m.id !== id) m.classList.add('hidden');
  $('#' + id).classList.remove('hidden');
  document.body.classList.add('modal-open');
}
export function closeModal(id) {
  $('#' + id).classList.add('hidden');
  if (!document.querySelector('.modal-wrap:not(.hidden)')) document.body.classList.remove('modal-open');
}
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = [...document.querySelectorAll('.modal-wrap:not(.hidden)')].pop();
  if (open) closeModal(open.id);
});
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) closeModal(c.dataset.close);
});

// ---------- Lựa chọn trong câu trả lời ----------
// Khối ```lua-chon {json}``` ở cuối câu trả lời; không có thì đoán từ danh sách 1. 2. 3. cuối bài
export function parseChoices(text) {
  const t = String(text || '');
  const m = t.match(/```lua-chon\s*([\s\S]*?)```/);
  if (m) {
    try {
      const j = JSON.parse(m[1]);
      const opts = (j.lua_chon || j.options || []).map(o => typeof o === 'string' ? { nhan: o } : o).filter(o => o.nhan);
      if (opts.length) return { body: t.replace(m[0], '').trim(), question: j.cau_hoi || '', options: opts };
    } catch {}
    return { body: t.replace(m[0], '').trim(), question: '', options: [] };
  }
  if (!/[?？]|chọn|lựa chọn/i.test(t)) return { body: t, question: '', options: [] };
  const lines = t.split('\n');
  let end = lines.length - 1, opts = [];
  // tìm danh sách đánh số gần cuối bài
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 25; i--) {
    const mm = lines[i].match(/^\s*(?:\*\*)?(\d)[.)](?:\*\*)?\s+(.+)/);
    if (mm) { opts.unshift({ nhan: mm[2].replace(/\*\*/g, '').replace(/\s*[:：—-]\s.*$/, '').slice(0, 80), mo_ta: mm[2].replace(/\*\*/g, ''), so: mm[1] }); end = i; }
    else if (opts.length) break;
  }
  if (opts.length < 2 || opts.length > 6) opts = [];
  return { body: t, question: '', options: opts, guessed: true };
}
function choiceHtml(c, live) {
  if (!c.options.length) return '';
  return `<div class="choices${live ? ' live' : ''}">
    ${c.question ? `<div class="q">${esc(c.question)}</div>` : ''}
    ${c.options.map((o, i) => `<button class="opt${o.khuyen_dung ? ' rec' : ''}" ${live ? '' : 'disabled'} data-choose="${esc(o.so ? `Mình chọn ${o.so}: ${o.nhan}` : `Mình chọn: ${o.nhan}`)}">
      <span class="n">${i + 1}</span><span class="t"><b>${esc(o.nhan)}</b>${o.khuyen_dung ? '<em>Khuyên dùng</em>' : ''}${o.mo_ta && o.mo_ta !== o.nhan ? `<small>${esc(o.mo_ta)}</small>` : ''}</span></button>`).join('')}
    ${live ? '' : '<div class="done-note">Đã trả lời</div>'}
  </div>`;
}
// Câu hỏi còn chờ: tin Calm cuối cùng có lựa chọn và sau đó bạn chưa nói gì
function pendingChoice() {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'hyan') return null;
    if (m.role === 'calm') { const c = parseChoices(m.text); return c.options.length ? { msg: m, c } : null; }
  }
  return null;
}

// ---------- Phòng Calm ----------
function msgHtml(m, prev, liveId) {
  let html = '';
  if (!prev || dayOf(prev.ts) !== dayOf(m.ts)) html += `<div class="day">${esc(dayOf(m.ts))}</div>`;
  const src = m.source === 'claude-code' ? '<span class="src">gõ trong Claude Code</span>' : '';
  if (m.role === 'hyan') return html + `<div class="m hyan" data-id="${m.id}"><div class="who">Bạn ${src}<time>${hhmm(m.ts)}</time></div><div class="txt">${md(m.text)}</div></div>`;
  if (m.role === 'calm') {
    const c = parseChoices(m.text);
    return html + `<div class="m calm" data-id="${m.id}"><img class="av" src="assets/ui/icon-mail.webp" alt=""><div class="bub"><div class="who">Calm ${src}<time>${hhmm(m.ts)}</time></div>
      <div class="txt md">${md(c.body)}</div>${choiceHtml(c, m.id === liveId)}</div></div>`;
  }
  if (m.role === 'step') return html + `<details class="m step${m.error ? ' err' : ''}" data-id="${m.id}"><summary><span class="ic">${m.error ? '⚠' : '⚙'}</span>${esc(m.text)}<time>${hhmm(m.ts)}</time></summary>
    ${m.input ? `<div class="io"><b>Đầu vào</b><pre>${esc(m.input)}</pre></div>` : ''}${m.output ? `<div class="io"><b>Kết quả</b><pre>${esc(m.output)}</pre></div>` : ''}</details>`;
  if (m.role === 'end') return html + `<div class="m end">— ${esc(m.text)} —</div>`;
  return html + `<div class="m sys">${md(m.text)}</div>`;
}
function renderRoom(scroll) {
  if (!loaded) return;
  const box = $('#calm-msgs');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const pc = pendingChoice();
  let html = '', prev = null;
  for (const m of msgs) {
    if (m.role === 'step' && !showSteps) continue;
    html += msgHtml(m, prev, pc?.msg.id);
    prev = m;
  }
  box.innerHTML = html || '<div class="empty-room">Chưa có cuộc trò chuyện nào. Gõ việc bạn muốn giao cho Calm ở ô bên dưới, Calm sẽ chia việc cho cả đội.</div>';
  if (scroll || nearBottom) box.scrollTop = box.scrollHeight;
  renderStatus();
}
function renderStatus() {
  const s = status;
  $('#calm-status').innerHTML = s.running
    ? `<span class="dot busy"></span>Calm đang làm${s.queue ? ` · còn ${s.queue} tin chờ` : ''}<span class="typing"><i></i><i></i><i></i></span>`
    : '<span class="dot"></span>Calm đang rảnh, sẵn sàng nhận việc';
  $('#calm-stop').classList.toggle('hidden', !s.running);
  $('#calm-dir').textContent = s.dir ? s.dir : 'chưa chọn';
  $('#calm-dirbox').classList.toggle('warn', !s.dir);
}
async function loadHistory() {
  const j = await fetch('/api/chat?limit=400').then(r => r.json()).catch(() => null);
  if (!j) return;
  msgs = j.messages; status = j.status; loaded = true;
  renderRoom(true);
}
async function send(text) {
  text = String(text || '').trim();
  if (!text) return;
  $('#calm-input').value = '';
  autoGrow();
  closeModal('ask-wrap');
  await post('/api/chat/send', { text });
}
export function openRoom() {
  openModal('calm-wrap');
  unread = 0; ctx.onUnread(0);
  if (!loaded) loadHistory(); else renderRoom(true);
  setTimeout(() => $('#calm-input').focus(), 50);
}
const autoGrow = () => { const t = $('#calm-input'); t.style.height = 'auto'; t.style.height = Math.min(220, t.scrollHeight) + 'px'; };

// Tin mới từ server (sự kiện "chat")
export function onChat(ev) {
  if (ev.type === 'status') { status = ev.status; if (loaded) renderStatus(); return; }
  if (ev.type === 'step-result') {
    const m = msgs.find(x => x.id === ev.stepId);
    if (m) { m.output = ev.output; m.error = ev.error; }
    if (loaded && !$('#calm-wrap').classList.contains('hidden')) renderRoom();
    return;
  }
  if (ev.type !== 'msg') return;
  const m = ev.msg;
  msgs.push(m);
  const roomOpen = !$('#calm-wrap').classList.contains('hidden');
  if (loaded && roomOpen) renderRoom();
  if (m.role === 'calm') {
    if (!roomOpen) { unread++; ctx.onUnread(unread); }
    const c = parseChoices(m.text);
    if (c.options.length) {
      showAsk(m, c);
      sound.play('choice');
    } else if (!roomOpen) {
      ctx.toast('calm', 'Calm', c.body.replace(/\*\*|`|^\s*[#>]+\s*|\|/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 160), openRoom);
      sound.play('calm');
    }
  }
}

// Hộp "Calm hỏi bạn": hiện giữa màn hình khi Calm đưa lựa chọn
function showAsk(m, c) {
  $('#ask-body').innerHTML = `<div class="md">${md(c.body)}</div>${choiceHtml(c, true)}`;
  openModal('ask-wrap');
  if (!loaded) loadHistory();
}

// ---------- Chi tiết một việc ----------
export async function openTask(id) {
  const t = await fetch('/api/board/' + encodeURIComponent(id)).then(r => r.ok ? r.json() : null).catch(() => null);
  const st = ctx.getState();
  if (!t) { ctx.toast('error', 'Không tìm thấy', `Không có việc ${id} trên bảng`); return; }
  const logs = (await fetch('/api/log').then(r => r.json()).catch(() => st.log)).filter(e => e.text.includes(t.id));
  const waiting = t.status === 'waiting_approval';
  $('#task-body').innerHTML = `
    <div class="task-head"><span class="tid">${esc(t.id)}</span><span class="tag ${t.status}">${statusText[t.status] || t.status}</span></div>
    <h3 class="task-title">${esc(t.title)}</h3>
    <div class="meta">Người làm: <b>${esc(ctx.nameOf(t.agent))}</b> · Tạo lúc ${hhmm(t.createdAt)} ${new Date(t.createdAt).toLocaleDateString('vi-VN')} · Cập nhật ${hhmm(t.updatedAt)}</div>
    ${waiting ? `<div class="approve-row"><button class="ok" data-task-decide="${esc(t.id)}" data-ok="1">Duyệt</button><button class="no" data-task-decide="${esc(t.id)}" data-ok="0">Từ chối</button></div>` : ''}
    ${t.note ? `<section><h4>Ghi chú</h4><div class="md">${md(t.note)}</div></section>` : ''}
    ${t.brief ? `<section><h4>Calm giao việc</h4><div class="md">${md(t.brief)}</div></section>` : ''}
    ${t.steps?.length ? `<section><h4>Các bước đã làm (${t.steps.length})</h4><ol class="steps">${t.steps.map(s => `<li><time>${hhmm(s.ts)}</time>${esc(s.text)}</li>`).join('')}</ol></section>` : ''}
    ${t.result ? `<section><h4>Báo cáo kết quả</h4><div class="md">${md(t.result)}</div></section>` : ''}
    <section><h4>Diễn biến</h4>${logs.length ? `<ul class="tl">${logs.map(e => `<li><time>${hhmm(e.ts)}</time><b>${esc(ctx.nameOf(e.agent))}</b> ${esc(e.text)}</li>`).join('')}</ul>` : '<div class="empty">Chưa có.</div>'}</section>
    ${!t.brief && !t.result && !t.steps?.length ? '<p class="hint">Việc này được tạo trước khi game biết lưu chi tiết, hoặc là việc trong bản Tự chạy, nên chỉ có diễn biến.</p>' : ''}`;
  openModal('task-wrap');
}

// ---------- Nhật ký đầy đủ ----------
let fullLog = [];
export async function openFullLog() {
  fullLog = await fetch('/api/log').then(r => r.json()).catch(() => ctx.getState()?.log || []);
  const ids = [...new Set(fullLog.map(e => e.agent))];
  $('#flog-agent').innerHTML = '<option value="">Tất cả mọi người</option>' + ids.map(id => `<option value="${esc(id)}">${esc(ctx.nameOf(id))}</option>`).join('');
  renderFullLog();
  openModal('flog-wrap');
}
function renderFullLog() {
  const q = $('#flog-q').value.trim().toLowerCase(), who = $('#flog-agent').value, kind = $('#flog-kind').value;
  let html = '', day = '';
  const list = [...fullLog].reverse().filter(e => (!who || e.agent === who) && (!kind || e.kind === kind) && (!q || (e.text + ' ' + ctx.nameOf(e.agent)).toLowerCase().includes(q)));
  for (const e of list) {
    const d = dayOf(e.ts);
    if (d !== day) { html += `<div class="day">${esc(d)}</div>`; day = d; }
    const tid = (e.text.match(/\b[A-Z]{2,5}-\d{3,}\b/) || [])[0];
    html += `<div class="e ${esc(e.kind)}${tid ? ' link' : ''}"${tid ? ` data-task="${tid}"` : ''}><time>${hhmm(e.ts)}</time><span class="who">${esc(ctx.nameOf(e.agent))}</span><span class="txt">${esc(e.text)}</span></div>`;
  }
  $('#flog-body').innerHTML = html || '<div class="empty">Không có mục nào khớp.</div>';
  $('#flog-count').textContent = `${list.length} mục`;
}

// ---------- Khởi động ----------
export function initCalmRoom(c) {
  ctx = c;
  $('#calm-send').onclick = () => send($('#calm-input').value);
  $('#calm-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(e.target.value); }
  });
  $('#calm-input').addEventListener('input', autoGrow);
  $('#calm-stop').onclick = () => post('/api/chat/stop');
  $('#calm-new').onclick = async () => {
    if (!confirm('Bắt đầu cuộc trò chuyện mới với Calm? Calm sẽ không nhớ nội dung cuộc cũ (lịch sử vẫn còn để đọc).')) return;
    const r = await post('/api/chat/new');
    if (r.error) alert(r.error);
  };
  $('#calm-steps').onchange = e => { showSteps = e.target.checked; renderRoom(); };
  $('#calm-setdir').onclick = async () => {
    const d = prompt('Thư mục làm việc của đội Calm (nơi có CLAUDE.md và .claude của đội), ví dụ C:\\Users\\hyang\\Calm', status.dir || '');
    if (d === null) return;
    const r = await post('/api/chat/dir', { dir: d });
    if (!r.ok) alert(r.error || 'Không đặt được thư mục');
  };
  for (const b of document.querySelectorAll('[data-quick]')) b.onclick = () => send(b.dataset.quick);
  // Bấm nút lựa chọn (trong phòng hoặc trong hộp hỏi)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-choose]');
    if (b && !b.disabled) send(b.dataset.choose);
    const tk = e.target.closest('[data-task]');
    if (tk) openTask(tk.dataset.task);
    const d = e.target.closest('[data-task-decide]');
    if (d) post('/api/decide', { id: d.dataset.taskDecide, approve: d.dataset.ok === '1' }).then(() => openTask(d.dataset.taskDecide));
  });
  $('#ask-other').onclick = () => { closeModal('ask-wrap'); openRoom(); };
  for (const id of ['flog-q', 'flog-agent', 'flog-kind']) $('#' + id).addEventListener('input', renderFullLog);
  loadHistory();
}
