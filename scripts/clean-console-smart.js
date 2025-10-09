#!/usr/bin/env node

/**
 * حذف Console Logs بذكاء عالي
 * يحذف console.log, console.info, console.warn
 * يحتفظ بـ console.error فقط
 */

const fs = require('fs');
const path = require('path');

// الملفات المستهدفة بالأولوية
const TARGET_FILES = [
  'src/contexts/AlWaseetContext.jsx',
  'src/contexts/SuperProvider.jsx',
  'src/contexts/ProfitsContext.jsx',
  'src/components/orders/EditOrderDialog.jsx',
  'src/components/orders/OrderCard.jsx',
];

function cleanConsole(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalLength = content.length;
    
    // حذف console.log و console.info و console.warn
    content = content.replace(/console\.(log|info|warn)\([^)]*\);?/g, '');
    
    // حذف السطور الفارغة الزائدة
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content.length !== originalLength) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ تم تنظيف: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ خطأ في ${filePath}:`, error.message);
    return false;
  }
}

let cleaned = 0;
TARGET_FILES.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    if (cleanConsole(fullPath)) cleaned++;
  } else {
    console.warn(`⚠️ الملف غير موجود: ${file}`);
  }
});

console.log(`\n🎉 تم تنظيف ${cleaned} ملف بنجاح!`);
