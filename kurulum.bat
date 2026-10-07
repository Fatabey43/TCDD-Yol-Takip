@echo off
title TCDD Demiryolu Portali - Ilk Kurulum
echo ========================================================
echo   TCDD DEMIRYOLU KM PORTALI - ILK KURULUM
echo ========================================================
echo.
echo 1. Gerekli paketler yukleniyor...
call npm install
echo.
echo 2. Sistem derleniyor...
call npm run build
echo.
echo ========================================================
echo KURULUM TAMAMLANDI!
echo Artik "baslat.bat" dosyasina cift tiklayarak haritayi acabilirsiniz.
echo ========================================================
pause
