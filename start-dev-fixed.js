#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 البحث عن vite...');

// مواقع محتملة لـ vite
const vitePaths = [
  './node_modules/.bin/vite',
  './node_modules/vite/bin/vite.js',
  'npx vite'
];

function runVite() {
  // التحقق من node_modules/.bin/vite
  if (fs.existsSync('./node_modules/.bin/vite')) {
    console.log('✅ تم العثور على vite في node_modules/.bin');
    const child = spawn('./node_modules/.bin/vite', process.argv.slice(2), {
      stdio: 'inherit',
      shell: true
    });
    child.on('exit', process.exit);
    return;
  }

  // التحقق من node_modules/vite/bin/vite.js
  if (fs.existsSync('./node_modules/vite/bin/vite.js')) {
    console.log('✅ تم العثور على vite في node_modules/vite/bin');
    const child = spawn('node', ['./node_modules/vite/bin/vite.js', ...process.argv.slice(2)], {
      stdio: 'inherit'
    });
    child.on('exit', process.exit);
    return;
  }

  // استخدام npx كبديل
  console.log('⚠️ استخدام npx كبديل');
  const child = spawn('npx', ['vite', ...process.argv.slice(2)], {
    stdio: 'inherit'
  });
  child.on('exit', process.exit);
}

runVite();