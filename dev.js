#!/usr/bin/env node

// حل نهائي لمشكلة vite not found
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('🚀 بدء تشغيل خادم التطوير...')

// استخدام npx لتشغيل vite
const child = spawn('npx', ['vite', '--host', '::', '--port', '8080'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
})

child.on('error', (error) => {
  console.error('❌ خطأ في التشغيل:', error.message)
  process.exit(1)
})

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ توقف الخادم بالكود: ${code}`)
  }
  process.exit(code)
})