#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Force starting Vite with npx...');

const viteProcess = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

viteProcess.on('error', (error) => {
  console.error('Failed to start Vite:', error);
  process.exit(1);
});

viteProcess.on('exit', (code) => {
  console.log(`Vite process exited with code ${code}`);
  process.exit(code);
});

// Handle process signals
process.on('SIGINT', () => {
  console.log('Received SIGINT, terminating Vite...');
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, terminating Vite...');
  viteProcess.kill('SIGTERM');
});