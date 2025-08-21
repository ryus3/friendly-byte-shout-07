#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 بدء الحل الجذري لمشكلة vite...');

// إعداد المتغيرات
const nodeModulesBin = path.join(process.cwd(), 'node_modules', '.bin');
const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const currentPath = process.env.PATH || '';

// تعديل PATH
process.env.PATH = `${nodeModulesBin}:${currentPath}`;
process.env.NODE_ENV = 'development';

console.log('📁 مجلد العمل:', process.cwd());
console.log('🔍 PATH:', process.env.PATH);

// دالة لتشغيل vite
function startVite() {
  console.log('🚀 محاولة تشغيل vite...');
  
  // المحاولة 1: استخدام node مباشرة
  if (fs.existsSync(vitePath)) {
    console.log('✅ تم العثور على vite.js، التشغيل مباشرة');
    const child = spawn('node', [vitePath, '--host', '::', '--port', '8080'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    
    child.on('error', (error) => {
      console.error('❌ خطأ في node vite:', error.message);
      tryNpx();
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        console.log('⚠️ vite خرج بخطأ، محاولة npx...');
        tryNpx();
      }
    });
    
    return;
  }
  
  // المحاولة 2: استخدام .bin
  const binVite = path.join(nodeModulesBin, 'vite');
  if (fs.existsSync(binVite)) {
    console.log('✅ تم العثور على vite في .bin');
    const child = spawn(binVite, ['--host', '::', '--port', '8080'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    
    child.on('error', (error) => {
      console.error('❌ خطأ في .bin vite:', error.message);
      tryNpx();
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        console.log('⚠️ .bin vite خرج بخطأ، محاولة npx...');
        tryNpx();
      }
    });
    
    return;
  }
  
  // المحاولة 3: npx
  tryNpx();
}

function tryNpx() {
  console.log('💡 استخدام npx كحل أخير...');
  const child = spawn('npx', ['vite', '--host', '::', '--port', '8080'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
    shell: true
  });
  
  child.on('error', (error) => {
    console.error('❌ خطأ في npx:', error.message);
    console.log('\n🔧 حلول بديلة:');
    console.log('1. npm install');
    console.log('2. npm install vite@latest --save-dev');
    console.log('3. node start-fixed.js');
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    if (code !== 0) {
      console.log(`⚠️ npx خرج بالرمز ${code}`);
    }
    process.exit(code || 0);
  });
}

// التحقق من node_modules
if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
  console.log('📦 node_modules غير موجود، تثبيت التبعيات...');
  const installChild = spawn('npm', ['install'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env
  });
  
  installChild.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ تم تثبيت التبعيات بنجاح');
      startVite();
    } else {
      console.error('❌ فشل في تثبيت التبعيات');
      process.exit(1);
    }
  });
} else {
  startVite();
}

// معالجة إيقاف البرنامج
process.on('SIGINT', () => {
  console.log('\n👋 إيقاف الخادم...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 إيقاف الخادم...');
  process.exit(0);
});