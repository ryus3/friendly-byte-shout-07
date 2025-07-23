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
      
      let yPosition = 20;
      
      // العنوان
      pdf.setFontSize(20);
      pdf.text('تقرير المخزون', 105, yPosition, { align: 'center' });
      yPosition += 15;
      
      // التاريخ
      pdf.setFontSize(12);
      const currentDate = new Date().toLocaleDateString('ar-EG');
      pdf.text(`تاريخ التقرير: ${currentDate}`, 20, yPosition);
      yPosition += 10;
      
      // عدد المنتجات
      pdf.text(`عدد المنتجات: ${dataToExport.length}`, 20, yPosition);
      yPosition += 20;
      
      // الجدول
      const tableHeader = ['المنتج', 'الكمية', 'السعر', 'الحالة'];
      const rowHeight = 8;
      const colWidth = 45;
      
      // رأس الجدول
      pdf.setFillColor(200, 200, 200);
      pdf.rect(20, yPosition, 180, rowHeight, 'F');
      
      pdf.setFontSize(10);
      tableHeader.forEach((header, index) => {
        pdf.text(header, 25 + (index * colWidth), yPosition + 5);
      });
      yPosition += rowHeight;
      
      // بيانات الجدول
      dataToExport.forEach((item, index) => {
        if (yPosition > 280) {
          pdf.addPage();
          yPosition = 20;
        }
        
        const totalStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
        const avgPrice = item.variants?.length > 0 ? 
          item.variants.reduce((sum, v) => sum + (v.price || 0), 0) / item.variants.length : 0;
        
        let status = 'متوفر';
        if (totalStock === 0) status = 'نافذ';
        else if (totalStock < 5) status = 'منخفض';
        
        const rowData = [
          item.name?.substring(0, 15) || 'بدون اسم',
          totalStock.toString(),
          Math.round(avgPrice).toString() + ' د.ع',
          status
        ];
        
        // خلفية السطر
        if (index % 2 === 0) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(20, yPosition, 180, rowHeight, 'F');
        }
        
        rowData.forEach((cell, colIndex) => {
          pdf.text(cell, 25 + (colIndex * colWidth), yPosition + 5);
        });
        
        yPosition += rowHeight;
      });

      const fileName = `inventory_report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "✅ تم إنشاء التقرير!",
        description: `تقرير لـ ${dataToExport.length} منتج`,
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