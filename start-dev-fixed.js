#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 بدء تشغيل خادم التطوير...');

// Use npx to run vite - ensuring we use local or global vite
const viteProcess = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

viteProcess.on('error', (error) => {
  console.error('❌ فشل في تشغيل الخادم:', error.message);
  console.log('🔄 محاولة تثبيت vite...');
  
  // Try to install vite if not found
  const installProcess = spawn('npm', ['install', 'vite'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });
  
  installProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ تم تثبيت vite، إعادة التشغيل...');
      const retryProcess = spawn('npx', ['vite'], {
        stdio: 'inherit',
        shell: true,
        cwd: process.cwd()
      });
    } else {
      console.error('❌ فشل في تثبيت vite');
      process.exit(1);
    }
  });
});

viteProcess.on('close', (code) => {
  console.log(`عملية التطوير انتهت برمز: ${code}`);
  process.exit(code);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n⏹️ إيقاف الخادم...');
  viteProcess.kill('SIGINT');
});