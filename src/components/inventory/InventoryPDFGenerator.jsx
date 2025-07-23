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
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // إضافة خط عربي (استخدام خط افتراضي يدعم العربية)
      pdf.setFont('helvetica');
      
      await createPDFContent(pdf, dataToExport, filters, selectedItems.length > 0);

      // حفظ PDF
      const fileName = selectedItems.length > 0 
        ? `تقرير_الجرد_المحدد_${new Date().toISOString().split('T')[0]}.pdf`
        : Object.keys(filters).some(key => filters[key] && filters[key] !== 'all' && filters[key] !== '')
          ? `تقرير_الجرد_المفلتر_${new Date().toISOString().split('T')[0]}.pdf`
          : `تقرير_الجرد_الشامل_${new Date().toISOString().split('T')[0]}.pdf`;

      pdf.save(fileName);

      toast({
        title: "✅ تم إنشاء التقرير بنجاح",
        description: `تم تصدير ${dataToExport.length} منتج بتصميم احترافي`,
        variant: "default"
      });

    } catch (error) {
      console.error('خطأ في إنشاء PDF:', error);
      toast({
        title: "خطأ في إنشاء التقرير",
        description: "حدث خطأ أثناء إنشاء PDF",
        variant: "destructive"
      });
    }
  };

  const createPDFContent = async (pdf, data, filters, isFiltered) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // ألوان الموقع
    const colors = {
      primary: [59, 130, 246],      // أزرق
      secondary: [147, 51, 234],    // بنفسجي
      success: [34, 197, 94],       // أخضر
      warning: [251, 146, 60],      // برتقالي
      danger: [239, 68, 68],        // أحمر
      dark: [30, 41, 59],           // رمادي داكن
      light: [248, 250, 252]        // رمادي فاتح
    };

    let currentY = margin;

    // غلاف التقرير
    currentY = await createCoverPage(pdf, pageWidth, pageHeight, margin, colors, isFiltered);
    
    // صفحة جديدة للمحتوى
    pdf.addPage();
    currentY = margin;

    // الإحصائيات
    const stats = calculateInventoryStats(data);
    currentY = await createStatsSection(pdf, stats, margin, contentWidth, currentY, colors);
    
    // الجدول
    currentY = await createInventoryTable(pdf, data, margin, contentWidth, currentY, colors, pageHeight);
    
    // التوقيع
    await createSignatureSection(pdf, margin, contentWidth, pageHeight - 60, colors);
  };

  const createCoverPage = async (pdf, pageWidth, pageHeight, margin, colors, isFiltered) => {
    // خلفية متدرجة (محاكاة)
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.rect(0, 0, pageWidth, pageHeight / 2, 'F');
    
    pdf.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    pdf.rect(0, pageHeight / 2, pageWidth, pageHeight / 2, 'F');

    // العنوان الرئيسي
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(28);
    pdf.text('تقرير الجرد الاحترافي', pageWidth / 2, 80, { align: 'center' });

    // التاريخ
    const currentDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    
    pdf.setFontSize(16);
    pdf.text(currentDate, pageWidth / 2, 100, { align: 'center' });

    // مربع المعلومات
    const boxY = 120;
    const boxHeight = 80;
    
    pdf.setFillColor(255, 255, 255, 0.9);
    pdf.roundedRect(margin + 20, boxY, contentWidth - 40, boxHeight, 5, 5, 'F');
    
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(20);
    pdf.text('ملخص التقرير', pageWidth / 2, boxY + 20, { align: 'center' });

    if (isFiltered) {
      pdf.setFontSize(12);
      pdf.text('📋 تقرير مفلتر - تم تطبيق فلاتر مخصصة', pageWidth / 2, boxY + 40, { align: 'center' });
    }

    return pageHeight;
  };

  const createStatsSection = async (pdf, stats, margin, contentWidth, startY, colors) => {
    let currentY = startY + 20;
    
    // عنوان القسم
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(18);
    pdf.text('إحصائيات المخزون', margin, currentY);
    currentY += 15;

    // الإحصائيات في صفوف
    const statsData = [
      { label: 'متوفر جيد', value: stats.good, color: colors.success },
      { label: 'متوسط', value: stats.medium, color: colors.warning },
      { label: 'منخفض', value: stats.low, color: colors.danger },
      { label: 'نافذ', value: stats.outOfStock, color: colors.dark }
    ];

    const boxWidth = contentWidth / 4 - 5;
    const boxHeight = 30;

    statsData.forEach((stat, index) => {
      const x = margin + (index * (boxWidth + 6.67));
      
      // صندوق الإحصائية
      pdf.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
      pdf.roundedRect(x, currentY, boxWidth, boxHeight, 3, 3, 'F');
      
      // النص
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.text(stat.value.toString(), x + boxWidth/2, currentY + 12, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.text(stat.label, x + boxWidth/2, currentY + 22, { align: 'center' });
    });

    return currentY + boxHeight + 20;
  };

  const createInventoryTable = async (pdf, data, margin, contentWidth, startY, colors, pageHeight) => {
    let currentY = startY;
    
    // عنوان الجدول
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(16);
    pdf.text('تفاصيل المخزون', margin, currentY);
    currentY += 10;

    // رأس الجدول
    const headerHeight = 12;
    const rowHeight = 10;
    const columns = [
      { label: 'المنتج', width: contentWidth * 0.3 },
      { label: 'الرمز', width: contentWidth * 0.2 },
      { label: 'المتغيرات', width: contentWidth * 0.25 },
      { label: 'المخزون', width: contentWidth * 0.15 },
      { label: 'الحالة', width: contentWidth * 0.1 }
    ];

    // خلفية رأس الجدول
    pdf.setFillColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.rect(margin, currentY, contentWidth, headerHeight, 'F');
    
    // نص رأس الجدول
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    
    let xPos = margin;
    columns.forEach(col => {
      pdf.text(col.label, xPos + col.width/2, currentY + 8, { align: 'center' });
      xPos += col.width;
    });
    
    currentY += headerHeight;

    // بيانات الجدول
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(8);

    data.forEach((product, index) => {
      // فحص إذا كنا بحاجة لصفحة جديدة
      if (currentY > pageHeight - 40) {
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
      let xPos = margin;
      
      // اسم المنتج
      pdf.text(truncateText(product.name || 'غير محدد', 25), xPos + 2, currentY + 6);
      xPos += columns[0].width;
      
      // الرمز
      pdf.text(product.sku || 'N/A', xPos + 2, currentY + 6);
      xPos += columns[1].width;
      
      // المتغيرات
      const variantsText = formatVariantsForPDF(product.variants);
      pdf.text(truncateText(variantsText, 20), xPos + 2, currentY + 6);
      xPos += columns[2].width;
      
      // المخزون
      pdf.text(totalStock.toString(), xPos + columns[3].width/2, currentY + 6, { align: 'center' });
      xPos += columns[3].width;
      
      // الحالة
      const status = getStockStatusText(totalStock);
      pdf.text(status, xPos + columns[4].width/2, currentY + 6, { align: 'center' });

      currentY += rowHeight;
    });

    return currentY + 10;
  };

  const createSignatureSection = async (pdf, margin, contentWidth, startY, colors) => {
    // خط فاصل
    pdf.setDrawColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.line(margin, startY, margin + contentWidth, startY);
    
    // التوقيعات
    const signatureY = startY + 20;
    const signatureWidth = contentWidth / 2 - 10;
    
    pdf.setFontSize(12);
    pdf.text('توقيع المسؤول', margin + signatureWidth/2, signatureY, { align: 'center' });
    pdf.text('ختم الشركة', margin + contentWidth/2 + 10 + signatureWidth/2, signatureY, { align: 'center' });
    
    // خطوط التوقيع
    pdf.line(margin, signatureY + 10, margin + signatureWidth, signatureY + 10);
    pdf.line(margin + contentWidth/2 + 10, signatureY + 10, margin + contentWidth, signatureY + 10);
    
    // تاريخ الإنشاء
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`تم إنشاؤه آلياً في ${new Date().toLocaleString('ar-EG')}`, 
             margin + contentWidth/2, signatureY + 25, { align: 'center' });
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

  const formatVariantsForPDF = (variants) => {
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return 'لا توجد متغيرات';
    }

    return variants.map(variant => {
      const parts = [];
      if (variant.size_name) parts.push(variant.size_name);
      if (variant.color_name) parts.push(variant.color_name);
      const variantName = parts.join(' × ') || 'أساسي';
      const stock = parseInt(variant.stock_quantity) || 0;
      return `${variantName}: ${stock}`;
    }).join(', ');
  };

  const getStockStatusText = (totalStock) => {
    if (totalStock === 0) return 'نافذ';
    if (totalStock <= 5) return 'منخفض';
    if (totalStock <= 20) return 'متوسط';
    return 'جيد';
  };

  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
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