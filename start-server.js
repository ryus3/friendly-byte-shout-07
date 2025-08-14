#!/usr/bin/env node

// 🔥 الحل النهائي والجذري لمشكلة vite
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 الحل الجذري: بدء تشغيل خادم التطوير...');

// البحث الذكي عن vite
const vitePaths = [
  path.resolve(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.resolve(__dirname, 'node_modules', '.bin', 'vite')
];

let viteCommand = null;
let useNode = false;

// فحص الملفات
for (const vitePath of vitePaths) {
  if (fs.existsSync(vitePath)) {
    console.log(`✅ تم العثور على vite: ${vitePath}`);
    viteCommand = vitePath;
    useNode = vitePath.endsWith('.js');
    break;
  }
}

// تحديد الأمر النهائي
const finalCommand = useNode ? 'node' : (viteCommand || 'npx');
const finalArgs = useNode ? [viteCommand, '--host', '0.0.0.0', '--port', '8080'] 
                          : viteCommand ? ['--host', '0.0.0.0', '--port', '8080']
                          : ['vite', '--host', '0.0.0.0', '--port', '8080'];

console.log(`🔧 تشغيل: ${finalCommand} ${finalArgs.join(' ')}`);

// بدء العملية
const child = spawn(finalCommand, finalArgs, {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
  },
  shell: process.platform === 'win32'
});

child.on('error', (error) => {
  console.error('❌ خطأ في التشغيل:', error.message);
  console.log('💡 جرب: node start-server.js أو bash ultimate-start.sh');
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`🏁 انتهت العملية بالكود: ${code}`);
  process.exit(code || 0);
});