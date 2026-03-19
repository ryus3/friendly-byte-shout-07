#!/usr/bin/env node
const path = require('path');

// البحث عن vite في عدة مواقع
const possiblePaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, 'node_modules', '.bin', 'vite'),
  'npx vite'
];

for (const vitePath of possiblePaths) {
  try {
    if (vitePath === 'npx vite') {
      const { execSync } = require('child_process');
      execSync('npx vite', { stdio: 'inherit' });
      break;
    } else {
      const fs = require('fs');
      if (fs.existsSync(vitePath)) {
        if (vitePath.endsWith('.js')) {
          require(vitePath);
        } else {
          const { execSync } = require('child_process');
          execSync(`"${vitePath}"`, { stdio: 'inherit' });
        }
        break;
      }
    }
  } catch (error) {
    console.log(`محاولة فاشلة: ${vitePath}`);
    if (vitePath === possiblePaths[possiblePaths.length - 1]) {
      console.error('فشل في تشغيل vite من جميع المواقع');
      process.exit(1);
    }
  }
}