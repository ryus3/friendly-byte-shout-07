#!/usr/bin/env node

// Alternative dev server starter
const { execSync } = require('child_process');
const path = require('path');

try {
  // Try different methods to start vite
  console.log('🚀 Starting development server...');
  
  // Method 1: Direct node execution
  const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  const fs = require('fs');
  
  if (fs.existsSync(vitePath)) {
    console.log('✅ Found vite, starting with correct options...');
    execSync(`node "${vitePath}" --host :: --port 8080`, { stdio: 'inherit' });
  } else {
    // Method 2: npx fallback
    console.log('📦 Using npx fallback...');
    execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Failed to start dev server:', error.message);
  
  // Method 3: Manual instructions
  console.log('\n🔧 Try running these commands manually:');
  console.log('npm install');
  console.log('npx vite --host :: --port 8080');
  
  process.exit(1);
}