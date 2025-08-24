#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 تشخيص مشكلة vite...\n');

// فحص package.json
console.log('📄 package.json scripts:');
try {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log('  dev:', pkg.scripts?.dev || 'غير موجود');
  console.log('  vite dependency:', pkg.dependencies?.vite || 'غير موجود');
} catch (e) {
  console.log('  ❌ خطأ في قراءة package.json');
}

// فحص node_modules
console.log('\n📁 node_modules:');
console.log('  node_modules exists:', fs.existsSync('./node_modules'));
console.log('  vite folder:', fs.existsSync('./node_modules/vite'));
console.log('  vite/bin/vite.js:', fs.existsSync('./node_modules/vite/bin/vite.js'));
console.log('  .bin/vite:', fs.existsSync('./node_modules/.bin/vite'));

// فحص الملفات المحلية
console.log('\n📄 ملفات vite محلية:');
console.log('  ./vite exists:', fs.existsSync('./vite'));
console.log('  ./vite-direct.js:', fs.existsSync('./vite-direct.js'));

// فحص الصلاحيات
console.log('\n🔐 صلاحيات:');
try {
  const stats = fs.statSync('./vite');
  console.log('  ./vite permissions:', stats.mode.toString(8));
  console.log('  ./vite is executable:', !!(stats.mode & parseInt('111', 8)));
} catch (e) {
  console.log('  ❌ خطأ في فحص صلاحيات ./vite');
}

// فحص PATH
console.log('\n🛤️  PATH:', process.env.PATH?.split(':').filter(p => p.includes('node_modules')));

// فحص current working directory
console.log('\n📍 Current directory:', process.cwd());
console.log('Directory contents:', fs.readdirSync('.').filter(f => f.includes('vite')));

console.log('\n✅ انتهى التشخيص');