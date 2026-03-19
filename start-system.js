#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 بدء نظام التطوير مع إصلاح مشكلة vite...');

try {
  // Use our custom vite-start.js
  console.log('📦 استخدام vite-start.js...');
  execSync('node vite-start.js', { stdio: 'inherit' });
} catch (error) {
  console.log('🔄 محاولة npx vite مباشرة...');
  try {
    execSync('npx vite dev --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
  } catch (fallbackError) {
    console.error('❌ فشل في تشغيل vite:', fallbackError.message);
    console.log('💡 قم بتشغيل: npm install && npm run dev');
    process.exit(1);
  }
}