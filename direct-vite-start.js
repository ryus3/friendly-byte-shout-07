#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite Development Server directly...');

// Try multiple approaches
const approaches = [
  // Method 1: Direct node execution
  () => {
    console.log('📝 Method 1: Direct node execution...');
    return spawn('node', ['./node_modules/vite/bin/vite.js', '--port', '8080', '--host', '0.0.0.0'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  },
  // Method 2: Using npx
  () => {
    console.log('📝 Method 2: Using npx...');
    return spawn('npx', ['vite', '--port', '8080', '--host', '0.0.0.0'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  },
  // Method 3: Using npm run
  () => {
    console.log('📝 Method 3: Using npm run dev...');
    return spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  }
];

let currentMethod = 0;

function tryNextMethod() {
  if (currentMethod >= approaches.length) {
    console.error('❌ All methods failed');
    process.exit(1);
  }

  const child = approaches[currentMethod]();
  currentMethod++;

  child.on('error', (error) => {
    console.error(`❌ Method ${currentMethod} failed:`, error.message);
    console.log('🔄 Trying next method...');
    tryNextMethod();
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.log(`🔄 Method ${currentMethod} exited with code ${code}, trying next...`);
      tryNextMethod();
    }
  });
}

// Start with first method
tryNextMethod();