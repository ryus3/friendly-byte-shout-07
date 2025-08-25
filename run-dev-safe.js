#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 بدء الخادم الآمن مع إصلاح مشكلة vite...');

// Try vite-start.js first
console.log('📦 تشغيل vite-start.js...');
const child = spawn('node', ['vite-start.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ خطأ في بدء الخادم:', error.message);
  console.log('🔄 محاولة npx vite...');
  
  // Fallback to npx vite
  const fallback = spawn('npx', ['vite', 'dev', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
  
  fallback.on('error', (err) => {
    console.error('❌ فشل في جميع المحاولات:', err.message);
    console.log('💡 يرجى تشغيل: npm install');
    process.exit(1);
  });
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log(`الخادم توقف بكود ${code}`);
  }
});