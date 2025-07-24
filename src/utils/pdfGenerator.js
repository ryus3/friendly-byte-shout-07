import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateInventoryReportPDF = async (inventoryData) => {
  // إنشاء HTML للتقرير
  const reportHTML = `
    <div id="inventory-report" style="
      font-family: 'Arial', sans-serif;
      direction: rtl;
      padding: 30px;
      background: white;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
    ">
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px;">
        <h1 style="color: #3b82f6; font-size: 28px; margin: 0;">تقرير الجرد</h1>
        <p style="color: #666; margin: 10px 0;">RYUS BRAND - نظام إدارة المخزون</p>
        <p style="color: #888; font-size: 14px;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
      </div>

      <table style="
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        <thead>
          <tr style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white;">
            <th style="padding: 15px; text-align: center; border: 1px solid #ddd;">#</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #ddd;">اسم المنتج</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #ddd;">اللون</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #ddd;">القياس</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #ddd;">الكمية المتاحة</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #ddd;">سعر البيع</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #ddd;">القيمة الإجمالية</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryData.map((item, index) => `
            <tr style="background: ${index % 2 === 0 ? '#f8fafc' : 'white'};">
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${index + 1}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${item.product_name || 'غير محدد'}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${item.color_name || 'غير محدد'}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${item.size_name || 'غير محدد'}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${item.quantity || 0}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${formatCurrency(item.sale_price || 0)}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${formatCurrency((item.quantity || 0) * (item.sale_price || 0))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="
        margin-top: 30px;
        padding: 20px;
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        border-radius: 12px;
        border: 2px solid #3b82f6;
      ">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold;">
          <span>إجمالي العناصر:</span>
          <span>${inventoryData.length}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold;">
          <span>إجمالي الكمية:</span>
          <span>${inventoryData.reduce((sum, item) => sum + (item.quantity || 0), 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; color: #1e40af; border-top: 2px solid #3b82f6; padding-top: 15px; margin-top: 15px;">
          <span>إجمالي قيمة المخزون:</span>
          <span>${formatCurrency(inventoryData.reduce((sum, item) => sum + ((item.quantity || 0) * (item.sale_price || 0)), 0))}</span>
        </div>
      </div>
    </div>
  `;

  // إنشاء عنصر مؤقت في الصفحة
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = reportHTML;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  document.body.appendChild(tempDiv);

  try {
    // تحويل HTML إلى صورة
    const canvas = await html2canvas(tempDiv.firstElementChild, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // إنشاء PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 190;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10;

    // إضافة الصفحة الأولى
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // إضافة صفحات إضافية إذا لزم الأمر
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // حفظ أو تنزيل PDF
    pdf.save(`inventory-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
  } finally {
    // إزالة العنصر المؤقت
    document.body.removeChild(tempDiv);
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

// مثال لاستخدام المولد
export const generateSalesReportPDF = async (salesData) => {
  // نفس المنطق ولكن لتقرير المبيعات
  // يمكن تخصيصه حسب الحاجة
};

export const generatePurchaseReportPDF = async (purchaseData) => {
  // نفس المنطق ولكن لتقرير المشتريات
  // يمكن تخصيصه حسب الحاجة
};