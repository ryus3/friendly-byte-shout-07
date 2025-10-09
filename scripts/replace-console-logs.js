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
  
  // Check if devLog import exists
  const hasDevLogImport = content.includes("from '@/lib/devLogger'") || 
                          content.includes('from "@/lib/devLogger"');
  
  // Check if there are console.log/info/warn calls
  const hasConsoleCalls = /console\.(log|info|warn)\(/g.test(content);
  
  if (!hasConsoleCalls) {
    return false;
  }
  
  // Add devLog import if needed
  if (!hasDevLogImport) {
    // Find the last import statement
    const importRegex = /import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*\n/g;
    const imports = content.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;
      
      content = content.slice(0, insertPosition) + 
                "import devLog from '@/lib/devLogger';\n" +
                content.slice(insertPosition);
      modified = true;
    }
  }
  
  // Replace console calls with devLog
  const originalContent = content;
  content = content.replace(/console\.log\(/g, 'devLog.log(');
  content = content.replace(/console\.info\(/g, 'devLog.info(');
  content = content.replace(/console\.warn\(/g, 'devLog.warn(');
  
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
  
  console.log('🚀 Starting console.log replacement...');
  console.log('📁 Scanning directory:', srcDir);
  
  walkDirectory(srcDir, (filePath) => {
    if (processFile(filePath)) {
      filesModified++;
      console.log('✅ Modified:', filePath.replace(process.cwd(), ''));
    }
  });
  
  console.log(`\n✨ Complete! Modified ${filesModified} files.`);
  console.log('💡 All console.log/info/warn have been replaced with devLog');
}

main();
