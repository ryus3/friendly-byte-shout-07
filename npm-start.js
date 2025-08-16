#!/usr/bin/env node
import { execSync } from 'child_process'

try {
  console.log('🚀 Starting with npx vite...')
  execSync('npx vite --host :: --port 8080', {
    stdio: 'inherit',
    cwd: process.cwd()
  })
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}