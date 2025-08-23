#!/usr/bin/env node

// إصلاح مشكلة "vite: not found"
const path = require('path');
const { spawn, execSync } = require('child_process');

async function startDev() {
  console.log('🚀 تحضير خادم التطوير...');
  
  try {
    // طريقة 1: استخدام مسار vite المباشر
    const viteBinPath = path.join(__dirname, 'node_modules', '.bin', 'vite');
    const fs = require('fs');
    
    if (fs.existsSync(viteBinPath)) {
      console.log('✅ تم العثور على Vite، جارٍ التشغيل...');
      
      const viteProcess = spawn(viteBinPath, ['--host', '0.0.0.0', '--port', '8080'], {
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      
      viteProcess.on('error', (error) => {
        console.error('❌ خطأ في تشغيل Vite:', error.message);
        fallbackMethod();
      });
      
      return;
    }
    
    // طريقة 2: npx
    fallbackMethod();
    
  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
    fallbackMethod();
  }
}

function fallbackMethod() {
  console.log('🔄 استخدام الطريقة البديلة...');
  
  try {
    execSync('npx vite --host 0.0.0.0 --port 8080', { 
      stdio: 'inherit',
      shell: true 
    });
  } catch (error) {
    console.error('❌ فشلت جميع الطرق. جرب:');
    console.log('npm install');
    console.log('npx vite');
    process.exit(1);
  }
}

startDev();