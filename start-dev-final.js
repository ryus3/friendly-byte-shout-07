#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite development server...');

// Use the vite-server.js we created
const child = spawn('node', ['vite-server.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  
  // Fallback to npx
  console.log('🔄 Trying npx vite...');
  const fallback = spawn('npx', ['vite', '--port', '8080', '--host', '0.0.0.0'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  fallback.on('error', () => {
    console.error('❌ All startup methods failed');
    process.exit(1);
  });
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log('🔄 Retrying with npx...');
    spawn('npx', ['vite', '--port', '8080', '--host', '0.0.0.0'], {
      stdio: 'inherit',
      cwd: __dirname
    });
  }
});