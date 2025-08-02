#!/usr/bin/env node

// Simple vite startup script to fix PATH issues
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('🚀 Starting development server...')

// Start vite with explicit path
const viteCommand = path.join(__dirname, 'node_modules', '.bin', 'vite')
const child = spawn(viteCommand, [], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
  }
})

child.on('error', (error) => {
  console.error('❌ Error:', error.message)
  console.log('💡 Try running: chmod +x start.js && node start.js')
})

child.on('exit', (code) => {
  process.exit(code)
})