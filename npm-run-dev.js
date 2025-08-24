#!/usr/bin/env node

// حل بديل لتشغيل vite بدون تعديل package.json
const { execSync } = require('child_process');

try {
  console.log('🚀 Starting development server...');
  execSync('npx vite --host 0.0.0.0 --port 8080', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  console.log('💡 Please ensure dependencies are installed: npm install');
}