#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

try {
  const args = process.argv.slice(2).join(' ');
  
  if (existsSync('./node_modules/.bin/vite')) {
    execSync(`./node_modules/.bin/vite ${args}`, { stdio: 'inherit' });
  } else if (existsSync('./node_modules/vite/bin/vite.js')) {
    execSync(`node ./node_modules/vite/bin/vite.js ${args}`, { stdio: 'inherit' });
  } else {
    execSync(`npx vite ${args}`, { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Error running vite:', error.message);
  process.exit(1);
}