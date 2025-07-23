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
    // حساب الإحصائيات المتقدمة
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

    // حساب نسب للرسم البياني
    const stockPercentages = {
      good: totalProducts > 0 ? Math.round((goodStockItems / totalProducts) * 100) : 0,
      low: totalProducts > 0 ? Math.round((lowStockItems / totalProducts) * 100) : 0,
      out: totalProducts > 0 ? Math.round((outOfStockItems / totalProducts) * 100) : 0
    };

    // تاريخ باللغة الإنجليزية
    const currentDate = new Date();
    const englishDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return `
      <div style="font-family: 'Inter', 'system-ui', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; padding: 20px; background: #ffffff; color: #0f172a; line-height: 1.5; font-size: 13px;">
        
        <!-- Brand Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); color: white; padding: 25px; border-radius: 16px; text-align: center; margin-bottom: 20px; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"20\" cy=\"20\" r=\"2\" fill=\"rgba(255,255,255,0.1)\"/><circle cx=\"80\" cy=\"80\" r=\"2\" fill=\"rgba(255,255,255,0.1)\"/><circle cx=\"40\" cy=\"60\" r=\"1.5\" fill=\"rgba(255,255,255,0.08)\"/><circle cx=\"60\" cy=\"30\" r=\"1.5\" fill=\"rgba(255,255,255,0.08)\"/></svg>'); opacity: 0.3;"></div>
          <div style="position: relative; z-index: 1;">
            <div style="font-size: 28px; font-weight: 800; letter-spacing: 3px; margin-bottom: 5px; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">RYUS BRAND</div>
            <div style="font-size: 16px; font-weight: 600; opacity: 0.95; margin-bottom: 8px;">Inventory Management System</div>
            <div style="font-size: 12px; opacity: 0.8;">${englishDate} • ${currentDate.toLocaleTimeString('en-US')}</div>
            <div style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); font-size: 40px; opacity: 0.2;">📊</div>
          </div>
        </div>

        <!-- Advanced Statistics Dashboard -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);">
            <div style="font-size: 22px; font-weight: 700;">${totalProducts}</div>
            <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Products</div>
          </div>
          <div style="background: linear-gradient(135deg, #10b981, #047857); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);">
            <div style="font-size: 22px; font-weight: 700;">${totalStock.toLocaleString()}</div>
            <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Total Stock</div>
          </div>
          <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);">
            <div style="font-size: 22px; font-weight: 700;">${totalVariants}</div>
            <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Variants</div>
          </div>
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);">
            <div style="font-size: 22px; font-weight: 700;">${totalReservedStock}</div>
            <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Reserved</div>
          </div>
          <div style="background: linear-gradient(135deg, #06b6d4, #0891b2); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.25);">
            <div style="font-size: 22px; font-weight: 700;">${(totalStock - totalReservedStock).toLocaleString()}</div>
            <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Available</div>
          </div>
        </div>

        <!-- Stock Distribution Chart -->
        <div style="background: white; border-radius: 16px; padding: 18px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            📈 Stock Distribution Analysis
          </h3>
          <div style="display: flex; gap: 15px; align-items: center;">
            <!-- Mini Chart -->
            <div style="flex: 1; background: #f8fafc; border-radius: 8px; padding: 12px; position: relative; overflow: hidden;">
              <div style="display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: #e2e8f0;">
                <div style="background: #10b981; width: ${stockPercentages.good}%; transition: all 0.3s;"></div>
                <div style="background: #f59e0b; width: ${stockPercentages.low}%; transition: all 0.3s;"></div>
                <div style="background: #ef4444; width: ${stockPercentages.out}%; transition: all 0.3s;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 10px; color: #64748b;">
                <span>Good: ${stockPercentages.good}%</span>
                <span>Low: ${stockPercentages.low}%</span>
                <span>Out: ${stockPercentages.out}%</span>
              </div>
            </div>
            <!-- Legend -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                <div style="width: 12px; height: 12px; background: #10b981; border-radius: 2px;"></div>
                <span style="color: #374151;">Good Stock (${goodStockItems})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                <div style="width: 12px; height: 12px; background: #f59e0b; border-radius: 2px;"></div>
                <span style="color: #374151;">Low Stock (${lowStockItems})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 2px;"></div>
                <span style="color: #374151;">Out of Stock (${outOfStockItems})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Products Table -->
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 16px;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              📋 Detailed Product Inventory
            </h2>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e2e8f0; width: 25%;">Product Name</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e2e8f0; width: 15%;">Variants</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e2e8f0; width: 12%;">Total Stock</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e2e8f0; width: 12%;">Reserved</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e2e8f0; width: 12%;">Available</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e2e8f0; width: 12%;">Avg. Price</th>
                <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e2e8f0; width: 12%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => {
                const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
                const itemReserved = item.variants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;
                const itemAvailable = itemStock - itemReserved;
                const avgPrice = item.variants?.length > 0 
                  ? item.variants.reduce((sum, v) => sum + (v.price || 0), 0) / item.variants.length 
                  : 0;
                
                let status = 'Good';
                let statusColor = '#10b981';
                let statusBg = '#10b98110';
                if (itemStock === 0) {
                  status = 'Out';
                  statusColor = '#ef4444';
                  statusBg = '#ef444410';
                } else if (itemStock < 5) {
                  status = 'Low';
                  statusColor = '#f59e0b';
                  statusBg = '#f59e0b10';
                }

                // عرض تفاصيل المتغيرات
                const variantDetails = item.variants?.map(variant => {
                  const variantStock = variant.quantity || 0;
                  const variantReserved = variant.reserved_quantity || 0;
                  const variantAvailable = variantStock - variantReserved;
                  
                  return `
                    <div style="margin: 2px 0; padding: 4px 6px; background: #f8fafc; border-radius: 4px; font-size: 9px; border-left: 3px solid ${variantStock === 0 ? '#ef4444' : variantStock < 3 ? '#f59e0b' : '#10b981'};">
                      <strong>${variant.size || variant.color || 'Default'}</strong> - Stock: ${variantStock}, Reserved: ${variantReserved}, Available: ${variantAvailable}, Price: ${Math.round(variant.price || 0).toLocaleString()}
                    </div>
                  `;
                }).join('') || '<div style="font-size: 9px; color: #64748b;">No variants</div>';

                return `
                  <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
                      <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${item.name || 'Unnamed Product'}</div>
                      <div style="font-size: 9px; color: #64748b; margin-bottom: 6px;">${item.category || 'No Category'}</div>
                      ${variantDetails}
                    </td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #6366f1;">${item.variants?.length || 0}</td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">${itemStock.toLocaleString()}</td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #f59e0b;">${itemReserved.toLocaleString()}</td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #10b981;">${itemAvailable.toLocaleString()}</td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 500;">${Math.round(avgPrice).toLocaleString()}</td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: ${statusColor}; font-weight: 600; padding: 4px 8px; background: ${statusBg}; border-radius: 12px; font-size: 10px; border: 1px solid ${statusColor}20;">
                        ${status}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Professional Footer -->
        <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #f8fafc, #e2e8f0); border-radius: 12px; text-align: center; color: #64748b; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">Generated by RYUS Brand Inventory Management System</div>
          <div style="font-size: 10px; color: #94a3b8;">📅 ${englishDate} at ${currentDate.toLocaleTimeString('en-US')} • Confidential Report</div>
          <div style="margin-top: 8px; font-size: 9px; color: #94a3b8;">This report contains ${totalProducts} products with ${totalVariants} variants • Total inventory value: ${Math.round(data.reduce((sum, item) => sum + (item.variants?.reduce((vSum, v) => vSum + ((v.quantity || 0) * (v.price || 0)), 0) || 0), 0)).toLocaleString()} IQD</div>
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