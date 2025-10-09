#!/usr/bin/env node

/**
 * Script to replace all console.log/info/warn with devLog
 * This improves production performance by removing console statements
 */

const fs = require('fs');
const path = require('path');

const IGNORED_FILES = [
  'src/utils/cleanConsole.js',
  'src/lib/devLogger.js',
  'scripts/replace-console-logs.js'
];

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build'
];

function shouldProcessFile(filePath) {
  if (IGNORED_FILES.some(ignored => filePath.endsWith(ignored))) {
    return false;
  }
  
  if (EXCLUDED_DIRS.some(dir => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`))) {
    return false;
  }
  
  return filePath.match(/\.(js|jsx|ts|tsx)$/);
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if there are console.log/info/warn calls
  const hasConsoleCalls = /console\.(log|info|warn)\(/g.test(content);
  
  if (!hasConsoleCalls) {
    return false;
  }
  
  // Remove console.log and console.info completely (keep console.error)
  const originalContent = content;
  
  // حذف أكثر ذكاءً - يتعامل مع console متعدد الأسطر
  // Pattern 1: Single line console
  content = content.replace(/\s*console\.log\([^)]*\);?\s*\n?/g, '');
  content = content.replace(/\s*console\.info\([^)]*\);?\s*\n?/g, '');
  content = content.replace(/\s*console\.warn\([^)]*\);?\s*\n?/g, '');
  
  // Pattern 2: Multi-line console with template literals
  content = content.replace(/\s*console\.log\([^)]*`[^`]*`[^)]*\);?\s*\n?/g, '');
  content = content.replace(/\s*console\.info\([^)]*`[^`]*`[^)]*\);?\s*\n?/g, '');
  content = content.replace(/\s*console\.warn\([^)]*`[^`]*`[^)]*\);?\s*\n?/g, '');
  
  // تنظيف الأسطر الفارغة الزائدة
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  if (content !== originalContent) {
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

function walkDirectory(dir, callback) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(file)) {
        walkDirectory(filePath, callback);
      }
    } else if (shouldProcessFile(filePath)) {
      callback(filePath);
    }
  });
}

function main() {
  const srcDir = path.join(process.cwd(), 'src');
  let filesModified = 0;
  
  console.log('🚀 Starting console.log deletion...');
  console.log('📁 Scanning directory:', srcDir);
  
  walkDirectory(srcDir, (filePath) => {
    if (processFile(filePath)) {
      filesModified++;
      console.log('✅ Modified:', filePath.replace(process.cwd(), ''));
    }
  });
  
  console.log(`\n✨ Complete! Modified ${filesModified} files.`);
  console.log('💡 All console.log/info/warn have been permanently deleted');
  console.log('💡 console.error has been kept for critical errors');
}

main();
