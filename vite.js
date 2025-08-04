#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🚀 Starting Vite...');
  execSync('npx vite', { stdio: 'inherit' });
} catch (error) {
  console.log('📦 NPX failed, trying node modules...');
  try {
    execSync('node ./node_modules/vite/bin/vite.js', { stdio: 'inherit' });
  } catch (error2) {
    console.log('🔧 Installing vite...');
    execSync('npm install vite@latest', { stdio: 'inherit' });
    execSync('npx vite', { stdio: 'inherit' });
  }
}