---
name: sua-loi
description: Coder: sửa một lỗi của Helper
---

1. Đọc mô tả đã viết lại của Tiếp nhận và issue Linear.
2. Tìm nguyên nhân trong code, ghi lại một câu trước khi sửa.
3. Viết test tái hiện lỗi nếu được (`lib/*.test.mjs`), sửa nhỏ nhất có thể, không sửa lan sang phần khác.
4. Chạy `node --test lib/*.test.mjs`, `npx tsc --noEmit`, và script verify liên quan.
5. Commit trên nhánh của mình, lời commit tiếng Việt có mã việc. Báo Calm: nguyên nhân, đã sửa gì, đã kiểm gì, có đổi giao diện không.
