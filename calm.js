// Phòng Calm: nói chuyện với Calm (Claude Code) ngay trong game.
// - Gửi lệnh: server chạy `claude -p` trong thư mục của đội, nối tiếp cùng một cuộc trò chuyện
//   (--resume), đọc từng tin Calm viết ra (stream-json) và đẩy lên trang ngay khi có.
// - Lưu toàn bộ hội thoại vào data/tro-chuyen.jsonl để đọc lại.
// - Phiên bạn tự gõ trong Claude Code hay phiên chạy theo lịch cũng được ghi lại, nhờ hooks
//   UserPromptSubmit (câu bạn hỏi) và Stop (câu Calm trả lời cuối lượt).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Calm đưa lựa chọn cho Hyan theo khối này để game hiện thành nút bấm
const CHOICE_GUIDE = [
  'Bạn đang nói chuyện với Hyan qua game "Thị trấn AI". Câu trả lời được hiện đầy đủ, có định dạng Markdown.',
  'Khi cần Hyan chọn giữa các phương án, đặt ở CUỐI câu trả lời một khối như sau (JSON hợp lệ, tiếng Việt):',
  '```lua-chon',
  '{"cau_hoi": "Câu hỏi ngắn", "lua_chon": [{"nhan": "Tên phương án", "mo_ta": "Chọn cái này thì điều gì xảy ra", "khuyen_dung": true}, {"nhan": "...", "mo_ta": "..."}]}',
  '```',
  'Game hiện mỗi phương án thành một nút; Hyan bấm nút nào thì tin tiếp theo là "Mình chọn: <nhan>".',
].join('\n');

