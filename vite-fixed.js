#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Starting development server with fixed vite command...');

try {
  // Use npx vite instead of just vite to avoid "vite: not found" error
  console.log('📦 Running: npx vite --host 0.0.0.0 --port 8080');
  execSync('npx vite --host 0.0.0.0 --port 8080', { 
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  console.log('💡 Fallback commands to try:');
  console.log('  npm install');
  console.log('  node start-dev-fix.js');
  console.log('  npm run dev');
}