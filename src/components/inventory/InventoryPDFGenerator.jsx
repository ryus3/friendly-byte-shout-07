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
    console.log('🖨️ بدء إنشاء PDF...', { 
      inventoryData: inventoryData?.length,
      selectedItems: selectedItems?.length 
    });
    
    try {
      const dataToExport = selectedItems.length > 0 ? 
        inventoryData.filter(item => selectedItems.includes(item.id)) : 
        inventoryData;
      
      console.log('📊 البيانات للتصدير:', dataToExport?.length);
      
      if (!dataToExport || dataToExport.length === 0) {
        console.log('❌ لا توجد بيانات للتصدير');
        toast({
          title: "لا توجد بيانات للتصدير",
          description: "لم يتم العثور على منتجات للتصدير",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ إنشاء PDF بدأ...', dataToExport.length, 'منتج');

      // إنشاء PDF جديد
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // إنشاء المحتوى
      await createProfessionalPDF(pdf, dataToExport, filters, selectedItems.length > 0);

      // حفظ PDF
      const fileName = getFileName(selectedItems.length > 0, filters);
      pdf.save(fileName);

      toast({
        title: "✅ تم إنشاء التقرير بنجاح",
        description: `تم تصدير ${dataToExport.length} منتج بتصميم احترافي`,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ خطأ في إنشاء PDF:', error);
      toast({
        title: "خطأ في إنشاء التقرير",
        description: `حدث خطأ: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const createProfessionalPDF = async (pdf, data, filters, isFiltered) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // الألوان المطابقة للموقع
    const colors = {
      primary: [59, 130, 246],
      secondary: [147, 51, 234], 
      success: [34, 197, 94],
      warning: [251, 146, 60],
      danger: [239, 68, 68],
      dark: [30, 41, 59],
      light: [248, 250, 252],
      white: [255, 255, 255]
    };

    let currentY = margin;

    // الغلاف
    currentY = createCoverPage(pdf, pageWidth, pageHeight, margin, colors, isFiltered);
    
    // صفحة جديدة
    pdf.addPage();
    currentY = margin;

    // الإحصائيات
    const stats = calculateInventoryStats(data);
    currentY = createStatsCards(pdf, stats, margin, contentWidth, currentY, colors);
    
    // الجدول
    currentY = createDataTable(pdf, data, margin, contentWidth, currentY, colors, pageHeight);
    
    // التوقيع
    createFooter(pdf, margin, contentWidth, pageHeight - 40, colors);
  };

  const createCoverPage = (pdf, pageWidth, pageHeight, margin, colors, isFiltered) => {
    // خلفية متدرجة (تقليد التدرج بألوان متعددة)
    for (let i = 0; i < pageHeight; i += 5) {
      const ratio = i / pageHeight;
      const r = Math.round(colors.primary[0] + (colors.secondary[0] - colors.primary[0]) * ratio);
      const g = Math.round(colors.primary[1] + (colors.secondary[1] - colors.primary[1]) * ratio);
      const b = Math.round(colors.primary[2] + (colors.secondary[2] - colors.primary[2]) * ratio);
      
      pdf.setFillColor(r, g, b);
      pdf.rect(0, i, pageWidth, 5, 'F');
    }

    // العنوان الرئيسي
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    pdf.text('تقرير الجرد الاحترافي', pageWidth / 2, 70, { align: 'center' });

    // التاريخ والوقت بالميلادي والأرقام الإنجليزية
    const now = new Date();
    const dateOptions = {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    };
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const arabicDate = now.toLocaleDateString('ar-EG', dateOptions);
    const englishTime = now.toLocaleTimeString('en-US', timeOptions);
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${arabicDate}`, pageWidth / 2, 90, { align: 'center' });
    pdf.text(`${englishTime}`, pageWidth / 2, 105, { align: 'center' });

    // مربع المعلومات مع تدرج
    const boxY = 130;
    const boxHeight = 60;
    const boxX = margin + 20;
    const boxWidth = contentWidth - 40;
    
    // خلفية المربع بلون شفاف
    pdf.setFillColor(255, 255, 255);
    pdf.setGState(new pdf.GState({opacity: 0.9}));
    pdf.roundedRect(boxX, boxY, boxWidth, boxHeight, 8, 8, 'F');
    pdf.setGState(new pdf.GState({opacity: 1}));
    
    // نص المربع
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('تقرير شامل للمخزون', pageWidth / 2, boxY + 25, { align: 'center' });
    
    if (isFiltered) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('📋 تم تطبيق فلاتر مخصصة على البيانات', pageWidth / 2, boxY + 45, { align: 'center' });
    }

    return pageHeight;
  };

  const createStatsCards = (pdf, stats, margin, contentWidth, startY, colors) => {
    let currentY = startY + 20;
    
    // عنوان الإحصائيات
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ملخص الإحصائيات', margin, currentY);
    currentY += 20;

    // بطاقات الإحصائيات
    const statsData = [
      { label: 'متوفر جيد', value: stats.good, color: colors.success },
      { label: 'متوسط', value: stats.medium, color: colors.warning },
      { label: 'منخفض', value: stats.low, color: colors.danger },
      { label: 'نافذ', value: stats.outOfStock, color: colors.dark }
    ];

    const cardWidth = (contentWidth - 15) / 4; // 15 = spacing between cards
    const cardHeight = 35;

    statsData.forEach((stat, index) => {
      const x = margin + (index * (cardWidth + 5));
      
      // خلفية البطاقة
      pdf.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
      pdf.roundedRect(x, currentY, cardWidth, cardHeight, 5, 5, 'F');
      
      // النص
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(stat.value.toString(), x + cardWidth/2, currentY + 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(stat.label, x + cardWidth/2, currentY + 28, { align: 'center' });
    });

    return currentY + cardHeight + 25;
  };

  const createDataTable = (pdf, data, margin, contentWidth, startY, colors, pageHeight) => {
    let currentY = startY;
    
    // عنوان الجدول
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('تفاصيل المنتجات', margin, currentY);
    currentY += 15;

    // إعدادات الجدول
    const headerHeight = 12;
    const rowHeight = 8;
    const columns = [
      { label: 'اسم المنتج', width: contentWidth * 0.35 },
      { label: 'الكود', width: contentWidth * 0.15 },
      { label: 'المتغيرات', width: contentWidth * 0.3 },
      { label: 'المخزون', width: contentWidth * 0.1 },
      { label: 'الحالة', width: contentWidth * 0.1 }
    ];

    // رأس الجدول
    pdf.setFillColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.rect(margin, currentY, contentWidth, headerHeight, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    
    let xPos = margin;
    columns.forEach(col => {
      pdf.text(col.label, xPos + col.width/2, currentY + 8, { align: 'center' });
      xPos += col.width;
    });
    
    currentY += headerHeight;

    // صفوف البيانات
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');

    data.forEach((product, index) => {
      // فحص إذا كنا بحاجة لصفحة جديدة
      if (currentY > pageHeight - 50) {
        pdf.addPage();
        currentY = margin;
      }

      const totalStock = calculateTotalStock(product.variants);
      const isEven = index % 2 === 0;
      
      // خلفية الصف
      if (isEven) {
        pdf.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
        pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }

      // البيانات
      xPos = margin;
      
      // اسم المنتج
      const productName = truncateText(product.name || 'غير محدد', 30);
      pdf.text(productName, xPos + 5, currentY + 5);
      xPos += columns[0].width;
      
      // الكود
      pdf.text(product.sku || 'N/A', xPos + 5, currentY + 5);
      xPos += columns[1].width;
      
      // المتغيرات
      const variantsText = formatVariantsSimple(product.variants);
      pdf.text(truncateText(variantsText, 25), xPos + 5, currentY + 5);
      xPos += columns[2].width;
      
      // المخزون (أرقام إنجليزية)
      pdf.text(totalStock.toString(), xPos + columns[3].width/2, currentY + 5, { align: 'center' });
      xPos += columns[3].width;
      
      // الحالة
      const status = getStockStatusSimple(totalStock);
      pdf.text(status, xPos + columns[4].width/2, currentY + 5, { align: 'center' });

      currentY += rowHeight;
    });

    return currentY + 15;
  };

  const createFooter = (pdf, margin, contentWidth, startY, colors) => {
    // خط فاصل
    pdf.setDrawColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setLineWidth(0.5);
    pdf.line(margin, startY, margin + contentWidth, startY);
    
    // التوقيعات
    const signatureY = startY + 15;
    const signatureWidth = contentWidth / 2 - 10;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('توقيع المسؤول', margin + signatureWidth/2, signatureY, { align: 'center' });
    pdf.text('ختم الشركة', margin + contentWidth/2 + 10 + signatureWidth/2, signatureY, { align: 'center' });
    
    // خطوط التوقيع
    pdf.line(margin, signatureY + 8, margin + signatureWidth, signatureY + 8);
    pdf.line(margin + contentWidth/2 + 10, signatureY + 8, margin + contentWidth, signatureY + 8);
    
    // تاريخ الإنشاء
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    const createdAt = new Date().toLocaleString('en-US');
    pdf.text(`تم الإنشاء: ${createdAt}`, margin + contentWidth/2, signatureY + 20, { align: 'center' });
  };

  // دوال مساعدة
  const calculateInventoryStats = (data) => {
    let good = 0, medium = 0, low = 0, outOfStock = 0;
    
    data.forEach(product => {
      const totalStock = calculateTotalStock(product.variants);
      if (totalStock === 0) outOfStock++;
      else if (totalStock <= 5) low++;
      else if (totalStock <= 20) medium++;
      else good++;
    });
    
    return { good, medium, low, outOfStock };
  };

  const calculateTotalStock = (variants) => {
    if (!variants || !Array.isArray(variants)) return 0;
    return variants.reduce((total, variant) => total + (parseInt(variant.stock_quantity) || 0), 0);
  };

  const formatVariantsSimple = (variants) => {
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return 'لا توجد متغيرات';
    }

    return variants.map(variant => {
      const parts = [];
      if (variant.size_name) parts.push(variant.size_name);
      if (variant.color_name) parts.push(variant.color_name);
      const variantName = parts.join('×') || 'أساسي';
      const stock = parseInt(variant.stock_quantity) || 0;
      return `${variantName}:${stock}`;
    }).join(', ');
  };

  const getStockStatusSimple = (totalStock) => {
    if (totalStock === 0) return 'نافذ';
    if (totalStock <= 5) return 'منخفض';
    if (totalStock <= 20) return 'متوسط';
    return 'جيد';
  };

  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const getFileName = (isSelected, filters) => {
    const date = new Date().toISOString().split('T')[0];
    if (isSelected) return `تقرير_الجرد_المحدد_${date}.pdf`;
    if (Object.keys(filters).some(key => filters[key] && filters[key] !== 'all' && filters[key] !== '')) {
      return `تقرير_الجرد_المفلتر_${date}.pdf`;
    }
    return `تقرير_الجرد_الشامل_${date}.pdf`;
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