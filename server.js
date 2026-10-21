// Thị trấn AI agent: server nhỏ, không cần cài thêm gói nào.
// - Nhận sự kiện từ hooks của Claude Code (POST /hook)
// - Giữ trạng thái: agent, bảng việc, việc chờ duyệt, nhật ký
// - Đẩy trạng thái lên trang web qua Server-Sent Events (GET /events)
// Chạy: node server.js   rồi mở http://localhost:4545

const http = require('http');
const fs = require('fs');
const path = require('path');
const { runDemo } = require('./demo');

const ROOT = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'town.config.json'), 'utf8'));
const PORT = Number(process.env.PORT) || config.port || 4545;
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });

// ---------- Trạng thái ----------
const now = () => new Date().toISOString();
const agents = {};
function makeAgent(def, isBoss = false, isGuest = false) {
  return {
    id: def.id, name: def.name, role: def.role || '', color: def.color || '#888',
    skills: def.skills || [], files: [...(def.files || [])],
    isBoss, isGuest, home: def.id,
    at: def.id,             // đang đứng ở phòng nào (khác home khi đi bàn giao)
    state: 'idle',          // idle | working | waiting | done | error
    bubble: isBoss ? 'Chờ việc' : 'Chờ việc',
    task: null, tools: [], updatedAt: now(),
  };
}
agents[config.boss.id] = makeAgent(config.boss, true);
for (const a of config.agents) agents[a.id] = makeAgent(a);

const boardFile = path.join(DATA, 'board.json');
let board = [];
try { board = JSON.parse(fs.readFileSync(boardFile, 'utf8')); } catch {}
let taskSeq = board.reduce((m, t) => Math.max(m, Number(String(t.id).split('-').pop()) || 0), 0);

const approvals = [];       // yêu cầu xin quyền đang chờ (PermissionRequest)
const log = [];
const logFile = path.join(DATA, 'log.jsonl');
try {
  const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').slice(-300);
  for (const l of lines) if (l) log.push(JSON.parse(l));
} catch {}

const settings = { demo: false };

function addLog(agentId, text, kind = 'info') {
  const e = { ts: now(), agent: agentId, text, kind };
  log.push(e);
  if (log.length > 500) log.shift();
  fs.appendFile(logFile, JSON.stringify(e) + '\n', () => {});
}
function saveBoard() { fs.writeFile(boardFile, JSON.stringify(board, null, 2), () => {}); }
function writeStatus() {
  // status.json: bản chụp trạng thái để công cụ khác (hoặc chính agent) đọc được
  fs.writeFile(path.join(DATA, 'status.json'), JSON.stringify(snapshot(), null, 2), () => {});
}

function newTask(title, agentId, status = 'queued') {
  taskSeq += 1;
  const t = {
    id: `${config.taskPrefix || 'HY'}-${String(taskSeq).padStart(3, '0')}`,
    title, agent: agentId, status, note: '', createdAt: now(), updatedAt: now(),
  };
  board.push(t);
  if (board.length > 300) board.shift();
  saveBoard();
  return t;
}
function setTask(t, status, note) {
  if (!t) return;
  t.status = status; t.updatedAt = now();
  if (note !== undefined) t.note = note;
  saveBoard();
}

function setAgent(id, patch) {
  const a = agents[id];
  if (!a) return;
  Object.assign(a, patch, { updatedAt: now() });
}

// Agent lạ (ví dụ Explore, general-purpose) đến làm khách ở quảng trường
function ensureAgent(id) {
  if (!id) return config.boss.id;
  if (agents[id]) return id;
  const palette = ['#8d99ae', '#a3b18a', '#cdb4db', '#b5838d', '#6d6875'];
  const g = makeAgent({ id, name: id, role: 'Agent khách (không có nhà riêng)',
    color: palette[Object.keys(agents).length % palette.length] }, false, true);
  g.home = config.boss.id; g.at = config.boss.id;
  agents[id] = g;
  return id;
}

