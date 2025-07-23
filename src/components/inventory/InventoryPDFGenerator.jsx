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
    // حساب الإحصائيات
    const totalProducts = data.length;
    const totalStock = data.reduce((sum, item) => {
      return sum + (item.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0);
    }, 0);
    
    const lowStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock > 0 && itemStock < 5;
    }).length;
    
    const outOfStockItems = data.filter(item => {
      const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
      return itemStock === 0;
    }).length;

    const currentDate = new Date();
    const arabicDate = currentDate.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #ffffff; color: #1f2937; line-height: 1.6;">
        <!-- رأس التقرير -->
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(37, 99, 235, 0.3);">
          <h1 style="font-size: 32px; font-weight: bold; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">📊 تقرير جرد المخزون</h1>
          <p style="font-size: 16px; margin: 0; opacity: 0.9;">${arabicDate} - ${currentDate.toLocaleTimeString('ar-EG')}</p>
          <div style="width: 60px; height: 4px; background: rgba(255,255,255,0.3); margin: 15px auto 0; border-radius: 2px;"></div>
        </div>

        <!-- إحصائيات سريعة -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
            <div style="font-size: 28px; font-weight: bold;">${totalProducts}</div>
            <div style="font-size: 14px; opacity: 0.9;">إجمالي المنتجات</div>
          </div>
          <div style="background: linear-gradient(135deg, #10b981, #047857); color: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
            <div style="font-size: 28px; font-weight: bold;">${totalStock.toLocaleString()}</div>
            <div style="font-size: 14px; opacity: 0.9;">إجمالي المخزون</div>
          </div>
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
            <div style="font-size: 28px; font-weight: bold;">${lowStockItems}</div>
            <div style="font-size: 14px; opacity: 0.9;">منتجات منخفضة</div>
          </div>
          <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
            <div style="font-size: 28px; font-weight: bold;">${outOfStockItems}</div>
            <div style="font-size: 14px; opacity: 0.9;">منتجات نافذة</div>
          </div>
        </div>

        <!-- جدول المنتجات -->
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #374151, #1f2937); color: white; padding: 20px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: bold;">📋 تفاصيل المنتجات</h2>
          </div>
          
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 15px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0;">المنتج</th>
                <th style="padding: 15px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0;">الكمية المتاحة</th>
                <th style="padding: 15px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0;">السعر المتوسط</th>
                <th style="padding: 15px; text-align: center; font-weight: bold; color: #374151; border-bottom: 2px solid #e2e8f0;">حالة المخزون</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => {
                const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
                const avgPrice = item.variants?.length > 0 
                  ? item.variants.reduce((sum, v) => sum + (v.price || 0), 0) / item.variants.length 
                  : 0;
                
                let status = '✅ متوفر';
                let statusColor = '#10b981';
                if (itemStock === 0) {
                  status = '❌ نافذ';
                  statusColor = '#ef4444';
                } else if (itemStock < 5) {
                  status = '⚠️ منخفض';
                  statusColor = '#f59e0b';
                }

                return `
                  <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; transition: all 0.2s;">
                    <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${item.name?.substring(0, 30) || 'بدون اسم'}</td>
                    <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #374151;">${itemStock.toLocaleString()}</td>
                    <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #6b7280;">${Math.round(avgPrice).toLocaleString()} د.ع</td>
                    <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: ${statusColor}; font-weight: bold; padding: 6px 12px; background: ${statusColor}15; border-radius: 20px; font-size: 12px;">
                        ${status}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- تذييل التقرير -->
        <div style="margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #f8fafc, #e2e8f0); border-radius: 10px; text-align: center; color: #64748b;">
          <div style="font-size: 14px; margin-bottom: 5px;">تم إنشاء هذا التقرير بواسطة نظام إدارة المخزون RYUS</div>
          <div style="font-size: 12px; color: #94a3b8;">📅 ${new Date().toLocaleString('ar-EG')}</div>
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