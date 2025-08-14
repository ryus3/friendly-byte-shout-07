#!/usr/bin/env node
console.log('🚀 Final Server Start...');
const { spawn } = require('child_process');
const child = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit'
});
child.on('exit', process.exit);