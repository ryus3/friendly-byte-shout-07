#!/usr/bin/env node

// Force CommonJS to avoid module issues
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting development server...');

const projectRoot = process.cwd();

// Multiple methods to start vite
function startVite() {
  const methods = [
    // Method 1: npx vite (most reliable)
    () => {
      console.log('📦 Using npx vite...');
      execSync('npx vite --host 0.0.0.0 --port 8080', {
        stdio: 'inherit',
        cwd: projectRoot,
        env: { ...process.env, NODE_ENV: 'development' }
      });
    },
    
    // Method 2: Direct node_modules path
    () => {
      const vitePath = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
      if (fs.existsSync(vitePath)) {
        console.log('🔧 Using direct vite.js...');
        execSync(`node "${vitePath}" --host 0.0.0.0 --port 8080`, {
          stdio: 'inherit',
          cwd: projectRoot,
          env: { ...process.env, NODE_ENV: 'development' }
        });
      } else {
        throw new Error('vite.js not found');
      }
    },
    
    // Method 3: .bin directory
    () => {
      const vitePath = path.join(projectRoot, 'node_modules', '.bin', 'vite');
      if (fs.existsSync(vitePath)) {
        console.log('⚙️ Using .bin/vite...');
        execSync(`"${vitePath}" --host 0.0.0.0 --port 8080`, {
          stdio: 'inherit',
          cwd: projectRoot,
          env: { 
            ...process.env, 
            NODE_ENV: 'development',
            PATH: `${path.join(projectRoot, 'node_modules', '.bin')}:${process.env.PATH}`
          }
        });
      } else {
        throw new Error('.bin/vite not found');
      }
    }
  ];

  for (let i = 0; i < methods.length; i++) {
    try {
      methods[i]();
      return; // Success - exit function
    } catch (error) {
      console.log(`❌ Method ${i + 1} failed: ${error.message}`);
      if (i === methods.length - 1) {
        console.error('💥 All startup methods failed');
        console.log('💡 Try running: npm install && npx vite --host 0.0.0.0 --port 8080');
        process.exit(1);
      }
    }
  }
}

startVite();