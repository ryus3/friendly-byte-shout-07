#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function start(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'development' }
  });
  child.on('error', (err) => {
    console.error('❌ Dev start error:', err.message);
    process.exit(1);
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.log('⚠️ Process exited with code', code);
      // try fallback to npx
      start('npx', ['vite', '--host', '0.0.0.0']);
    }
  });
}

const viteJs = join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
start('node', [viteJs, '--host', '0.0.0.0']);
