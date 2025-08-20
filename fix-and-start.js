#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🔧 تشغيل الخادم مع إصلاح المسارات...');

// إضافة node_modules/.bin إلى PATH
const nodeModulesBin = path.join(process.cwd(), 'node_modules', '.bin');
const currentPath = process.env.PATH || '';
process.env.PATH = `${nodeModulesBin}:${currentPath}`;

// تشغيل vite
const viteProcess = spawn('vite', [], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

viteProcess.on('error', (error) => {
  console.error('❌ خطأ في تشغيل vite:', error.message);
  process.exit(1);
});

viteProcess.on('close', (code) => {
  console.log(`vite انتهى بالرمز ${code}`);
  process.exit(code);
});