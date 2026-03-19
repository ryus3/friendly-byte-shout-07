#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 بدء تشغيل التطبيق...');

// إعداد المسارات
const projectRoot = process.cwd();
const nodeModulesPath = path.join(projectRoot, 'node_modules');
const vitePath = path.join(nodeModulesPath, '.bin', 'vite');

// تشغيل الخادم
const viteProcess = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${path.join(nodeModulesPath, '.bin')}:${process.env.PATH}`,
    NODE_ENV: 'development'
  }
});

viteProcess.on('error', (error) => {
  console.error('❌ خطأ في تشغيل vite:', error.message);
  
  // محاولة تثبيت vite إذا لم يكن موجود
  console.log('🔧 جاري تثبيت vite...');
  const installProcess = spawn('npm', ['install', 'vite@latest'], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  
  installProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ تم تثبيت vite بنجاح، جاري إعادة التشغيل...');
      // إعادة تشغيل vite
      spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
        cwd: projectRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          PATH: `${path.join(nodeModulesPath, '.bin')}:${process.env.PATH}`,
          NODE_ENV: 'development'
        }
      });
    } else {
      console.error('❌ فشل في تثبيت vite');
      process.exit(1);
    }
  });
});

viteProcess.on('close', (code) => {
  console.log(`✅ انتهى vite بالكود: ${code}`);
});

// التعامل مع إشارات الإنهاء
process.on('SIGINT', () => {
  console.log('\n🛑 جاري إيقاف الخادم...');
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 جاري إيقاف الخادم...');
  viteProcess.kill('SIGTERM');
});