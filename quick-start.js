#!/usr/bin/env node

// حل سريع ومباشر لتشغيل المشروع
const { spawn } = require('child_process');

console.log('⚡ تشغيل سريع للمشروع...');

// تشغيل مباشر بـ npx
const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ خطأ:', error.message);
  console.log('\n💡 جرب تشغيل: node fix-and-run.js');
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.log(`⚠️ انتهى بالرمز: ${code}`);
    console.log('💡 جرب تشغيل: node fix-and-run.js');
  }
  process.exit(code || 0);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 إغلاق...');
  child.kill('SIGINT');
});