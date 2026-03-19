#!/usr/bin/env node

// Simple dev starter - guaranteed to work
const { exec } = require('child_process');

console.log('🚀 Starting development server...');

// Direct npx call - most reliable
exec('npx vite --host 0.0.0.0 --port 8080', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  console.log(stdout);
  if (stderr) console.error(stderr);
});