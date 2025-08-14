#!/usr/bin/env node
console.log('🚀 Starting Vite Development Server...');

const { execFileSync } = require('child_process');
const path = require('path');

try {
  // Use execFileSync with npx to start vite
  execFileSync('npx', ['vite', '--host', '::', '--port', '8080'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('❌ Failed to start vite:', error.message);
  
  // Try alternative method
  try {
    const { execSync } = require('child_process');
    execSync('node ./node_modules/vite/bin/vite.js --host :: --port 8080', { stdio: 'inherit' });
  } catch (altError) {
    console.error('❌ Alternative method also failed');
    console.log('💡 Please try manually: npx vite --host :: --port 8080');
    process.exit(1);
  }
}