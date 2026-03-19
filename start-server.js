#!/usr/bin/env node

/**
 * 🚀 نظام تشغيل الخادم الموحد والذكي
 * حل نهائي وجذري لمشكلة vite not found
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 نظام تشغيل الخادم الذكي');

/**
 * التحقق من وجود vite في المشروع
 */
function checkViteInstallation() {
  const possiblePaths = [
    path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(__dirname, 'node_modules', '.bin', 'vite')
  ];
  
  for (const vitePath of possiblePaths) {
    if (fs.existsSync(vitePath)) {
      console.log(`✅ تم العثور على vite: ${vitePath}`);
      return { found: true, path: vitePath };
    }
  }
  
  console.log('❌ لم يتم العثور على vite محلياً');
  return { found: false };
}

/**
 * تثبيت vite إذا لم يكن موجوداً
 */
function ensureVite() {
  try {
    console.log('📦 التحقق من تثبيت vite...');
    execSync('npm list vite', { stdio: 'ignore' });
    console.log('✅ vite مثبت بالفعل');
    return true;
  } catch (error) {
    console.log('📥 تثبيت vite...');
    try {
      execSync('npm install vite@latest --save-dev', { stdio: 'inherit' });
      console.log('✅ تم تثبيت vite بنجاح');
      return true;
    } catch (installError) {
      console.error('❌ فشل في تثبيت vite:', installError.message);
      return false;
    }
  }
}

/**
 * تشغيل الخادم بطرق متعددة
 */
function startServer() {
  // الطريقة 1: استخدام npx (الأكثر موثوقية)
  console.log('🚀 تشغيل الخادم بـ npx vite...');
  
  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
    },
    shell: process.platform === 'win32'
  });

  child.on('error', (error) => {
    console.error('❌ خطأ في npx:', error.message);
    tryDirectExecution();
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.log('🔄 محاولة تشغيل مباشر...');
      tryDirectExecution();
    }
  });
}

/**
 * التشغيل المباشر عبر node
 */
function tryDirectExecution() {
  const viteCheck = checkViteInstallation();
  
  if (viteCheck.found) {
    console.log('🔧 تشغيل مباشر عبر node...');
    
    const child = spawn('node', [viteCheck.path, '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    child.on('error', (error) => {
      console.error('❌ فشل التشغيل المباشر:', error.message);
      console.log('💡 تجرب: npm install && npm run dev');
      process.exit(1);
    });
  } else {
    console.error('❌ جميع طرق التشغيل فشلت');
    console.log('💡 الحلول المقترحة:');
    console.log('1. npm install');
    console.log('2. npm install vite@latest --save-dev');
    console.log('3. npx vite --host 0.0.0.0 --port 8080');
    process.exit(1);
  }
}

/**
 * البدء
 */
function main() {
  // التأكد من تثبيت vite
  if (ensureVite()) {
    startServer();
  } else {
    console.error('❌ لا يمكن تشغيل الخادم بدون vite');
    process.exit(1);
  }
}

// معالجة الأخطاء العامة
process.on('uncaughtException', (error) => {
  console.error('❌ خطأ غير متوقع:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ رفض غير معالج:', reason);
  process.exit(1);
});

main();