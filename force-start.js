#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Force install vite if needed
console.log('🔧 Ensuring Vite is available...');

try {
  execSync('npm list vite', { stdio: 'pipe' });
  console.log('✅ Vite is installed');
} catch {
  console.log('📦 Installing Vite...');
  execSync('npm install vite@latest --save-dev', { stdio: 'inherit' });
}

// Start with npx to ensure it works
console.log('🚀 Starting with npx vite...');
execSync('npx vite --host 0.0.0.0 --port 8080', { 
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});