#!/usr/bin/env node

// Alternative dev server starter
const { execSync } = require('child_process');
const path = require('path');

try {
  // Try different methods to start vite
  console.log('🚀 Starting development server...');
  
  // Check for vite in multiple locations
  const fs = require('fs');
  const viteBinPath = path.join(process.cwd(), 'node_modules', '.bin', 'vite');
  const viteJsPath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  
  if (fs.existsSync(viteBinPath)) {
    console.log('✅ Found vite binary, starting...');
    execSync(`"${viteBinPath}" --host :: --port 8080`, { stdio: 'inherit' });
  } else if (fs.existsSync(viteJsPath)) {
    console.log('✅ Found vite.js, starting with node...');
    execSync(`node "${viteJsPath}" --host :: --port 8080`, { stdio: 'inherit' });
  } else {
    // Try npx as fallback
    console.log('📦 Using npx fallback...');
    execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Failed to start dev server:', error.message);
  
  // Try ultimate fallback
  console.log('\n🔧 Trying alternative methods...');
  try {
    // Method 3: Try different port
    execSync('npx vite --host 0.0.0.0 --port 5173', { stdio: 'inherit' });
  } catch (fallbackError) {
    console.log('\n💡 Manual troubleshooting steps:');
    console.log('1. Run: npm install');
    console.log('2. Run: npm run build');
    console.log('3. Run: npx vite --host :: --port 8080');
    console.log('4. Or try: node ./node_modules/vite/bin/vite.js');
    
    process.exit(1);
  }
}