// Giao việc thật từ bản đồ: chọn nhân vật rồi bấm vào một nhà.
// Server chạy `claude -p` (không giao diện) trong thư mục đội Calm với lời dặn riêng của từng phòng,
// rồi ghi kết quả lên bảng việc. Mỗi phòng chỉ chạy một việc cùng lúc.
const fs = require('fs');
const { spawn } = require('child_process');

// Lời dặn mặc định theo nhà; ghi đè được bằng "dispatch" trong town.config.json
const DEFAULT_PROMPTS = {
  'tiep-nhan': { title: 'Nhận feedback mới trên Linear', prompt: 'Lấy các feedback mới trên Linear, phân loại (lỗi / đề xuất / trùng) bằng /phan-loai-feedback, cập nhật BOARD.md và tóm tắt ngắn gọn những gì mới.' },
  'san-pham': { title: 'Chấm điểm đề xuất đang chờ', prompt: 'Xem các đề xuất tính năng đang chờ trong proposals/, chấm điểm giá trị / công sức / rủi ro bằng /danh-gia-de-xuat, rồi tóm tắt.' },
  'thiet-ke': { title: 'Xem các mục thiết kế đang chờ', prompt: 'Rà các mục thiết kế đang chờ duyệt, đối chiếu quy chuẩn giao diện, ghi nhận xét và tóm tắt những mục cần Hyan quyết.' },
  'calm': { title: 'Kiểm tra định kỳ', prompt: '/kiem-tra-dinh-ky' },
  'anicca': { title: 'Debate việc đang mở', prompt: 'Chọn vấn đề quan trọng nhất đang mở trên BOARD.md, chạy /debate để tìm lỗi và cách tối ưu, báo lại cho Calm.' },
  'coder': { title: 'Làm việc đã duyệt đầu tiên', prompt: 'Lấy việc đã được duyệt có ưu tiên cao nhất trên BOARD.md, làm nó, chạy kiểm tra, và tóm tắt thay đổi.' },
  'qa': { title: 'Kiểm thử thay đổi mới nhất', prompt: 'Kiểm thử các thay đổi mới nhất (git log / diff gần đây), chạy test có sẵn, ghi lỗi tìm được và tóm tắt kết quả.' },
};
const houseKey = id => (String(id).startsWith('coder') ? 'coder' : id);

function createDispatch({ config, calmDir, newTask, setTask, setAgent, addLog, push, agents }) {
  const running = {}; // house -> { proc, task }
  const plan = house => {
    const k = houseKey(house);
    return { ...(DEFAULT_PROMPTS[k] || { title: 'Việc mới', prompt: 'Xem có việc gì cần làm và làm nó.' }), ...(config.dispatch?.[k] || {}) };
  };

  function launch({ agent, house }) {
    const who = agents[agent], target = agents[house];
    if (!who || !target) return { ok: false, error: 'Không thấy nhân vật hoặc nhà này' };
    const k = houseKey(house);
    if (running[k]) return { ok: false, error: `Nhà này đang làm ${running[k].task.id}` };
    const cwd = calmDir();
    if (!cwd || !fs.existsSync(cwd)) return { ok: false, error: 'Chưa có thư mục làm việc của Calm (town.config.json → calm.dir)' };
    const p = plan(house);
    const t = newTask(`${p.title} (${who.name} → ${target.name})`, agent, 'running');
    t.brief = p.prompt; t.source = 'dispatch'; t.house = house;
    setAgent(agent, { at: house, state: 'working', task: t.id, bubble: `Đi giao ${t.id} ở ${target.name}` });
    addLog(agent, `Giao ${t.id} "${p.title}" ở ${target.name}`, 'handoff');
    const args = ['-p', p.prompt, '--output-format', 'json'];
    if (config.calm?.model) args.push('--model', config.calm.model);
    args.push('--permission-mode', config.dispatchPermissionMode || config.calm?.permissionMode || 'acceptEdits');
    let proc;
    try { proc = spawn(config.calm?.command || 'claude', args, { cwd, windowsHide: true, shell: process.platform === 'win32' }); }
    catch (e) { return finish(t, agent, false, 'Không chạy được Claude Code: ' + e.message); }
    running[k] = { proc, task: t };
    let out = '', err = '';
    proc.stdout.on('data', d => { out = (out + d).slice(-200000); });
    proc.stderr.on('data', d => { err = (err + d).slice(-4000); });
    proc.on('error', e => { err += e.message; });
    proc.on('close', code => {
      delete running[k];
      let result = out.trim();
      try { const j = JSON.parse(result); result = j.result || result; if (j.is_error) code = code || 1; } catch {}
      finish(t, agent, code === 0, code === 0 ? result : `Lỗi (mã ${code}). ${err.trim().slice(-1500)}`);
    });
    push();
    return { ok: true, task: t.id };
  }
  function finish(t, agent, ok, result) {
    t.result = String(result || '').slice(0, 20000);
    setTask(t, ok ? 'done' : 'error', String(result || '').replace(/\s+/g, ' ').slice(0, 140));
    const a = agents[agent];
    setAgent(agent, { state: ok ? 'done' : 'error', bubble: ok ? `Xong ${t.id}` : `${t.id} lỗi` });
    addLog(agent, `${ok ? 'Xong' : 'Lỗi'} ${t.id}: ${t.title}`, ok ? 'done' : 'error');
    push();
    setTimeout(() => { if (a && a.task === t.id) { setAgent(agent, { at: a.home, state: 'idle', bubble: 'Chờ việc' }); push(); } }, 8000);
    return { ok, task: t.id };
  }
  return {
    launch, plans: () => Object.fromEntries(Object.keys(agents).map(id => [id, plan(id)])),
    busy: () => Object.fromEntries(Object.entries(running).map(([k, r]) => [k, r.task.id])),
  };
}

// Lịch định kỳ (chạy bằng Task Scheduler qua claude-template/lich): nhận ra khi lượt theo lịch bắt đầu
function routineFor(config, prompt) {
  const m = String(prompt || '').trim().match(/^\/([\w-]+)/);
  return m && (config.routines || []).find(r => r.skill === m[1]);
}

module.exports = { createDispatch, routineFor, houseKey };
