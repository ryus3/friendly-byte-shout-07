#!/usr/bin/env node

// حل بديل لمشكلة vite باستخدام require بدلاً من import
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 بدء خادم التطوير...');

// محاولة عدة طرق للعثور على vite
const vitePaths = [
  path.join(__dirname, 'node_modules', '.bin', 'vite'),
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js')
];

let found = false;

for (const vitePath of vitePaths) {
  if (fs.existsSync(vitePath)) {
    console.log('✅ تم العثور على vite في:', vitePath);
    
    const isJs = vitePath.endsWith('.js');
    const command = isJs ? 'node' : vitePath;
    const args = isJs ? [vitePath] : [];
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
      }
    });
    
    child.on('exit', (code) => process.exit(code));
    found = true;
    break;
  }
}

if (!found) {
  console.log('💡 استخدام npx كحل بديل...');
  const child = spawn('npx', ['vite'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  child.on('exit', (code) => process.exit(code));
}