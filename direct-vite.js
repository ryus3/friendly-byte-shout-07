#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite directly...');

// Ensure we're in the project directory
process.chdir(__dirname);

try {
  // Run vite directly with full path
  const vitePath = path.join(__dirname, 'node_modules', '.bin', 'vite');
  console.log('📦 Using vite at:', vitePath);
  
  execSync(`"${vitePath}" --host 0.0.0.0 --port 8080`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
} catch (error) {
  console.log('🔄 Fallback: Using npx vite...');
  try {
    execSync('npx vite --host 0.0.0.0 --port 8080', {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });
  } catch (fallbackError) {
    console.error('❌ Both methods failed:', fallbackError.message);
    console.log('💡 Try: npm install vite@latest');
    process.exit(1);
  }
}