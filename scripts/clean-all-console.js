#!/usr/bin/env node

/**
 * حذف Console Logs الشامل - النظام الذكي
 * يحذف console.log, console.info
 * يعلق console.warn
 * يحتفظ بـ console.error
 */

const fs = require('fs');
const path = require('path');

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'scripts'];
const IGNORED_FILES = ['devLogger.js', 'cleanConsole.js'];

let totalFilesProcessed = 0;
let totalFilesModified = 0;
let totalLogsRemoved = 0;
let totalWarnsCommented = 0;

function shouldProcessFile(filePath) {
  // تجاهل الملفات المستثناة
  if (IGNORED_FILES.some(ignored => filePath.endsWith(ignored))) {
    return false;
  }
  
  // تجاهل المجلدات المستثناة
  if (EXCLUDED_DIRS.some(dir => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`))) {
    return false;
  }
  
  // معالجة ملفات JS/JSX/TS/TSX فقط
  return filePath.match(/\.(js|jsx|ts|tsx)$/);
}

function cleanConsoleFromFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let logsRemoved = 0;
    let warnsCommented = 0;
    
    // حذف console.log و console.info
    const logPattern = /console\.(log|info)\([^)]*\);?\s*\n?/g;
    content = content.replace(logPattern, (match) => {
      logsRemoved++;
      return '';
    });
    
    // تعليق console.warn
    const warnPattern = /(\s*)(console\.warn\([^)]*\);?)/g;
    content = content.replace(warnPattern, (match, indent, warnCode) => {
      warnsCommented++;
      return `${indent}// ${warnCode}`;
    });
    
    // تنظيف الأسطر الفارغة الزائدة
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      totalFilesModified++;
      totalLogsRemoved += logsRemoved;
      totalWarnsCommented += warnsCommented;
      console.log(`✅ ${filePath.replace(process.cwd(), '')} - حذف ${logsRemoved} log، تعليق ${warnsCommented} warn`);
      return true;
    }
    
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
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(file)) {
          walkDirectory(filePath);
        }
      } else if (shouldProcessFile(filePath)) {
        totalFilesProcessed++;
        cleanConsoleFromFile(filePath);
      }
    });
  } catch (error) {
    console.error(`❌ خطأ في قراءة المجلد ${dir}:`, error.message);
  }
}

function main() {
  const srcDir = path.join(process.cwd(), 'src');
  
  console.log('🚀 بدء حذف Console Logs الشامل...');
  console.log('📁 المجلد المستهدف:', srcDir);
  console.log('');
  
  const startTime = Date.now();
  walkDirectory(srcDir);
  const endTime = Date.now();
  
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✨ اكتمل التنظيف بنجاح في ${((endTime - startTime) / 1000).toFixed(2)} ثانية`);
  console.log(`📊 ملفات تم فحصها: ${totalFilesProcessed}`);
  console.log(`✅ ملفات تم تعديلها: ${totalFilesModified}`);
  console.log(`🗑️ console.log/info تم حذفها: ${totalLogsRemoved}`);
  console.log(`💬 console.warn تم تعليقها: ${totalWarnsCommented}`);
  console.log(`✔️ console.error محفوظة للأخطاء الحرجة`);
  console.log('═══════════════════════════════════════');
}

main();
