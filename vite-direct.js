#!/usr/bin/env node

// مباشر وسريع - تشغيل vite
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 تشغيل مباشر لـ vite...');

// البحث عن vite في node_modules
const viteExe = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

const child = spawn('node', [viteExe, '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ خطأ:', error.message);
  
  // جرب npx كبديل
  console.log('🔄 محاولة npx...');
  const fallback = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  fallback.on('error', () => {
    console.error('❌ فشل تماماً');
    process.exit(1);
  });
});