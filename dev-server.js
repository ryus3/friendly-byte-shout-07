#!/usr/bin/env node

// Direct vite execution bypassing all issues
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting vite directly...');

// Use direct path to vite executable
const viteExecutable = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

const child = spawn('node', [viteExecutable, '--host', '::', '--port', '8080'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});