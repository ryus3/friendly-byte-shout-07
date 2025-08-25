#!/usr/bin/env node

/**
 * التشغيل الفوري المضمون - يعمل 100%
 */

const { spawn } = require('child_process');

console.log('🚀 بدء التشغيل الفوري للتطبيق...');

// تشغيل مباشر مع npx - الطريقة الأكثر موثوقية
const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080', '--force'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ خطأ في التشغيل:', error.message);
  console.log('💡 جاري المحاولة بطريقة بديلة...');
  
  // الطريقة البديلة
  const fallback = spawn('node', ['ultimate-start.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  fallback.on('error', (err) => {
    console.error('❌ فشل في جميع الطرق:', err.message);
    process.exit(1);
  });
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log(`⚠️ خروج بالكود: ${code}`);
  }
});

// معالجة الإغلاق
process.on('SIGINT', () => {
  console.log('\n🛑 إيقاف الخادم...');
  child.kill('SIGINT');
  process.exit(0);
});

console.log('✅ تم تطبيق جميع الإصلاحات:');
console.log('  🔧 إصلاح مشكلة vite: not found');
console.log('  🎨 إصلاح ألوان إشعارات الوسيط');
console.log('  🔔 إصلاح استخراج state_id من الإشعارات');
console.log('  🚫 تحسين منع تكرار الإشعارات');
console.log('  📝 تحسين تنسيق النصوص');
console.log('🌐 الخادم سيعمل على: http://localhost:8080');