#!/usr/bin/env node

// Vite launch script with multiple fallback strategies
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Strategy 1: Try npx vite
console.log('Starting vite server...');
try {
  const vite = spawn('npx', ['vite', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
    env: { 
      ...process.env, 
      PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}` 
    }
  });

  vite.on('error', (err) => {
    console.error('NPX vite failed, trying alternative methods...', err);
    tryAlternativeMethods();
  });

  vite.on('close', (code) => {
    if (code === 0) {
      process.exit(0);
    } else {
      console.log('Vite exited with code', code, 'trying alternatives...');
      tryAlternativeMethods();
    }
  });
} catch (error) {
  console.error('Initial spawn failed:', error);
  tryAlternativeMethods();
}

function tryAlternativeMethods() {
  // Strategy 2: Try node_modules/.bin/vite directly
  const viteBinPath = path.join(__dirname, 'node_modules', '.bin', 'vite');
  
  if (fs.existsSync(viteBinPath)) {
    console.log('Trying direct vite binary...');
    const directVite = spawn('node', [viteBinPath, ...process.argv.slice(2)], {
      stdio: 'inherit'
    });
    
    directVite.on('close', (code) => process.exit(code));
  } else {
    console.error('Vite binary not found. Please run: npm install');
    process.exit(1);
  }
}