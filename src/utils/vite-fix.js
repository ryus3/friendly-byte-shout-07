#!/usr/bin/env node

// Temporary fix for vite startup issue
const { execSync } = require('child_process');

console.log('🚀 Starting development server with fixed command...');

try {
  execSync('npx vite --host 0.0.0.0 --port 8080', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  process.exit(1);
}