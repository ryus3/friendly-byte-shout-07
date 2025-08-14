#!/usr/bin/env node

console.log('🚀 Vite Server Launcher');

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the project root directory
const projectRoot = process.cwd();

// Define possible vite locations in order of preference
const viteLocations = [
  // 1. Local .bin directory
  {
    path: path.join(projectRoot, 'node_modules', '.bin', 'vite'),
    type: 'binary',
    platform: process.platform !== 'win32' ? 'unix' : 'win'
  },
  // 2. Windows .cmd version
  {
    path: path.join(projectRoot, 'node_modules', '.bin', 'vite.cmd'),
    type: 'cmd',
    platform: 'win'
  },
  // 3. Direct vite.js
  {
    path: path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    type: 'node',
    platform: 'all'
  }
];

async function findAndStartVite() {
  console.log('🔍 Searching for vite installation...');
  
  // Check each location
  for (const location of viteLocations) {
    if (location.platform !== 'all' && location.platform !== (process.platform === 'win32' ? 'win' : 'unix')) {
      continue;
    }
    
    if (fs.existsSync(location.path)) {
      console.log(`✅ Found vite at: ${location.path}`);
      return startViteWithPath(location);
    }
  }
  
  // If no local vite found, try npx
  console.log('⚠️ No local vite found, trying npx...');
  return startViteWithNpx();
}

function startViteWithPath(location) {
  return new Promise((resolve, reject) => {
    let command, args;
    
    switch (location.type) {
      case 'binary':
      case 'cmd':
        command = location.path;
        args = ['--host', '::', '--port', '8080'];
        break;
      case 'node':
        command = 'node';
        args = [location.path, '--host', '::', '--port', '8080'];
        break;
      default:
        return reject(new Error('Unknown vite type'));
    }
    
    console.log(`🚀 Starting vite with: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: process.platform === 'win32'
    });
    
    child.on('error', (error) => {
      console.error(`❌ Failed to start vite: ${error.message}`);
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Vite exited with code ${code}`));
      } else {
        resolve();
      }
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down vite server...');
      child.kill('SIGINT');
    });
  });
}

function startViteWithNpx() {
  return new Promise((resolve, reject) => {
    console.log('📦 Starting vite with npx...');
    
    const child = spawn('npx', ['vite', '--host', '::', '--port', '8080'], {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: true
    });
    
    child.on('error', (error) => {
      console.error(`❌ Failed to start vite with npx: ${error.message}`);
      
      // Final fallback instructions
      console.log('\n💡 Troubleshooting steps:');
      console.log('1. Check if Node.js is installed: node --version');
      console.log('2. Install dependencies: npm install');
      console.log('3. Try manual start: npx vite');
      console.log('4. Or use Node.js directly: node ./node_modules/vite/bin/vite.js');
      
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Npx vite exited with code ${code}`));
      } else {
        resolve();
      }
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down vite server...');
      child.kill('SIGINT');
    });
  });
}

// Start the process
findAndStartVite().catch((error) => {
  console.error('❌ Could not start vite development server');
  console.error('Error:', error.message);
  process.exit(1);
});