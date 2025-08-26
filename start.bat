@echo off
echo 🚀 تشغيل المشروع...

REM Try quick start first
echo ⚡ محاولة سريعة...
node quick-start.js

REM If that fails, try comprehensive fix
if errorlevel 1 (
    echo 🔧 تطبيق الإصلاح الشامل...
    node fix-and-run.js
)

pause