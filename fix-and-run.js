#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 إصلاح شامل وتشغيل المشروع...');
console.log('📁 مجلد العمل:', __dirname);

// Step 1: تنظيف التبعيات
console.log('\n🗑️ تنظيف التبعيات القديمة...');
try {
  if (fs.existsSync('node_modules')) {
    execSync('rm -rf node_modules', { stdio: 'inherit' });
  }
  if (fs.existsSync('package-lock.json')) {
    execSync('rm -f package-lock.json', { stdio: 'inherit' });
  }
  console.log('✅ تم التنظيف');
} catch (error) {
  console.log('⚠️ تحذير:', error.message);
}

// Step 2: إعادة تثبيت التبعيات
console.log('\n📦 إعادة تثبيت التبعيات...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ تم تثبيت التبعيات');
} catch (error) {
  console.error('❌ خطأ في تثبيت التبعيات:', error.message);
  console.log('🔄 محاولة إصلاح...');
  
  try {
    execSync('npm cache clean --force', { stdio: 'inherit' });
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ تم الإصلاح والتثبيت');
  } catch (retryError) {
    console.error('❌ فشل نهائياً:', retryError.message);
    process.exit(1);
  }
}

// Step 3: التحقق من وجود vite
console.log('\n🔍 التحقق من vite...');
const viteChecks = [
  'node_modules/vite/bin/vite.js',
  'node_modules/.bin/vite'
];

let viteFound = false;
for (const vitePath of viteChecks) {
  if (fs.existsSync(vitePath)) {
    console.log(`✅ vite موجود في: ${vitePath}`);
    viteFound = true;
    break;
  }
}

if (!viteFound) {
  console.log('⚠️ لم يتم العثور على vite، تثبيت مباشر...');
  try {
    execSync('npm install vite@latest --save-dev', { stdio: 'inherit' });
    console.log('✅ تم تثبيت vite');
  } catch (error) {
    console.error('❌ فشل تثبيت vite:', error.message);
  }
}

// Step 4: تشغيل الخادم بعدة طرق
console.log('\n🚀 تشغيل خادم التطوير...');

const startMethods = [
  {
    name: 'npx vite',
    command: 'npx',
    args: ['vite', '--host', '0.0.0.0', '--port', '8080']
  },
  {
    name: 'node vite.js',
    command: 'node',
    args: ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '8080']
  },
  {
    name: '.bin/vite',
    command: './node_modules/.bin/vite',
    args: ['--host', '0.0.0.0', '--port', '8080']
  }
];

function tryStartMethod(methodIndex = 0) {
  if (methodIndex >= startMethods.length) {
    console.error('❌ فشلت جميع طرق التشغيل');
    process.exit(1);
  }

  const method = startMethods[methodIndex];
  console.log(`🔄 محاولة ${methodIndex + 1}: ${method.name}`);

  const child = spawn(method.command, method.args, {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  child.on('error', (error) => {
    console.error(`❌ فشل ${method.name}:`, error.message);
    console.log('🔄 جارٍ المحاولة التالية...');
    tryStartMethod(methodIndex + 1);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ ${method.name} انتهى بالرمز ${code}`);
      tryStartMethod(methodIndex + 1);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 إغلاق الخادم...');
    child.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 إنهاء الخادم...');
    child.kill('SIGTERM');
    process.exit(0);
  });
}

// بدء التشغيل
setTimeout(() => {
  console.log('\n🎯 بدء تشغيل الخادم...');
  tryStartMethod();
}, 1000);