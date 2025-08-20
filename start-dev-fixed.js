#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🚀 تشغيل الخادم...');
  execSync('npx vite', { stdio: 'inherit' });
} catch (error) {
  console.log('📦 تثبيت vite والتشغيل...');
  execSync('npm install vite@latest', { stdio: 'inherit' });
  execSync('npx vite', { stdio: 'inherit' });
}