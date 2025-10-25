#!/usr/bin/env node

/**
 * 🚀 Ultimate Console Cleaner - حذف نهائي لجميع console.log
 * يحذف console.log, console.info, console.warn من كامل المشروع
 * يبقي فقط console.error للأخطاء الحرجة
 */

const fs = require('fs');
const path = require('path');

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage'];
const IGNORED_FILES = [
  'src/utils/cleanConsole.js',
  'src/lib/devLogger.js',
  'scripts/replace-console-logs.js',
  'scripts/clean-all-console-ultimate.js'
];

let totalFilesProcessed = 0;
let totalFilesModified = 0;
let totalLogsRemoved = 0;

function shouldProcessFile(filePath) {
  if (IGNORED_FILES.some(ignored => filePath.endsWith(ignored))) {
    return false;
  }
  
  if (EXCLUDED_DIRS.some(dir => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`))) {
    return false;
  }
  
  return filePath.match(/\.(js|jsx|ts|tsx)$/);
}

function cleanConsoleFromFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let removedCount = 0;
    
    // حذف كل أنواع console.log/info/warn (single line, multi-line, nested)
    const patterns = [
      // Single line console statements
      /\s*console\.log\([^)]*\);?\s*\n?/g,
      /\s*console\.info\([^)]*\);?\s*\n?/g,
      /\s*console\.warn\([^)]*\);?\s*\n?/g,
      
      // Multi-line console statements with template literals
      /\s*console\.log\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      /\s*console\.info\([^)]*`[^`]*`[^)]*\);?\s*\n?/g,
      /\s*console\.warn\([^)]*`[^)]*`[^)]*\);?\s*\n?/g,
      
      // Complex multi-line statements (nested parentheses)
      /\s*console\.log\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
      /\s*console\.info\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
      /\s*console\.warn\(\s*[^;]*?\{[^}]*\}[^;]*?\);?\s*\n?/g,
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        removedCount += matches.length;
        content = content.replace(pattern, '');
      }
    });
    
    // تنظيف السطور الفارغة الزائدة
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      totalFilesModified++;
      totalLogsRemoved += removedCount;
      console.log(`✅ ${filePath.replace(process.cwd(), '')} - حذف ${removedCount} console`);
      return true;
    }
    
    totalFilesProcessed++;
    return false;
  } catch (error) {
    console.error(`❌ خطأ في ${filePath}:`, error.message);
    return false;
  }
}

function walkDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          if (!EXCLUDED_DIRS.includes(file)) {
            walkDirectory(filePath);
          }
        } else if (shouldProcessFile(filePath)) {
          cleanConsoleFromFile(filePath);
        }
      } catch (err) {
        console.error(`تجاهل الملف: ${filePath}`, err.message);
      }
    });
  } catch (error) {
    console.error(`خطأ في قراءة المجلد ${dir}:`, error.message);
  }
}

function main() {
  const srcDir = path.join(process.cwd(), 'src');
  console.log('🚀 بدء حذف console.log من كامل المشروع...');
  console.log('📁 المجلد:', srcDir);
  console.log('');
  
  const startTime = Date.now();
  walkDirectory(srcDir);
  const endTime = Date.now();
  
  console.log('');
  console.log('='.repeat(60));
  console.log('✨ اكتمل التنظيف!');
  console.log(`📊 ملفات تمت معالجتها: ${totalFilesProcessed}`);
  console.log(`✅ ملفات تم تعديلها: ${totalFilesModified}`);
  console.log(`🗑️  Console تم حذفها: ${totalLogsRemoved}`);
  console.log(`⏱️  الوقت المستغرق: ${((endTime - startTime) / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 تم حذف جميع console.log/info/warn');
  console.log('💡 تم الاحتفاظ بـ console.error للأخطاء الحرجة');
  console.log('🚀 الموقع الآن طيارة! ✈️');
}

main();
