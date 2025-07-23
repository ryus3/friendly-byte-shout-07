import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from '@/components/ui/use-toast';

const InventoryPDFGenerator = ({ 
  inventoryData = [], 
  selectedItems = [], 
  filters = {},
  isLoading = false 
}) => {
  const generatePDF = async () => {
    console.log('🖨️ بدء تشغيل مولد PDF...');
    console.log('📊 البيانات المستلمة:', { 
      inventoryData: inventoryData?.length,
      selectedItems: selectedItems?.length,
      filters,
      isLoading
    });
    
    try {
      // فحص البيانات
      const dataToExport = selectedItems.length > 0 ? 
        inventoryData.filter(item => selectedItems.includes(item.id)) : 
        inventoryData;
      
      console.log('📋 البيانات النهائية للتصدير:', dataToExport?.length);
      
      if (!dataToExport || dataToExport.length === 0) {
        console.warn('⚠️ لا توجد بيانات للتصدير');
        toast({
          title: "لا توجد بيانات للتصدير",
          description: "لم يتم العثور على منتجات للتصدير",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ سيتم تصدير', dataToExport.length, 'منتج');

      // إنشاء PDF بسيط
      console.log('🔧 إنشاء PDF...');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      console.log('📝 بدء كتابة المحتوى...');
      
      // إنشاء محتوى بسيط
      createSimplePDF(pdf, dataToExport);

      console.log('💾 حفظ الملف...');
      
      // حفظ PDF
      const fileName = `inventory_report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      console.log('✅ تم إنشاء PDF بنجاح!');
      
      toast({
        title: "✅ تم إنشاء التقرير بنجاح",
        description: `تم تصدير ${dataToExport.length} منتج`,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ خطأ في إنشاء PDF:', error);
      console.error('📍 تفاصيل الخطأ:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      toast({
        title: "خطأ في إنشاء التقرير",
        description: `خطأ: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const createSimplePDF = (pdf, data) => {
    try {
      console.log('🎨 رسم الصفحة...');
      
      // إعدادات أساسية
      const pageWidth = 210;
      const margin = 20;
      let currentY = margin;

      // العنوان
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Inventory Report', pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;

      // التاريخ
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US');
      const timeStr = now.toLocaleTimeString('en-US');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Date: ${dateStr} ${timeStr}`, margin, currentY);
      currentY += 15;

      // إحصائيات بسيطة
      const stats = calculateStats(data);
      pdf.text(`Total Products: ${data.length}`, margin, currentY);
      currentY += 8;
      pdf.text(`Good Stock: ${stats.good}`, margin, currentY);
      currentY += 8;
      pdf.text(`Low Stock: ${stats.low}`, margin, currentY);
      currentY += 8;
      pdf.text(`Out of Stock: ${stats.outOfStock}`, margin, currentY);
      currentY += 20;

      // رأس الجدول
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Product Name', margin, currentY);
      pdf.text('SKU', margin + 60, currentY);
      pdf.text('Stock', margin + 120, currentY);
      pdf.text('Status', margin + 150, currentY);
      currentY += 8;

      // خط تحت الرأس
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      // البيانات
      pdf.setFont('helvetica', 'normal');
      
      data.slice(0, 30).forEach((product, index) => { // أول 30 منتج فقط لاختبار
        if (currentY > 270) { // صفحة جديدة
          pdf.addPage();
          currentY = margin;
        }

        const totalStock = calculateTotalStock(product.variants);
        const status = getSimpleStatus(totalStock);
        
        const productName = (product.name || 'Unknown').substring(0, 25);
        const sku = (product.sku || 'N/A').substring(0, 15);
        
        pdf.text(productName, margin, currentY);
        pdf.text(sku, margin + 60, currentY);
        pdf.text(totalStock.toString(), margin + 120, currentY);
        pdf.text(status, margin + 150, currentY);
        
        currentY += 6;
      });

      console.log('✅ تم رسم المحتوى بنجاح');
      
    } catch (error) {
      console.error('❌ خطأ في رسم المحتوى:', error);
      throw error;
    }
  };

  // دوال مساعدة بسيطة
  const calculateStats = (data) => {
    let good = 0, low = 0, outOfStock = 0;
    
    data.forEach(product => {
      const totalStock = calculateTotalStock(product.variants);
      if (totalStock === 0) outOfStock++;
      else if (totalStock <= 5) low++;
      else good++;
    });
    
    return { good, low, outOfStock };
  };

  const calculateTotalStock = (variants) => {
    if (!variants || !Array.isArray(variants)) return 0;
    return variants.reduce((total, variant) => {
      const stock = parseInt(variant.stock_quantity) || 0;
      return total + stock;
    }, 0);
  };

  const getSimpleStatus = (totalStock) => {
    if (totalStock === 0) return 'Out of Stock';
    if (totalStock <= 5) return 'Low';
    return 'Good';
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isLoading || !inventoryData.length}
      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg"
      size="sm"
    >
      <Download className="w-4 h-4" />
      تحميل PDF
    </Button>
  );
};

export default InventoryPDFGenerator;