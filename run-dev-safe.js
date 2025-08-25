#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting development server safely...');

const child = spawn('npx', ['vite', 'dev', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error starting dev server:', error.message);
  console.log('💡 Make sure dependencies are installed: npm install');
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});