// ---------- Gửi trạng thái lên trang web ----------
const clients = new Set();
function snapshot() {
  return {
    title: config.title, subtitle: config.subtitle, boss: config.boss.id,
    rooms: [config.boss.id, ...config.agents.map(a => a.id)],
    agents: Object.values(agents),
    board: board.slice(-80),
    approvals: approvals.map(({ resolve, timer, ...rest }) => rest),
    log: log.slice(-150), settings,
  };
}
let pushTimer = null;
function push() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const data = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of clients) res.write(data);
    writeStatus();
  }, 60);
}

// ---------- Đọc sự kiện hooks ----------
const recentStops = {};     // agentId -> thời điểm vừa xong (để vẽ cảnh bàn giao)
const runningByAgent = {};  // agentId -> task đang chạy

function shortPath(p) { return p ? String(p).replace(/\\/g, '/').split('/').slice(-2).join('/') : ''; }
function toolBubble(name, input = {}) {
  switch (name) {
    case 'Read': return `Đọc ${shortPath(input.file_path)}`;
    case 'Write': return `Viết ${shortPath(input.file_path)}`;
    case 'Edit': case 'MultiEdit': return `Sửa ${shortPath(input.file_path)}`;
    case 'Grep': case 'Glob': return `Tìm trong file: ${input.pattern || ''}`;
    case 'WebSearch': return `Tìm trên web: ${input.query || ''}`;
    case 'WebFetch': return `Đọc trang web`;
    case 'Bash': return `Chạy lệnh: ${(input.description || input.command || '').slice(0, 40)}`;
    case 'Skill': return `Dùng kỹ năng /${input.skill || input.name || ''}`;
    case 'Task': case 'Agent': return `Giao việc cho ${input.subagent_type || 'agent'}`;
    default:
      if (/^mcp__linear/i.test(name)) return /comment/i.test(name) ? 'Trả lời trên Linear' : /update|save|create/i.test(name) ? 'Cập nhật Linear' : 'Đọc Linear';
      return `Dùng ${name}`;
  }
}
function relPath(p, cwd) {
  if (!p) return '';
  const f = String(p).replace(/\\/g, '/'), c = String(cwd || '').replace(/\\/g, '/').replace(/\/$/, '');
  return c && f.toLowerCase().startsWith(c.toLowerCase() + '/') ? f.slice(c.length + 1) : shortPath(f);
}
function trackFile(a, input = {}, cwd) {
  const f = relPath(input.file_path, cwd);
  if (f && !a.files.includes(f)) { a.files.push(f); if (a.files.length > 12) a.files.shift(); }
}
function agentOf(ev) {
  return ev.agent_type ? ensureAgent(ev.agent_type) : config.boss.id;
}

