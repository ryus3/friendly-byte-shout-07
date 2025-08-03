#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  execSync('node ./node_modules/vite/bin/vite.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error starting vite:', error.message);
  process.exit(1);
}