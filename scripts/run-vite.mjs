#!/usr/bin/env node

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const viteConfigPath = path.join(projectRoot, 'vite.config.js');
const viteChunkPath = path.join(projectRoot, 'node_modules', 'vite', 'dist', 'node', 'chunks', 'dep-C6uTJdX2.js');
const viteArgs = process.argv.slice(2);
const hasHealthyLocalVite = existsSync(viteChunkPath);
const shouldForceLocalVite = process.env.FORCE_LOCAL_VITE === '1';

const hasExplicitConfig = viteArgs.includes('--config') || viteArgs.some((arg) => arg.startsWith('--config='));
const firstArg = viteArgs[0];
const hasNamedCommand = Boolean(firstArg && !firstArg.startsWith('-'));

const withRootAndConfig = (args) => {
  if (hasNamedCommand) {
    const [commandName, ...rest] = args;
    return hasExplicitConfig
      ? [commandName, projectRoot, ...rest]
      : [commandName, projectRoot, ...rest, '--config', viteConfigPath];
  }

  return hasExplicitConfig
    ? [projectRoot, ...args]
    : [projectRoot, ...args, '--config', viteConfigPath];
};

const useLocalVite = shouldForceLocalVite && hasHealthyLocalVite;
const isolatedCwd = useLocalVite ? projectRoot : mkdtempSync(path.join(os.tmpdir(), 'vite-runner-'));

if (!useLocalVite) {
  process.on('exit', () => {
    rmSync(isolatedCwd, { recursive: true, force: true });
  });
}

const command = 'npx';
const args = useLocalVite
  ? ['vite', ...viteArgs]
  : ['--yes', '--package', 'vite@5.4.19', 'vite', ...withRootAndConfig(viteArgs)];

const child = spawn(command, args, {
  cwd: isolatedCwd,
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