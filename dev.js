#!/usr/bin/env node

import { execSync } from 'child_process'
import path from 'path'

const projectRoot = process.cwd()

try {
  console.log('🚀 Starting development server...')
  
  // Add node_modules/.bin to PATH and run vite
  const vitePath = path.join(projectRoot, 'node_modules', '.bin', 'vite')
  const env = {
    ...process.env,
    PATH: `${path.join(projectRoot, 'node_modules', '.bin')}:${process.env.PATH}`
  }
  
  execSync(`"${vitePath}" --host :: --port 8080`, {
    stdio: 'inherit',
    env,
    cwd: projectRoot
  })
  
} catch (error) {
  console.log('💡 Trying alternative method...')
  try {
    // Fallback to npx
    execSync('npx vite --host :: --port 8080', {
      stdio: 'inherit',
      cwd: projectRoot
    })
  } catch (fallbackError) {
    console.error('❌ All methods failed:', fallbackError.message)
    process.exit(1)
  }
}