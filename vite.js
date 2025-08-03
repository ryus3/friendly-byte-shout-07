#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

const viteScript = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
const args = process.argv.slice(2);

const child = spawn('node', [viteScript, ...args], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code || 0);
});