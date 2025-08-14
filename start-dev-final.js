#!/usr/bin/env node

// Final solution for vite startup
console.log('🔥 FINAL VITE SOLUTION');

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check all possible vite locations
const locations = [
  'node_modules/vite/bin/vite.js',
  'node_modules/.bin/vite',
  'node_modules/.bin/vite.cmd'
];

console.log('🔍 Searching for vite...');

for (const location of locations) {
  if (fs.existsSync(location)) {
    console.log(`✅ Found vite at: ${location}`);
    
    try {
      if (location.endsWith('.js')) {
        console.log('🚀 Starting with node...');
        execSync(`node "${location}" --host :: --port 8080`, { stdio: 'inherit' });
      } else {
        console.log('🚀 Starting directly...');
        execSync(`"${location}" --host :: --port 8080`, { stdio: 'inherit' });
      }
      process.exit(0);
    } catch (error) {
      console.log(`⚠️ Failed with ${location}: ${error.message}`);
      continue;
    }
  }
}

// Final fallback
console.log('📦 Using npx as final fallback...');
try {
  execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ All methods failed!');
  console.log('\n💡 Manual steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: node node_modules/vite/bin/vite.js --host :: --port 8080');
  process.exit(1);
}