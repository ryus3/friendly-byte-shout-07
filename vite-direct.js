#!/usr/bin/env node

// مباشر وسريع - تشغيل vite
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 تشغيل مباشر لـ vite...');

const fs = require('fs');

// البحث عن vite في مسارات متعددة
const vitePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, 'node_modules', '.bin', 'vite'),
];

let viteExe = null;
for (const vitePath of vitePaths) {
  if (fs.existsSync(vitePath)) {
    viteExe = vitePath;
    console.log('✅ وُجد vite في:', vitePath);
    break;
  }
}

if (!viteExe) {
  console.error('❌ لم يتم العثور على vite في أي مسار');
  console.log('🔄 محاولة تثبيت vite...');
  
  const installChild = spawn('npm', ['install', 'vite'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  installChild.on('close', (code) => {
    if (code === 0) {
      console.log('✅ تم تثبيت vite بنجاح، محاولة التشغيل...');
      // إعادة تشغيل نفس الـ script
      spawn('node', [__filename], { stdio: 'inherit', cwd: __dirname });
    } else {
      console.error('❌ فشل في تثبيت vite');
      process.exit(1);
    }
  });
  return;
}

// تشغيل vite
const isWindowsBin = viteExe.includes('.bin') && !viteExe.endsWith('.js');
const command = isWindowsBin ? viteExe : 'node';
const args = isWindowsBin ? ['--host', '0.0.0.0', '--port', '8080'] : [viteExe, '--host', '0.0.0.0', '--port', '8080'];

console.log(`🚀 تشغيل: ${command} ${args.join(' ')}`);

const child = spawn(command, args, {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ خطأ في تشغيل vite:', error.message);
  
  // جرب npx كبديل أخير
  console.log('🔄 محاولة npx كبديل أخير...');
  const fallback = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  fallback.on('error', () => {
    console.error('❌ فشل تماماً في جميع المحاولات');
    process.exit(1);
  });
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ vite توقف بكود الخطأ: ${code}`);
    process.exit(code);
  }
});