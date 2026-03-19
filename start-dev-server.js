#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting development server...');

// Check if node_modules exists
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('📦 Installing dependencies...');
  const install = spawn('npm', ['install'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  install.on('close', (code) => {
    if (code === 0) {
      startVite();
    } else {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
  });
} else {
  startVite();
}

function startVite() {
  // Try different methods to start vite
  const viteOptions = [
    ['npx', ['vite', '--host', '0.0.0.0', '--port', '8080']],
    ['node', [path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', '8080']],
    ['npm', ['run', 'dev']]
  ];

  function tryNext(index = 0) {
    if (index >= viteOptions.length) {
      console.error('❌ All startup methods failed');
      process.exit(1);
      return;
    }

    const [command, args] = viteOptions[index];
    console.log(`🔄 Trying method ${index + 1}: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    child.on('error', (error) => {
      console.log(`❌ Method ${index + 1} failed: ${error.message}`);
      tryNext(index + 1);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        console.log(`❌ Method ${index + 1} exited with code ${code}`);
        tryNext(index + 1);
      }
    });
  }

  tryNext();
}