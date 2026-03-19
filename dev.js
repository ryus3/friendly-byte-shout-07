#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎯 Starting Inventory Management System...');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Add node_modules/.bin to PATH
const nodeModulesBin = path.join(__dirname, 'node_modules', '.bin');
process.env.PATH = `${nodeModulesBin}${path.delimiter}${process.env.PATH}`;

function startVite() {
  console.log('🚀 Starting development server...');
  
  // Ensure vite is available
  const viteJsPath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
  const viteBinPath = path.join(nodeModulesBin, 'vite');
  
  if (fs.existsSync(viteJsPath)) {
    console.log(`✅ Found vite.js at: ${viteJsPath}`);
    const child = spawn('node', [viteJsPath, '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname,
      env: process.env
    });
    
    child.on('error', (error) => {
      console.error('❌ Error starting vite:', error.message);
      fallbackToNpx();
    });
    
    return;
  }
  
  if (fs.existsSync(viteBinPath)) {
    console.log(`✅ Found vite bin at: ${viteBinPath}`);
    const child = spawn(viteBinPath, ['--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname,
      env: process.env
    });
    
    child.on('error', (error) => {
      console.error('❌ Error starting vite:', error.message);
      fallbackToNpx();
    });
    
    return;
  }
  
  fallbackToNpx();
}

function fallbackToNpx() {
  console.log('📦 Using npx vite as fallback...');
  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname,
    shell: process.platform === 'win32',
    env: process.env
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start vite with npx:', error.message);
    console.log('🔧 Trying to install vite globally...');
    try {
      execSync('npm install -g vite@latest', { stdio: 'inherit' });
      console.log('✅ Vite installed globally, retrying...');
      const globalChild = spawn('vite', ['--host', '0.0.0.0', '--port', '8080'], {
        stdio: 'inherit',
        cwd: __dirname,
        shell: true,
        env: process.env
      });
      globalChild.on('error', (err) => {
        console.error('❌ All methods failed:', err.message);
        process.exit(1);
      });
    } catch (installError) {
      console.error('❌ Failed to install vite globally:', installError.message);
      process.exit(1);
    }
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down development server...');
  process.exit(0);
});

startVite();