#!/usr/bin/env node
import { execSync } from 'child_process'

try {
  execSync('npx vite --host :: --port 8080', { stdio: 'inherit' })
} catch (error) {
  console.error('Error:', error.message)
}