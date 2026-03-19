#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 تشغيل خادم التطوير...');

// تحديث PATH لتشمل node_modules/.bin
const nodeModulesBin = path.join(__dirname, 'node_modules', '.bin');
process.env.PATH = `${nodeModulesBin}${path.delimiter}${process.env.PATH || ''}`;
process.env.NODE_ENV = 'development';

// مسارات vite المختلفة
const vitePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(nodeModulesBin, 'vite')
];

let started = false;

function tryStartVite(index = 0) {
  if (index >= vitePaths.length) {
    console.log('💡 استخدام npx vite...');
    tryNpx();
    return;
  }

  const vitePath = vitePaths[index];
  
  if (!fs.existsSync(vitePath)) {
    console.log(`⚠️ ${vitePath} غير موجود`);
    tryStartVite(index + 1);
    return;
  }

  console.log(`✅ تم العثور على vite في: ${vitePath}`);

  const child = spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });

  child.on('error', (error) => {
    if (!started) {
      console.log(`⚠️ فشل في ${vitePath}: ${error.message}`);
      tryStartVite(index + 1);
    }
  });

  child.on('spawn', () => {
    console.log(`✅ تم تشغيل vite بنجاح`);
    started = true;
  });

  child.on('exit', (code) => {
    if (!started && code !== 0) {
      console.log(`⚠️ ${vitePath} خرج بالرمز ${code}`);
      tryStartVite(index + 1);
    }
  });
}

function tryNpx() {
  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env,
    shell: true
  });

  child.on('error', (error) => {
    console.error('❌ فشل npx أيضاً:', error.message);
    console.log('\n📋 حلول بديلة:');
    console.log('1. npm install');
    console.log('2. npm install vite@latest --save-dev');
    process.exit(1);
  });
}

// بدء التشغيل
tryStartVite();

// معالجة إيقاف البرنامج
process.on('SIGINT', () => {
  console.log('\n👋 إيقاف الخادم...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 إيقاف الخادم...');
  process.exit(0);
});