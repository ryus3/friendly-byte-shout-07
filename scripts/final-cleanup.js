#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', 'scripts'];
const IGNORED_FILES = ['devLogger.js'];

let stats = { processed: 0, modified: 0, removed: 0 };

function shouldProcess(filePath) {
  if (IGNORED_FILES.some(ignored => filePath.endsWith(ignored))) return false;
  if (EXCLUDED_DIRS.some(dir => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`))) return false;
  return filePath.match(/\.(js|jsx|ts|tsx)$/);
}

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // حذف console.log/info/warn بجميع الأشكال (نبقي console.error)
    const patterns = [
      /\s*console\.log\([^)]*\);?\s*\n?/g,
      /\s*console\.info\([^)]*\);?\s*\n?/g,
      /\s*console\.warn\([^)]*\);?\s*\n?/g,
      // Multi-line patterns
      /\s*console\.log\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      /\s*console\.info\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      /\s*console\.warn\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      // Object patterns
      /\s*console\.log\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
      /\s*console\.info\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
      /\s*console\.warn\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
    ];
    
    let count = 0;
    patterns.forEach(p => {
      const m = content.match(p);
      if (m) {
        count += m.length;
        content = content.replace(p, '');
      }
    });
    
    // تنظيف الأسطر الفارغة الزائدة
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.modified++;
      stats.removed += count;
      return count;
    }
    
    stats.processed++;
    return 0;
  } catch (error) {
    return 0;
  }
}

function walk(dir) {
  try {
    fs.readdirSync(dir).forEach(file => {
      const fp = path.join(dir, file);
      try {
        const stat = fs.statSync(fp);
        if (stat.isDirectory() && !EXCLUDED_DIRS.includes(file)) {
          walk(fp);
        } else if (shouldProcess(fp)) {
          cleanFile(fp);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

const start = Date.now();
walk(path.join(process.cwd(), 'src'));
const time = ((Date.now() - start) / 1000).toFixed(2);

console.log('='.repeat(60));
console.log(`✅ تم حذف ${stats.removed} console من ${stats.modified} ملف`);
console.log(`⏱️  الوقت: ${time}s`);
console.log(`📊 الملفات المعالجة: ${stats.processed + stats.modified}`);
console.log('='.repeat(60));
