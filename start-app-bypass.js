#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🔧 Bypassing package.json script, starting Vite directly...');

// Direct execution that doesn't rely on package.json scripts
const child = spawn('node', ['direct-vite.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
  process.exit(code || 0);
});