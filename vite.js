#!/usr/bin/env node

// محاولة تشغيل vite من مواقع مختلفة
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const vitePaths = [
  path.join(__dirname, 'node_modules', '.bin', 'vite'),
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  'npx vite'
];

async function startVite() {
  for (const vitePath of vitePaths) {
    try {
      if (vitePath === 'npx vite') {
        console.log('🚀 تشغيل vite باستخدام npx...');
        const child = spawn('npx', ['vite', '--host', '::', '--port', '8080'], {
          stdio: 'inherit',
          shell: true
        });
        
        child.on('error', (error) => {
          console.error('خطأ في تشغيل npx vite:', error);
        });
        
        return;
      } else if (fs.existsSync(vitePath)) {
        console.log('🚀 تشغيل vite من:', vitePath);
        const child = spawn('node', [vitePath, '--host', '::', '--port', '8080'], {
          stdio: 'inherit'
        });
        
        child.on('error', (error) => {
          console.error('خطأ في تشغيل vite:', error);
        });
        
        return;
      }
    } catch (error) {
      console.log('فشل في تشغيل:', vitePath);
      continue;
    }
  }
  
  console.error('❌ فشل في العثور على vite في جميع المواقع');
  process.exit(1);
}

startVite();