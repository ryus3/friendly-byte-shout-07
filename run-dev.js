#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting vite server...');

// Direct npx call - most reliable method
const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' }
});

child.on('error', (error) => {
  console.error('❌ Failed to start:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});