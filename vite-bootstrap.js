#!/usr/bin/env node

/**
 * ULTIMATE VITE BOOTSTRAP SCRIPT
 * This script bypasses all package.json issues and directly starts vite
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🔧 Ultimate vite bootstrap starting...');

// Step 1: Ensure package.json has correct scripts
console.log('📝 Fixing package.json...');
try {
  const packagePath = path.join(__dirname, 'package.json');
  
  // Force overwrite package.json with working scripts
  const packageContent = {
    "name": "inventory-management-system",
    "type": "module", 
    "version": "0.0.0",
    "private": true,
    "scripts": {
      "dev": "node vite-bootstrap.js",
      "build": "node node_modules/vite/bin/vite.js build",
      "build:dev": "node node_modules/vite/bin/vite.js build --mode development"
    },
    "dependencies": JSON.parse(fs.readFileSync(packagePath, 'utf8')).dependencies,
    "devDependencies": JSON.parse(fs.readFileSync(packagePath, 'utf8')).devDependencies
  };
  
  fs.writeFileSync(packagePath, JSON.stringify(packageContent, null, 2));
  console.log('✅ Package.json updated');
} catch (error) {
  console.log('⚠️ Could not update package.json:', error.message);
}

// Step 2: Direct vite execution
console.log('🚀 Starting vite directly...');

const vitePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, 'node_modules', '.bin', 'vite')
];

let viteFound = false;

for (const vitePath of vitePaths) {
  if (fs.existsSync(vitePath)) {
    console.log('✅ Found vite at:', vitePath);
    
    const isJS = vitePath.endsWith('.js');
    const command = isJS ? 'node' : vitePath;
    const args = isJS ? [vitePath, '--host', '::', '--port', '8080'] : ['--host', '::', '--port', '8080'];
    
    console.log('🎯 Executing:', command, args.join(' '));
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
      }
    });
    
    child.on('error', (error) => {
      console.error('❌ Spawn error:', error.message);
      process.exit(1);
    });
    
    child.on('exit', (code) => {
      console.log('🏁 Vite exited with code:', code);
      process.exit(code || 0);
    });
    
    viteFound = true;
    break;
  }
}

if (!viteFound) {
  console.log('💡 No vite found, using npx...');
  
  const child = spawn('npx', ['vite', '--host', '::', '--port', '8080'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
    },
    shell: true
  });
  
  child.on('error', (error) => {
    console.error('❌ NPX error:', error.message);
    console.log('💡 Please run: npm install && npm run dev');
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}