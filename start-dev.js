#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🚀 Starting development server with npx vite...');

const child = spawn('npx', ['vite', 'dev', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error('❌ Error starting dev server:', error);
  process.exit(1);
});

child.on('close', (code) => {
  console.log(`Dev server exited with code ${code}`);
  process.exit(code);
});