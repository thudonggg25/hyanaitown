---
name: giao-viec
description: Calm: giao một việc code cho coder rảnh và theo dõi tới khi xong
---

1. Xem `BOARD.md` coder nào đang rảnh (tối đa 3 việc code chạy cùng lúc).
2. Nếu chưa có thư mục làm việc của coder, tạo: `git -C projects/helper-web worktree add ../wt/coder-N -b calm/<mã>-<tên-ngắn> origin/HEAD` (lấy nhánh chính mới nhất trước: `git -C projects/helper-web fetch origin`).
3. Giao bằng công cụ Agent, `subagent_type` = `coder-N`, `description` ngắn. Trong prompt ghi: mã việc, link Linear, nội dung đã viết lại của Tiếp nhận, thư mục và tên nhánh.
4. Coder xong: nếu có đổi giao diện thì giao `thiet-ke` soát, rồi luôn giao `qa`.
5. QA chưa đạt thì trả lại đúng coder đó, tối đa 3 vòng. Quá 3 vòng thì báo Hyan.
