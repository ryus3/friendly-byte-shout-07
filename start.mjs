#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting development server...');

// Try different methods to start vite
const methods = [
  // Method 1: npx vite
  () => {
    console.log('📦 Using npx vite...');
    return spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'development' }
    });
  },
  
  // Method 2: Direct vite.js
  () => {
    const vitePath = join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
    if (existsSync(vitePath)) {
      console.log('🔧 Using direct vite.js...');
      return spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env, NODE_ENV: 'development' }
      });
    }
    throw new Error('vite.js not found');
  }
];

function tryMethod(index = 0) {
  if (index >= methods.length) {
    console.error('❌ All startup methods failed');
    console.log('💡 Try running: npm install && npx vite --host 0.0.0.0 --port 8080');
    process.exit(1);
    return;
  }

  try {
    const child = methods[index]();
    
    child.on('error', (error) => {
      console.log(`❌ Method ${index + 1} failed: ${error.message}`);
      tryMethod(index + 1);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        console.log(`❌ Method ${index + 1} exited with code ${code}`);
        tryMethod(index + 1);
      }
    });

  } catch (error) {
    console.log(`❌ Method ${index + 1} failed: ${error.message}`);
    tryMethod(index + 1);
  }
}

tryMethod();