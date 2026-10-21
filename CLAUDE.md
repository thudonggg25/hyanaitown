# Thị trấn AI agent: ghi chú cho Claude làm tiếp dự án này

Người dùng: hyan (GitHub thudonggg25). Viết tiếng Việt, câu ngắn, dễ hiểu. Máy Windows, thư mục game ở `E:\Hyanie Little World`.

## Nguồn gốc

hyan xem một clip TikTok "Thị trấn solomi – mini AI marketing agent team": trang web 3D góc chéo, mỗi ngôi nhà là một phòng ban, mỗi nhân vật là một subagent Claude Code, có bong bóng trạng thái, nhân vật đi bộ khi bàn giao, bảng Tổng quan (đang chạy / sắp làm / chờ duyệt / lỗi), danh sách việc chờ duyệt (mã kiểu SOL-025), nhật ký theo ngày, các nút Dừng xoay, Tên, Bong bóng, Toàn cảnh, Tổng quan, Tự chạy, 1 bước duyệt. Mô hình từ Kenney và KayKit (CC0).

## Kết quả nghiên cứu (21/10/2026)

- Chưa có repo nổi tiếng nào giống hẳn clip. Pixel Agents (pixel-agents-hq/pixel-agents, 9,8k sao, MIT) là 2D pixel, không có phòng ban / cổng duyệt / nhật ký. paulrobello/claude-office (576 sao) 2D có Kanban.
- Repo 3D gần clip nhất đều rất nhỏ, đáng đọc để học: niklan1110/agentic-office (Three.js, tạo `.claude/agents` từ skill), natansalvadorligabo/agents-at-work (duyệt quyền ngay trên trang 3D), regisBafutwabo/agent-office.
- Không cần game engine: three.js + server Node nhỏ + hooks `http` của Claude Code. Godot để dành cho game Hyan World.
- hyan chọn: **tự viết bản 3D như clip**. Phòng ban chưa chốt, tạm dùng 7 phòng marketing như clip.

## Đã làm (bản mẫu 0.1)

- `server.js`: Node thuần, không gói phụ thuộc, cổng 4545. Nhận hooks ở `POST /hook`, đẩy trạng thái qua SSE `GET /events`, lưu `data/status.json`, `data/board.json`, `data/log.jsonl`.
  - Giao việc: PreToolUse của công cụ Agent/Task ở phiên chính tạo mã việc (HY-001…), SubagentStart trả `additionalContext` báo mã việc cho subagent.
  - Bàn giao: agent vừa xong trong 25 giây đi bộ sang nhà của agent kế tiếp.
  - Duyệt quyền: PermissionRequest được giữ tối đa `approvalHoldSeconds` (60s) chờ bấm trên trang, quá giờ thì Claude Code hỏi như thường.
  - Duyệt việc: `claude-template/.claude/town/board.js duyet "..."` tạo việc "Chờ duyệt" và chờ tới khi người dùng bấm.
- `demo.js`: nút Tự chạy giả lập cả quy trình bằng đúng sự kiện hooks thật.
- `web/`: three.js r169 kèm sẵn (`web/vendor`), camera chéo, nhà và nhân vật dựng bằng khối, bảng Tổng quan / Nhật ký / chi tiết agent, giao diện điện thoại.
- `claude-template/`: 7 agent, 9 skill, hooks trong `.claude/settings.json`, `CLAUDE.md` cho Điều phối với cổng duyệt.
- Đã chạy thử với Claude Code CLI thật: giao việc → bàn giao → QA gửi duyệt đều hiện đúng trên trang.

## Việc tiếp theo (gợi ý)

1. hyan chạy thử trên máy (bấm `chay-thi-tran.bat`) và chốt phòng ban.
2. Thay khối bằng mô hình Kenney (City Kit, Mini Characters) / KayKit dạng glTF. Lưu ý: máy cloud của Claude không tải được trang kenney.nl, cần tải trên máy hyan hoặc nguồn khác.
3. Hiệu ứng đẹp hơn: đường đi vòng theo đường lát, cầm phong bì khi bàn giao, ngày/đêm.
4. Nhiều phiên Claude Code cùng lúc (tách theo `session_id`).

## Quy tắc

- Không tự đăng, gửi gì ra ngoài; việc không hoàn tác được phải hỏi hyan.
- Giữ server không phụ thuộc gói ngoài để hyan chỉ cần Node là chạy được.
