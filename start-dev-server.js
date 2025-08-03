#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting development server...');

try {
  // Set environment variables
  process.env.NODE_ENV = 'development';
  
  // Add node_modules/.bin to PATH
  const binPath = path.join(__dirname, 'node_modules', '.bin');
  process.env.PATH = `${binPath}:${process.env.PATH}`;
  
  // Run vite with npx
  execSync('npx vite --host :: --port 8080 --cors', {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });
  
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  process.exit(1);
}