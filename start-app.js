#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting application...');

// Try multiple approaches
const attempts = [
  ['npx', ['vite']],
  ['node', [path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')]],
  [path.join(process.cwd(), 'node_modules', '.bin', 'vite'), []]
];

function tryStart(index = 0) {
  if (index >= attempts.length) {
    console.error('❌ All attempts failed');
    process.exit(1);
  }
  
  const [cmd, args] = attempts[index];
  console.log(`Attempt ${index + 1}: ${cmd} ${args.join(' ')}`);
  
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  
  child.on('error', (err) => {
    console.log(`❌ Attempt ${index + 1} failed: ${err.message}`);
    tryStart(index + 1);
  });
  
  child.on('exit', (code) => {
    if (code === 0) {
      process.exit(0);
    } else {
      console.log(`❌ Attempt ${index + 1} exited with code ${code}`);
      tryStart(index + 1);
    }
  });
}

tryStart();