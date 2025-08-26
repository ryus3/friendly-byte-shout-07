#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🎯 Starting Inventory Management System...');

try {
  console.log('🚀 Starting development server...');
  // Ensure vite is installed first
  execSync('npm install vite@latest --no-save', { stdio: 'inherit' });
  execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.log('📦 Fallback: trying local vite...');
  try {
    execSync('./node_modules/.bin/vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
  } catch (fallbackError) {
    console.log('❌ Could not start vite. Installing and retrying...');
    execSync('npm install -g vite@latest', { stdio: 'inherit' });
    execSync('vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
  }
}