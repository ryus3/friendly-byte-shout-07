#!/usr/bin/env node

import { execSync } from 'child_process';

try {
  console.log('🚀 بدء تشغيل الخادم من vite.mjs...');
  execSync('npx vite --host :: --port 8080', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('❌ خطأ:', error.message);
  process.exit(1);
}