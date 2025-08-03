#!/usr/bin/env node

// حل جذري لمشكلة vite PATH
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('🚀 بدء خادم التطوير...')
console.log('📁 مجلد العمل:', __dirname)

// محاولة عدة طرق للعثور على vite
const vitePaths = [
  path.join(__dirname, 'node_modules', '.bin', 'vite'),
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  'vite'
]

let viteCommand = null
let useNode = false

for (const vitePath of vitePaths) {
  if (fs.existsSync(vitePath)) {
    viteCommand = vitePath
    if (vitePath.endsWith('.js')) {
      useNode = true
    }
    console.log('✅ تم العثور على vite في:', vitePath)
    break
  }
}

if (!viteCommand) {
  console.log('💡 استخدام npx كحل بديل...')
  viteCommand = 'npx'
}

// بدء العملية
const args = viteCommand === 'npx' ? ['vite'] : []
const command = useNode ? 'node' : viteCommand
const finalArgs = useNode ? [viteCommand, ...args] : args

console.log('🔧 الأمر:', command, finalArgs)

const child = spawn(command, finalArgs, {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
  },
  shell: process.platform === 'win32'
})

child.on('error', (error) => {
  console.error('❌ خطأ:', error.message)
  console.log('💡 جرب: chmod +x start.js && node start.js')
  process.exit(1)
})

child.on('exit', (code) => {
  console.log('🏁 انتهت العملية بالكود:', code)
  process.exit(code)
})