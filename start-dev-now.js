#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Starting development server...');

try {
  // Use npx to ensure vite is available
  execSync('npx vite --host 0.0.0.0 --port 8080', {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  console.log('💡 Try: npm install && node start-dev-now.js');
  process.exit(1);
}