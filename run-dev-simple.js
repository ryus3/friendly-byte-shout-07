const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting development server...');

// Try to run vite directly from node_modules
const vitePath = path.join(__dirname, 'node_modules', '.bin', 'vite');
const child = spawn('node', [vitePath, 'dev'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('error', (error) => {
  console.error('❌ Error:', error);
  console.log('Trying npx fallback...');
  
  const fallback = spawn('npx', ['vite', 'dev'], {
    stdio: 'inherit',
    shell: true
  });
  
  fallback.on('error', (err) => {
    console.error('❌ Fallback failed:', err);
    process.exit(1);
  });
});

child.on('close', (code) => {
  process.exit(code);
});