# Thị trấn AI agent (bản mẫu 0.1)

Một trang web 3D: mỗi ngôi nhà là một phòng ban, mỗi nhân vật là một subagent của Claude Code. Khi Claude Code làm việc, nhân vật đi lại, hiện bong bóng, bàn giao cho nhau, và việc cần duyệt hiện lên để bạn bấm Duyệt / Từ chối.

Không cần cài thêm gì ngoài Node.js (máy bạn đã có). Không cần game engine.

## 1. Xem thử ngay (chưa cần Claude Code)

1. Chép thư mục `agent-town` về máy, ví dụ `E:\Hyanie Little World\agent-town`.
2. Bấm đúp `chay-thi-tran.bat`. Trình duyệt mở http://localhost:4545.
3. Bấm **Tự chạy** để xem đội marketing làm một vòng: nghiên cứu → viết → thiết kế → QA → chờ bạn duyệt → đăng → đo số liệu → trả lời comment.
4. Khi QA gửi duyệt, bấm **Duyệt** (hoặc **1 bước duyệt**). Không bấm thì sau 30 giây bản demo tự duyệt.

## 2. Nối với Claude Code thật

1. Tạo một thư mục dự án mới cho đội marketing, ví dụ `E:\Hyanie Little World\doi-marketing`.
2. Chép **toàn bộ nội dung** trong `agent-town\claude-template\` vào thư mục đó (gồm thư mục ẩn `.claude`, file `CLAUDE.md`, `BOARD.md`, `PAIN_BOARD.md`).
3. Mở thị trấn (`chay-thi-tran.bat`) và để cửa sổ đó chạy.
4. Mở Claude Code trong thư mục `doi-marketing` và ra việc, ví dụ: *"Làm video 30 giây về 3 mẹo pha matcha"*. Claude Code (Điều phối) sẽ giao cho từng phòng, và thị trấn cập nhật theo.

Thị trấn tắt thì Claude Code vẫn làm việc bình thường, chỉ là không có hình.

## Cái gì nằm ở đâu

| File | Làm gì |
|---|---|
| `town.config.json` | Tên thị trấn, danh sách phòng ban, màu, kỹ năng hiện trong bảng chi tiết |
| `server.js` | Server nhỏ nhận sự kiện từ Claude Code và đẩy lên trang |
| `demo.js` | Kịch bản cho nút Tự chạy |
| `web/` | Trang 3D (three.js đã kèm sẵn trong `web/vendor`, chạy không cần mạng) |
| `data/` | Tự tạo khi chạy: `status.json`, `board.json`, `log.jsonl` |
| `claude-template/.claude/agents/` | 7 phòng ban (subagent) |
| `claude-template/.claude/skills/` | Kỹ năng cho từng phòng (/research-competitors, /qa-check…) |
| `claude-template/.claude/settings.json` | Hooks gửi sự kiện tới http://localhost:4545/hook |
| `claude-template/.claude/town/board.js` | Lệnh để agent gửi việc chờ duyệt và đợi bạn bấm |
| `claude-template/CLAUDE.md` | Quy tắc cho Điều phối: quy trình và cổng duyệt |

## Hai kiểu duyệt

- **Duyệt việc** (như clip): QA chạy `node .claude/town/board.js duyet "..."`. Việc hiện ở "Chờ bạn duyệt", agent đợi tới khi bạn bấm. Không có "đã duyệt" thì Điều phối không giao cho phòng Đăng bài.
- **Duyệt quyền**: khi Claude Code hỏi quyền chạy một lệnh, nhân vật giơ tay và yêu cầu hiện trên trang. Bạn có 60 giây để bấm trên trang (đổi ở `approvalHoldSeconds`); quá 60 giây thì Claude Code hỏi bạn như bình thường trong cửa sổ của nó.

## Đổi phòng ban

Sửa danh sách `agents` trong `town.config.json` (id, tên, màu, kỹ năng), rồi tạo file cùng tên trong `.claude/agents/` của dự án. `id` trong config phải trùng `name` trong file agent. Agent không có nhà (ví dụ Explore) sẽ đứng làm khách ở quảng trường.

## Giới hạn của bản mẫu

- Nhà và nhân vật đang dựng bằng khối đơn giản. Bước sau có thể thay bằng mô hình Kenney / KayKit (miễn phí, CC0).
- Chỉ chạy trên máy bạn (localhost), chưa xem được từ điện thoại ở xa.
- Mỗi lúc nên chạy một phiên Claude Code cho đội này; nhiều phiên cùng lúc sẽ dùng chung một thị trấn.
