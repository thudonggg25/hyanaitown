@echo off
chcp 65001 >nul
rem Tao 4 lich chay cho Calm trong Task Scheduler. Chay lai se ghi de lich cu.
set RUN=\"%~dp0chay-dinh-ky.bat\"
schtasks /Create /F /TN "Calm\NhanFeedback" /SC DAILY /ST 08:00 /TR "%RUN% nhan-feedback"
schtasks /Create /F /TN "Calm\KiemTra" /SC DAILY /ST 08:00 /RI 120 /DU 14:00 /TR "%RUN% kiem-tra-dinh-ky"
schtasks /Create /F /TN "Calm\BaoCaoNgay" /SC DAILY /ST 17:30 /TR "%RUN% bao-cao-ngay"
schtasks /Create /F /TN "Calm\TongKetTuan" /SC WEEKLY /D MON /ST 08:30 /TR "%RUN% tong-ket-tuan"
echo.
echo Da tao lich cho Calm. Xem trong Task Scheduler, nhom "Calm".
pause
