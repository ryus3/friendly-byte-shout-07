#!/usr/bin/env node

/**
 * تشغيل Vite مباشرة - حل نهائي لمشكلة "vite not found"
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔥 تشغيل خادم التطوير...');

// تشغيل vite مباشرة من node_modules
const viteProcess = spawn('node', [
  './node_modules/vite/bin/vite.js',
  '--host', '0.0.0.0', 
  '--port', '8080'
], {
  stdio: 'inherit',
  shell: false
});

viteProcess.on('error', (error) => {
  console.error('❌ خطأ:', error.message);
  process.exit(1);
});

viteProcess.on('close', (code) => {
  process.exit(code);
});