#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Starting development server...');

try {
  // Use npx vite instead of just vite to avoid "vite: not found" error
  execSync('npx vite --host 0.0.0.0 --port 8080', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  console.log('💡 Make sure dependencies are installed: npm install');
}