import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateInventoryReportPDF = async (inventoryData) => {
  try {
    // إنشاء عنصر مؤقت في DOM
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    document.body.appendChild(tempDiv);

    // إنشاء HTML للتقرير
    tempDiv.innerHTML = `
      <div style="
        font-family: Arial, sans-serif;
        direction: rtl;
        padding: 20px;
        background: white;
        color: #333;
        width: 800px;
      ">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 15px;">
          <h1 style="color: #3b82f6; font-size: 24px; margin: 0;">تقرير الجرد التفصيلي</h1>
          <p style="color: #666; margin: 5px 0;">RYUS BRAND</p>
          <p style="color: #888; font-size: 12px;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <table style="
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 12px;
        ">
          <thead>
            <tr style="background: #3b82f6; color: white;">
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">#</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">المنتج</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">اللون</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">القياس</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">الكمية</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">السعر</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">القيمة</th>
            </tr>
          </thead>
          <tbody>
            ${inventoryData.map((item, index) => `
              <tr style="background: ${index % 2 === 0 ? '#f8fafc' : 'white'};">
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">${index + 1}</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">${item.product_name || 'غير محدد'}</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">${item.color_name || 'غير محدد'}</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">${item.size_name || 'غير محدد'}</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">${item.quantity || 0}</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">${(item.sale_price || 0).toLocaleString()} د.ع</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">${((item.quantity || 0) * (item.sale_price || 0)).toLocaleString()} د.ع</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 20px; text-align: center; color: #666; font-size: 11px;">
          <p>المجموع الإجمالي: ${inventoryData.reduce((sum, item) => sum + ((item.quantity || 0) * (item.sale_price || 0)), 0).toLocaleString()} د.ع</p>
          <p>عدد العناصر: ${inventoryData.length}</p>
        </div>
      </div>
    `;

    // تحويل إلى canvas
    const canvas = await html2canvas(tempDiv.querySelector('div'), {
      scale: 2,
      useCORS: true,
      allowTaint: true
    });

    // إنشاء PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // تنزيل الملف
    pdf.save(`تقرير_الجرد_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.pdf`);

    // إزالة العنصر المؤقت
    document.body.removeChild(tempDiv);

  } catch (error) {
    console.error('خطأ في إنشاء PDF:', error);
    throw error;
  }
};