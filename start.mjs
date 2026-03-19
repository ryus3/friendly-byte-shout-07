#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🚀 Starting development server...');

const child = spawn('node', ['run-server-final.js'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error starting server:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});