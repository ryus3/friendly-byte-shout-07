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
    const currentDate = new Date();
    const gregorianDate = currentDate.toLocaleDateString('en-GB');
    const timeStamp = currentDate.toLocaleTimeString('ar-EG');

    // فقط المنتجات المتوفرة (تصفية البيانات محلياً)
    const availableProducts = data.filter(item => {
      const totalStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return totalStock > 0; // فقط المنتجات المتوفرة
    });

    const totalAvailableStock = availableProducts.reduce((sum, item) => {
      return sum + (item.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0);
    }, 0);
    
    const totalReservedStock = availableProducts.reduce((sum, item) => {
      return sum + (item.variants?.reduce((vSum, v) => vSum + (v.reserved_quantity || 0), 0) || 0);
    }, 0);

    return `
      <div style="font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); color: #1e293b; line-height: 1.6;">
        
        <!-- رأس التقرير مع العلامة التجارية -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%); color: white; padding: 25px; border-radius: 16px; text-align: center; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(30, 64, 175, 0.3); position: relative; overflow: hidden;">
          
          <!-- شعار RYUS BRAND -->
          <div style="background: linear-gradient(45deg, #fbbf24, #f59e0b, #d97706); -webkit-background-clip: text; background-clip: text; color: transparent; font-size: 28px; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            RYUS BRAND
          </div>
          
          <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 8px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">📊 تقرير المخزون المتوفر</h1>
          <p style="font-size: 14px; margin: 0; opacity: 0.9;">${gregorianDate} - ${timeStamp}</p>
          
          <!-- تأثيرات بصرية -->
          <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.5;"></div>
          <div style="position: absolute; bottom: -30px; left: -30px; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.3;"></div>
        </div>

        <!-- إحصائيات مبسطة -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
          
          <div style="background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 18px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
            <div style="font-size: 24px; font-weight: bold;">${availableProducts.length}</div>
            <div style="font-size: 12px; opacity: 0.9;">منتجات متوفرة</div>
          </div>
          
          <div style="background: linear-gradient(135deg, #10b981, #047857); color: white; padding: 18px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
            <div style="font-size: 24px; font-weight: bold;">${totalAvailableStock.toLocaleString()}</div>
            <div style="font-size: 12px; opacity: 0.9;">مخزون متاح</div>
          </div>
          
          <div style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; padding: 18px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
            <div style="font-size: 24px; font-weight: bold;">${totalReservedStock.toLocaleString()}</div>
            <div style="font-size: 12px; opacity: 0.9;">مخزون محجوز</div>
          </div>
          
        </div>

        <!-- جدول المنتجات المبسط -->
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <div style="background: linear-gradient(135deg, #374151, #1f2937); color: white; padding: 15px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: bold;">📋 المنتجات المتوفرة فقط</h2>
          </div>
          
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 12px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0; font-size: 14px;">المنتج</th>
                <th style="padding: 12px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0; font-size: 14px;">المتوفر</th>
                <th style="padding: 12px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0; font-size: 14px;">المحجوز</th>
                <th style="padding: 12px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0; font-size: 14px;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${availableProducts.map((item, index) => {
                const availableStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
                const reservedStock = item.variants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;
                const freeStock = availableStock - reservedStock;
                
                let status = '✅ متوفر';
                let statusColor = '#10b981';
                if (freeStock < 5 && freeStock > 0) {
                  status = '⚠️ منخفض';
                  statusColor = '#f59e0b';
                }

                return `
                  <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; transition: all 0.2s;">
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 500; font-size: 13px;">${item.name?.substring(0, 25) || 'بدون اسم'}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #059669; font-size: 13px;">${availableStock.toLocaleString()}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #8b5cf6; font-weight: 600; font-size: 13px;">${reservedStock.toLocaleString()}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: ${statusColor}; font-weight: bold; padding: 4px 8px; background: ${statusColor}15; border-radius: 12px; font-size: 11px;">
                        ${status}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- تذييل مبسط -->
        <div style="margin-top: 25px; padding: 15px; background: linear-gradient(135deg, #f1f5f9, #e2e8f0); border-radius: 8px; text-align: center; color: #64748b;">
          <div style="font-size: 12px; margin-bottom: 4px;">
            <span style="background: linear-gradient(45deg, #1e40af, #3b82f6); -webkit-background-clip: text; background-clip: text; color: transparent; font-weight: bold;">RYUS BRAND</span>
            - نظام إدارة المخزون
          </div>
          <div style="font-size: 10px; color: #94a3b8;">📅 ${gregorianDate} | ⏰ ${timeStamp}</div>
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