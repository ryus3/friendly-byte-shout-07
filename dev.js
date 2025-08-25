#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting development server...');

const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error starting server:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});