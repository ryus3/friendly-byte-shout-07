import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from '@/hooks/use-toast';

const InventoryPDFGenerator = ({ 
  products = [], 
  selectedProducts = [], 
  filters = {},
  isFiltered = false 
}) => {
  const generatePDF = async () => {
    try {
      const dataToExport = selectedProducts.length > 0 ? selectedProducts : products;
      
      if (!dataToExport || dataToExport.length === 0) {
        toast({
          title: "لا توجد بيانات للتصدير",
          description: "لم يتم العثور على منتجات للتصدير",
          variant: "destructive"
        });
        return;
      }

      // إنشاء عنصر HTML مؤقت للطباعة
      const printElement = document.createElement('div');
      printElement.innerHTML = generateInventoryHTML(dataToExport, filters, isFiltered);
      printElement.style.position = 'absolute';
      printElement.style.left = '-9999px';
      printElement.style.top = '0';
      printElement.style.width = '210mm';
      document.body.appendChild(printElement);

      // تحويل HTML إلى صورة عالية الجودة
      const canvas = await html2canvas(printElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        height: Math.max(1123, printElement.scrollHeight)
      });

      // إنشاء PDF متعدد الصفحات
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // إضافة الصفحة الأولى
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // إضافة صفحات إضافية إذا لزم الأمر
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // حفظ PDF
      const fileName = selectedProducts.length > 0 
        ? `تقرير_الجرد_المحدد_${new Date().toISOString().split('T')[0]}.pdf`
        : isFiltered 
          ? `تقرير_الجرد_المفلتر_${new Date().toISOString().split('T')[0]}.pdf`
          : `تقرير_الجرد_الشامل_${new Date().toISOString().split('T')[0]}.pdf`;

      pdf.save(fileName);
      document.body.removeChild(printElement);

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

  const generateInventoryHTML = (data, filters, isFiltered) => {
    const stats = calculateInventoryStats(data);
    const currentDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return `
      <div style="
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 0;
        margin: 0;
        direction: rtl;
      ">
        <!-- الغلاف الأمامي -->
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 80px 60px;
          text-align: center;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          overflow: hidden;
        ">
          <!-- عناصر تزيينية -->
          <div style="
            position: absolute;
            top: -50px;
            right: -50px;
            width: 200px;
            height: 200px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
          "></div>
          <div style="
            position: absolute;
            bottom: -30px;
            left: -30px;
            width: 150px;
            height: 150px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
          "></div>
          
          <!-- الشعار -->
          <div style="
            width: 120px;
            height: 120px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            margin: 0 auto 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid rgba(255,255,255,0.3);
            backdrop-filter: blur(10px);
          ">
            <div style="
              font-size: 48px;
              font-weight: bold;
              background: linear-gradient(45deg, #ffd700, #ffed4a);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            ">📊</div>
          </div>

          <h1 style="
            font-size: 48px;
            font-weight: 800;
            margin: 0 0 20px 0;
            text-shadow: 0 4px 8px rgba(0,0,0,0.3);
            letter-spacing: 2px;
          ">تقرير الجرد الاحترافي</h1>
          
          <p style="
            font-size: 20px;
            margin: 0 0 40px 0;
            opacity: 0.9;
            font-weight: 300;
          ">${currentDate}</p>

          <div style="
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin: 40px auto;
            max-width: 500px;
            border: 1px solid rgba(255,255,255,0.3);
          ">
            <h2 style="
              font-size: 24px;
              margin: 0 0 20px 0;
              font-weight: 600;
            ">ملخص الجرد</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              <div style="text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #10b981;">${stats.good}</div>
                <div style="font-size: 14px; opacity: 0.8;">متوفر جيد</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${stats.medium}</div>
                <div style="font-size: 14px; opacity: 0.8;">متوسط</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #ef4444;">${stats.low}</div>
                <div style="font-size: 14px; opacity: 0.8;">منخفض</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #9ca3af;">${stats.outOfStock}</div>
                <div style="font-size: 14px; opacity: 0.8;">نافذ</div>
              </div>
            </div>
          </div>
          
          ${isFiltered ? `
            <div style="
              background: rgba(59, 130, 246, 0.3);
              border: 1px solid rgba(59, 130, 246, 0.5);
              border-radius: 15px;
              padding: 20px;
              margin: 20px auto;
              max-width: 400px;
              backdrop-filter: blur(10px);
            ">
              <div style="font-size: 18px; font-weight: 600;">📋 تقرير مفلتر</div>
              <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">تم تطبيق فلاتر مخصصة على البيانات</div>
            </div>
          ` : ''}
        </div>

        <!-- صفحة التفاصيل -->
        <div style="
          background: white;
          padding: 60px;
          min-height: 100vh;
        ">
          <!-- رأس التفاصيل -->
          <div style="
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 30px;
            border-radius: 20px;
            margin-bottom: 40px;
            text-align: center;
          ">
            <h2 style="font-size: 28px; margin: 0; font-weight: 700;">التفاصيل الكاملة للمخزون</h2>
          </div>

          <!-- جدول المنتجات المحسن -->
          <div style="
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e5e7eb;
          ">
            <table style="
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            ">
              <thead>
                <tr style="
                  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                  color: white;
                ">
                  <th style="
                    padding: 20px 15px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 14px;
                    letter-spacing: 0.5px;
                  ">اسم المنتج</th>
                  <th style="
                    padding: 20px 15px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 14px;
                    letter-spacing: 0.5px;
                  ">الرمز</th>
                  <th style="
                    padding: 20px 15px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 14px;
                    letter-spacing: 0.5px;
                  ">المتغيرات</th>
                  <th style="
                    padding: 20px 15px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 14px;
                    letter-spacing: 0.5px;
                  ">إجمالي المخزون</th>
                  <th style="
                    padding: 20px 15px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 14px;
                    letter-spacing: 0.5px;
                  ">حالة المخزون</th>
                </tr>
              </thead>
              <tbody>
                ${data.map((product, index) => {
                  const totalStock = calculateTotalStock(product.variants);
                  const isEven = index % 2 === 0;
                  
                  return `
                    <tr style="
                      background: ${isEven ? '#ffffff' : '#f8fafc'};
                      border-bottom: 1px solid #e2e8f0;
                      transition: all 0.3s ease;
                    ">
                      <td style="
                        padding: 16px;
                        text-align: center;
                        font-weight: 600;
                        color: #1e293b;
                        border-right: 4px solid ${getStockColor(totalStock)};
                      ">
                        ${product.name || 'غير محدد'}
                      </td>
                      <td style="
                        padding: 16px;
                        text-align: center;
                        color: #64748b;
                        font-family: 'Monaco', 'Menlo', monospace;
                        background: #f1f5f9;
                        font-size: 12px;
                      ">
                        ${product.sku || 'N/A'}
                      </td>
                      <td style="padding: 16px; text-align: center;">
                        ${formatVariantsModern(product.variants)}
                      </td>
                      <td style="
                        padding: 16px;
                        text-align: center;
                        font-weight: 700;
                        font-size: 16px;
                        color: ${getStockColor(totalStock)};
                      ">
                        ${totalStock.toLocaleString()}
                      </td>
                      <td style="padding: 16px; text-align: center;">
                        ${getStockStatusModern(totalStock)}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- التوقيع والختم -->
          <div style="
            margin-top: 60px;
            padding: 40px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 20px;
            border-top: 4px solid #3b82f6;
          ">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
              <div style="text-align: center;">
                <div style="
                  height: 80px;
                  border-bottom: 2px solid #94a3b8;
                  margin-bottom: 10px;
                "></div>
                <p style="color: #64748b; font-weight: 600;">توقيع المسؤول</p>
              </div>
              <div style="text-align: center;">
                <div style="
                  height: 80px;
                  border-bottom: 2px solid #94a3b8;
                  margin-bottom: 10px;
                "></div>
                <p style="color: #64748b; font-weight: 600;">ختم الشركة</p>
              </div>
            </div>
            
            <div style="
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #cbd5e1;
              color: #64748b;
              font-size: 12px;
            ">
              <p style="margin: 0;">تم إنشاء هذا التقرير آلياً بواسطة نظام إدارة المخزون المتقدم</p>
              <p style="margin: 5px 0 0 0;">${new Date().toLocaleString('ar-EG')}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // دوال مساعدة محسنة
  const calculateInventoryStats = (data) => {
    let good = 0, medium = 0, low = 0, outOfStock = 0;

    data.forEach(product => {
      const totalStock = calculateTotalStock(product.variants);
      if (totalStock === 0) {
        outOfStock++;
      } else if (totalStock <= 5) {
        low++;
      } else if (totalStock <= 20) {
        medium++;
      } else {
        good++;
      }
    });

    return { good, medium, low, outOfStock };
  };

  const calculateTotalStock = (variants) => {
    if (!variants || !Array.isArray(variants)) return 0;
    return variants.reduce((total, variant) => total + (parseInt(variant.stock_quantity) || 0), 0);
  };

  const getStockColor = (stock) => {
    if (stock === 0) return '#ef4444';
    if (stock <= 5) return '#f59e0b';
    if (stock <= 20) return '#eab308';
    return '#10b981';
  };

  const formatVariantsModern = (variants) => {
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return '<span style="color: #9ca3af; font-style: italic;">لا توجد متغيرات</span>';
    }

    return variants.map(variant => {
      const parts = [];
      if (variant.size_name) parts.push(variant.size_name);
      if (variant.color_name) parts.push(variant.color_name);
      const variantName = parts.join(' × ') || 'أساسي';
      const stock = parseInt(variant.stock_quantity) || 0;
      
      return `
        <div style="
          display: inline-block;
          background: ${stock === 0 ? 'linear-gradient(135deg, #fee2e2, #fecaca)' : 
                       stock <= 5 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 
                       'linear-gradient(135deg, #dcfce7, #bbf7d0)'};
          color: ${stock === 0 ? '#dc2626' : stock <= 5 ? '#d97706' : '#059669'};
          padding: 6px 12px;
          margin: 3px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid ${stock === 0 ? '#fca5a5' : stock <= 5 ? '#f9d71c' : '#86efac'};
        ">
          ${variantName}: <span style="font-weight: 700;">${stock}</span>
        </div>
      `;
    }).join('');
  };

  const getStockStatusModern = (totalStock) => {
    if (totalStock === 0) {
      return `
        <div style="
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          color: #dc2626;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 12px;
          display: inline-block;
          box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);
          border: 2px solid #fca5a5;
        ">
          🚫 نافذ
        </div>
      `;
    } else if (totalStock <= 5) {
      return `
        <div style="
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          color: #d97706;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 12px;
          display: inline-block;
          box-shadow: 0 4px 6px rgba(217, 119, 6, 0.2);
          border: 2px solid #f9d71c;
        ">
          ⚠️ منخفض
        </div>
      `;
    } else if (totalStock <= 20) {
      return `
        <div style="
          background: linear-gradient(135deg, #fef3c7, #fbbf24);
          color: #92400e;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 12px;
          display: inline-block;
          box-shadow: 0 4px 6px rgba(146, 64, 14, 0.2);
          border: 2px solid #f59e0b;
        ">
          📊 متوسط
        </div>
      `;
    } else {
      return `
        <div style="
          background: linear-gradient(135deg, #dcfce7, #bbf7d0);
          color: #059669;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 12px;
          display: inline-block;
          box-shadow: 0 4px 6px rgba(5, 150, 105, 0.2);
          border: 2px solid #86efac;
        ">
          ✅ جيد
        </div>
      `;
    }
  };

  return (
    <Button
      onClick={generatePDF}
      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg"
      size="sm"
    >
      <Download className="w-4 h-4" />
      تحميل PDF احترافي
    </Button>
  );
};

export default InventoryPDFGenerator;