#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 تشغيل الخادم مع إصلاح RTL...');

// Update PATH to include node_modules/.bin
const nodeModulesBin = path.join(__dirname, 'node_modules', '.bin');
const newPath = `${nodeModulesBin}:${process.env.PATH || ''}`;

// Start with robust method
const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    PATH: newPath,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ خطأ في التشغيل:', error.message);
  console.log('💡 محاولة طريقة بديلة...');
  
  // Fallback method
  const fallback = spawn('node', [
    path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', '0.0.0.0', 
    '--port', '8080'
  ], {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
  
  fallback.on('error', (err) => {
    console.error('❌ فشل جميع الطرق:', err.message);
    process.exit(1);
  });
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log(`⚠️ خروج بالكود: ${code}`);
  }
  process.exit(code || 0);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 إيقاف الخادم...');
  child.kill('SIGINT');
  process.exit(0);
});

console.log('✅ تم تطبيق الإصلاحات:');
console.log('  🔧 إصلاح مشكلة vite: not found');  
console.log('  📝 تحسين RTL للقوائم المنسدلة');
console.log('  ✔️ وضع العلامة على اليمين');
console.log('  🎨 خلفية صلبة للقوائم');
console.log('🌐 الخادم سيعمل على: http://localhost:8080');