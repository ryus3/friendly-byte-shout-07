import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// دالة تنسيق العملة
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('IQD', 'د.ع');
};

export const generateInventoryReportPDF = async (inventoryData) => {
  try {
    // إنشاء عنصر مؤقت في DOM
    const reportElement = document.createElement('div');
    reportElement.style.position = 'absolute';
    reportElement.style.left = '-9999px';
    reportElement.style.top = '0';
    reportElement.style.width = '210mm';
    reportElement.style.backgroundColor = 'white';
    reportElement.style.fontFamily = '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    reportElement.style.direction = 'rtl';
    
    // إنشاء HTML للتقرير مع التصميم الجميل
    const totalValue = inventoryData.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || item.selling_price || item.sale_price || 0)), 0);
    const totalItems = inventoryData.length;
    
    reportElement.innerHTML = `
      <div style="
        padding: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
        margin-bottom: 40px;
        border-radius: 20px;
        box-shadow: 0 25px 50px rgba(0,0,0,0.15);
      ">
        <h1 style="
          font-size: 42px;
          font-weight: 900;
          margin: 0 0 15px 0;
          text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
          letter-spacing: 1px;
        ">تقرير الجرد التفصيلي</h1>
        <div style="
          background: rgba(255,255,255,0.25);
          border-radius: 15px;
          padding: 20px;
          margin-top: 25px;
          backdrop-filter: blur(10px);
        ">
          <p style="font-size: 20px; margin: 8px 0; font-weight: 600;">RYUS BRAND - نظام إدارة المخزون</p>
          <p style="font-size: 16px; margin: 8px 0; opacity: 0.95;">تاريخ التقرير: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB', { hour12: false })}</p>
        </div>
      </div>

      <div style="
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 35px;
        border-radius: 20px;
        margin-bottom: 40px;
        display: flex;
        justify-content: space-around;
        box-shadow: 0 20px 45px rgba(240, 147, 251, 0.3);
      ">
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 38px; font-weight: 900; margin-bottom: 8px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${totalItems}</div>
          <div style="font-size: 18px; opacity: 0.95; font-weight: 500;">إجمالي العناصر</div>
        </div>
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 28px; font-weight: 900; margin-bottom: 8px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${formatCurrency(totalValue)}</div>
          <div style="font-size: 18px; opacity: 0.95; font-weight: 500;">إجمالي القيمة</div>
        </div>
      </div>

      <div style="
        background: white;
        border-radius: 15px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        overflow: hidden;
        margin-bottom: 30px;
      ">
        <table style="
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        ">
          <thead>
            <tr style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            ">
              <th style="padding: 20px 15px; text-align: center; font-weight: bold; font-size: 16px;">#</th>
              <th style="padding: 20px 15px; text-align: center; font-weight: bold; font-size: 16px;">اسم المنتج</th>
              <th style="padding: 20px 15px; text-align: center; font-weight: bold; font-size: 16px;">اللون</th>
              <th style="padding: 20px 15px; text-align: center; font-weight: bold; font-size: 16px;">القياس</th>
              <th style="padding: 20px 15px; text-align: center; font-weight: bold; font-size: 16px;">الكمية</th>
              <th style="padding: 20px 15px; text-align: center; font-weight: bold; font-size: 16px;">سعر البيع</th>
              <th style="padding: 20px 15px; text-align: center; font-weight: bold; font-size: 16px;">القيمة الإجمالية</th>
            </tr>
          </thead>
          <tbody>
            ${inventoryData.map((item, index) => `
              <tr style="
                background: ${index % 2 === 0 ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' : 'white'};
                transition: all 0.3s ease;
              ">
                <td style="
                  padding: 18px 15px;
                  text-align: center;
                  border-bottom: 1px solid #e2e8f0;
                  font-weight: bold;
                  color: #667eea;
                ">${index + 1}</td>
                <td style="
                  padding: 18px 15px;
                  text-align: center;
                  border-bottom: 1px solid #e2e8f0;
                  font-weight: 600;
                  color: #1a202c;
                ">${item.name || item.product_name || 'غير محدد'}</td>
                <td style="
                  padding: 18px 15px;
                  text-align: center;
                  border-bottom: 1px solid #e2e8f0;
                  color: #4a5568;
                ">${item.color || item.color_name || 'غير محدد'}</td>
                <td style="
                  padding: 18px 15px;
                  text-align: center;
                  border-bottom: 1px solid #e2e8f0;
                  color: #4a5568;
                ">${item.size || item.size_name || 'غير محدد'}</td>
                <td style="
                  padding: 18px 15px;
                  text-align: center;
                  border-bottom: 1px solid #e2e8f0;
                  font-weight: bold;
                  color: #2d3748;
                  background: ${(item.quantity || 0) < 5 ? 'linear-gradient(135deg, #fed7d7, #feb2b2)' : 'transparent'};
                ">${item.quantity || 0}</td>
                <td style="
                  padding: 18px 15px;
                  text-align: center;
                  border-bottom: 1px solid #e2e8f0;
                  font-weight: 600;
                  color: #2b6cb0;
                ">${formatCurrency(item.price || item.selling_price || item.sale_price || 0)}</td>
                <td style="
                  padding: 18px 15px;
                  text-align: center;
                  border-bottom: 1px solid #e2e8f0;
                  font-weight: bold;
                  color: #276749;
                  background: linear-gradient(135deg, #f0fff4, #c6f6d5);
                ">${formatCurrency((item.quantity || 0) * (item.price || item.selling_price || item.sale_price || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        color: white;
        padding: 30px;
        border-radius: 15px;
        text-align: center;
        box-shadow: 0 15px 35px rgba(0,0,0,0.1);
      ">
        <h3 style="font-size: 24px; margin: 0 0 20px 0; font-weight: bold;">ملخص التقرير</h3>
        <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
          <div style="margin: 10px;">
            <div style="font-size: 20px; font-weight: bold;">عدد المنتجات</div>
            <div style="font-size: 32px; margin-top: 5px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${totalItems}</div>
          </div>
          <div style="margin: 10px;">
            <div style="font-size: 20px; font-weight: bold;">القيمة الإجمالية</div>
            <div style="font-size: 28px; margin-top: 5px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${formatCurrency(totalValue)}</div>
          </div>
        </div>
      </div>

      <div style="
        margin-top: 40px;
        text-align: center;
        color: #64748b;
        font-size: 12px;
        border-top: 2px solid #e2e8f0;
        padding-top: 20px;
      ">
        <p>تم إنشاء هذا التقرير بواسطة نظام RYUS BRAND</p>
        <p>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
      </div>
    `;

    // إضافة العنصر إلى DOM
    document.body.appendChild(reportElement);

    // تحويل إلى canvas مع إعدادات عالية الجودة
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: reportElement.scrollWidth,
      height: reportElement.scrollHeight
    });

    // إنشاء PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // إضافة الصفحة الأولى
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // إضافة صفحات إضافية إذا كان المحتوى طويل
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // تنزيل الملف
    pdf.save(`تقرير_الجرد_التفصيلي_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.pdf`);

    // إزالة العنصر المؤقت
    document.body.removeChild(reportElement);

  } catch (error) {
    console.error('خطأ في إنشاء PDF:', error);
    throw error;
  }
};