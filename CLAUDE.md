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
- `claude-template/`: lúc đầu 7 agent marketing; từ bản 0.2 là đội Helper (xem dưới).
- Đã chạy thử với Claude Code CLI thật: giao việc → bàn giao → QA gửi duyệt đều hiện đúng trên trang.

## Bản 0.2 (21/10/2026): đội vận hành Helper

hyan chốt: làm **web game** three.js (không làm client riêng), đội AI đầu tiên vận hành App Helper (repo thudonggg25/helper-web, Next/vinext trên Cloudflare). Kế hoạch: https://claude.ai/artifact/TKTkVRDM6i1pbFjALf8SZP

- Calm (phiên chính, boss) điều phối; Anicca (đối ngoại, debate GPT + Gemini qua `.claude/town/debate.js`, cần API key); Tiếp nhận (Linear view "Feedback Helper Web", workspace keepember); Sản phẩm; Thiết kế (`design/QUY-CHUAN-HELPER.md`); Coder 1-3 (git worktree `projects/wt/coder-N`, nhánh `calm/...`); QA.
- Calm được bình luận và đổi trạng thái trên Linear. 3 cổng duyệt của hyan: nhận làm tính năng mới, gộp vào main, đăng bản.
- Lịch: Task Scheduler trên PC trước (`lich/`), 1-2 tuần sau chuyển lên VPS (hyan đồng ý thuê nếu cần).

## Việc tiếp theo (gợi ý)

1. hyan chạy thử đội Helper trên PC, đăng nhập Linear qua `/mcp`, lấy API key OpenAI + Gemini cho Anicca.
2. Đồ họa: hyan làm moodboard + ảnh GPT theo prompt trong kế hoạch, tải mô hình Kenney / KayKit glTF; Claude lắp vào (máy cloud không tải được kenney.nl).
3. Xưởng Code thành một toà to có nhiều bàn thay vì 3 nhà riêng; nhân vật Hyan đi lại được để có cảm giác game.
4. Hiệu ứng: đường đi vòng theo đường lát, cầm phong bì khi bàn giao, ngày/đêm. Giảm khung hình khi tab ẩn.
5. Nhiều phiên Claude Code cùng lúc (tách theo `session_id`), cần khi chạy lịch song song với phiên tay.

## Quy tắc

- Không tự đăng, gửi gì ra ngoài; việc không hoàn tác được phải hỏi hyan.
- Giữ server không phụ thuộc gói ngoài để hyan chỉ cần Node là chạy được.

## Bản 0.3 (21/10/2026): đồ họa anime 2.5D

- `web/app.js` vẽ kiểu 2.5D: bản đồ `town_map_empty_7_plots` là ảnh nền phẳng, nhà và nhân vật là sprite nền trong suốt, sắp thứ tự vẽ theo y. Camera trực giao cố định góc (tranh vẽ sẵn góc nhìn nên không xoay), kéo để di chuyển, cuộn / chụm hai ngón để phóng to. Nút "Lướt" cho camera trôi chậm.
- Toạ độ ô đất, quảng trường trong `PLOTS` / `PLAZA` ở đầu `web/app.js` (pixel ảnh 1920×1080). 3 Coder ở chung "Xưởng Code".
- Nhân vật: bảng 4 dáng (thẳng, lưng, nghiêng trái, bước phải) cắt thành sprite sheet; đi bộ bằng 2 khung luân phiên + lật ngang, đi vòng qua quảng trường.
- Sprite tạo lại bằng `python3 tools/lam_sprite.py` (Pillow + numpy): xoá nền trắng bằng loang màu từ mép, ra `web/assets/sprites/`.

## Bản 0.4 (21/10/2026): chuyển động, âm thanh, prompt vẽ

