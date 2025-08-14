#!/usr/bin/env node
// Emergency vite runner - guaranteed to work
const { execSync } = require('child_process');
console.log('🚨 Emergency Vite Runner Starting...');
try {
  execSync('node node_modules/vite/bin/vite.js --host :: --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}