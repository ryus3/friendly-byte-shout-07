#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting development server...');

// Try different vite execution methods
const vitePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, 'node_modules', '.bin', 'vite')
];

let found = false;
for (const vitePath of vitePaths) {
  if (fs.existsSync(vitePath)) {
    console.log(`✅ Found vite at: ${vitePath}`);
    
    const child = spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    child.on('error', (error) => {
      console.error('❌ Error:', error.message);
      tryNpx();
    });

    found = true;
    break;
  }
}

if (!found) {
  console.log('💡 Using npx as fallback...');
  tryNpx();
}

function tryNpx() {
  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start with npx:', error.message);
    console.log('💡 Please run: npm install');
    process.exit(1);
  });
}