function handleHook(ev) {
  let reply = {};
  const name = ev.hook_event_name;
  const boss = config.boss.id;
  switch (name) {
    case 'SessionStart':
      setAgent(boss, { state: 'idle', bubble: 'Mở ca làm việc' });
      addLog(boss, 'Bắt đầu phiên làm việc');
      break;
    case 'UserPromptSubmit': {
      // Thông báo nội bộ khi subagent chạy nền xong, không phải yêu cầu của người dùng
      if (/^\s*<task-notification/.test(ev.prompt || '')) break;
      const p = String(ev.prompt || '').replace(/\s+/g, ' ').slice(0, 80);
      setAgent(boss, { state: 'working', bubble: `Nhận yêu cầu: ${p}` });
      addLog(boss, `Nhận yêu cầu: ${p}`);
      break;
    }
    case 'PreToolUse': {
      const id = agentOf(ev);
      const a = agents[id];
      const input = ev.tool_input || {};
      if ((ev.tool_name === 'Task' || ev.tool_name === 'Agent') && !ev.agent_type) {
        // Sếp giao việc cho một phòng
        const target = ensureAgent(input.subagent_type || 'general-purpose');
        const title = input.description || String(input.prompt || '').slice(0, 60) || 'Việc mới';
        const t = newTask(title, target, 'running');
        runningByAgent[target] = t;
        setAgent(target, { task: t.id });
        setAgent(boss, { state: 'working', bubble: `Giao ${t.id} cho ${agents[target].name}` });
        addLog(boss, `Giao ${t.id} "${title}" cho ${agents[target].name}`, 'handoff');
        break;
      }
      a.tools.unshift({ ts: now(), text: toolBubble(ev.tool_name, input) });
      a.tools.length = Math.min(a.tools.length, 10);
      trackFile(a, input, ev.cwd);
      setAgent(id, { state: 'working', bubble: toolBubble(ev.tool_name, input) });
      break;
    }
    case 'PostToolUseFailure': {
      const id = agentOf(ev);
      setAgent(id, { bubble: `Lỗi khi dùng ${ev.tool_name}` });
      addLog(id, `Lỗi khi dùng ${ev.tool_name}`, 'error');
      break;
    }
    case 'PostToolUse': {
      if ((ev.tool_name === 'Task' || ev.tool_name === 'Agent') && !ev.agent_type) {
        const target = (ev.tool_input || {}).subagent_type;
        const t = target && runningByAgent[target];
        if (t && t.status === 'running') setTask(t, 'done');
      }
      break;
    }
    case 'SubagentStart': {
      const id = ensureAgent(ev.agent_type);
      const t = runningByAgent[id];
      // Ai vừa xong việc trong 25 giây qua thì mang kết quả sang phòng này
      for (const [from, ts] of Object.entries(recentStops)) {
        if (from !== id && Date.now() - ts < 25000 && agents[from] && !agents[from].isGuest) {
          delete recentStops[from];
          setAgent(from, { at: agents[id].home, state: 'working',
            bubble: `Mang kết quả sang ${agents[id].name}` });
          addLog(from, `Bàn giao kết quả cho ${agents[id].name}`, 'handoff');
          setTimeout(() => { setAgent(from, { at: agents[from].home, state: 'idle', bubble: 'Xong, về phòng' }); push(); }, 7000);
        }
      }
      setAgent(id, { state: 'working', at: agents[id].home, bubble: t ? `Nhận ${t.id}: ${t.title}` : 'Nhận việc mới', task: t ? t.id : null });
      addLog(id, t ? `Bắt đầu ${t.id}: ${t.title}` : 'Bắt đầu việc mới', 'start');
      // Báo cho subagent biết mã việc của nó
      if (t) reply = { hookSpecificOutput: { hookEventName: 'SubagentStart',
        additionalContext: `Mã việc của bạn trên bảng thị trấn: ${t.id} ("${t.title}"). Ghi mã này ở đầu file kết quả.` } };
      break;
    }
    case 'SubagentStop': {
      const id = ensureAgent(ev.agent_type);
      const t = runningByAgent[id];
      if (t) { setTask(t, 'done'); delete runningByAgent[id]; }
      recentStops[id] = Date.now();
      setAgent(id, { state: 'done', bubble: t ? `Xong ${t.id}` : 'Xong việc' });
      addLog(id, t ? `Xong ${t.id}: ${t.title}` : 'Xong việc', 'done');
      setTimeout(() => {
        const a = agents[id];
        if (a && a.state === 'done') { setAgent(id, { state: 'idle', bubble: 'Chờ việc', at: a.home }); push(); }
      }, 20000);
      break;
    }
    case 'TaskCreated': {
      const title = ev.subject || ev.task_subject || (ev.task && ev.task.subject) || 'Việc mới';
      newTask(title, agentOf(ev), 'queued');
      break;
    }
    case 'TaskCompleted': {
      const title = ev.subject || ev.task_subject || (ev.task && ev.task.subject);
      const t = [...board].reverse().find(x => x.title === title && x.status !== 'done');
      if (t) setTask(t, 'done');
      break;
    }
    case 'Notification':
      setAgent(boss, { state: 'waiting', bubble: String(ev.message || 'Đang chờ bạn').slice(0, 70) });
      break;
    case 'Stop':
      setAgent(boss, { state: 'idle', bubble: 'Xong lượt, chờ việc' });
      addLog(boss, 'Xong một lượt làm việc', 'done');
      break;
    case 'StopFailure':
      setAgent(boss, { state: 'error', bubble: 'Gặp lỗi, dừng lại' });
      addLog(boss, 'Lượt làm việc bị lỗi', 'error');
      break;
  }
  push();
  return reply;
}

