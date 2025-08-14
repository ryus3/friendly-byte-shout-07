#!/usr/bin/env node

// Emergency vite starter - bypasses all issues
process.chdir(__dirname);

const { spawn } = require('child_process');

console.log('🆘 Emergency Vite Launcher');

// Just use npx with full path resolution
const child = spawn('npx', ['vite', '--host', '::', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
  env: {
    ...process.env,
    PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH}`
  }
});

child.on('error', (error) => {
  console.error('❌ Emergency start failed:', error.message);
  console.log('\n💡 Manual steps:');
  console.log('1. npm install');
  console.log('2. node ./node_modules/vite/bin/vite.js --host :: --port 8080');
  process.exit(1);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});