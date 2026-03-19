#!/usr/bin/env node

// حل نهائي لمشكلة vite not found
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Vite server...');

// البحث عن vite في أماكن متعددة
const vitePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, 'node_modules', '.bin', 'vite')
];

let viteFound = false;
let vitePath = null;

for (const pathToCheck of vitePaths) {
  if (fs.existsSync(pathToCheck)) {
    console.log(`✅ Found vite at: ${pathToCheck}`);
    vitePath = pathToCheck;
    viteFound = true;
    break;
  }
}

if (viteFound) {
  // تشغيل vite مباشرة
  const isJsFile = vitePath.endsWith('.js');
  const command = isJsFile ? 'node' : vitePath;
  const args = isJsFile ? [vitePath, '--host', '0.0.0.0', '--port', '8080'] : ['--host', '0.0.0.0', '--port', '8080'];
  
  console.log(`🔧 Running: ${command} ${args.join(' ')}`);
  
  const child = spawn(command, args, {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  child.on('error', (error) => {
    console.error('❌ Error starting vite:', error.message);
    console.log('💡 Trying npx as fallback...');
    startWithNpx();
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.log('💡 Trying npx as fallback...');
      startWithNpx();
    }
  });
} else {
  console.log('💡 Vite not found locally, using npx...');
  startWithNpx();
}

function startWithNpx() {
  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start with npx:', error.message);
    console.log('💡 Please run: npm install && npm run dev');
    process.exit(1);
  });
}