#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🚀 Starting development server...');
  execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.log('📦 Installing vite and retrying...');
  execSync('npm install vite@latest', { stdio: 'inherit' });
  execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
}