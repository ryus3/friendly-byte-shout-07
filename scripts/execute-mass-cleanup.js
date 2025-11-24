#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 بدء حذف شامل لـ console.log...\n');

try {
  execSync('node scripts/mass-console-cleanup.js', { stdio: 'inherit' });
  console.log('\n✅ تم حذف console.log بنجاح!');
} catch (error) {
  console.error('❌ خطأ في التنفيذ:', error.message);
}
