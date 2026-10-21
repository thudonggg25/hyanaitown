# Thị trấn AI agent (bản mẫu 0.1)

Một trang web 3D: mỗi ngôi nhà là một phòng ban, mỗi nhân vật là một subagent của Claude Code. Khi Claude Code làm việc, nhân vật đi lại, hiện bong bóng, bàn giao cho nhau, và việc cần duyệt hiện lên để bạn bấm Duyệt / Từ chối.

Không cần cài thêm gì ngoài Node.js (máy bạn đã có). Không cần game engine.

## 1. Xem thử ngay (chưa cần Claude Code)

1. Lấy repo này về máy, ví dụ `C:\Users\hyang\HyanAITown`.
2. Bấm đúp `chay-thi-tran.bat`. Trình duyệt mở http://localhost:4545.
3. Bấm **Tự chạy** để xem đội Helper làm một vòng: Tiếp nhận đọc Linear → lỗi thì Coder sửa → Thiết kế soát → QA → chờ bạn duyệt gộp. Đề xuất thì qua Sản phẩm → Anicca debate → chờ bạn duyệt nhận làm.
4. Khi có việc chờ duyệt, bấm **Duyệt** (hoặc **1 bước duyệt**). Không bấm thì sau 30 giây bản demo tự duyệt.

## 2. Nối với Claude Code thật (đội vận hành Helper)

1. Tạo thư mục cho Calm, ví dụ `C:\Users\hyang\HyanAITown\calm`, chép **toàn bộ** nội dung trong `claude-template\` vào (gồm thư mục ẩn `.claude` và file `.mcp.json`).
2. Trong thư mục đó, clone code Helper: `git clone https://github.com/thudonggg25/helper-web projects/helper-web`.
3. Mở thị trấn (`chay-thi-tran.bat`) và để cửa sổ đó chạy.
4. Mở Claude Code trong thư mục `calm`. Lần đầu gõ `/mcp` và đăng nhập Linear (cửa sổ trình duyệt hiện ra).
5. Gõ `/nhan-feedback` để Calm quét Linear và bắt đầu chia việc. Muốn Calm tự chạy theo giờ: bấm đúp `lich\cai-lich-windows.bat` (xem `lich\LICH-CALM.md`).
6. Anicca cần API key của OpenAI và Gemini (trả theo lượt dùng, khác gói ChatGPT / Gemini trả tháng). Đặt key thành biến môi trường `OPENAI_API_KEY`, `GEMINI_API_KEY` trên máy, không ghi vào file.

Thị trấn tắt thì Claude Code vẫn làm việc bình thường, chỉ là không có hình.

## Cái gì nằm ở đâu

| File | Làm gì |
|---|---|
| `town.config.json` | Tên thị trấn, danh sách phòng ban, màu, kỹ năng hiện trong bảng chi tiết |
| `server.js` | Server nhỏ nhận sự kiện từ Claude Code và đẩy lên trang |
| `demo.js` | Kịch bản cho nút Tự chạy |
| `web/` | Trang 3D (three.js đã kèm sẵn trong `web/vendor`, chạy không cần mạng) |
| `data/` | Tự tạo khi chạy: `status.json`, `board.json`, `log.jsonl` |
| `claude-template/.claude/agents/` | 8 agent: Anicca, Tiếp nhận, Sản phẩm, Thiết kế, Coder 1-3, QA (Calm là phiên chính) |
| `claude-template/.claude/skills/` | 12 kỹ năng (/nhan-feedback, /giao-viec, /debate, /soat-thiet-ke…) |
| `claude-template/.claude/town/debate.js` | Anicca hỏi GPT và Gemini |
| `claude-template/design/QUY-CHUAN-HELPER.md` | Quy chuẩn giao diện Helper rút từ code |
| `claude-template/lich/` | Lịch chạy định kỳ của Calm (Task Scheduler) |
| `claude-template/.mcp.json` | Kết nối Linear |
| `claude-template/.claude/settings.json` | Hooks gửi sự kiện tới http://localhost:4545/hook |
| `claude-template/.claude/town/board.js` | Lệnh để agent gửi việc chờ duyệt và đợi bạn bấm |
| `claude-template/CLAUDE.md` | Quy tắc cho Calm: luồng việc, 3 cổng duyệt, Linear |

## Hai kiểu duyệt

- **Duyệt việc**: Calm hoặc QA chạy `node .claude/town/board.js duyet "..." --no-wait`. Việc hiện ở "Chờ bạn duyệt". Calm làm việc khác trong lúc chờ và kiểm lại mỗi lần chạy định kỳ. Chỉ 3 chỗ cần bạn duyệt: nhận làm tính năng mới, gộp code vào main, đăng bản lên web.
- **Duyệt quyền**: khi Claude Code hỏi quyền chạy một lệnh, nhân vật giơ tay và yêu cầu hiện trên trang. Bạn có 60 giây để bấm trên trang (đổi ở `approvalHoldSeconds`); quá 60 giây thì Claude Code hỏi bạn như bình thường trong cửa sổ của nó.

## Đổi phòng ban

Sửa danh sách `agents` trong `town.config.json` (id, tên, màu, kỹ năng), rồi tạo file cùng tên trong `.claude/agents/` của dự án. `id` trong config phải trùng `name` trong file agent. Agent không có nhà (ví dụ Explore) sẽ đứng làm khách ở quảng trường.

## Giới hạn của bản mẫu

- Nhà và nhân vật đang dựng bằng khối đơn giản. Bước sau có thể thay bằng mô hình Kenney / KayKit (miễn phí, CC0).
- Chỉ chạy trên máy bạn (localhost), chưa xem được từ điện thoại ở xa.
- Mỗi lúc nên chạy một phiên Claude Code cho đội này; nhiều phiên cùng lúc sẽ dùng chung một thị trấn.
