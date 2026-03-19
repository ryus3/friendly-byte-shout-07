#!/usr/bin/env node

// Force install vite globally accessible
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

try {
  console.log('🔧 Setting up vite...')
  
  // Create a direct vite executable in project root
  const viteWrapper = `#!/bin/bash
export PATH="./node_modules/.bin:$PATH"
exec ./node_modules/.bin/vite "$@"
`
  
  fs.writeFileSync('./vite', viteWrapper, { mode: 0o755 })
  console.log('✅ Created vite wrapper')
  
  // Now start the server
  execSync('./vite --host :: --port 8080', {
    stdio: 'inherit',
    cwd: process.cwd()
  })
  
} catch (error) {
  console.error('❌ Error:', error.message)
  console.log('💡 Trying npx fallback...')
  
  try {
    execSync('npx vite --host :: --port 8080', {
      stdio: 'inherit'
    })
  } catch (fallbackError) {
    console.error('❌ Fallback failed:', fallbackError.message)
    process.exit(1)
  }
}