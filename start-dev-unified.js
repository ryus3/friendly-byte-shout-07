#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting development server...');

// Try npx vite directly
const child = spawn('npx', ['vite', '--port', '8080', '--host', '0.0.0.0'], {
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
  if (code !== 0) {
    console.error('❌ Server exited with code:', code);
    process.exit(code);
  }
});