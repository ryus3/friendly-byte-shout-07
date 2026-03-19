#!/usr/bin/env node

// Direct execution of npx vite
const { execSync } = require('child_process');

try {
  console.log('🚀 Starting unified inventory system...');
  execSync('npx vite --host 0.0.0.0 --port 8080', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  console.log('💡 Make sure dependencies are installed: npm install');
  process.exit(1);
}