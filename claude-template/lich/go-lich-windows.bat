@echo off
for %%T in (NhanFeedback KiemTra BaoCaoNgay TongKetTuan) do schtasks /Delete /F /TN "Calm\%%T"
echo Da go het lich cua Calm.
pause
