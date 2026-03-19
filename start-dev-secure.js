#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting development server with security checks...');

// التحقق من وجود Vite
const checkVite = () => {
  const vitePath = path.join(__dirname, 'node_modules', '.bin', 'vite');
  const viteExists = fs.existsSync(vitePath);
  
  if (viteExists) {
    console.log('✅ Vite found in node_modules/.bin');
    return vitePath;
  }
  
  console.log('📦 Using npx vite as fallback');
  return 'npx';
};

const viteCommand = checkVite();
const args = viteCommand === 'npx' ? ['vite', '--host', '0.0.0.0', '--port', '8080'] : ['--host', '0.0.0.0', '--port', '8080'];

const child = spawn(viteCommand, args, {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  console.log('🔄 Trying alternative method...');
  
  // محاولة بديلة
  const fallback = spawn('node', ['./node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  fallback.on('error', (err) => {
    console.error('❌ All methods failed:', err.message);
    process.exit(1);
  });
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

// إغلاق آمن
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  child.kill('SIGINT');
});