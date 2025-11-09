#!/usr/bin/env node

/**
 * 🚀 Cleanup 2000+ Console Logs - حذف شامل لجميع console.log
 */

const fs = require('fs');
const path = require('path');

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', 'scripts'];
const IGNORED_FILES = ['devLogger.js', 'cleanConsole.js'];

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
    
    // حذف جميع أنواع console.log/info/warn
    const patterns = [
      // Single line console statements
      /\s*console\.log\([^)]*\);?\s*\n?/g,
      /\s*console\.info\([^)]*\);?\s*\n?/g,
      /\s*console\.warn\([^)]*\);?\s*\n?/g,
      
      // Multi-line console with template literals
      /\s*console\.log\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      /\s*console\.info\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      /\s*console\.warn\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      
      // Console with objects
      /\s*console\.log\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
      /\s*console\.info\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
      /\s*console\.warn\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
      
      // Multi-line console statements
      /console\.log\([^;]*?\n[^;]*?\);?\s*\n?/g,
      /console\.info\([^;]*?\n[^;]*?\);?\s*\n?/g,
      /console\.warn\([^;]*?\n[^;]*?\);?\s*\n?/g,
    ];
    
    let count = 0;
    patterns.forEach(p => {
      const matches = content.match(p);
      if (matches) {
        count += matches.length;
        content = content.replace(p, '');
      }
    });
    
    // تنظيف الأسطر الفارغة الزائدة
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.modified++;
      stats.removed += count;
      if (count > 0) {
        console.log(`✅ ${filePath}: حذف ${count} console`);
      }
      return count;
    }
    
    stats.processed++;
    return 0;
  } catch (error) {
    console.error(`❌ خطأ في معالجة ${filePath}:`, error.message);
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
      } catch (e) {
        // تجاهل الأخطاء
      }
    });
  } catch (e) {
    // تجاهل الأخطاء
  }
}

const start = Date.now();
console.log('🚀 بدء حذف console.log من المشروع...\n');

walk(path.join(process.cwd(), 'src'));

const time = ((Date.now() - start) / 1000).toFixed(2);

console.log('\n' + '='.repeat(60));
console.log(`✨ تم حذف ${stats.removed} console.log من ${stats.modified} ملف`);
console.log(`📁 تم معالجة ${stats.processed + stats.modified} ملف إجمالاً`);
console.log(`⏱️  الوقت المستغرق: ${time}s`);
console.log('='.repeat(60));
