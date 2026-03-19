#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 Starting development server...');

// Direct npx call - bypass package.json issues
try {
  execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}