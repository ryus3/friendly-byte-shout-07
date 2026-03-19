const { exec } = require('child_process');
const path = require('path');

console.log('🚀 تشغيل التطبيق باستخدام npx...');

// استخدام npx لضمان توفر vite
const command = process.platform === 'win32' ? 'npx.cmd vite' : 'npx vite';

const viteProcess = exec(command, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

viteProcess.stdout.on('data', (data) => {
  console.log(data.toString());
});

viteProcess.stderr.on('data', (data) => {
  console.error(data.toString());
});

viteProcess.on('close', (code) => {
  console.log(`✅ vite انتهى بالكود: ${code}`);
});

viteProcess.on('error', (error) => {
  console.error('❌ خطأ في تشغيل vite:', error.message);
  console.log('🔧 جاري تثبيت المكتبات المطلوبة...');
  
  exec('npm install', (installError, stdout, stderr) => {
    if (installError) {
      console.error('❌ فشل في تثبيت المكتبات:', installError.message);
      return;
    }
    
    console.log('✅ تم تثبيت المكتبات، جاري إعادة التشغيل...');
    exec(command, { cwd: process.cwd() }, (retryError, retryStdout, retryStderr) => {
      if (retryStdout) console.log(retryStdout);
      if (retryStderr) console.error(retryStderr);
    });
  });
});

// التعامل مع إيقاف العملية
process.on('SIGINT', () => {
  console.log('\n🛑 جاري إيقاف الخادم...');
  viteProcess.kill('SIGINT');
});