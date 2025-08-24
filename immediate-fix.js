#!/usr/bin/env node

// حل فوري لتشغيل المشروع بدون مشاكل vite
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 تشغيل فوري للمشروع...');

// البحث المباشر عن vite
const viteJsPath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

if (fs.existsSync(viteJsPath)) {
  console.log('✅ تم العثور على vite.js، التشغيل المباشر...');
  
  const viteProcess = spawn('node', [viteJsPath, '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
  
  viteProcess.on('error', (error) => {
    console.error('❌ خطأ في تشغيل vite:', error.message);
    console.log('💡 الرجاء تشغيل: node immediate-fix.js');
    process.exit(1);
  });
  
  viteProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ توقف vite بكود: ${code}`);
    }
    process.exit(code || 0);
  });
  
} else {
  console.log('❌ vite.js غير موجود');
  console.log('🔄 محاولة تثبيت Dependencies...');
  
  const installProcess = spawn('npm', ['install'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  installProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ تم التثبيت بنجاح');
      console.log('🔄 الرجاء تشغيل: node immediate-fix.js مرة أخرى');
    } else {
      console.log('❌ فشل التثبيت');
    }
    process.exit(code || 0);
  });
}