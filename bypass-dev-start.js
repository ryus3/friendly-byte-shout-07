#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Bypass Dev Start - Direct Vite Launch');
console.log('📁 Working directory:', __dirname);

// Check if vite is installed
const vitePackagePath = path.join(__dirname, 'node_modules', 'vite', 'package.json');
if (fs.existsSync(vitePackagePath)) {
  console.log('✅ Vite package found');
} else {
  console.log('❌ Vite package not found');
}

// Try different methods to start vite
const methods = [
  () => {
    console.log('🔄 Method 1: Using npx vite...');
    return spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });
  },
  () => {
    console.log('🔄 Method 2: Using node_modules/.bin/vite...');
    const viteBin = path.join(__dirname, 'node_modules', '.bin', 'vite');
    return spawn(viteBin, ['--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname
    });
  },
  () => {
    console.log('🔄 Method 3: Using vite.js directly...');
    const viteJs = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
    return spawn('node', [viteJs, '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname
    });
  }
];

let currentMethod = 0;

function tryNextMethod() {
  if (currentMethod >= methods.length) {
    console.error('❌ All methods failed to start vite');
    process.exit(1);
  }

  const child = methods[currentMethod]();
  currentMethod++;

  child.on('error', (error) => {
    console.error(`❌ Method ${currentMethod} failed:`, error.message);
    tryNextMethod();
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Method ${currentMethod} exited with code ${code}`);
      tryNextMethod();
    } else {
      process.exit(0);
    }
  });
}

tryNextMethod();