// Xin quyền: giữ yêu cầu lại tới khi bạn bấm Duyệt / Từ chối trên trang
function handlePermission(ev, res) {
  const id = agentOf(ev);
  const input = ev.tool_input || {};
  const item = {
    id: 'Q' + Date.now().toString(36), agent: id, tool: ev.tool_name,
    summary: toolBubble(ev.tool_name, input), detail: JSON.stringify(input).slice(0, 400), ts: now(),
  };
  setAgent(id, { state: 'waiting', bubble: `Giơ tay xin quyền: ${item.summary}` });
  addLog(id, `Xin quyền: ${item.summary}`, 'approval');
  const finish = (behavior, message) => {
    clearTimeout(item.timer);
    const i = approvals.indexOf(item);
    if (i >= 0) approvals.splice(i, 1);
    if (behavior) {
      setAgent(id, { state: 'working', bubble: behavior === 'allow' ? 'Được duyệt, làm tiếp' : 'Bị từ chối' });
      addLog(id, behavior === 'allow' ? `Được duyệt: ${item.summary}` : `Bị từ chối: ${item.summary}`, 'approval');
      const decision = behavior === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: message || 'Người dùng từ chối trên Thị trấn AI agent' };
      sendJson(res, 200, { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } });
    } else {
      // Hết giờ: trả về rỗng để Claude Code hỏi bạn như bình thường
      setAgent(id, { bubble: 'Chờ bạn trả lời trong Claude Code' });
      sendJson(res, 200, {});
    }
    push();
  };
  item.resolve = finish;
  item.timer = setTimeout(() => finish(null), (config.approvalHoldSeconds || 60) * 1000);
  res.on('close', () => { if (approvals.includes(item)) { approvals.splice(approvals.indexOf(item), 1); push(); } });
  approvals.push(item);
  push();
}

