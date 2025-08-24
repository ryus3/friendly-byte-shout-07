#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting development server...');

// Use npx to run vite directly
const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});