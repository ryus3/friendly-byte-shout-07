#!/usr/bin/env node

// حل نهائي لمشكلة vite
import { execSync } from 'child_process'

try {
  console.log('🚀 بدء تشغيل الخادم...')
  // تشغيل vite مع npx لضمان العثور على المسار الصحيح
  execSync('npx vite --host :: --port 8080 --cors', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  })
} catch (error) {
  console.error('❌ خطأ:', error.message)
  process.exit(1)
}