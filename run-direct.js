#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🎯 Direct Vite Execution...');

// Direct path to vite
const vitePath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

console.log('🚀 Starting with:', vitePath);

const child = spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env
});

child.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`🏁 Vite exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  child.kill('SIGTERM');
});