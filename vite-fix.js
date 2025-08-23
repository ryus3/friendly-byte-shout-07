#!/usr/bin/env node

// محلل مشكلة vite not found
const { spawn } = require('child_process');
const path = require('path');

console.log('🔧 تشغيل Vite مع إصلاح المسارات...');

// تشغيل npx vite مباشرة
const viteProcess = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

viteProcess.on('error', (error) => {
  console.error('❌ خطأ في تشغيل Vite:', error.message);
  process.exit(1);
});

viteProcess.on('close', (code) => {
  console.log(`✅ Vite انتهى بالكود ${code}`);
  process.exit(code);
});