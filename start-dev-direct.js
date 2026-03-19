#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting Vite development server...');

// Use npx to ensure Vite runs even if not in PATH
const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start Vite:', error.message);
  console.log('💡 Trying alternative method...');
  
  // Fallback: try direct node execution
  const fallback = spawn('node', ['./node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  fallback.on('error', (err) => {
    console.error('❌ All methods failed:', err.message);
    process.exit(1);
  });
});

child.on('exit', (code) => {
  process.exit(code || 0);
});