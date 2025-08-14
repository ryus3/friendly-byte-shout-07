#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Universal Vite Runner');

// Find vite executable
const possiblePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, 'node_modules', '.bin', 'vite'),
  'vite'
];

let vitePath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    vitePath = p;
    console.log(`✅ Found vite at: ${vitePath}`);
    break;
  }
}

if (!vitePath) {
  console.error('❌ Vite not found in any expected location');
  process.exit(1);
}

// Launch vite
const args = ['--host', '::', '--port', '8080'];
let command, commandArgs;

if (vitePath.endsWith('.js')) {
  command = 'node';
  commandArgs = [vitePath, ...args];
} else {
  command = vitePath;
  commandArgs = args;
}

console.log(`🎯 Executing: ${command} ${commandArgs.join(' ')}`);

const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('error', (err) => {
  console.error('❌ Launch failed:', err.message);
  process.exit(1);
});

child.on('close', (code) => {
  console.log(`🔄 Process exited with code ${code}`);
  process.exit(code);
});

// Handle signals
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));