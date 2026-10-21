@echo off
chcp 65001 >nul
rem Chay mot skill cua Calm theo lich. Vi du: chay-dinh-ky.bat kiem-tra-dinh-ky
cd /d "%~dp0.."
echo ===== %date% %time% /%1 ===== >> "lich\nhat-ky-chay.txt"
claude -p "/%1" --permission-mode acceptEdits >> "lich\nhat-ky-chay.txt" 2>&1
