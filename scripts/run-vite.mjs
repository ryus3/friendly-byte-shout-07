#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const viteChunkPath = path.join(projectRoot, 'node_modules', 'vite', 'dist', 'node', 'chunks', 'dep-C6uTJdX2.js');
const viteArgs = process.argv.slice(2);
const hasHealthyLocalVite = existsSync(viteChunkPath);
const shouldForceLocalVite = process.env.FORCE_LOCAL_VITE === '1';

const command = 'npx';
const args = shouldForceLocalVite && hasHealthyLocalVite
  ? ['vite', ...viteArgs]
  : ['--yes', '--package', 'vite@5.4.19', 'vite', ...viteArgs];

const child = spawn(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to start Vite:', error.message);
  process.exit(1);
});