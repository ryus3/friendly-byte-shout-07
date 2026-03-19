@echo off
echo 🚀 بدء خادم التطوير...

REM تحقق من وجود node_modules
if not exist "node_modules" (
    echo 📦 تثبيت التبعيات...
    npm install
    if errorlevel 1 (
        echo ❌ فشل في تثبيت التبعيات
        pause
        exit /b 1
    )
)

REM تحقق من وجود vite
if not exist "node_modules\.bin\vite.cmd" (
    echo 🔧 إعادة تثبيت vite...
    npm install vite@latest --save-dev
)

echo ✅ تشغيل الخادم على localhost:8080

REM تشغيل vite
if exist "node_modules\.bin\vite.cmd" (
    node_modules\.bin\vite.cmd --host 0.0.0.0 --port 8080
) else (
    npx vite --host 0.0.0.0 --port 8080
)