function createCalm({ DATA, config, onChange }) {
  const FILE = path.join(DATA, 'tro-chuyen.jsonl');
  const STATE = path.join(DATA, 'phong-calm.json');
  let msgs = [];
  try { msgs = fs.readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).slice(-2000); } catch {}
  let seq = msgs.reduce((m, x) => Math.max(m, x.id || 0), 0);
  let st = { session: null, dir: null };
  try { st = { ...st, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch {}
  const saveState = () => fs.writeFile(STATE, JSON.stringify(st, null, 1), () => {});

  // Thư mục đội Calm: theo cài đặt trên trang, rồi theo town.config.json
  const dir = () => st.dir || config.calm?.dir || null;
  let run = null;        // lượt đang chạy: { proc, session, startedAt }
  let lastRun = null;    // lượt vừa xong, để bỏ qua hooks tới trễ của chính nó
  const queue = [];      // tin gửi lúc Calm đang bận, chạy lần lượt

  function add(m) {
    const e = { id: ++seq, ts: new Date().toISOString(), ...m };
    msgs.push(e);
    if (msgs.length > 3000) msgs = msgs.slice(-2000);
    fs.appendFile(FILE, JSON.stringify(e) + '\n', () => {});
    onChange({ type: 'msg', msg: e });
    return e;
  }
  const status = () => ({ running: !!run, queue: queue.length, session: st.session, dir: dir(), startedAt: run?.startedAt || null });
  const emitStatus = () => onChange({ type: 'status', status: status() });

  function toolText(name, input = {}) {
    const s = v => String(v ?? '').replace(/\s+/g, ' ').slice(0, 160);
    switch (name) {
      case 'Bash': case 'PowerShell': return `Chạy lệnh: ${s(input.description || input.command)}`;
      case 'Read': return `Đọc ${s(input.file_path)}`;
      case 'Write': return `Viết ${s(input.file_path)}`;
      case 'Edit': case 'MultiEdit': return `Sửa ${s(input.file_path)}`;
      case 'Grep': case 'Glob': return `Tìm: ${s(input.pattern)}`;
      case 'WebSearch': return `Tìm trên web: ${s(input.query)}`;
      case 'WebFetch': return `Đọc trang ${s(input.url)}`;
      case 'Task': case 'Agent': return `Giao việc cho ${s(input.subagent_type || 'agent')}: ${s(input.description)}`;
      case 'Skill': return `Dùng kỹ năng /${s(input.skill || input.name)}`;
      case 'TodoWrite': return 'Cập nhật danh sách việc';
      default: return `Dùng ${name.replace(/^mcp__\w+?__/, '')}`;
    }
  }
  const clip = (v, n = 6000) => { const t = typeof v === 'string' ? v : JSON.stringify(v, null, 1); return t.length > n ? t.slice(0, n) + '\n…(còn nữa)' : t; };

  function start(text) {
    const cwd = dir();
    if (!cwd || !fs.existsSync(cwd)) {
      add({ role: 'system', text: 'Chưa chọn thư mục làm việc của Calm, hoặc thư mục không có. Mở "Cài đặt phòng" trong phòng Calm để chọn.' });
      return;
    }
    const args = ['-p', text, '--output-format', 'stream-json', '--verbose', '--append-system-prompt', CHOICE_GUIDE];
    if (st.session) args.push('--resume', st.session);
    if (config.calm?.model) args.push('--model', config.calm.model);
    if (config.calm?.permissionMode) args.push('--permission-mode', config.calm.permissionMode);
    let proc;
    try { proc = spawn(config.calm?.command || 'claude', args, { cwd, windowsHide: true }); }
    catch (e) { add({ role: 'system', text: 'Không chạy được Claude Code: ' + e.message }); return next(); }
    run = { proc, session: st.session, startedAt: new Date().toISOString(), tools: {} };
    emitStatus();
    let buf = '', errBuf = '';
    proc.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line) try { onEvent(JSON.parse(line)); } catch {}
      }
    });
    proc.stderr.on('data', d => { errBuf = (errBuf + d).slice(-4000); });
    proc.on('error', e => { add({ role: 'system', text: 'Không chạy được Claude Code: ' + e.message }); });
    proc.on('close', code => {
      if (code && !run?.stopped && !run?.gotResult) add({ role: 'system', text: `Calm dừng giữa chừng (mã ${code}).` + (errBuf ? '\n\n```\n' + errBuf.trim().slice(-1500) + '\n```' : '') });
      lastRun = { session: run?.session, endedAt: Date.now() };
      run = null;
      emitStatus();
      next();
    });
  }
  function onEvent(ev) {
    if (ev.session_id && ev.session_id !== st.session) { st.session = ev.session_id; saveState(); }
    if (run && ev.session_id) run.session = ev.session_id;
    if (ev.type === 'assistant') {
      for (const c of ev.message?.content || []) {
        if (c.type === 'text' && c.text.trim()) add({ role: 'calm', text: c.text, session: ev.session_id, source: 'game' });
        if (c.type === 'tool_use') {
          const m = add({ role: 'step', text: toolText(c.name, c.input), tool: c.name, input: clip(c.input, 3000), session: ev.session_id });
          run.tools[c.id] = m.id;
        }
      }
    } else if (ev.type === 'user') {
      for (const c of ev.message?.content || []) {
        if (c.type !== 'tool_result') continue;
        const out = Array.isArray(c.content) ? c.content.map(x => x.text || '').join('\n') : c.content;
        onChange({ type: 'step-result', stepId: run?.tools[c.tool_use_id], output: clip(out || '', 6000), error: !!c.is_error });
        const m = msgs.find(x => x.id === run?.tools[c.tool_use_id]);
        if (m) { m.output = clip(out || '', 6000); m.error = !!c.is_error; }
      }
    } else if (ev.type === 'result') {
      if (run) run.gotResult = true;
      if (ev.is_error && ev.result) add({ role: 'system', text: 'Calm báo lỗi: ' + ev.result });
      add({ role: 'end', text: `Xong lượt · ${Math.round((ev.duration_ms || 0) / 1000)} giây`, session: ev.session_id });
    }
  }
  function next() {
    if (run || !queue.length) return;
    start(queue.shift());
  }

  return {
    status,
    history: (before, limit = 300) => {
      const list = before ? msgs.filter(m => m.id < before) : msgs;
      return list.slice(-limit);
    },
    send(text) {
      text = String(text || '').trim();
      if (!text) return { ok: false };
      add({ role: 'hyan', text, source: 'game' });
      if (run) { queue.push(text); emitStatus(); return { ok: true, queued: true }; }
      start(text);
      return { ok: true };
    },
    stop() {
      queue.length = 0;
      if (run) { run.stopped = true; try { run.proc.kill(); } catch {} add({ role: 'system', text: 'Bạn đã dừng Calm.' }); }
      emitStatus();
    },
    newSession() {
      if (run) return { ok: false, error: 'Calm đang làm, dừng trước đã' };
      st.session = null; saveState();
      add({ role: 'system', text: 'Bắt đầu cuộc trò chuyện mới.' });
      emitStatus();
      return { ok: true };
    },
    setDir(d) {
      d = String(d || '').trim();
      if (!d || !fs.existsSync(d)) return { ok: false, error: 'Không thấy thư mục này trên máy' };
      st.dir = d; st.session = null; saveState(); emitStatus();
      return { ok: true };
    },
    // Hooks từ phiên Claude Code khác (bạn gõ trực tiếp, hoặc chạy theo lịch)
    fromHook(ev) {
      if (run && (ev.session_id === run.session || !run.session)) return; // lượt do game chạy: đã ghi từ stream
      if (lastRun && ev.session_id === lastRun.session && Date.now() - lastRun.endedAt < 15000) return;
      if (ev.hook_event_name === 'UserPromptSubmit') {
        const p = String(ev.prompt || '');
        if (!p.trim() || /^\s*<task-notification/.test(p)) return;
        add({ role: 'hyan', text: p, session: ev.session_id, source: 'claude-code' });
      } else if (ev.hook_event_name === 'Stop' && ev.last_assistant_message) {
        add({ role: 'calm', text: ev.last_assistant_message, session: ev.session_id, source: 'claude-code' });
      }
    },
  };
}

module.exports = { createCalm };
