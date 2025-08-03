#!/usr/bin/env node

import { execSync } from 'child_process'
import path from 'path'

const projectRoot = process.cwd()
const args = process.argv.slice(2)
const command = args[0] || 'dev'

try {
  let viteCommand = ''
  
  if (command === 'build') {
    viteCommand = 'build'
  } else if (command === 'preview') {
    viteCommand = 'preview'
  } else {
    viteCommand = '--host :: --port 8080'
  }
  
  console.log(`🚀 Running vite ${command}...`)
  
  // Add node_modules/.bin to PATH and run vite
  const vitePath = path.join(projectRoot, 'node_modules', '.bin', 'vite')
  const env = {
    ...process.env,
    PATH: `${path.join(projectRoot, 'node_modules', '.bin')}:${process.env.PATH}`
  }
  
  execSync(`"${vitePath}" ${viteCommand}`, {
    stdio: 'inherit',
    env,
    cwd: projectRoot
  })
  
} catch (error) {
  console.log('💡 Trying alternative method...')
  try {
    // Fallback to npx
    let npxCommand = `npx vite`
    if (command === 'build') {
      npxCommand += ' build'
    } else if (command === 'preview') {
      npxCommand += ' preview'
    } else {
      npxCommand += ' --host :: --port 8080'
    }
    
    execSync(npxCommand, {
      stdio: 'inherit',
      cwd: projectRoot
    })
  } catch (fallbackError) {
    console.error('❌ All methods failed:', fallbackError.message)
    process.exit(1)
  }
}