#!/usr/bin/env node
// حل نهائي وبسيط لـ vite
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const viteBinPath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteBinPath)) {
  console.error('❌ vite غير موجود في:', viteBinPath);
  process.exit(1);
}

const child = spawn('node', [viteBinPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('exit', (code) => {
  process.exit(code || 0);
});