import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from '@/hooks/use-toast';

const InventoryPDFGenerator = ({ 
  inventoryData = [], 
  selectedItems = [], 
  filters = {},
  isLoading = false 
}) => {
  const generatePDF = async () => {
    try {
      const dataToExport = selectedItems.length > 0 ? 
        inventoryData.filter(item => selectedItems.includes(item.id)) : 
        inventoryData;
      
      console.log('البيانات المختارة للتصدير:', {
        selectedItems,
        totalInventoryData: inventoryData.length,
        dataToExport: dataToExport.length,
        itemNames: dataToExport.map(item => item.name)
      });
      
      if (!dataToExport || dataToExport.length === 0) {
        toast({
          title: "لا توجد بيانات للتصدير",
          description: "لم يتم العثور على منتجات للتصدير",
          variant: "destructive"
        });
        return;
      }

      // إنشاء HTML تقرير احترافي
      const reportHTML = createReportHTML(dataToExport);
      
      // إنشاء عنصر مؤقت
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = reportHTML;
      tempDiv.style.position = 'absolute';
      tempDiv.style.top = '-9999px';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '210mm'; // عرض A4
      document.body.appendChild(tempDiv);

      // تحويل HTML إلى canvas بحجم ديناميكي
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // عرض A4 بالبيكسل
        height: tempDiv.scrollHeight // ارتفاع ديناميكي حسب المحتوى
      });

      // إزالة العنصر المؤقت
      document.body.removeChild(tempDiv);

      // إنشاء PDF مع صفحات متعددة
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      // حساب الأبعاد
      const imgWidth = 210; // عرض A4
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = 297; // ارتفاع A4
      
      let position = 0;
      
      // إضافة الصفحة الأولى
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      
      // إضافة صفحات إضافية إذا كان المحتوى أطول من صفحة واحدة
      let remainingHeight = imgHeight - pageHeight;
      
      while (remainingHeight > 0) {
        position = -pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        remainingHeight -= pageHeight;
      }
      
      // حفظ الملف
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
        title: "❌ خطأ في إنشاء التقرير",
        description: "حدث خطأ أثناء إنشاء التقرير",
        variant: "destructive"
      });
    }
  };

  const createReportHTML = (data) => {
    // حساب الإحصائيات المتقدمة - البيانات المحلية فقط (لا يستخدم قاعدة البيانات)
    const totalProducts = data.length;
    const totalStock = data.reduce((sum, item) => {
      return sum + (item.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0);
    }, 0);
    
    const totalVariants = data.reduce((sum, item) => sum + (item.variants?.length || 0), 0);
    const totalReservedStock = data.reduce((sum, item) => {
      return sum + (item.variants?.reduce((vSum, v) => vSum + (v.reserved_quantity || 0), 0) || 0);
    }, 0);
    
    // تحليل مفصل للمخزون بدقة
    const mediumStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock >= 5 && itemStock < 15;
    }).length;
    
    const lowStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock > 0 && itemStock < 5;
    }).length;
    
    const outOfStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock === 0;
    }).length;

    const goodStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock >= 15;
    }).length;

    // تحليل التفاصيل المتقدمة
    const variantAnalysis = {
      totalVariants: totalVariants,
      availableVariants: data.reduce((sum, item) => {
        return sum + (item.variants?.filter(v => (v.quantity || 0) > 0).length || 0);
      }, 0),
      lowStockVariants: data.reduce((sum, item) => {
        return sum + (item.variants?.filter(v => (v.quantity || 0) > 0 && (v.quantity || 0) < 3).length || 0);
      }, 0),
      outOfStockVariants: data.reduce((sum, item) => {
        return sum + (item.variants?.filter(v => (v.quantity || 0) === 0).length || 0);
      }, 0)
    };

    // حساب نسب دقيقة للرسم البياني
    const stockPercentages = {
      good: totalProducts > 0 ? Math.round((goodStockItems / totalProducts) * 100) : 0,
      medium: totalProducts > 0 ? Math.round((mediumStockItems / totalProducts) * 100) : 0,
      low: totalProducts > 0 ? Math.round((lowStockItems / totalProducts) * 100) : 0,
      out: totalProducts > 0 ? Math.round((outOfStockItems / totalProducts) * 100) : 0
    };

    // حساب القيمة الإجمالية للمخزون
    const totalInventoryValue = data.reduce((sum, item) => {
      return sum + (item.variants?.reduce((vSum, v) => vSum + ((v.quantity || 0) * (v.price || 0)), 0) || 0);
    }, 0);

    // التاريخ بالعربية والميلادي
    const currentDate = new Date();
    const arabicDate = currentDate.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
    const gregorianDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Amiri', 'Inter', system-ui, -apple-system, sans-serif; padding: 15px; background: #ffffff; color: #0f172a; line-height: 1.6; font-size: 12px; direction: rtl;">
        
        <!-- العنوان الاحترافي -->
        <div style="background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 30%, #a855f7 60%, #ec4899 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 15px; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(124, 58, 237, 0.25);">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 40%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.08) 0%, transparent 40%); opacity: 0.6;"></div>
          <div style="position: relative; z-index: 2;">
            <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">RYUS BRAND</div>
            <div style="font-size: 14px; font-weight: 600; opacity: 0.95; margin-bottom: 6px;">نظام إدارة المخزون المتقدم</div>
            <div style="font-size: 11px; opacity: 0.85; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>📅 ${arabicDate}</span>
              <span>•</span>
              <span>${gregorianDate}</span>
              <span>•</span>
              <span>⏰ ${currentDate.toLocaleTimeString('ar-SA')}</span>
            </div>
            <div style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); font-size: 35px; opacity: 0.15;">📊</div>
          </div>
        </div>

        <!-- بطاقات الإحصائيات الأساسية -->
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 15px;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 12px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(59, 130, 246, 0.3);">
            <div style="font-size: 18px; font-weight: 800;">${totalProducts}</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 1px;">إجمالي المنتجات</div>
          </div>
          <div style="background: linear-gradient(135deg, #10b981, #047857); color: white; padding: 12px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(16, 185, 129, 0.3);">
            <div style="font-size: 18px; font-weight: 800;">${totalStock.toLocaleString()}</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 1px;">إجمالي المخزون</div>
          </div>
          <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 12px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(139, 92, 246, 0.3);">
            <div style="font-size: 18px; font-weight: 800;">${totalVariants}</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 1px;">المتغيرات</div>
          </div>
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 12px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(245, 158, 11, 0.3);">
            <div style="font-size: 18px; font-weight: 800;">${totalReservedStock.toLocaleString()}</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 1px;">محجوز</div>
          </div>
          <div style="background: linear-gradient(135deg, #06b6d4, #0891b2); color: white; padding: 12px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(6, 182, 212, 0.3);">
            <div style="font-size: 18px; font-weight: 800;">${(totalStock - totalReservedStock).toLocaleString()}</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 1px;">متاح</div>
          </div>
          <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 12px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(239, 68, 68, 0.3);">
            <div style="font-size: 18px; font-weight: 800;">${Math.round(totalInventoryValue).toLocaleString()}</div>
            <div style="font-size: 9px; opacity: 0.9; margin-top: 1px;">القيمة (د.ع)</div>
          </div>
        </div>


        <!-- جدول المنتجات التفصيلي -->
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 12px; direction: rtl;">
            <h2 style="margin: 0; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              📋 تفاصيل مخزون المنتجات
            </h2>
          </div>
          
          <div style="direction: rtl;">
            ${data.map((item, index) => {
              const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
              const itemReserved = item.variants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;
              const itemAvailable = itemStock - itemReserved;
              const avgPrice = item.variants?.length > 0 
                ? item.variants.reduce((sum, v) => sum + (v.price || 0), 0) / item.variants.length 
                : 0;
              
              let status = 'جيد';
              let statusColor = '#10b981';
              let statusBg = '#10b98120';
              if (itemStock === 0) {
                status = 'نافد';
                statusColor = '#ef4444';
                statusBg = '#ef444420';
              } else if (itemStock < 5) {
                status = 'منخفض';
                statusColor = '#ef4444';
                statusBg = '#ef444420';
              } else if (itemStock < 15) {
                status = 'متوسط';
                statusColor = '#f59e0b';
                statusBg = '#f59e0b20';
              }

              // عرض تفاصيل جميع المتغيرات بشكل مفصل وكبير وواضح
              const allVariants = item.variants || [];
              
              let variantDetails = '';
              if (allVariants.length > 0) {
                // تجميع المتغيرات حسب اللون والقياس
                const variantsByColor = {};
                const variantsBySize = {};
                const generalVariants = [];
                
                allVariants.forEach(variant => {
                  const variantStock = variant.quantity || 0;
                  const variantReserved = variant.reserved_quantity || 0;
                  const variantAvailable = variantStock - variantReserved;
                  
                  // تخطي المتغيرات النافدة
                  if (variantStock === 0) return;
                  
                  // تحديد حالة المخزون للمتغير
                  let variantStatus = '';
                  let statusColor = '#10b981';
                  if (variantStock < 3) {
                    variantStatus = 'منخفض';
                    statusColor = '#ef4444';
                  } else if (variantStock < 10) {
                    variantStatus = 'متوسط';
                    statusColor = '#f59e0b';
                  } else {
                    variantStatus = 'جيد';
                    statusColor = '#10b981';
                  }
                  
                  if (variant.color && variant.size) {
                    // منتج له لون وقياس
                    if (!variantsByColor[variant.color]) {
                      variantsByColor[variant.color] = [];
                    }
                    variantsByColor[variant.color].push({
                      ...variant,
                      available: variantAvailable,
                      status: variantStatus,
                      statusColor: statusColor
                    });
                  } else if (variant.size && !variant.color) {
                    // منتج له قياس فقط
                    variantsBySize[variant.size] = {
                      ...variant,
                      available: variantAvailable,
                      status: variantStatus,
                      statusColor: statusColor
                    };
                  } else if (variant.color && !variant.size) {
                    // منتج له لون فقط
                    if (!variantsByColor[variant.color]) {
                      variantsByColor[variant.color] = [];
                    }
                    variantsByColor[variant.color].push({
                      ...variant,
                      available: variantAvailable,
                      status: variantStatus,
                      statusColor: statusColor
                    });
                  } else {
                    // متغير عام
                    generalVariants.push({
                      ...variant,
                      available: variantAvailable,
                      status: variantStatus,
                      statusColor: statusColor
                    });
                  }
                });

                // تدرج لوني احترافي عالمي مثل ألوان الذكاء الاصطناعي
                const getColorGradient = (colorName) => {
                  // تدرجات AI جميلة واحترافية
                  const aiGradients = [
                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple Blue
                    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink Red
                    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue Cyan
                    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green Mint
                    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Pink Yellow
                    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Mint Pink
                    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // Peach Orange
                    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Rose Pink
                  ];
                  // اختيار تدرج بناء على hash اللون لضمان الثبات
                  const index = colorName.length % aiGradients.length;
                  return aiGradients[index];
                };

                // عرض المنتجات التي لها ألوان - كل لون في سطر منفصل
                if (Object.keys(variantsByColor).length > 0) {
                  Object.entries(variantsByColor).forEach(([color, variants]) => {
                    const colorGradient = getColorGradient(color);
                    
                    variantDetails += `
                      <!-- سطر كامل للون -->
                      <div style="margin: 16px 0; background: ${colorGradient}; border-radius: 20px; padding: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); border: 2px solid rgba(0,0,0,0.1); direction: rtl;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                          <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="background: rgba(255,255,255,0.9); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                              🎨
                            </div>
                             <div>
                               <div style="font-weight: 900; font-size: 16px; color: #1e293b; text-shadow: 0 1px 3px rgba(255,255,255,0.8);">${item.name} - لون ${color}</div>
                               <div style="font-size: 12px; color: #64748b; font-weight: 600;">${variants.length} ${variants.length > 1 ? 'قياس متوفر' : 'قياس متوفر'}</div>
                             </div>
                          </div>
                          <div style="background: rgba(255,255,255,0.9); padding: 8px 16px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <span style="font-size: 12px; color: #1e293b; font-weight: 700;">
                              إجمالي: ${variants.reduce((sum, v) => sum + (v.quantity || 0), 0)} قطعة
                            </span>
                          </div>
                        </div>
                        
                        <!-- عرض القياسات في شبكة أنيقة -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; direction: rtl;">
                          ${variants.map(variant => `
                            <div style="background: rgba(255,255,255,0.95); border: 2px solid ${variant.statusColor}40; border-radius: 16px; padding: 16px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; overflow: hidden;">
                               <!-- تأثير بصري في الخلفية -->
                               <div style="position: absolute; top: -10px; left: -10px; width: 30px; height: 30px; background: ${variant.statusColor}20; border-radius: 50%; opacity: 0.6;"></div>
                               <div style="position: absolute; bottom: -10px; right: -10px; width: 20px; height: 20px; background: ${variant.statusColor}15; border-radius: 50%; opacity: 0.8;"></div>
                               
                               <!-- محتوى القياس -->
                               <div style="position: relative; z-index: 2;">
                                 <div style="font-weight: 800; font-size: 14px; color: #1e293b; margin-bottom: 8px; padding: 6px 12px; background: ${variant.statusColor}15; border-radius: 12px; border: 1px solid ${variant.statusColor}30;">
                                   📏 ${variant.size}
                                 </div>
                                 
                                 <div style="margin: 8px 0;">
                                   <div style="font-size: 13px; color: ${variant.statusColor}; font-weight: 700; margin-bottom: 3px;">
                                     الكلي: ${variant.quantity || 0}
                                   </div>
                                   <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">
                                     محجوز: ${variant.reserved_quantity || 0}
                                   </div>
                                   <div style="font-size: 11px; color: ${variant.statusColor}; font-weight: 700; margin-bottom: 6px;">
                                     متاح: ${variant.available}
                                   </div>
                                 </div>
                               </div>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    `;
                  });
                }

                // عرض المنتجات التي لها أقياس فقط (بدون ألوان)
                if (Object.keys(variantsBySize).length > 0) {
                  variantDetails += `
                    <div style="margin: 16px 0; background: linear-gradient(135deg, #f8fafc, #e2e8f0); border-radius: 20px; padding: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); border: 2px solid rgba(100, 116, 139, 0.2); direction: rtl;">
                      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="background: rgba(100, 116, 139, 0.1); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                          📏
                        </div>
                        <div>
                          <div style="font-weight: 900; font-size: 18px; color: #1e293b;">القياسات المتوفرة</div>
                          <div style="font-size: 12px; color: #64748b; font-weight: 600;">${Object.keys(variantsBySize).length} قياس</div>
                        </div>
                      </div>
                      
                      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; direction: rtl;">
                        ${Object.entries(variantsBySize).map(([size, variant]) => `
                          <div style="background: white; border: 2px solid ${variant.statusColor}40; border-radius: 16px; padding: 16px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <div style="font-weight: 800; font-size: 14px; color: #1e293b; margin-bottom: 8px; padding: 6px 12px; background: ${variant.statusColor}15; border-radius: 12px;">
                              📏 ${size}
                            </div>
                            <div style="font-size: 13px; color: ${variant.statusColor}; font-weight: 700; margin-bottom: 3px;">
                              الكلي: ${variant.quantity || 0}
                            </div>
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">
                              محجوز: ${variant.reserved_quantity || 0}
                            </div>
                            <div style="font-size: 11px; color: ${variant.statusColor}; font-weight: 700; margin-bottom: 6px;">
                              متاح: ${variant.available}
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `;
                }

                // عرض المتغيرات العامة
                if (generalVariants.length > 0) {
                  variantDetails += `
                    <div style="margin: 16px 0; background: linear-gradient(135deg, #fef7ed, #fed7aa); border-radius: 20px; padding: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); border: 2px solid rgba(217, 119, 6, 0.2); direction: rtl;">
                      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="background: rgba(217, 119, 6, 0.1); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                          📦
                        </div>
                        <div>
                          <div style="font-weight: 900; font-size: 18px; color: #1e293b;">منتجات عامة</div>
                          <div style="font-size: 12px; color: #64748b; font-weight: 600;">${generalVariants.length} متغير</div>
                        </div>
                      </div>
                      
                      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; direction: rtl;">
                        ${generalVariants.map((variant, idx) => `
                          <div style="background: white; border: 2px solid ${variant.statusColor}40; border-radius: 16px; padding: 16px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <div style="font-weight: 800; font-size: 14px; color: #1e293b; margin-bottom: 8px; padding: 6px 12px; background: ${variant.statusColor}15; border-radius: 12px;">
                              📦 عام ${idx + 1}
                            </div>
                            <div style="font-size: 13px; color: ${variant.statusColor}; font-weight: 700; margin-bottom: 3px;">
                              الكلي: ${variant.quantity || 0}
                            </div>
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">
                              محجوز: ${variant.reserved_quantity || 0}
                            </div>
                            <div style="font-size: 11px; color: ${variant.statusColor}; font-weight: 700; margin-bottom: 6px;">
                              متاح: ${variant.available}
                             </div>
                           </div>
                         `).join('')}
                      </div>
                    </div>
                  `;
                }
                
                if (variantDetails === '') {
                  variantDetails = '<div style="font-size: 14px; color: #64748b; padding: 30px; text-align: center; direction: rtl; background: linear-gradient(135deg, #f9fafb, #e5e7eb); border-radius: 16px; border: 3px dashed #d1d5db; margin: 16px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">⚠️ جميع المتغيرات نافدة من المخزون</div>';
                }
              } else {
                variantDetails = '<div style="font-size: 14px; color: #64748b; padding: 30px; text-align: center; direction: rtl; background: linear-gradient(135deg, #f9fafb, #e5e7eb); border-radius: 16px; border: 3px dashed #d1d5db; margin: 16px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">📭 لا توجد متغيرات لهذا المنتج</div>';
              }

              return `
                <div style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 2px solid #e2e8f0; padding: 20px; direction: rtl;">
                  <!-- عنوان المنتج مع التفاصيل الأساسية -->
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 16px; border-radius: 12px; box-shadow: 0 4px 12px rgba(30, 41, 59, 0.3);">
                    <div style="direction: rtl;">
                      <div style="font-weight: 900; font-size: 16px; margin-bottom: 4px;">${item.name || 'منتج بدون اسم'}</div>
                      ${avgPrice > 0 ? `<div style="font-size: 11px; opacity: 0.9;">متوسط السعر: ${Math.round(avgPrice).toLocaleString()} د.ع</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                      <div style="text-align: center; padding: 8px 12px; background: rgba(255,255,255,0.15); border-radius: 10px;">
                        <div style="font-size: 14px; font-weight: 800; color: #10b981;">${itemStock.toLocaleString()}</div>
                        <div style="font-size: 8px; opacity: 0.9;">إجمالي</div>
                      </div>
                      <div style="text-align: center; padding: 8px 12px; background: rgba(255,255,255,0.15); border-radius: 10px;">
                        <div style="font-size: 14px; font-weight: 800; color: #f59e0b;">${itemReserved.toLocaleString()}</div>
                        <div style="font-size: 8px; opacity: 0.9;">محجوز</div>
                      </div>
                      <div style="text-align: center; padding: 8px 12px; background: rgba(255,255,255,0.15); border-radius: 10px;">
                        <div style="font-size: 14px; font-weight: 800; color: #06b6d4;">${itemAvailable.toLocaleString()}</div>
                        <div style="font-size: 8px; opacity: 0.9;">متاح</div>
                      </div>
                      <div style="padding: 8px 12px; background: ${statusBg}; border: 2px solid ${statusColor}40; border-radius: 10px;">
                        <span style="color: ${statusColor}; font-weight: 700; font-size: 10px;">${status}</span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- تفاصيل المتغيرات -->
                  ${variantDetails}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- التذييل المبسط -->
        <div style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #f8fafc, #e2e8f0); border-radius: 8px; text-align: center; color: #64748b; border: 1px solid #e2e8f0; direction: rtl;">
          <div style="font-size: 10px; font-weight: 600; color: #1e293b; margin-bottom: 3px;">تم إنشاؤه بواسطة نظام إدارة المخزون RYUS BRAND</div>
          <div style="font-size: 9px; color: #94a3b8;">📅 ${arabicDate} • ${gregorianDate} • ${currentDate.toLocaleTimeString('ar-SA')} • تقرير سري</div>
          <div style="margin-top: 6px; font-size: 8px; color: #94a3b8;">يحتوي هذا التقرير على ${totalProducts} منتج مع ${totalVariants} متغير • القيمة الإجمالية للمخزون: ${Math.round(totalInventoryValue).toLocaleString()} دينار عراقي</div>
        </div>
      </div>
    `;
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