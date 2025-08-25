#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🚀 Starting development server...');
  execSync('npx vite dev', { stdio: 'inherit' });
} catch (error) {
  console.log('📦 Installing vite and starting...');
  execSync('npm install vite@latest', { stdio: 'inherit' });
  execSync('npx vite dev', { stdio: 'inherit' });
}