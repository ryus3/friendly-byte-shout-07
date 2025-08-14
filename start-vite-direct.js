#!/usr/bin/env node

/**
 * حل جذري لمشكلة "vite not found"
 * تشغيل Vite مباشرة من node_modules
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// البحث عن vite في node_modules
const possiblePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
];

let vitePath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    vitePath = p;
    break;
  }
}

if (!vitePath) {
  console.error('❌ لم يتم العثور على Vite في أي من المسارات المتوقعة');
  console.error('المسارات المحاولة:', possiblePaths);
  process.exit(1);
}

console.log('✅ تم العثور على Vite في:', vitePath);
console.log('🚀 تشغيل خادم التطوير...');

// تشغيل Vite
const viteProcess = spawn('node', [
  vitePath,
  '--host', '0.0.0.0',
  '--port', '8080'
], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' }
});

viteProcess.on('error', (err) => {
  console.error('❌ خطأ في تشغيل Vite:', err.message);
  process.exit(1);
});

viteProcess.on('exit', (code) => {
  console.log(`🏁 Vite انتهى بالكود: ${code}`);
  process.exit(code);
});

// التعامل مع إشارات النظام
process.on('SIGINT', () => {
  console.log('\n🛑 إيقاف الخادم...');
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  viteProcess.kill('SIGTERM');
});