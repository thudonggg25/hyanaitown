---
name: debate
description: Anicca: debate một phương án với GPT và Gemini rồi viết báo cáo cho Calm
---

1. Viết rõ vấn đề cần debate vào `debate/<MÃ>-de.md`: bối cảnh, phương án đang có, câu hỏi cụ thể. Không đưa khoá, mật khẩu, dữ liệu thật của người dùng vào.
2. Chạy: `node .claude/town/debate.js debate/<MÃ>-de.md --out debate/<MÃ>-tra-loi.md`. Script hỏi GPT và Gemini (key đặt trong biến môi trường `OPENAI_API_KEY`, `GEMINI_API_KEY`).
3. Đọc ý kiến, phản biện lại những điểm yếu (vòng 2 nếu cần, thêm `--round 2`).
4. Viết `debate/<MÃ>.md` cho Calm: **Kết luận** (một câu) · Điểm cả hai AI đồng ý · Điểm bất đồng và bạn nghiêng về bên nào · Lỗi hoặc rủi ro mới tìm ra · Đề xuất cụ thể cho team.
