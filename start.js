#!/usr/bin/env node

// Startup script that properly applies package-override.json and handles vite
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🔧 Applying package override...');
  
  // Read package-override.json and copy it to package.json  
  if (fs.existsSync('./package-override.json')) {
    const override = fs.readFileSync('./package-override.json', 'utf8');
    fs.writeFileSync('./package.json', override);
    console.log('✅ Applied package override');
  }
  
  // Now directly run vite with proper path
  console.log('🚀 Starting development server...');
  
  const vitePath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(vitePath)) {
    console.log('✅ Found vite, starting...');
    execSync(`node "${vitePath}" --host :: --port 8080`, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
      }
    });
  } else {
    console.log('💡 Using npx fallback...');
    execSync('npx vite --host :: --port 8080', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
      }
    });
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('💡 Try manually: npm install && npx vite --host :: --port 8080');
  process.exit(1);
}