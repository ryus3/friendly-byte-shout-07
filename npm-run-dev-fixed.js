#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting development server...');

// Try npx vite first
function startVite() {
  console.log('📝 Using npx vite...');
  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  child.on('error', (error) => {
    console.error('❌ Error with npx vite:', error.message);
    tryDirectExecution();
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.log('❌ npx vite exited with code', code);
      tryDirectExecution();
    }
  });
}

// Fallback to direct node execution
function tryDirectExecution() {
  console.log('💡 Trying direct node execution...');
  const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  
  if (fs.existsSync(vitePath)) {
    const child = spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    child.on('error', (error) => {
      console.error('❌ Failed with direct execution:', error.message);
      process.exit(1);
    });
  } else {
    console.error('❌ Vite not found. Please run: npm install');
    process.exit(1);
  }
}

// Try to run vite directly first, then fallback to npx
console.log('🔧 Trying to start development server...');

// Set NODE_ENV
process.env.NODE_ENV = 'development';

// Try direct node execution first
const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
if (fs.existsSync(vitePath)) {
  console.log('✅ Found vite binary, starting directly...');
  const child = spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env
  });
  
  child.on('error', (error) => {
    console.error('❌ Direct execution failed:', error.message);
    startVite();
  });
} else {
  console.log('💡 Vite binary not found, trying npx...');
  startVite();
}