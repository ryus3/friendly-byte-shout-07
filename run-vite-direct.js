#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vite development server...');

try {
  // Try multiple ways to run vite
  const commands = [
    'npx vite --host 0.0.0.0 --port 8080',
    'node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080',
    './node_modules/.bin/vite --host 0.0.0.0 --port 8080'
  ];

  for (const cmd of commands) {
    try {
      console.log(`Trying: ${cmd}`);
      execSync(cmd, { 
        stdio: 'inherit', 
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'development' }
      });
      break;
    } catch (error) {
      console.log(`Command failed: ${cmd}`);
      continue;
    }
  }
} catch (error) {
  console.error('Failed to start Vite:', error.message);
  process.exit(1);
}