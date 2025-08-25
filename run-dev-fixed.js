#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('🔧 Fixing Vite startup...');

// Method 1: Try using npx vite directly
function tryNpxVite() {
  console.log('📝 Method 1: Using npx vite...');
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npx vite exited with code ${code}`));
    });
  });
}

// Method 2: Try direct node execution
function tryDirectNode() {
  console.log('📝 Method 2: Using direct node execution...');
  return new Promise((resolve, reject) => {
    const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Direct node execution exited with code ${code}`));
    });
  });
}

async function startServer() {
  try {
    await tryNpxVite();
  } catch (error1) {
    console.log('❌ Method 1 failed:', error1.message);
    try {
      await tryDirectNode();
    } catch (error2) {
      console.log('❌ Method 2 failed:', error2.message);
      console.error('❌ All startup methods failed');
      process.exit(1);
    }
  }
}

startServer();