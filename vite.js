#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite Server...');

// Direct path to vite
const vitePath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

try {
  console.log('📍 Using vite at:', vitePath);
  execSync(`node "${vitePath}" --host :: --port 8080`, { 
    stdio: 'inherit',
    cwd: __dirname 
  });
} catch (error) {
  console.log('⚠️ Fallback to npx...');
  try {
    execSync('npx vite --host :: --port 8080', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
  } catch (fallbackError) {
    console.error('❌ Both methods failed:', fallbackError.message);
    process.exit(1);
  }
}