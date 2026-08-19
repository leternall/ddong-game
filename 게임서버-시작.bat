@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   똥피하기 게임 서버
echo ============================================
echo.
echo 이 PC의 주소:
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do echo    http://%%b:8000
)

echo.
echo 위 주소를 휴대폰 브라우저에 입력하세요.
echo (휴대폰이 이 PC와 같은 Wi-Fi에 연결되어 있어야 합니다)
echo.
echo 이 창을 닫으면 게임 서버가 종료됩니다.
echo ============================================
echo.

python -m http.server 8000

pause
