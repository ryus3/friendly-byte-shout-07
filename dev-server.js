#!/usr/bin/env node

// ESM-compatible dev server to run Vite directly
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('🚀 Starting Vite directly (ESM)...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use direct path to vite executable
const viteExecutable = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

const port = process.env.PORT || '5173';
const host = process.env.HOST || '::';

const child = spawn(process.execPath, [viteExecutable, '--host', host, '--port', port], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});