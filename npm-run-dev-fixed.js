#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🚀 تشغيل الخادم المباشر...');
  execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ خطأ في التشغيل:', error.message);
  console.log('💡 تأكد من تثبيت التبعيات بتشغيل: npm install');
}