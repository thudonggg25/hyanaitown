#!/usr/bin/env node
// Anicca dùng lệnh này để hỏi GPT và Gemini cùng một vấn đề, rồi ghi câu trả lời ra file.
//
//   node .claude/town/debate.js <file-de-bai.md> --out <file-tra-loi.md> [--round 2]
//
// Vòng 2: mỗi AI đọc ý kiến của AI kia (lấy từ file --out của vòng 1) và phản biện lại.
// Key đặt trong biến môi trường, không ghi vào file:
//   OPENAI_API_KEY, GEMINI_API_KEY   (thiếu key nào thì bỏ qua AI đó)
//   OPENAI_MODEL, GEMINI_MODEL       (đổi model nếu muốn)
// Thoát mã 0 = có ít nhất một AI trả lời, 3 = không có key nào, 1 = lỗi.

const fs = require('fs');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const out = opt('out');
const round = Number(opt('round') || 1);
const file = args[0];
if (!file || !out) { console.log('Dùng: node .claude/town/debate.js <de-bai.md> --out <tra-loi.md> [--round 2]'); process.exit(1); }

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const SYSTEM = 'Bạn là chuyên gia phản biện phần mềm. Trả lời bằng tiếng Việt, ngắn gọn. ' +
  'Chỉ ra lỗi, rủi ro, chỗ chưa tối ưu và đề xuất cụ thể. Nói rõ điểm nào bạn chắc chắn, điểm nào chỉ là phỏng đoán.';

async function askGpt(prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.status);
  return j.choices[0].message.content;
}

async function askGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.status);
  return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
}

(async () => {
  const topic = fs.readFileSync(file, 'utf8');
  const prev = round > 1 && fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const pick = name => (prev.split(`## ${name}`).slice(1).pop() || '').split('\n## ')[0].split('\n# ')[0].trim();
  const prompt = other => round > 1
    ? `${topic}\n\n---\nĐây là ý kiến của một AI khác về vấn đề trên:\n\n${other}\n\nHãy phản biện: đồng ý điểm nào, không đồng ý điểm nào, vì sao. Rồi đưa kết luận cuối.`
    : topic;

  const jobs = [];
  if (process.env.OPENAI_API_KEY) jobs.push(['GPT', `${OPENAI_MODEL}`, askGpt(prompt(pick('Gemini')))]);
  if (process.env.GEMINI_API_KEY) jobs.push(['Gemini', `${GEMINI_MODEL}`, askGemini(prompt(pick('GPT')))]);
  if (!jobs.length) {
    console.log('Chưa có OPENAI_API_KEY hay GEMINI_API_KEY. Hãy tự phản biện và ghi rõ trong báo cáo là chưa debate được với AI ngoài.');
    process.exit(3);
  }

  let text = `# Vòng ${round}: ${new Date().toLocaleString('vi-VN')}\n`;
  let ok = 0;
  for (const [name, model, p] of jobs) {
    try { text += `\n## ${name}\n\n_(${model})_\n\n${await p}\n`; ok++; }
    catch (e) { text += `\n## ${name}\n\nLỗi khi hỏi ${name}: ${e.message}\n`; }
  }
  if (round > 1 && prev) text = `${prev}\n\n${text}`;
  fs.writeFileSync(out, text);
  console.log(`Đã ghi ${out} (${ok}/${jobs.length} AI trả lời).`);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('Lỗi:', e.message); process.exit(1); });
