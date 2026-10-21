---
name: soat-thiet-ke
description: Thiết kế: soát một nhánh có đổi giao diện theo quy chuẩn Helper
---

1. Xem diff của nhánh (`git -C projects/wt/coder-N diff origin/HEAD --stat` rồi đọc file CSS / TSX đổi).
2. So từng thay đổi với `design/QUY-CHUAN-HELPER.md`: cỡ chữ theo vai, độ đậm, nút, icon (lucide-react, một icon một hành động), màu xanh chỉ dùng đúng chỗ, khoảng cách.
3. Nếu chạy được: dùng các script kiểm có sẵn của Helper (`scripts/e2e/type-audit.mjs`, `scripts/e2e/ui-audit.mjs`) và chụp màn hình máy tính + điện thoại 320 / 375 / 430 px.
4. Ghi `design/soat-<MÃ>.md`: Đạt / Chưa đạt, từng điểm sai kèm file và dòng, cách sửa.
