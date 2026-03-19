#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Run vite directly
const viteCommand = path.join(__dirname, 'node_modules', '.bin', 'vite');

const child = spawn('node', [viteCommand], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

child.on('error', (error) => {
  console.error('Error starting vite:', error);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code);
});