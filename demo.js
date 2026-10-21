// Chế độ "Tự chạy": giả lập một vòng vận hành Helper bằng đúng các sự kiện hooks
// mà Claude Code gửi, để xem thị trấn hoạt động khi chưa nối Claude Code.

const sleep = ms => new Promise(r => setTimeout(r, ms));
let running = false;

const items = [
  { kind: 'bug', title: 'Lỗi: nút Lưu ở Thu chi không phản hồi trên iPhone', ui: true },
  { kind: 'idea', title: 'Đề xuất: lọc công việc theo nhóm trên Trang chủ' },
  { kind: 'bug', title: 'Lỗi: nhắc việc Telegram gửi trùng hai lần', ui: false },
];

async function runDemo({ handleHook, api, isOn }) {
  if (running) return;
  running = true;
  const ev = (name, extra = {}) => handleHook({ hook_event_name: name, session_id: 'demo', ...extra });
  const step = async ms => { await sleep(ms); if (!isOn()) throw new Error('stop'); };

  async function delegate(agent, description, tools) {
    ev('PreToolUse', { tool_name: 'Agent', tool_input: { subagent_type: agent, description } });
    await step(1500);
    ev('SubagentStart', { agent_type: agent, agent_id: agent + Date.now() });
    for (const [tool, input] of tools) {
      await step(2600);
      ev('PreToolUse', { agent_type: agent, tool_name: tool, tool_input: input });
    }
    await step(2600);
    ev('SubagentStop', { agent_type: agent });
    ev('PostToolUse', { tool_name: 'Agent', tool_input: { subagent_type: agent } });
    await step(1800);
  }

  try {
    let i = 0, coder = 0;
    // Chờ bạn bấm Duyệt trên trang (demo tự duyệt sau 30 giây). Trả về false nếu bị từ chối.
    async function gate(title, agent) {
      const t = api.needApproval(title, agent);
      const t0 = Date.now();
      while (api.task(t.id).status === 'waiting_approval' && Date.now() - t0 < 30000) await step(800);
      if (api.task(t.id).status === 'rejected') return false;
      if (api.task(t.id).status === 'waiting_approval') {
        api.task(t.id).status = 'approved';
        ev('Notification', { message: `Demo tự duyệt ${t.id} sau 30 giây` });
      }
      return true;
    }
    async function code(item) {
      const who = `coder-${(coder++ % 3) + 1}`;
      await delegate(who, item.kind === 'bug' ? `Sửa: ${item.title.replace(/^Lỗi: /, '')}` : `Làm: ${item.title.replace(/^Đề xuất: /, '')}`, [
        ['Skill', { skill: item.kind === 'bug' ? 'sua-loi' : 'lam-tinh-nang' }],
        ['Grep', { pattern: 'onSave' }],
        ['Edit', { file_path: 'projects/wt/' + who + '/components/fund-txn-form.tsx' }],
        ['Bash', { description: 'Chạy test', command: 'node --test lib/*.test.mjs' }],
      ]);
      if (item.ui !== false) await delegate('thiet-ke', 'Soát cỡ chữ, nút, icon', [
        ['Skill', { skill: 'soat-thiet-ke' }],
        ['Read', { file_path: 'design/QUY-CHUAN-HELPER.md' }],
      ]);
      await delegate('qa', 'Kiểm tra nhánh trước khi gửi Hyan', [
        ['Skill', { skill: 'kiem-tra-pr' }],
        ['Bash', { description: 'Chạy test + build', command: 'npx tsc --noEmit' }],
      ]);
      if (await gate(`Duyệt gộp: ${item.title}`, 'qa'))
        ev('PreToolUse', { tool_name: 'mcp__linear__create_comment', tool_input: { body: 'Đã sửa xong, sẽ có trong bản tới' } });
    }

    while (isOn()) {
      const item = items[i++ % items.length];
      ev('UserPromptSubmit', { prompt: '/nhan-feedback' });
      await step(2000);
      await delegate('tiep-nhan', 'Phân loại feedback mới trên Linear', [
        ['mcp__linear__list_issues', { query: 'Feedback Helper Web' }],
        ['Skill', { skill: 'phan-loai-feedback' }],
        ['Write', { file_path: 'intake/hom-nay.md' }],
      ]);
      if (item.kind === 'bug') await code(item);
      else {
        await delegate('san-pham', `Chấm điểm: ${item.title}`, [
          ['Skill', { skill: 'danh-gia-de-xuat' }],
          ['Write', { file_path: 'proposals/de-xuat.md' }],
        ]);
        await delegate('anicca', 'Debate đề xuất với GPT và Gemini', [
          ['Skill', { skill: 'debate' }],
          ['Bash', { description: 'Hỏi GPT và Gemini', command: 'node .claude/town/debate.js' }],
          ['Write', { file_path: 'debate/bao-cao.md' }],
        ]);
        if (await gate(`Duyệt nhận làm: ${item.title}`, 'calm')) await code(item);
      }
      ev('Stop');
      await step(6000);
    }
  } catch (e) {
    if (e.message !== 'stop') console.error(e);
  } finally {
    running = false;
  }
}

module.exports = { runDemo };
