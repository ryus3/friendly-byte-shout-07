#!/usr/bin/env node
// Emergency Vite - Direct execution
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Emergency Vite Launcher');

try {
  // Method 1: Direct node execution of vite.js
  const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  console.log('📍 Trying direct vite execution...');
  execSync(`node "${vitePath}" --host :: --port 8080`, { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️ Direct method failed, trying npx...');
  try {
    execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
  } catch (npxError) {
    console.error('❌ Both methods failed');
    console.log('💡 Manual command: node node_modules/vite/bin/vite.js --host :: --port 8080');
    process.exit(1);
  }
}