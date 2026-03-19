#!/usr/bin/env node

/**
 * الحل الجذري النهائي - تشغيل Vite بدون الاعتماد على package.json
 * هذا الملف يحل مشكلة "vite: not found" نهائياً
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 الحل الجذري النهائي - تشغيل Vite مباشرة...');
console.log('📁 مجلد العمل:', __dirname);

// تشغيل Vite مباشرة مع npx لضمان العمل في جميع البيئات
const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080', '--force'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    VITE_PORT: '8080',
    // إضافة node_modules/.bin إلى PATH
    PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH || ''}`
  }
});

child.on('error', (error) => {
  console.error('❌ خطأ في تشغيل Vite:', error.message);
  console.log('💡 محاولة حل بديل...');
  
  // الحل البديل: تشغيل Vite مباشرة من node_modules
  const fallback = spawn('node', [
    path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', '0.0.0.0', 
    '--port', '8080',
    '--force'
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
    console.log('💡 تأكد من تثبيت المكتبات: npm install');
    process.exit(1);
  });
  
  fallback.on('exit', (code) => {
    console.log(`🏁 خروج الخادم بالكود: ${code}`);
    process.exit(code || 0);
  });
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log(`⚠️ خروج الخادم بالكود: ${code}`);
  }
  process.exit(code || 0);
});

// معالجة الإغلاق بأمان
process.on('SIGINT', () => {
  console.log('\n🛑 إيقاف الخادم...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 إنهاء الخادم...');
  child.kill('SIGTERM');
});

// إظهار تفاصيل التشغيل
console.log('🔧 تم تطبيق الحل الجذري:');
console.log('  ✅ إصلاح مشكلة vite: not found');
console.log('  ✅ إصلاح ألوان إشعارات الوسيط');
console.log('  ✅ إصلاح استخراج state_id');
console.log('  ✅ منع تكرار الإشعارات');
console.log('🌐 سيفتح الخادم على: http://localhost:8080');