- hyan chốt: tranh phẳng vẽ tay, camera không xoay. Đã thử 3D và 2.5D nghiêng, hyan không thích, đừng làm lại.
- Chuyển động (`stepPerson` trong `web/app.js`): bước đếm theo quãng đường (`STEP_LEN`), nhún, bẹp/vươn, ngả người theo hướng đi; đổi dáng bằng "xoay người" (bóp hẹp rồi nở, `TURN_TIME`) thay vì lật gương tức thì. Rảnh thì ngó nghiêng, chờ duyệt thì nhảy.
- Dáng đi nhiều khung: thêm `walk: { file, cols, rows: ['down','up','left','right'] }` vào nhân vật trong `sprites.json` là game tự dùng (thiếu hàng `right` thì lật hàng `left`).
- Âm thanh `web/sound.js`: Web Audio tự tạo (tin mới, cần duyệt, lỗi, xong việc, bàn giao, nhạc nền lo-fi), nút 🔊 có âm lượng, nhớ trong localStorage. Tiếng gắn với nhật ký thật (`announce` trong app.js), kèm thông báo nổi.
- Prompt GPT cho walk cycle và UI: `docs/PROMPT-GPT.md`. Ảnh hyan gửi lại phải commit vào repo, không để trong project files (ảnh lớn làm treo phiên).
- Ảnh do Claude tự vẽ bằng skill `create-image` (9router codex-image). Ảnh gốc ở `F:\AI-Workspace\hyanaitown-anh-2026-10-21\` (có `ve_buoc_di.sh`). Ảnh mẫu tham chiếu phải là PNG nền trắng (`ref/<mã>.png`) kèm mô tả chữ; dùng webp trong suốt thì model bỏ qua ảnh mẫu và vẽ sai người.
- Dáng đi: `python tools/lam_buoc_di.py <thư mục ảnh> <mã>...` (6 khung mỗi hướng, xuống/lên/trái; `coder-b=coder`, `khach=tiep-nhan` dùng chung).
- Giao diện vẽ tay: `python tools/lam_ui.py <thư mục ảnh>` cắt icon, nút 4 màu × 4 trạng thái, khung bảng, thẻ thông báo, biển gỗ ra `web/assets/ui/`; CSS dùng `border-image` ở cuối `web/style.css`.
- Đổi hướng kiểu game 2D: đổi khung ngay, không bóp hình (hyan chê bóp trông như tờ giấy); quay ngược hẳn thì qua khung nhìn thẳng 0,075 giây.
- Bảng "Cài đặt thông báo" (`web/settings.js`, nút Thông báo): bật/tắt thông báo và tiếng cho từng loại, chọn tiếng, tải tệp âm thanh lên (`POST /api/sounds/upload`, lưu `data/am-thanh/`), nhạc nền từ tệp của bạn, báo ra màn hình khi ở tab khác. Cài đặt lưu `data/am-thanh.json`.
- Rảnh (idle/done, ở nhà) 5-12 giây thì ra quảng trường nằm ngủ trên tấm chăn (`BEDS`, ảnh `nv/<mã>-ngu.webp` làm bằng `tools/lam_ngu.py`), có Zzz; có việc thì bật dậy rồi chạy về.
- Phòng Calm (`calm.js` ở server, `web/phong-calm.js`, `web/md.js`): gõ việc trong game → server chạy `claude -p --output-format stream-json --resume <phiên>` trong `calm.dir` (town.config.json, đổi được trên trang), đẩy tin qua SSE sự kiện `chat`, lưu `data/tro-chuyen.jsonl`. Phiên gõ trong Claude Code / lịch được ghi qua hooks UserPromptSubmit + Stop (`last_assistant_message`). Lựa chọn: Calm viết khối ```lua-chon {json}``` (dặn qua `--append-system-prompt`), không có thì đoán từ danh sách 1. 2. 3.; hiện hộp "Calm hỏi bạn" giữa màn hình. Việc lưu `brief` (đề bài), `steps`, `result` (báo cáo SubagentStop) để xem "Chi tiết việc".
- Giao diện theo mẫu hyan chọn (`docs/thiet-ke-menu/mau-da-chon.png`): thẻ kem bo tròn, màu pastel, viết bằng CSS (không còn khung gỗ border-image, chỉ giữ biển gỗ trên nhà và icon vẽ tay). Cột trái: tên + lưới nút 3×3 (+ Phòng Calm) + thẻ Âm thanh nhanh; phải: Tổng quan; dưới trái: Nhật ký chấm màu theo người; dưới giữa: thẻ nhân vật có ảnh mặt (`nv/<mã>-mat.webp`, `tools/lam_mat.py`); hộp lỗi có nút "Nhờ Calm xử lý".
