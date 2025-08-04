#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// تشغيل vite مباشرة من node_modules
const vitePath = path.join(__dirname, 'node_modules', '.bin', 'vite');
const viteProcess = spawn('node', [vitePath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true
});

viteProcess.on('close', (code) => {
  process.exit(code);
});