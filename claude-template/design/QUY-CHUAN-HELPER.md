# Quy chuẩn giao diện App Helper (bản 1, 21/10/2026)

Rút ra từ code helper-web hiện tại: `app/type-roles.css` (Hyan chọn 20/10/2026), `app/ui-standard.css` (14/10), `app/flat-fields.css`, `app/phone-fields.css` (12/10), `app/icon-tiles.css` (10/10). Khi hai chỗ khác nhau, file nạp sau thắng. Đây là luật Hyan đã duyệt qua góp ý, phòng Thiết kế giữ đúng, không tự đổi.

Kiểm bằng máy: `node scripts/e2e/type-audit.mjs` (cỡ chữ), `node scripts/e2e/ui-audit.mjs` (chữ xanh, cỡ nút, icon, độ đậm).

## 1. Chữ

Font: font hệ thống kiểu iOS (`--ios-font`: SF Pro, Segoe UI trên Windows). Người dùng có thể chọn font riêng (`--user-font`).

| Vai | Cỡ (px) | Độ đậm | Ghi chú |
|---|---|---|---|
| Tên trang | 28 | 600 | Lời chào Trang chủ trên điện thoại: 22 |
| Tên đầu hộp (tên việc, tên hồ sơ, tiêu đề hộp thoại) | 22 | 600 | |
| Tiêu đề phần | 16 | 600 | "Tạo việc" là mẫu |
| Chữ chính: tên tab, mục bên trái, dòng danh sách | 14 | 400 | |
| Nhãn hàng và giá trị (Người giao, Phụ trách...) | 13 | 400 | Tên người, nhóm, ngày không in đậm |
| Tên ô phía trên ô gõ | 13 | 400 | |
| Chữ gõ trong ô | 15 | 400 | Điện thoại: 16, không nhỏ hơn (iPhone tự phóng to nếu nhỏ hơn) |

Độ đậm chỉ có 400 (chữ), 500 (tên, nút), 600 (tiêu đề, số quan trọng). Không dùng 450, 550, 650, 700, 800, trừ chữ thương hiệu.

## 2. Màu

- Chữ: đen `--ui-text` (#1c1c1e), phụ `--ui-text-2` (#3a3a3c), chú thích xám `--ui-sub` (#6e6e73), mờ `--ui-faint` (#aeaeb2).
- Xanh `--lg-tint` (#0a66e0, tối #4da3ff) **chỉ** cho: nút chính tô đầy, dấu đang chọn (tích, công tắc, hôm nay, thanh tab điện thoại), viền focus, link thật trong đoạn chữ, màu mang nghĩa (trạng thái, nhãn, màu nhóm).
- Chú thích không được xanh như link: dùng xám.
- Tab đang chọn: chữ đen, gạch đen 2px. Tab khác: xám. Cùng độ đậm 500.
- Đậm, đen, xám chỉ dùng khi mang nghĩa.

## 3. Nút

| Loại | Cao | Chữ | Icon |
|---|---|---|---|
| Nút chính (tô xanh, một nút mỗi chỗ) | 36 (điện thoại 40) | 14 / 600 | 16 |
| Nút phụ (cạnh nút chính, đầu trang, thanh công cụ) | 32 | 14 / 500, xám đậm, không nền | 16 |
| Hành động nhỏ trên dòng ("Mở công việc", "Đã đọc") | theo chữ | 13 / 500, xám | |
| Nút "+ Thêm ..." | theo chữ | 13 / 400, xám | |
| Nút chỉ có icon | 32 (trên dòng 28) | | 18 (trên dòng 16), xám |
| Nút đóng ✕ của hộp thoại | 32, tròn, nền nhạt | | |

Chiều cao nút đi theo chữ: chữ 14 trong nút 32-36.

## 4. Icon

- Bộ icon: `lucide-react`. Một hành động một icon, giống nhau ở mọi màn.
- Ô icon (icon tile): nền xám trung tính nhạt, viền mảnh, chỉ hình vẽ có màu.

## 5. Ô gõ

- Nền cùng màu tờ, viền mảnh 1px (inset shadow). Không dùng nền xám.
- Rê chuột: viền đậm hơn. Đang gõ: viền xanh.
- Ô nằm trong ô (số trong hàng tiền, chữ trong ô tìm kiếm): không nền, không viền.

## 6. Khung và khoảng cách

- Bo góc chung `--radius` 14px.
- Lề trang `--page-edge`: 16 (máy tính), 14 (dưới 768px), 12 (dưới 420px).
- Kiểm cả máy tính và điện thoại 320 / 375 / 430 px. Kèm ảnh khi đổi giao diện.

## 7. Chỗ còn lệch (phòng Thiết kế đề xuất dọn dần, cần Hyan duyệt)

- Cỡ icon trong code rất rải rác: 16 (550 chỗ), 15 (414), 14 (327), 17 (251), 18 (217), 13 (132), 20, 22. Quy chuẩn chỉ có 16 và 18.
- Nhiều luật cỡ chữ cũ còn trong `app/type-scale.css` (24 / 20 / 15...), đang bị `type-roles.css` đè. Nên gom về một file.
- Chưa có file token màu chung cho mọi chủ đề; màu đang nằm trong `liquid-glass.css` và `ui-standard.css`.
