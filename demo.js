// Chế độ "Tự chạy": giả lập một quy trình marketing bằng đúng các sự kiện hooks
// mà Claude Code gửi, để xem thị trấn hoạt động khi chưa nối Claude Code.

const sleep = ms => new Promise(r => setTimeout(r, ms));
let running = false;

const topics = [
  'Video 30s: 3 mẹo pha matcha tại nhà',
  'Bài đăng: review bình giữ nhiệt mùa đông',
  'Chuỗi 5 bài: chăm cây trong văn phòng',
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
    let i = 0;
    while (isOn()) {
      const topic = topics[i++ % topics.length];
      ev('UserPromptSubmit', { prompt: topic });
      await step(2000);
      await delegate('nghien-cuu', `Nghiên cứu: ${topic}`, [
        ['Skill', { skill: 'research-competitors' }],
        ['WebSearch', { query: topic.split(':').pop().trim() }],
        ['Write', { file_path: 'research/PAIN_BOARD.md' }],
      ]);
      await delegate('viet-bai', `Viết kịch bản: ${topic}`, [
        ['Read', { file_path: 'research/PAIN_BOARD.md' }],
        ['Skill', { skill: 'topic-blueprint' }],
        ['Write', { file_path: 'drafts/kich-ban.md' }],
      ]);
      await delegate('thiet-ke', 'Lên ảnh bìa', [
        ['Read', { file_path: 'drafts/kich-ban.md' }],
        ['Write', { file_path: 'design/anh-bia.md' }],
      ]);
      await delegate('qa', 'Kiểm tra kịch bản + ảnh bìa', [
        ['Read', { file_path: 'drafts/kich-ban.md' }],
        ['Skill', { skill: 'qa-check' }],
      ]);

      // Cổng duyệt: chờ bạn bấm Duyệt (demo tự duyệt sau 30 giây)
      const t = api.needApproval(`Duyệt đăng: ${topic}`, 'qa');
      const t0 = Date.now();
      while (api.task(t.id).status === 'waiting_approval' && Date.now() - t0 < 30000) await step(800);
      if (api.task(t.id).status === 'rejected') { ev('Stop'); await step(4000); continue; }
      if (api.task(t.id).status === 'waiting_approval') {
        api.task(t.id).status = 'approved';
        ev('Notification', { message: `Demo tự duyệt ${t.id} sau 30 giây` });
      }

      await delegate('dang-bai', `Lên lịch đăng: ${topic}`, [
        ['Skill', { skill: 'schedule-post' }],
        ['Bash', { description: 'Đặt lịch đăng 19:00' }],
      ]);
      await delegate('so-lieu', 'Đo số liệu bài hôm qua', [
        ['WebFetch', { url: 'https://example.com/stats' }],
        ['Write', { file_path: 'reports/tuan-nay.md' }],
      ]);
      await delegate('tra-loi', 'Trả lời 12 comment mới', [
        ['Skill', { skill: 'reply-comments' }],
        ['Write', { file_path: 'replies/hom-nay.md' }],
      ]);
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
