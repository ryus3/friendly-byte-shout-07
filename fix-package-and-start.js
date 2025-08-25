#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 إصلاح package.json وبدء الخادم...');

try {
  // Copy the fixed package.json
  if (fs.existsSync('./package-fixed.json')) {
    const fixedPackage = fs.readFileSync('./package-fixed.json', 'utf8');
    fs.writeFileSync('./package.json', fixedPackage);
    console.log('✅ تم إصلاح package.json');
  }
  
  // Start the server using our custom script
  console.log('🚀 بدء الخادم...');
  execSync('node vite-start.js', { stdio: 'inherit' });
  
} catch (error) {
  console.error('❌ خطأ:', error.message);
  console.log('🔄 محاولة طريقة بديلة...');
  
  try {
    execSync('npx vite dev --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
  } catch (fallbackError) {
    console.error('❌ فشل نهائياً:', fallbackError.message);
    process.exit(1);
  }
}