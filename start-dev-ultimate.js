#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting Vite development server (Ultimate Fix)...');

// Direct npx execution - most reliable method
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
  console.log('💡 Make sure you have Node.js and npm installed');
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log(`⚠️ Server exited with code: ${code}`);
  }
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating server...');
  child.kill('SIGTERM');
});