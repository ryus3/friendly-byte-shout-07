#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', 'scripts'];
const IGNORED_FILES = ['devLogger.js'];

let stats = { files: 0, removed: 0 };

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // أنماط شاملة لحذف console.log/info/warn
    const patterns = [
      // Single line console statements
      /^\s*console\.(log|info|warn)\([^)]*\);?\s*$/gm,
      // Multi-line console with template literals
      /^\s*console\.(log|info|warn)\([^)]*`[\s\S]*?`[^)]*\);?\s*$/gm,
      // Multi-line console with objects
      /^\s*console\.(log|info|warn)\([^)]*\{[\s\S]*?\}[^)]*\);?\s*$/gm,
      // Console with multiple arguments
      /^\s*console\.(log|info|warn)\([^;]+?\);?\s*$/gm,
      // Inline console (more aggressive)
      /console\.(log|info|warn)\([^)]*\);?/g,
    ];
    
    let count = 0;
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
        content = content.replace(pattern, '');
      }
    });
    
    // تنظيف الأسطر الفارغة المتعددة
    content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.files++;
      stats.removed += count;
    }
  } catch (error) {
    // تجاهل الأخطاء
  }
}

function shouldProcess(filePath) {
  if (IGNORED_FILES.some(ignored => filePath.endsWith(ignored))) return false;
  if (EXCLUDED_DIRS.some(dir => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`))) return false;
  return filePath.match(/\.(js|jsx|ts|tsx)$/);
}

function walk(dir) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !EXCLUDED_DIRS.includes(file)) {
          walk(fullPath);
        } else if (shouldProcess(fullPath)) {
          cleanFile(fullPath);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

console.log('🚀 بدء حذف شامل للـ console.log...\n');
const start = Date.now();

walk(path.join(process.cwd(), 'src'));

const time = ((Date.now() - start) / 1000).toFixed(2);

console.log('='.repeat(60));
console.log(`✅ تم حذف ${stats.removed} console من ${stats.files} ملف`);
console.log(`⏱️  الوقت: ${time}s`);
console.log('='.repeat(60));
