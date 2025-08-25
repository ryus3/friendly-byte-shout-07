#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🚀 تشغيل خادم التطوير...');
  execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.log('📦 تثبيت vite والتشغيل...');
  execSync('npm install vite@latest', { stdio: 'inherit' });
  execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });
}