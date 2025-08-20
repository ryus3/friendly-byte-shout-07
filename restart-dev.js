const { exec } = require('child_process');
const path = require('path');

console.log('🔄 إعادة تشغيل الخادم...');

// تثبيت التبعيات وتشغيل الخادم
exec('npm install && npm run dev', {
  cwd: process.cwd(),
  stdio: 'inherit'
}, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ خطأ في التشغيل:', error.message);
    return;
  }
  if (stderr) {
    console.error('⚠️ تحذيرات:', stderr);
  }
  console.log('✅ تم بنجاح:', stdout);
});