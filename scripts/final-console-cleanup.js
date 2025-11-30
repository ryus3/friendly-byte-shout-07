#!/usr/bin/env node

/**
 * ✅ FINAL Console Cleanup - حذف نهائي شامل لجميع console.log/info/warn
 * 
 * يحذف جميع console.log و console.info و console.warn من المشروع
 * يبقي فقط على console.error للأخطاء الحرجة
 * 
 * الاستخدام: node scripts/final-console-cleanup.js
 */

const fs = require('fs');
const path = require('path');

// المجلدات المستثناة
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', 'scripts'];

// الملفات المستثناة
const IGNORED_FILES = ['devLogger.js', 'cleanConsole.js'];

// إحصائيات
let stats = {
  filesProcessed: 0,
  filesModified: 0,
  consoleLogsRemoved: 0,
  consoleInfosRemoved: 0,
  consoleWarnsRemoved: 0
};

/**
 * تحديد ما إذا كان يجب معالجة الملف
 */
function shouldProcess(filePath) {
  // تحقق من الملفات المستثناة
  if (IGNORED_FILES.some(ignored => filePath.endsWith(ignored))) {
    return false;
  }
  
  // تحقق من المجلدات المستثناة
  if (EXCLUDED_DIRS.some(dir => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`))) {
    return false;
  }
  
  // فقط ملفات JS/JSX/TS/TSX
  return /\.(js|jsx|ts|tsx)$/.test(filePath);
}

/**
 * حذف console statements من محتوى الملف
 */
function removeConsoleStatements(content) {
  let modified = content;
  let removedCount = { log: 0, info: 0, warn: 0 };
  
  // أنماط regex شاملة لحذف console.log/info/warn
  const patterns = [
    // Single-line console statements
    { regex: /^\s*console\.log\([^)]*\);?\s*$/gm, type: 'log' },
    { regex: /^\s*console\.info\([^)]*\);?\s*$/gm, type: 'info' },
    { regex: /^\s*console\.warn\([^)]*\);?\s*$/gm, type: 'warn' },
    
    // Multi-line console with template literals
    { regex: /^\s*console\.log\([^)]*`[\s\S]*?`[^)]*\);?\s*$/gm, type: 'log' },
    { regex: /^\s*console\.info\([^)]*`[\s\S]*?`[^)]*\);?\s*$/gm, type: 'info' },
    { regex: /^\s*console\.warn\([^)]*`[\s\S]*?`[^)]*\);?\s*$/gm, type: 'warn' },
    
    // Multi-line console with objects
    { regex: /^\s*console\.log\([^)]*\{[\s\S]*?\}[^)]*\);?\s*$/gm, type: 'log' },
    { regex: /^\s*console\.info\([^)]*\{[\s\S]*?\}[^)]*\);?\s*$/gm, type: 'info' },
    { regex: /^\s*console\.warn\([^)]*\{[\s\S]*?\}[^)]*\);?\s*$/gm, type: 'warn' },
    
    // Inline console (aggressive)
    { regex: /console\.log\([^;)]*\);?/g, type: 'log' },
    { regex: /console\.info\([^;)]*\);?/g, type: 'info' },
    { regex: /console\.warn\([^;)]*\);?/g, type: 'warn' },
  ];
  
  // تطبيق كل نمط
  patterns.forEach(({ regex, type }) => {
    const matches = modified.match(regex);
    if (matches) {
      removedCount[type] += matches.length;
      modified = modified.replace(regex, '');
    }
  });
  
  // تنظيف الأسطر الفارغة المتعددة
  modified = modified.replace(/\n\s*\n\s*\n+/g, '\n\n');
  
  return { modified, removedCount };
}

/**
 * معالجة ملف واحد
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { modified, removedCount } = removeConsoleStatements(content);
    
    stats.filesProcessed++;
    
    if (modified !== content) {
      fs.writeFileSync(filePath, modified, 'utf8');
      stats.filesModified++;
      stats.consoleLogsRemoved += removedCount.log;
      stats.consoleInfosRemoved += removedCount.info;
      stats.consoleWarnsRemoved += removedCount.warn;
      
      const totalRemoved = removedCount.log + removedCount.info + removedCount.warn;
      if (totalRemoved > 0) {
        console.log(`✅ ${path.relative(process.cwd(), filePath)}: ${totalRemoved} console statements removed`);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * المرور عبر المجلدات بشكل متكرر
 */
function walkDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !EXCLUDED_DIRS.includes(file)) {
          walkDirectory(fullPath);
        } else if (stat.isFile() && shouldProcess(fullPath)) {
          processFile(fullPath);
        }
      } catch (error) {
        // تجاهل أخطاء الوصول للملفات
      }
    });
  } catch (error) {
    console.error(`❌ Error walking directory ${dir}:`, error.message);
  }
}

/**
 * البدء في التنفيذ
 */
console.log('🚀 بدء حذف شامل لجميع console.log/info/warn في المشروع...\n');
console.log('📂 المجلد المستهدف: src/\n');

const startTime = Date.now();
const srcPath = path.join(process.cwd(), 'src');

walkDirectory(srcPath);

const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
const totalRemoved = stats.consoleLogsRemoved + stats.consoleInfosRemoved + stats.consoleWarnsRemoved;

console.log('\n' + '='.repeat(70));
console.log('✨ اكتمل التنظيف بنجاح!');
console.log('='.repeat(70));
console.log(`📊 الإحصائيات:`);
console.log(`   • الملفات المعالجة: ${stats.filesProcessed}`);
console.log(`   • الملفات المعدلة: ${stats.filesModified}`);
console.log(`   • console.log محذوف: ${stats.consoleLogsRemoved}`);
console.log(`   • console.info محذوف: ${stats.consoleInfosRemoved}`);
console.log(`   • console.warn محذوف: ${stats.consoleWarnsRemoved}`);
console.log(`   • الإجمالي المحذوف: ${totalRemoved}`);
console.log(`   • الوقت المستغرق: ${executionTime}s`);
console.log('='.repeat(70));

if (totalRemoved > 0) {
  console.log('\n✅ تم حذف جميع console statements بنجاح!');
  console.log('💡 بقي فقط console.error للأخطاء الحرجة');
} else {
  console.log('\nℹ️ لم يتم العثور على console statements للحذف');
}

process.exit(0);
