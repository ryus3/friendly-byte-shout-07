import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

const InventoryPDFGenerator = ({ 
  inventoryData = [], 
  selectedItems = [], 
  filters = {},
  isLoading = false 
}) => {
  const generatePDF = () => {
    try {
      const dataToExport = selectedItems.length > 0 ? 
        inventoryData.filter(item => selectedItems.includes(item.id)) : 
        inventoryData;
      
      if (!dataToExport || dataToExport.length === 0) {
        toast({
          title: "لا توجد بيانات للتصدير",
          description: "لم يتم العثور على منتجات للتصدير",
          variant: "destructive"
        });
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // إعداد الخط العربي
      pdf.setFont('helvetica');
      pdf.setLanguage('ar');
      
      let yPosition = 25;
      const pageWidth = pdf.internal.pageSize.width;
      const margin = 15;
      
      // === رأس التقرير الاحترافي ===
      // خلفية رأس التقرير
      pdf.setFillColor(41, 128, 185); // لون أزرق احترافي
      pdf.rect(0, 0, pageWidth, 45, 'F');
      
      // العنوان الرئيسي
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('تقرير جرد المخزون', pageWidth / 2, 20, { align: 'center' });
      
      // معلومات التقرير
      pdf.setFontSize(12);
      const currentDate = new Date();
      const arabicDate = currentDate.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
      });
      
      pdf.text(`التاريخ: ${arabicDate}`, pageWidth - margin, 32, { align: 'right' });
      pdf.text(`الوقت: ${currentDate.toLocaleTimeString('ar-EG')}`, pageWidth - margin, 38, { align: 'right' });
      
      yPosition = 60;
      
      // === إحصائيات سريعة ===
      pdf.setTextColor(0, 0, 0);
      pdf.setFillColor(248, 249, 250);
      pdf.rect(margin, yPosition, pageWidth - (margin * 2), 25, 'F');
      
      // خط حدودي للإحصائيات
      pdf.setDrawColor(41, 128, 185);
      pdf.setLineWidth(0.5);
      pdf.rect(margin, yPosition, pageWidth - (margin * 2), 25);
      
      pdf.setFontSize(14);
      pdf.setTextColor(52, 73, 94);
      pdf.text(`📊 إجمالي المنتجات: ${dataToExport.length}`, margin + 5, yPosition + 8);
      
      // حساب الإحصائيات
      let totalStock = 0;
      let lowStockItems = 0;
      let outOfStockItems = 0;
      
      dataToExport.forEach(item => {
        const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
        totalStock += itemStock;
        if (itemStock === 0) outOfStockItems++;
        else if (itemStock < 5) lowStockItems++;
      });
      
      pdf.text(`📦 إجمالي المخزون: ${totalStock.toLocaleString()}`, margin + 5, yPosition + 15);
      pdf.text(`⚠️ منتجات منخفضة: ${lowStockItems}`, margin + 5, yPosition + 22);
      pdf.text(`❌ منتجات نافذة: ${outOfStockItems}`, pageWidth - margin - 50, yPosition + 15, { align: 'right' });
      
      yPosition += 40;
      
      // === جدول المنتجات الاحترافي ===
      const tableHeaders = ['المنتج', 'الكمية المتاحة', 'السعر المتوسط', 'حالة المخزون'];
      const colWidths = [60, 35, 40, 35];
      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const startX = (pageWidth - tableWidth) / 2;
      
      // رأس الجدول
      pdf.setFillColor(52, 73, 94);
      pdf.rect(startX, yPosition, tableWidth, 12, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      
      let currentX = startX;
      tableHeaders.forEach((header, index) => {
        pdf.text(header, currentX + (colWidths[index] / 2), yPosition + 8, { align: 'center' });
        currentX += colWidths[index];
      });
      
      yPosition += 12;
      
      // بيانات الجدول
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      
      dataToExport.forEach((item, index) => {
        // التحقق من الصفحة الجديدة
        if (yPosition > 260) {
          pdf.addPage();
          yPosition = 30;
          
          // إعادة رسم رأس الجدول في الصفحة الجديدة
          pdf.setFillColor(52, 73, 94);
          pdf.rect(startX, yPosition, tableWidth, 10, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(10);
          
          currentX = startX;
          tableHeaders.forEach((header, index) => {
            pdf.text(header, currentX + (colWidths[index] / 2), yPosition + 6, { align: 'center' });
            currentX += colWidths[index];
          });
          
          yPosition += 10;
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(9);
        }
        
        // خلفية السطر المتناوبة
        if (index % 2 === 0) {
          pdf.setFillColor(248, 249, 250);
          pdf.rect(startX, yPosition, tableWidth, 10, 'F');
        }
        
        // حساب البيانات
        const itemTotalStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
        const avgPrice = item.variants?.length > 0 ? 
          item.variants.reduce((sum, v) => sum + (v.price || 0), 0) / item.variants.length : 0;
        
        // تحديد حالة المخزون مع الألوان
        let stockStatus = '✅ متوفر';
        let statusColor = [46, 125, 50]; // أخضر
        
        if (itemTotalStock === 0) {
          stockStatus = '❌ نافذ';
          statusColor = [211, 47, 47]; // أحمر
        } else if (itemTotalStock < 5) {
          stockStatus = '⚠️ منخفض';
          statusColor = [255, 152, 0]; // برتقالي
        }
        
        // إضافة حدود للخلايا
        pdf.setDrawColor(224, 224, 224);
        pdf.setLineWidth(0.2);
        
        currentX = startX;
        const rowData = [
          item.name?.substring(0, 25) || 'بدون اسم',
          itemTotalStock.toLocaleString(),
          `${Math.round(avgPrice).toLocaleString()} د.ع`,
          stockStatus
        ];
        
        rowData.forEach((cellData, colIndex) => {
          // رسم حدود الخلية
          pdf.rect(currentX, yPosition, colWidths[colIndex], 10);
          
          // تلوين نص حالة المخزون
          if (colIndex === 3) {
            pdf.setTextColor(...statusColor);
          } else {
            pdf.setTextColor(0, 0, 0);
          }
          
          pdf.text(
            cellData, 
            currentX + (colWidths[colIndex] / 2), 
            yPosition + 6, 
            { align: 'center' }
          );
          
          currentX += colWidths[colIndex];
        });
        
        yPosition += 10;
      });
      
      // === تذييل التقرير ===
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 30;
      }
      
      yPosition += 20;
      
      // خط فاصل
      pdf.setDrawColor(41, 128, 185);
      pdf.setLineWidth(1);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 15;
      
      // معلومات إضافية
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(10);
      pdf.text('تم إنشاء هذا التقرير بواسطة نظام إدارة المخزون', pageWidth / 2, yPosition, { align: 'center' });
      pdf.text(`📅 ${new Date().toLocaleString('ar-EG')}`, pageWidth / 2, yPosition + 6, { align: 'center' });
      
      // إضافة أرقام الصفحات
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`صفحة ${i} من ${pageCount}`, pageWidth - margin, pdf.internal.pageSize.height - 10, { align: 'right' });
      }

      const fileName = `تقرير_المخزون_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "✅ تم إنشاء التقرير بنجاح!",
        description: `تقرير احترافي لـ ${dataToExport.length} منتج`,
        variant: "default"
      });

    } catch (error) {
      console.error('خطأ في إنشاء PDF:', error);
      toast({
        title: "خطأ في إنشاء التقرير",
        description: "حدث خطأ أثناء إنشاء التقرير",
        variant: "destructive"
      });
    }
  };

  return (
    <Button 
      onClick={generatePDF}
      disabled={isLoading || !inventoryData || inventoryData.length === 0}
      className="flex items-center gap-2"
      variant="outline"
    >
      <Download className="w-4 h-4" />
      تصدير PDF
    </Button>
  );
};

export default InventoryPDFGenerator;