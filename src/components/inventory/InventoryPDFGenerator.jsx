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

    const currentDate = new Date();
    const arabicDate = currentDate.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div style="font-family: 'Tahoma', Arial, sans-serif; padding: 15px; background: #fff; color: #333; font-size: 12px; line-height: 1.4;">
        
        <!-- رأس التقرير -->
        <div style="text-align: center; margin-bottom: 15px; padding: 15px; background: linear-gradient(45deg, #4f46e5, #7c3aed); color: white; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 20px; font-weight: bold;">RYUS BRAND</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">تقرير جرد المخزون</p>
          <p style="margin: 2px 0 0 0; font-size: 10px; opacity: 0.9;">${arabicDate}</p>
        </div>

        <!-- الإحصائيات -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px;">
          <div style="background: #3b82f6; color: white; padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-size: 16px; font-weight: bold;">${totalProducts}</div>
            <div style="font-size: 9px;">إجمالي المنتجات</div>
          </div>
          <div style="background: #10b981; color: white; padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-size: 16px; font-weight: bold;">${totalStock}</div>
            <div style="font-size: 9px;">المخزون الكلي</div>
          </div>
          <div style="background: #f59e0b; color: white; padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-size: 16px; font-weight: bold;">${totalReservedStock}</div>
            <div style="font-size: 9px;">المحجوز</div>
          </div>
          <div style="background: #06b6d4; color: white; padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-size: 16px; font-weight: bold;">${totalStock - totalReservedStock}</div>
            <div style="font-size: 9px;">المتاح</div>
          </div>
        </div>

        <!-- جدول المنتجات -->
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
          <div style="background: #f3f4f6; padding: 8px; border-bottom: 1px solid #e5e7eb;">
            <h3 style="margin: 0; font-size: 14px; color: #374151;">تفاصيل المنتجات</h3>
          </div>
          
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px; text-align: right; font-size: 10px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">المنتج</th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">المتغيرات</th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">المخزون</th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">المحجوز</th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">المتاح</th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => {
                const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
                const itemReserved = item.variants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;
                const itemAvailable = itemStock - itemReserved;
                
                let status = 'جيد';
                let statusColor = '#10b981';
                if (itemStock === 0) {
                  status = 'نافذ';
                  statusColor = '#ef4444';
                } else if (itemStock < 5) {
                  status = 'منخفض';
                  statusColor = '#f59e0b';
                }

                return `
                  <tr style="background: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
                    <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 10px;">
                      <div style="font-weight: 600;">${item.name || 'بدون اسم'}</div>
                      ${item.category ? `<div style="color: #6b7280; font-size: 8px;">${item.category}</div>` : ''}
                    </td>
                    <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 10px; color: #6366f1;">${item.variants?.length || 0}</td>
                    <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 10px; font-weight: 600;">${itemStock}</td>
                    <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 10px; color: #f59e0b;">${itemReserved}</td>
                    <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 10px; font-weight: 600; color: #10b981;">${itemAvailable}</td>
                    <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: ${statusColor}; font-size: 9px; font-weight: 600; padding: 2px 6px; background: ${statusColor}15; border-radius: 10px;">
                        ${status}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- تذييل بسيط -->
        <div style="margin-top: 10px; text-align: center; font-size: 9px; color: #6b7280;">
          RYUS BRAND - ${arabicDate} - ${data.length} منتج
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