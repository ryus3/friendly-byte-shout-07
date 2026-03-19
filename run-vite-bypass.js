#!/usr/bin/env node

// Bypass for vite execution issues
const { spawn } = require('child_process');

console.log('🚀 Starting vite development server (bypass mode)...');

const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
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