#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Ultimate Vite Starter');

const vitePaths = [
  './node_modules/.bin/vite',
  './node_modules/vite/bin/vite.js'
];

function startVite() {
  for (const vitePath of vitePaths) {
    if (fs.existsSync(vitePath)) {
      console.log(`✅ Found: ${vitePath}`);
      try {
        if (vitePath.endsWith('.js')) {
          execSync(`node "${vitePath}" --host :: --port 8080`, { stdio: 'inherit' });
        } else {
          execSync(`"${vitePath}" --host :: --port 8080`, { stdio: 'inherit' });
        }
        return;
      } catch (error) {
        console.log(`⚠️ Failed with ${vitePath}, trying next...`);
        continue;
      }
    }
  }
  
  // Final fallback
  try {
    console.log('📦 Trying npx vite...');
    execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ All methods failed. Please check your setup.');
    process.exit(1);
  }
}

startVite();