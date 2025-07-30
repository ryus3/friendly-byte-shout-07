#!/usr/bin/env node

// Script بديل لتشغيل vite في حالة عدم العثور على الأمر
const { spawn } = require('child_process');
const path = require('path');

// محاولة العثور على vite في node_modules
const vitePath = path.join(__dirname, 'node_modules', '.bin', 'vite');

try {
  const viteProcess = spawn('node', [vitePath], {
    stdio: 'inherit',
    shell: true
  });

  viteProcess.on('error', (err) => {
    console.error('خطأ في تشغيل vite:', err);
  });

  viteProcess.on('close', (code) => {
    process.exit(code);
  });
} catch (error) {
  console.error('فشل في تشغيل vite:', error);
  process.exit(1);
}