#!/usr/bin/env node
// Direct vite runner for Lovable
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite dev server...');

try {
  // محاولة تشغيل vite مباشرة
  execSync('node node_modules/vite/bin/vite.js --host :: --port 8080', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
} catch (error) {
  console.log('⚠️ Fallback to npx...');
  try {
    execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
  } catch (fallbackError) {
    console.error('❌ Both methods failed:', fallbackError.message);
    process.exit(1);
  }
}