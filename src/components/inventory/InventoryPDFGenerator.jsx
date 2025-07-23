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
    console.log('🖨️ بدء إنشاء PDF المذهل...');
    
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

      console.log('✨ إنشاء تحفة فنية...', dataToExport.length, 'منتج');

      // إنشاء PDF احترافي
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // إنشاء المحتوى المذهل
      await createWorldClassPDF(pdf, dataToExport, filters, selectedItems.length > 0);

      // حفظ التحفة
      const fileName = getArtisticFileName(selectedItems.length > 0, filters);
      pdf.save(fileName);

      toast({
        title: "🎨 تم إنشاء تحفة فنية!",
        description: `تقرير عالمي لـ ${dataToExport.length} منتج بتصميم مبهر`,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ خطأ في إنشاء التحفة:', error);
      toast({
        title: "خطأ في إنشاء التقرير",
        description: `خطأ: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const createWorldClassPDF = async (pdf, data, filters, isFiltered) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // ألوان الموقع الساحرة - نفس الموقع تماماً
    const colors = {
      primary: [59, 130, 246],      // الأزرق الساحر
      secondary: [147, 51, 234],    // البنفسجي الملكي  
      accent: [236, 72, 153],       // الوردي المذهل
      success: [34, 197, 94],       // الأخضر الطبيعي
      warning: [251, 146, 60],      // البرتقالي المشرق
      danger: [239, 68, 68],        // الأحمر القوي
      dark: [15, 23, 42],           // الأسود الملكي
      slate: [71, 85, 105],         // الرمادي الأنيق
      light: [248, 250, 252],       // الأبيض الناعم
      gold: [251, 191, 36],         // الذهبي المتألق
      emerald: [16, 185, 129],      // الزمردي الفاخر
      violet: [139, 92, 246]        // البنفسجي الكريستالي
    };

    // الصفحة الأولى - الغلاف المذهل
    await createEpicCover(pdf, pageWidth, pageHeight, colors, isFiltered);
    
    // الصفحة الثانية - الإحصائيات الساحرة
    pdf.addPage();
    await createMagicalStats(pdf, data, pageWidth, pageHeight, margin, contentWidth, colors);
    
    // الصفحة الثالثة+ - جدول البيانات الفني
    pdf.addPage();
    await createArtisticTable(pdf, data, pageWidth, pageHeight, margin, contentWidth, colors);
    
    // الصفحة الأخيرة - التوقيع الملكي
    await createRoyalFooter(pdf, pageWidth, pageHeight, margin, contentWidth, colors);
  };

  const createEpicCover = async (pdf, pageWidth, pageHeight, colors, isFiltered) => {
    // خلفية متدرجة ساحرة - من الأزرق للبنفسجي للوردي
    const gradientSteps = 100;
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const y = (pageHeight / gradientSteps) * i;
      
      // تدرج ثلاثي الألوان
      let r, g, b;
      if (ratio < 0.5) {
        const localRatio = ratio * 2;
        r = Math.round(colors.primary[0] + (colors.secondary[0] - colors.primary[0]) * localRatio);
        g = Math.round(colors.primary[1] + (colors.secondary[1] - colors.primary[1]) * localRatio);
        b = Math.round(colors.primary[2] + (colors.secondary[2] - colors.primary[2]) * localRatio);
      } else {
        const localRatio = (ratio - 0.5) * 2;
        r = Math.round(colors.secondary[0] + (colors.accent[0] - colors.secondary[0]) * localRatio);
        g = Math.round(colors.secondary[1] + (colors.accent[1] - colors.secondary[1]) * localRatio);
        b = Math.round(colors.secondary[2] + (colors.accent[2] - colors.secondary[2]) * localRatio);
      }
      
      pdf.setFillColor(r, g, b);
      pdf.rect(0, y, pageWidth, pageHeight / gradientSteps + 1, 'F');
    }

    // دوائر تزيينية متألقة
    const circles = [
      { x: 30, y: 40, r: 25, opacity: 0.1 },
      { x: 180, y: 80, r: 35, opacity: 0.08 },
      { x: 50, y: 200, r: 40, opacity: 0.12 },
      { x: 160, y: 250, r: 30, opacity: 0.09 }
    ];
    
    circles.forEach(circle => {
      pdf.setFillColor(255, 255, 255);
      pdf.setGState(new pdf.GState({opacity: circle.opacity}));
      pdf.circle(circle.x, circle.y, circle.r, 'F');
    });
    pdf.setGState(new pdf.GState({opacity: 1}));

    // الشعار المذهل - دائرة ذهبية مع أيقونة
    const logoY = 60;
    const logoSize = 30;
    
    // خلفية الشعار بتدرج ذهبي
    pdf.setFillColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    pdf.circle(pageWidth / 2, logoY, logoSize, 'F');
    
    // حدود بيضاء متألقة
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(2);
    pdf.circle(pageWidth / 2, logoY, logoSize);
    pdf.circle(pageWidth / 2, logoY, logoSize - 5);

    // العنوان الرئيسي بخط مذهل
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text('تقرير الجرد الاحترافي', pageWidth / 2, 120, { align: 'center' });
    
    // خط تحت العنوان بتدرج
    pdf.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    pdf.setLineWidth(3);
    pdf.line(40, 130, pageWidth - 40, 130);

    // التاريخ والوقت بتنسيق أنيق
    const now = new Date();
    const arabicDate = now.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
    const englishTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.text(arabicDate, pageWidth / 2, 150, { align: 'center' });
    pdf.setFontSize(14);
    pdf.text(`⏰ ${englishTime}`, pageWidth / 2, 165, { align: 'center' });

    // مربع المعلومات الكريستالي
    const infoBoxY = 185;
    const infoBoxHeight = 70;
    const infoBoxX = 25;
    const infoBoxWidth = pageWidth - 50;
    
    // خلفية شفافة أنيقة
    pdf.setFillColor(255, 255, 255);
    pdf.setGState(new pdf.GState({opacity: 0.15}));
    pdf.roundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 15, 15, 'F');
    pdf.setGState(new pdf.GState({opacity: 1}));
    
    // حدود متألقة
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(1.5);
    pdf.roundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 15, 15);
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text('📊 تقرير شامل ومفصل للمخزون', pageWidth / 2, infoBoxY + 25, { align: 'center' });
    
    if (isFiltered) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('🔍 تم تطبيق فلاتر مخصصة للحصول على النتائج المطلوبة', pageWidth / 2, infoBoxY + 45, { align: 'center' });
    }
    
    // نجوم متلألئة
    const stars = [
      {x: 60, y: 40}, {x: 150, y: 35}, {x: 40, y: 270}, {x: 170, y: 280}
    ];
    
    pdf.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    pdf.setFontSize(12);
    stars.forEach(star => {
      pdf.text('✦', star.x, star.y, { align: 'center' });
    });
  };

  const createMagicalStats = async (pdf, data, pageWidth, pageHeight, margin, contentWidth, colors) => {
    let currentY = margin + 10;
    
    // عنوان الإحصائيات بخط أنيق
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('📈 الإحصائيات التفصيلية', pageWidth / 2, currentY, { align: 'center' });
    
    // خط ذهبي تحت العنوان
    pdf.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    pdf.setLineWidth(2);
    pdf.line(40, currentY + 5, pageWidth - 40, currentY + 5);
    
    currentY += 25;

    const stats = calculateDetailedStats(data);
    
    // كروت الإحصائيات الساحرة
    const statsCards = [
      { 
        label: 'متوفر بكثرة', 
        value: stats.excellent, 
        color: colors.emerald,
        icon: '🟢',
        desc: 'مخزون ممتاز'
      },
      { 
        label: 'متوفر جيد', 
        value: stats.good, 
        color: colors.success,
        icon: '✅',
        desc: 'مخزون جيد'
      },
      { 
        label: 'متوسط', 
        value: stats.medium, 
        color: colors.warning,
        icon: '⚠️',
        desc: 'يحتاج متابعة'
      },
      { 
        label: 'منخفض', 
        value: stats.low, 
        color: colors.danger,
        icon: '🔴',
        desc: 'يحتاج تجديد'
      },
      { 
        label: 'نافذ المخزون', 
        value: stats.outOfStock, 
        color: colors.dark,
        icon: '🚫',
        desc: 'نفدت الكمية'
      }
    ];

    // رسم البطاقات في صفين
    const cardsPerRow = 3;
    const cardWidth = (contentWidth - 20) / cardsPerRow;
    const cardHeight = 45;
    const spacing = 10;

    statsCards.forEach((card, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const x = margin + (col * (cardWidth + spacing));
      const y = currentY + (row * (cardHeight + spacing));
      
      // خلفية البطاقة بتدرج
      pdf.setFillColor(card.color[0], card.color[1], card.color[2]);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 8, 8, 'F');
      
      // حدود فضية لامعة
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(1);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 8, 8);
      
      // النص
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(card.value.toString(), x + cardWidth/2, y + 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(card.label, x + cardWidth/2, y + 25, { align: 'center' });
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(card.desc, x + cardWidth/2, y + 35, { align: 'center' });
    });
    
    currentY += (Math.ceil(statsCards.length / cardsPerRow) * (cardHeight + spacing)) + 30;

    // إحصائيات إضافية جميلة
    const additionalStats = [
      { label: 'إجمالي المنتجات', value: data.length, icon: '📦' },
      { label: 'إجمالي المخزون', value: calculateTotalInventory(data), icon: '📊' },
      { label: 'قيمة المخزون التقديرية', value: `${calculateInventoryValue(data).toLocaleString()} د.ع`, icon: '💰' }
    ];

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.text('📋 معلومات إضافية', margin, currentY);
    currentY += 15;

    additionalStats.forEach((stat, index) => {
      const boxY = currentY + (index * 15);
      
      // خلفية ملونة خفيفة
      pdf.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
      pdf.roundedRect(margin, boxY - 5, contentWidth, 12, 3, 3, 'F');
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${stat.icon} ${stat.label}: ${stat.value}`, margin + 5, boxY + 2);
    });
  };

  const createArtisticTable = async (pdf, data, pageWidth, pageHeight, margin, contentWidth, colors) => {
    let currentY = margin + 10;
    
    // عنوان الجدول الفني
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('📋 تفاصيل المنتجات الشاملة', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    // إعدادات الجدول الفني
    const headerHeight = 15;
    const rowHeight = 10;
    const columns = [
      { label: '🏷️ اسم المنتج', width: contentWidth * 0.35 },
      { label: '🔖 الكود', width: contentWidth * 0.15 },
      { label: '🎨 المتغيرات', width: contentWidth * 0.25 },
      { label: '📦 المخزون', width: contentWidth * 0.15 },
      { label: '📊 الحالة', width: contentWidth * 0.1 }
    ];

    // رأس الجدول بلون أنيق
    
    pdf.setFillColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.roundedRect(margin, currentY, contentWidth, headerHeight, 5, 5, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    
    let xPos = margin;
    columns.forEach(col => {
      pdf.text(col.label, xPos + col.width/2, currentY + 10, { align: 'center' });
      xPos += col.width;
    });
    
    currentY += headerHeight + 3;

    // صفوف البيانات الأنيقة
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');

    data.forEach((product, index) => {
      // فحص الصفحة الجديدة
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = margin;
      }

      const totalStock = calculateTotalStock(product.variants);
      const isEven = index % 2 === 0;
      
      // خلفية الصف المتناوبة
      if (isEven) {
        pdf.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
        pdf.roundedRect(margin, currentY - 2, contentWidth, rowHeight, 2, 2, 'F');
      }

      // شريط جانبي ملون حسب حالة المخزون
      const stockColor = getStockColorAdvanced(totalStock, colors);
      pdf.setFillColor(stockColor[0], stockColor[1], stockColor[2]);
      pdf.rect(margin, currentY - 2, 3, rowHeight, 'F');

      pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
      
      xPos = margin + 5;
      
      // اسم المنتج
      const productName = truncateText(product.name || 'غير محدد', 28);
      pdf.text(productName, xPos, currentY + 4);
      xPos += columns[0].width;
      
      // الكود
      pdf.setFont('courier', 'normal'); // خط مونوسبيس للكود
      pdf.text(product.sku || 'N/A', xPos, currentY + 4);
      pdf.setFont('helvetica', 'normal');
      xPos += columns[1].width;
      
      // المتغيرات
      const variantsText = formatVariantsBeautifully(product.variants);
      pdf.text(truncateText(variantsText, 22), xPos, currentY + 4);
      xPos += columns[2].width;
      
      // المخزون بخط عريض
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(stockColor[0], stockColor[1], stockColor[2]);
      pdf.text(totalStock.toLocaleString(), xPos + columns[3].width/2, currentY + 4, { align: 'center' });
      
      // الحالة
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
      const status = getStockStatusBeautiful(totalStock);
      pdf.text(status, xPos + columns[3].width + columns[4].width/2, currentY + 4, { align: 'center' });

      currentY += rowHeight;
    });
  };

  const createRoyalFooter = async (pdf, pageWidth, pageHeight, margin, contentWidth, colors) => {
    const footerY = pageHeight - 50;
    
    // خط فاصل ذهبي أنيق
    pdf.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    pdf.setLineWidth(2);
    pdf.line(margin, footerY, margin + contentWidth, footerY);
    
    // مربعات التوقيع الأنيقة
    const signatureY = footerY + 15;
    const boxWidth = contentWidth / 2 - 15;
    const boxHeight = 25;
    
    // مربع التوقيع الأول
    pdf.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
    pdf.roundedRect(margin, signatureY, boxWidth, boxHeight, 5, 5, 'F');
    pdf.setDrawColor(colors.slate[0], colors.slate[1], colors.slate[2]);
    pdf.roundedRect(margin, signatureY, boxWidth, boxHeight, 5, 5);
    
    // مربع التوقيع الثاني
    pdf.roundedRect(margin + contentWidth/2 + 15, signatureY, boxWidth, boxHeight, 5, 5, 'F');
    pdf.roundedRect(margin + contentWidth/2 + 15, signatureY, boxWidth, boxHeight, 5, 5);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark[0], colors.dark[1], colors.dark[2]);
    pdf.text('✍️ توقيع المسؤول', margin + boxWidth/2, signatureY + 15, { align: 'center' });
    pdf.text('🏢 ختم الشركة', margin + contentWidth/2 + 15 + boxWidth/2, signatureY + 15, { align: 'center' });
    
    // معلومات الإنشاء بتنسيق جميل
    pdf.setFontSize(8);
    pdf.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
    pdf.setFont('helvetica', 'italic');
    const createdAt = new Date().toLocaleString('en-US');
    pdf.text(`🕐 تم الإنشاء آلياً: ${createdAt} | 💼 نظام إدارة المخزون المتقدم`, 
             pageWidth / 2, signatureY + 35, { align: 'center' });
  };

  // دوال مساعدة محسنة
  const calculateDetailedStats = (data) => {
    let excellent = 0, good = 0, medium = 0, low = 0, outOfStock = 0;
    
    data.forEach(product => {
      const totalStock = calculateTotalStock(product.variants);
      if (totalStock === 0) outOfStock++;
      else if (totalStock <= 5) low++;
      else if (totalStock <= 20) medium++;
      else if (totalStock <= 50) good++;
      else excellent++;
    });
    
    return { excellent, good, medium, low, outOfStock };
  };

  const calculateTotalStock = (variants) => {
    if (!variants || !Array.isArray(variants)) return 0;
    return variants.reduce((total, variant) => total + (parseInt(variant.stock_quantity) || 0), 0);
  };

  const calculateTotalInventory = (data) => {
    return data.reduce((total, product) => total + calculateTotalStock(product.variants), 0);
  };

  const calculateInventoryValue = (data) => {
    return data.reduce((total, product) => {
      const productTotal = (product.variants || []).reduce((pTotal, variant) => {
        const stock = parseInt(variant.stock_quantity) || 0;
        const price = parseFloat(variant.sale_price) || 0;
        return pTotal + (stock * price);
      }, 0);
      return total + productTotal;
    }, 0);
  };

  const getStockColorAdvanced = (totalStock, colors) => {
    if (totalStock === 0) return colors.dark;
    if (totalStock <= 5) return colors.danger;
    if (totalStock <= 20) return colors.warning;
    if (totalStock <= 50) return colors.success;
    return colors.emerald;
  };

  const formatVariantsBeautifully = (variants) => {
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
    }).join(' | ');
  };

  const getStockStatusBeautiful = (totalStock) => {
    if (totalStock === 0) return '🚫 نافذ';
    if (totalStock <= 5) return '🔴 منخفض';
    if (totalStock <= 20) return '🟡 متوسط';
    if (totalStock <= 50) return '🟢 جيد';
    return '💚 ممتاز';
  };

  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const getArtisticFileName = (isSelected, filters) => {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    
    if (isSelected) return `تقرير_الجرد_المحدد_${date}_${time}.pdf`;
    if (Object.keys(filters).some(key => filters[key] && filters[key] !== 'all' && filters[key] !== '')) {
      return `تقرير_الجرد_المفلتر_${date}_${time}.pdf`;
    }
    return `تقرير_الجرد_الشامل_${date}_${time}.pdf`;
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isLoading || !inventoryData.length}
      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white border-0 shadow-xl transform hover:scale-105 transition-all duration-300"
      size="sm"
    >
      <Download className="w-4 h-4" />
      تحميل PDF مذهل
    </Button>
  );
};

export default InventoryPDFGenerator;