#!/usr/bin/env node
// Lệnh nhỏ để agent nói chuyện với Thị trấn AI agent (server chạy ở localhost:4545).
//
//   node .claude/town/board.js duyet "Tiêu đề" --agent qa [--note "ghi chú"] [--no-wait]
//       Gửi một việc lên bảng với trạng thái "Chờ duyệt", rồi chờ người dùng bấm.
//       Thoát mã 0 = đã duyệt, 2 = bị từ chối, 3 = hết giờ chờ, 1 = lỗi.
//   node .claude/town/board.js cho <MÃ-VIỆC>        Chờ tiếp một việc đã gửi.
//   node .claude/town/board.js xem <MÃ-VIỆC>        Xem trạng thái một việc ngay, không chờ.
//   node .claude/town/board.js ds                   Liệt kê việc đang chờ duyệt và việc mới duyệt / từ chối.
//   node .claude/town/board.js ghi "Nội dung" --agent viet-bai [--bubble "chữ trên đầu"]
//       Ghi một dòng vào nhật ký (và đổi bong bóng nếu có).

const BASE = process.env.TOWN_URL || 'http://localhost:4545';
const args = process.argv.slice(2);
const cmd = args.shift();
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const flag = name => { const i = args.indexOf('--' + name); if (i >= 0) { args.splice(i, 1); return true; } return false; };

async function call(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function waitFor(id, maxMinutes = 9) {
  const end = Date.now() + maxMinutes * 60000;
  process.stdout.write(`Đang chờ người dùng duyệt ${id} trên trang thị trấn`);
  while (Date.now() < end) {
    const t = await call('GET', `/api/board/${id}`);
    if (t.status === 'approved') { console.log(`\nĐÃ DUYỆT ${id}.${t.note ? ' Ghi chú: ' + t.note : ''}`); return 0; }
    if (t.status === 'rejected') { console.log(`\nBỊ TỪ CHỐI ${id}.${t.note ? ' Lý do: ' + t.note : ''} Hãy dừng và báo lại cho Calm.`); return 2; }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\nHết giờ chờ ${id}. Chạy lại: node .claude/town/board.js cho ${id}`);
  return 3;
}

(async () => {
  try {
    if (cmd === 'duyet') {
      const agent = opt('agent'), note = opt('note'), noWait = flag('no-wait');
      const title = args.join(' ') || 'Việc cần duyệt';
      const t = await call('POST', '/api/board', { title, agent, note, status: 'waiting_approval' });
      console.log(`Đã gửi ${t.id}: ${t.title}`);
      process.exit(noWait ? 0 : await waitFor(t.id));
    } else if (cmd === 'cho') {
      process.exit(await waitFor(args[0]));
    } else if (cmd === 'xem') {
      const t = await call('GET', `/api/board/${args[0]}`);
      console.log(`${t.id} [${t.status}] ${t.title}${t.note ? ' · ' + t.note : ''}`);
    } else if (cmd === 'ds') {
      const s = await call('GET', '/api/state');
      const rows = s.board.filter(t => ['waiting_approval', 'approved', 'rejected'].includes(t.status));
      if (!rows.length) console.log('Không có việc nào chờ duyệt.');
      for (const t of rows) console.log(`${t.id} [${t.status}] ${t.title}${t.note ? ' · ' + t.note : ''}`);
    } else if (cmd === 'ghi') {
      const agent = opt('agent'), bubble = opt('bubble');
      await call('POST', '/api/log', { agent, text: args.join(' '), bubble });
      console.log('Đã ghi.');
    } else {
      console.log('Dùng: duyet "Tiêu đề" --agent <id> | cho <MÃ-VIỆC> | xem <MÃ-VIỆC> | ds | ghi "Nội dung" --agent <id>');
      process.exit(1);
    }
  } catch (e) {
    console.log(`Không nối được Thị trấn AI agent (${e.message}). Có thể server chưa chạy: mở thư mục agent-town và chạy "node server.js".`);
    process.exit(1);
  }
})();
