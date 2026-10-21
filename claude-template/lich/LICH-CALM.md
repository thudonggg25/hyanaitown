# Lịch làm việc của Calm

| Khi nào | Calm chạy | Làm gì |
|---|---|---|
| 8:00 mỗi ngày | `/nhan-feedback` | Quét Linear, nhận feedback mới, chia việc trong ngày |
| Mỗi 2 giờ, 8:00 tới 22:00 | `/kiem-tra-dinh-ky` | Xem việc đang chạy, việc kẹt, việc Hyan đã duyệt, đẩy bước tiếp theo |
| 17:30 mỗi ngày | `/bao-cao-ngay` | Báo cáo ngắn cho Hyan, cập nhật Linear |
| 8:30 thứ Hai | `/tong-ket-tuan` | Tổng kết tuần, nhờ Anicca debate các đề xuất lớn |

## Chạy lịch trên PC Windows (giai đoạn đầu)

1. Bấm đúp `lich/cai-lich-windows.bat` một lần. Nó tạo 4 lịch trong Task Scheduler, nhóm "Calm".
2. Mỗi lần đến giờ, Windows chạy `lich/chay-dinh-ky.bat <tên skill>`, kết quả ghi vào `lich/nhat-ky-chay.txt`.
3. Muốn tắt: bấm đúp `lich/go-lich-windows.bat`.

PC phải đang bật và không ngủ thì lịch mới chạy. Nhớ mở thị trấn (`chay-thi-tran.bat`) để xem trên trang.

## Chuyển lên VPS (sau 1-2 tuần, khi luồng việc đã ổn)

Trên VPS Linux dùng `cron` với cùng 4 dòng lệnh `claude -p "/<skill>"`. Calm sẽ hướng dẫn từng bước khi Hyan thuê VPS.