// ---------- HTTP ----------
function sendJson(res, code, obj) {
  if (res.writableEnded) return;
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.svg': 'image/svg+xml' };

const api = {
  // Sự kiện từ hooks của Claude Code
  'POST /hook': async (req, res) => {
    const ev = await readBody(req);
    if (ev.hook_event_name === 'PermissionRequest') return handlePermission(ev, res);
    let out = {};
    try { out = handleHook(ev) || {}; } catch (e) { console.error(e); }
    sendJson(res, 200, out);
  },
  'GET /api/state': (req, res) => sendJson(res, 200, snapshot()),
  // Duyệt / từ chối một yêu cầu xin quyền hoặc một việc trên bảng
  'POST /api/decide': async (req, res) => {
    const { id, approve, note } = await readBody(req);
    const q = approvals.find(x => x.id === id);
    if (q) { q.resolve(approve ? 'allow' : 'deny', note); return sendJson(res, 200, { ok: true }); }
    const t = board.find(x => x.id === id);
    if (t && t.status === 'waiting_approval') {
      setTask(t, approve ? 'approved' : 'rejected', note || '');
      addLog(t.agent, `${approve ? 'Bạn đã duyệt' : 'Bạn đã từ chối'} ${t.id}: ${t.title}`, 'approval');
      setAgent(t.agent, { state: approve ? 'working' : 'idle', bubble: approve ? `${t.id} được duyệt, làm tiếp` : `${t.id} bị trả lại` });
      push();
      return sendJson(res, 200, { ok: true });
    }
    sendJson(res, 404, { ok: false, error: 'Không tìm thấy' });
  },
  // Agent tạo việc cần duyệt (qua .claude/town/board.js)
  'POST /api/board': async (req, res) => {
    const { title, agent, status, note } = await readBody(req);
    const id = ensureAgent(agent || config.boss.id);
    const t = newTask(title || 'Việc mới', id, status || 'waiting_approval');
    if (note) t.note = note;
    if (t.status === 'waiting_approval') {
      setAgent(id, { state: 'waiting', bubble: `Chờ bạn duyệt ${t.id}` });
      addLog(id, `Gửi ${t.id} "${t.title}" chờ bạn duyệt`, 'approval');
    } else addLog(id, `Thêm việc ${t.id}: ${t.title}`);
    push();
    sendJson(res, 200, t);
  },
  'POST /api/log': async (req, res) => {
    const { agent, text, bubble } = await readBody(req);
    const id = ensureAgent(agent || config.boss.id);
    if (text) addLog(id, text);
    if (bubble) setAgent(id, { bubble });
    push();
    sendJson(res, 200, { ok: true });
  },
  'POST /api/demo': async (req, res) => {
    const { on } = await readBody(req);
    settings.demo = !!on;
    if (settings.demo) runDemo({ handleHook, api: demoApi, isOn: () => settings.demo });
    push();
    sendJson(res, 200, settings);
  },
  'POST /api/clear': async (req, res) => {
    board = []; taskSeq = 0; log.length = 0; saveBoard(); fs.writeFile(logFile, '', () => {});
    for (const a of Object.values(agents)) Object.assign(a, { state: 'idle', task: null, tools: [], at: a.home,
      bubble: a.isBoss ? 'Chờ việc' : 'Chờ việc' });
    push();
    sendJson(res, 200, { ok: true });
  },
};

// Bản demo dùng chung hàm với hooks thật, nên demo chạy được là phần thật cũng chạy được
const demoApi = {
  needApproval(title, agent) {
    const id = ensureAgent(agent);
    const t = newTask(title, id, 'waiting_approval');
    setAgent(id, { state: 'waiting', bubble: `Chờ bạn duyệt ${t.id}` });
    addLog(id, `Gửi ${t.id} "${t.title}" chờ bạn duyệt`, 'approval');
    push();
    return t;
  },
  task: id => board.find(t => t.id === id),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const key = `${req.method} ${url.pathname}`;
  if (key === 'GET /events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clients.delete(res); clearInterval(ping); });
    return;
  }
  const m = url.pathname.match(/^\/api\/board\/([\w-]+)$/);
  if (req.method === 'GET' && m) {
    const t = board.find(x => x.id === m[1]);
    return t ? sendJson(res, 200, t) : sendJson(res, 404, { error: 'Không tìm thấy' });
  }
  if (api[key]) return api[key](req, res);
  if (req.method !== 'GET') return sendJson(res, 404, { error: 'Không có' });
  // File tĩnh trong thư mục web/
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(ROOT, 'web', rel));
  if (!file.startsWith(path.join(ROOT, 'web'))) return sendJson(res, 403, {});
  if (rel === 'town.config.json') { res.writeHead(200, { 'Content-Type': MIME['.json'] }); return res.end(JSON.stringify(config)); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Không có'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ${config.title} đang chạy: http://localhost:${PORT}\n`);
  console.log('  Bấm "Tự chạy" trên trang để xem bản demo.');
  console.log('  Ctrl+C để tắt.\n');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.log(`\n  Cổng ${PORT} đang bận: có thể thị trấn đã chạy rồi. Mở http://localhost:${PORT} hoặc tắt cửa sổ cũ.\n`);
  else console.error(e);
  process.exit(1);
});
