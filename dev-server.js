#!/usr/bin/env node

// Direct vite execution bypassing all issues
const { spawn } = require('child_process');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'dev';

console.log(`🚀 Starting vite ${command}...`);

// Use direct path to vite executable
const viteExecutable = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

// Prepare vite arguments based on command
let viteArgs = [];
if (command === 'build') {
  viteArgs = ['build'];
  if (args.includes('--mode')) {
    const modeIndex = args.indexOf('--mode');
    if (args[modeIndex + 1]) {
      viteArgs.push('--mode', args[modeIndex + 1]);
    }
  }
} else {
  // Default dev server
  viteArgs = ['--host', '::', '--port', '8080'];
}

const child = spawn('node', [viteExecutable, ...viteArgs], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: command === 'build' ? 'production' : 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});