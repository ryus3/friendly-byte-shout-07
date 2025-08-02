#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('🚀 Starting development server...');

try {
  execSync('npx vite --host :: --port 8080', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env }
  });
} catch (error) {
  console.error('❌ Error starting vite:', error.message);
  process.exit(1);
}