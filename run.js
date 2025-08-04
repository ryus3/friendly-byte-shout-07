#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// حل مسار Vite
const vitePath = resolve(__dirname, 'node_modules', '.bin', 'vite');

// تشغيل Vite مع تمرير جميع المعاملات
const child = spawn('node', [vitePath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Error starting Vite:', err);
  process.exit(1);
});