#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting server with npx vite...');

// Set environment variables
process.env.NODE_ENV = 'development';

// Start the server
const viteProcess = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env
});

viteProcess.on('error', (error) => {
  console.error('❌ Error starting server:', error.message);
  console.log('\n📋 Try these solutions:');
  console.log('1. npm install');
  console.log('2. npm install vite@latest');
  process.exit(1);
});

viteProcess.on('exit', (code) => {
  if (code !== 0) {
    console.log(`Server exited with code ${code}`);
  }
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  viteProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down server...');
  viteProcess.kill('SIGTERM');
  process.exit(0);
});