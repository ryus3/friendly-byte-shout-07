#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite with direct node execution...');

// Try different approaches to run Vite
const approaches = [
  () => {
    console.log('Method 1: Direct node execution...');
    return spawn('node', [path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname
    });
  },
  () => {
    console.log('Method 2: NPX execution...');
    return spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname,
      shell: true
    });
  },
  () => {
    console.log('Method 3: Direct .bin execution...');
    return spawn(path.join(__dirname, 'node_modules', '.bin', 'vite'), ['--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname
    });
  }
];

let currentAttempt = 0;

function tryNext() {
  if (currentAttempt >= approaches.length) {
    console.error('❌ All methods failed. Please run: npm install && npm run dev');
    process.exit(1);
  }

  const child = approaches[currentAttempt]();
  currentAttempt++;

  child.on('error', (error) => {
    console.error(`❌ Method ${currentAttempt} failed:`, error.message);
    tryNext();
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.log(`Method ${currentAttempt} exited with code ${code}`);
      tryNext();
    }
  });
}

tryNext();