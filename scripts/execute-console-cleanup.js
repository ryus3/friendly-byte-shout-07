#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 بدء حذف شامل لجميع console.log في المشروع...\n');

try {
  execSync('node scripts/aggressive-console-cleanup.js', { stdio: 'inherit' });
  console.log('\n✅ اكتملت عملية الحذف بنجاح!');
  console.log('💡 قم بمراجعة التغييرات في Git قبل الـ commit');
} catch (error) {
  console.error('❌ خطأ في التنفيذ:', error.message);
  process.exit(1);
}
