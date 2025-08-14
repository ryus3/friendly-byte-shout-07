#!/usr/bin/env node
// Test if vite exists and create if needed
const fs = require('fs');
const path = require('path');

const viteMainPath = path.join(__dirname, 'vite');
const viteNodeModulesPath = path.join(__dirname, 'node_modules', '.bin', 'vite');

console.log('🔍 Checking vite executables...');
console.log('Main vite exists:', fs.existsSync(viteMainPath));
console.log('node_modules/.bin/vite exists:', fs.existsSync(viteNodeModulesPath));

// If no executable in node_modules/.bin, create one
if (!fs.existsSync(viteNodeModulesPath)) {
  const binDir = path.dirname(viteNodeModulesPath);
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  
  // Copy our working vite to node_modules/.bin
  const viteContent = fs.readFileSync(viteMainPath, 'utf8');
  fs.writeFileSync(viteNodeModulesPath, viteContent);
  
  // Make executable (Unix systems)
  try {
    fs.chmodSync(viteNodeModulesPath, 0o755);
  } catch (e) {
    console.log('chmod not available (Windows?)');
  }
  
  console.log('✅ Created vite in node_modules/.bin/');
}

// Now run the actual vite
console.log('🚀 Starting vite...');
require('./vite');