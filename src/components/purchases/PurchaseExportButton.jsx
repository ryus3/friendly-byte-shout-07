import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const PurchaseExportButton = ({ purchase }) => {
  const exportToCSV = () => {
    const items = purchase.items || [];
    
    // تحضير البيانات للـ CSV
    const csvData = [
      ['فاتورة شراء رقم', purchase.purchase_number || purchase.id],
      ['اسم المورد', purchase.supplier_name || 'غير محدد'],
      ['تاريخ الشراء', new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString('ar-SA')],
      ['حالة الفاتورة', purchase.status === 'completed' ? 'مكتملة' : 'معلقة'],
      [''],
      ['#', 'اسم المنتج', 'اللون', 'القياس', 'الكمية', 'سعر الوحدة', 'الإجمالي'],
      ...items.map((item, index) => [
        index + 1,
        item.productName || 'غير محدد',
        item.color || 'غير محدد',
        item.size || 'غير محدد',
        item.quantity || 0,
        item.costPrice || 0,
        (item.costPrice || 0) * (item.quantity || 0)
      ]),
      [''],
      ['إجمالي المنتجات', purchase.total_amount || 0],
      ['تكلفة الشحن', purchase.shipping_cost || 0],
      ['تكلفة التحويل', purchase.transfer_cost || 0],
      ['المجموع الكلي', (purchase.total_amount || 0) + (purchase.shipping_cost || 0) + (purchase.transfer_cost || 0)]
    ];

    // تحويل إلى CSV
    const csvContent = csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    // إضافة BOM للدعم العربي
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    
    // تحميل الملف
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `فاتورة_شراء_${purchase.purchase_number || purchase.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={exportToCSV}
      className="gap-1 text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
    >
      <Download className="h-4 w-4" />
      Excel
    </Button>
  );
};

export default PurchaseExportButton;