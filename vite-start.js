#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite development server...');

// Primary method: npx vite
const child = spawn('npx', ['vite', 'dev', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error starting with npx:', error.message);
  
  // Fallback: direct node execution
  const vitePath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
  console.log('🔄 Trying direct vite execution...');
  
  const fallback = spawn('node', [vitePath, 'dev', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  fallback.on('error', (err) => {
    console.error('❌ All methods failed:', err.message);
    console.log('💡 Please run: npm install');
    process.exit(1);
  });
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log(`Process exited with code ${code}`);
  }
});