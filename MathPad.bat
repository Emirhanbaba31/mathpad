@echo off
rem MathPad'i bu bilgisayarda acar. Pencereyi kapatma; kapatinca uygulama durur.
cd /d "%~dp0"
start "" http://localhost:5173
python -m http.server 5173 --bind 127.0.0.1
