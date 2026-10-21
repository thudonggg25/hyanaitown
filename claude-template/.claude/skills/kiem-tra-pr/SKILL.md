---
name: kiem-tra-pr
description: QA: kiểm tra nhánh coder vừa làm trước khi gửi Hyan
---

Trong thư mục của coder (`projects/wt/coder-N`):
1. Chạy `node --test lib/*.test.mjs workers/*.test.mjs`, `npx tsc --noEmit`, `npm run build`.
2. Đọc diff: đúng việc được giao, không sửa lan, không có khoá bí mật, không đụng migration hay đăng nhập khi việc không yêu cầu.
3. Có đổi giao diện: xem báo cáo của phòng Thiết kế phải Đạt.
4. Ghi `qa/<MÃ>.md`: Đạt / Chưa đạt từng mục. Đạt thì gửi Hyan duyệt gộp bằng lệnh board (xem file agent QA).
