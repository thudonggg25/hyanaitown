---
name: nhan-feedback
description: Calm: quét Linear lấy feedback mới của Helper, giao Tiếp nhận phân loại, rồi chia việc
---

1. Giao `tiep-nhan` đọc view "Feedback Helper Web" trên Linear (issue mới hoặc đổi từ lần quét trước, xem `intake/lan-quet-cuoi.txt`).
2. Đọc `intake/<ngày>.md` mà Tiếp nhận viết. Với mỗi mục:
   - **Lỗi**: bình luận trên Linear "Đã nhận, đang xử lý (mã HLP-xxx)", chuyển sang In Progress, giao coder đang rảnh bằng `/giao-viec`.
   - **Đề xuất**: bình luận "Đã nhận, đang đánh giá", giao `san-pham`, rồi `anicca` debate, rồi gửi Hyan duyệt nhận làm.
   - **Trùng**: bình luận link issue gốc.
   - **Thiếu thông tin**: bình luận hỏi lại người gửi, một câu ngắn, lịch sự.
3. Ghi thời điểm quét vào `intake/lan-quet-cuoi.txt` và cập nhật `BOARD.md`.
