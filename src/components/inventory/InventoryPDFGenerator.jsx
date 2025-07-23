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

      // تحويل HTML إلى canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // عرض A4 بالبيكسل
        height: 1123 // ارتفاع A4 بالبيكسل
      });

      // إزالة العنصر المؤقت
      document.body.removeChild(tempDiv);

      // إنشاء PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      // حساب الأبعاد للحصول على جودة عالية
      const imgWidth = 210; // عرض A4
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
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
    
    const lowStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock > 0 && itemStock < 5;
    }).length;
    
    const outOfStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock === 0;
    }).length;

    const goodStockItems = totalProducts - lowStockItems - outOfStockItems;

    // حساب نسب للرسم البياني المبسط
    const stockPercentages = {
      good: totalProducts > 0 ? Math.round((goodStockItems / totalProducts) * 100) : 0,
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

        <!-- مخطط توزيع المخزون المبسط -->
        <div style="background: white; border-radius: 12px; padding: 12px; margin-bottom: 15px; box-shadow: 0 3px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px; direction: rtl;">
            📊 تحليل توزيع المخزون
          </h3>
          <div style="display: flex; gap: 10px; align-items: center; direction: rtl;">
            <div style="flex: 1; background: #f8fafc; border-radius: 6px; padding: 8px;">
              <div style="display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: #e2e8f0; direction: ltr;">
                <div style="background: #10b981; width: ${stockPercentages.good}%;"></div>
                <div style="background: #f59e0b; width: ${stockPercentages.low}%;"></div>
                <div style="background: #ef4444; width: ${stockPercentages.out}%;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 8px; color: #64748b; direction: rtl;">
                <span>جيد: ${stockPercentages.good}%</span>
                <span>منخفض: ${stockPercentages.low}%</span>
                <span>نافد: ${stockPercentages.out}%</span>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; direction: rtl;">
              <div style="display: flex; align-items: center; gap: 4px; font-size: 9px;">
                <div style="width: 10px; height: 10px; background: #10b981; border-radius: 2px;"></div>
                <span style="color: #374151;">مخزون جيد (${goodStockItems})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; font-size: 9px;">
                <div style="width: 10px; height: 10px; background: #f59e0b; border-radius: 2px;"></div>
                <span style="color: #374151;">مخزون منخفض (${lowStockItems})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; font-size: 9px;">
                <div style="width: 10px; height: 10px; background: #ef4444; border-radius: 2px;"></div>
                <span style="color: #374151;">نافد من المخزون (${outOfStockItems})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- جدول المنتجات التفصيلي -->
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 12px; direction: rtl;">
            <h2 style="margin: 0; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              📋 تفاصيل مخزون المنتجات
            </h2>
          </div>
          
          <div style="width: 100%; direction: rtl;">
            ${data.map((item, index) => {
              const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
              const itemReserved = item.variants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;
              const itemAvailable = itemStock - itemReserved;
              const avgPrice = item.variants?.length > 0 
                ? item.variants.reduce((sum, v) => sum + (v.price || 0), 0) / item.variants.length 
                : 0;
              
              // فلترة المتغيرات المتوفرة فقط (استبعاد النافدة)
              const availableVariants = item.variants?.filter(variant => (variant.quantity || 0) > 0) || [];
              
              // تجميع المتغيرات حسب اللون والقياس
              const variantsByColor = {};
              const variantsBySize = {};
              const generalVariants = [];
              
              availableVariants.forEach(variant => {
                const variantStock = variant.quantity || 0;
                const variantReserved = variant.reserved_quantity || 0;
                const variantAvailable = variantStock - variantReserved;
                
                // تحديد حالة المخزون للمتغير (بدون النافد)
                let variantStatus = '';
                if (variantStock < 3) {
                  variantStatus = ' منخفض';
                } else if (variantStock < 10) {
                  variantStatus = ' متوسط';
                } else {
                  variantStatus = ' جيد';
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
                    total: variantStock,
                    reserved: variantReserved
                  });
                } else if (variant.size && !variant.color) {
                  // منتج له قياس فقط
                  variantsBySize[variant.size] = {
                    ...variant,
                    available: variantAvailable,
                    status: variantStatus,
                    total: variantStock,
                    reserved: variantReserved
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
                    total: variantStock,
                    reserved: variantReserved
                  });
                } else {
                  // متغير عام
                  generalVariants.push({
                    ...variant,
                    available: variantAvailable,
                    status: variantStatus,
                    total: variantStock,
                    reserved: variantReserved
                  });
                }
              });

              // تجهيز عرض تفاصيل الألوان والأقياس بمربعات صغيرة
              let colorSizeDisplay = '';
              
              // عرض الألوان مع الأقياس
              if (Object.keys(variantsByColor).length > 0) {
                colorSizeDisplay += Object.entries(variantsByColor).map(([color, variants]) => {
                  if (variants.length > 1 && variants[0].size) {
                    // لون مع عدة أقياس
                    const sizesBoxes = variants.map(v => {
                      const statusColor = v.total < 3 ? '#f59e0b' : v.total < 10 ? '#3b82f6' : '#10b981';
                      return `
                        <div style="display: inline-block; margin: 2px; padding: 4px 6px; background: white; border: 2px solid ${statusColor}; border-radius: 6px; font-size: 8px; text-align: center; direction: rtl; min-width: 40px;">
                          <div style="font-weight: 700; color: ${statusColor};">${v.size}</div>
                          <div style="color: #374151; font-size: 7px;">كلي: ${v.total}</div>
                          <div style="color: #374151; font-size: 7px;">محجوز: ${v.reserved}</div>
                          <div style="color: ${statusColor}; font-weight: 600; font-size: 7px;">متاح: ${v.available}</div>
                        </div>
                      `;
                    }).join('');
                    
                    return `
                      <div style="margin: 6px 0; padding: 8px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 8px; border-right: 4px solid #6366f1; direction: rtl;">
                        <div style="font-weight: 700; color: #4338ca; margin-bottom: 6px; font-size: 11px;">🎨 ${color} (${variants.length} أقياس)</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 2px; direction: rtl;">
                          ${sizesBoxes}
                        </div>
                      </div>
                    `;
                  } else {
                    // لون واحد بدون أقياس
                    const variant = variants[0];
                    const statusColor = variant.total < 3 ? '#f59e0b' : variant.total < 10 ? '#3b82f6' : '#10b981';
                    return `
                      <div style="margin: 4px 0; padding: 6px 8px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 6px; border-right: 4px solid ${statusColor}; direction: rtl;">
                        <div style="font-weight: 700; color: ${statusColor}; margin-bottom: 2px; font-size: 10px;">🎨 ${color}</div>
                        <div style="color: #374151; font-size: 8px;">كلي: ${variant.total} • محجوز: ${variant.reserved} • متاح: ${variant.available}</div>
                      </div>
                    `;
                  }
                }).join('');
              }

              // عرض الأقياس فقط
              if (Object.keys(variantsBySize).length > 0) {
                colorSizeDisplay += Object.entries(variantsBySize).map(([size, variant]) => {
                  const statusColor = variant.total < 3 ? '#f59e0b' : variant.total < 10 ? '#3b82f6' : '#10b981';
                  return `
                    <div style="margin: 4px 0; padding: 6px 8px; background: linear-gradient(135deg, #fefce8, #fef3c7); border-radius: 6px; border-right: 4px solid ${statusColor}; direction: rtl;">
                      <div style="font-weight: 700; color: ${statusColor}; margin-bottom: 2px; font-size: 10px;">📏 ${size}</div>
                      <div style="color: #374151; font-size: 8px;">كلي: ${variant.total} • محجوز: ${variant.reserved} • متاح: ${variant.available}</div>
                    </div>
                  `;
                }).join('');
              }

              // عرض المتغيرات العامة
              if (generalVariants.length > 0) {
                colorSizeDisplay += generalVariants.map((variant, idx) => {
                  const statusColor = variant.total < 3 ? '#f59e0b' : variant.total < 10 ? '#3b82f6' : '#10b981';
                  return `
                    <div style="margin: 4px 0; padding: 6px 8px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 6px; border-right: 4px solid ${statusColor}; direction: rtl;">
                      <div style="font-weight: 700; color: ${statusColor}; margin-bottom: 2px; font-size: 10px;">📦 منتج عام</div>
                      <div style="color: #374151; font-size: 8px;">كلي: ${variant.total} • محجوز: ${variant.reserved} • متاح: ${variant.available}</div>
                    </div>
                  `;
                }).join('');
              }

              if (!colorSizeDisplay) {
                colorSizeDisplay = '<div style="font-size: 9px; color: #64748b; text-align: center; padding: 8px; direction: rtl;">لا توجد متغيرات متوفرة</div>';
              }

              return `
                <div style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #e2e8f0; padding: 12px; direction: rtl;">
                  <!-- صف المنتج الأساسي -->
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 8px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="flex: 3; direction: rtl;">
                      <div style="font-weight: 800; color: #1e293b; font-size: 14px; margin-bottom: 2px;">${item.name || 'منتج بدون اسم'}</div>
                      ${avgPrice > 0 ? `<div style="font-size: 10px; color: #059669; font-weight: 600;">السعر: ${Math.round(avgPrice).toLocaleString()} د.ع</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 20px; align-items: center;">
                      <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: #6366f1;">${availableVariants.length}</div>
                        <div style="font-size: 8px; color: #64748b;">المتغيرات</div>
                      </div>
                      <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: #1e293b;">${itemStock.toLocaleString()}</div>
                        <div style="font-size: 8px; color: #64748b;">إجمالي المخزون</div>
                      </div>
                      <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${itemReserved.toLocaleString()}</div>
                        <div style="font-size: 8px; color: #64748b;">محجوز</div>
                      </div>
                      <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: #10b981;">${itemAvailable.toLocaleString()}</div>
                        <div style="font-size: 8px; color: #64748b;">متاح</div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- صف تفاصيل الألوان والأقياس -->
                  <div style="background: #f8fafc; border-radius: 8px; padding: 8px; direction: rtl;">
                    <div style="font-weight: 600; color: #374151; font-size: 10px; margin-bottom: 6px;">🎨 تفاصيل الألوان والأقياس:</div>
                    ${colorSizeDisplay}
                  </div>
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