@echo off
rem MathPad Setup.exe uretir -> dist\MathPad-Setup-<surum>.exe
rem Kisa (8.3) yol kullanilir: NSIS, klasor adindaki Turkce karakterlerle (o) dosya yazamiyor.
cd /d "%~sdp0"
call npm run vendor || goto :hata
call npx electron-builder --win nsis "-c.directories.output=%~sdp0dist" || goto :hata
echo.
echo Hazir: dist klasorundeki MathPad-Setup dosyasini paylasabilirsin.
pause
exit /b 0
:hata
echo Kurulum dosyasi olusturulamadi.
pause
exit /b 1
