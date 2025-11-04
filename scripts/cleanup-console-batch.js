#!/usr/bin/env node

/**
 * حذف سريع لـ console.log من ملفات محددة
 */

const fs = require('fs');
const path = require('path');

// الملفات المستهدفة
const targetFiles = [
  'src/contexts/SuperProvider.jsx',
  'src/components/accounting/ExpensesDialog.jsx',
  'src/components/ai/AiChatDialog.jsx',
  'src/components/ai/SuperAiChatDialog.jsx',
  'src/components/manage-employees/EmployeeList.jsx',
  'src/components/manage-variants/ColorsManager.jsx',
  'src/components/manage-variants/DepartmentsManager.jsx',
  'src/components/orders/AutoSyncInvoiceService.js',
  'src/components/orders/InvoiceCheckButton.jsx',
  'src/components/orders/UnifiedOrdersStats.jsx',
  'src/components/products/AdvancedProductFilters.jsx',
  'src/components/products/BarcodeScannerDialog.jsx',
  'src/components/products/OptimizedQRScanner.jsx',
  'src/components/customers/UnifiedCustomersStats.jsx',
  'src/components/inventory/InventoryFilters.jsx',
];

let totalRemoved = 0;

targetFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    return;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;
    
    // أنماط حذف console
    const patterns = [
      /\s*console\.log\([^)]*\);?\s*\n?/g,
      /\s*console\.info\([^)]*\);?\s*\n?/g,
      /\s*console\.warn\([^)]*\);?\s*\n?/g,
    ];
    
    let count = 0;
    patterns.forEach(p => {
      const matches = content.match(p);
      if (matches) {
        count += matches.length;
        content = content.replace(p, '');
      }
    });
    
    // تنظيف الأسطر الفارغة
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      totalRemoved += count;
    }
  } catch (error) {
    // تجاهل الأخطاء
  }
});

console.log(`✅ تم حذف ${totalRemoved} console من ${targetFiles.length} ملف`);
