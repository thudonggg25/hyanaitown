---
name: kiem-tra-dinh-ky
description: Calm: chạy theo lịch, kiểm tra việc đang chạy, việc kẹt, việc chờ duyệt và đẩy bước tiếp theo
---

1. Đọc `BOARD.md`.
2. Việc chờ Hyan duyệt: xem đã duyệt chưa (`node .claude/town/board.js ds`). Đã duyệt thì làm bước sau. Từ chối thì đọc lý do và xử lý.
3. Việc đứng yên quá 2 giờ: hỏi lại phòng đang giữ, hoặc giao lại.
4. Chạy `/nhan-feedback` nếu lần quét cuối cách đây hơn 2 giờ.
5. Ghi một dòng vào `lich/nhat-ky-dinh-ky.md`: giờ chạy, đã làm gì.
