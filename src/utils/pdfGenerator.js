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
    reportElement.style.fontFamily = '"Cairo", "Tajawal", "IBM Plex Sans Arabic", -apple-system, system-ui, sans-serif';
    reportElement.style.direction = 'rtl';
    
    // حساب الإحصائيات
    const totalValue = inventoryData.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || item.selling_price || item.sale_price || 0)), 0);
    const totalQuantity = inventoryData.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const availableItems = inventoryData.filter(item => (item.quantity || 0) > 5).length;
    const reservedItems = inventoryData.filter(item => (item.quantity || 0) === 0).length;
    const goodStock = inventoryData.filter(item => (item.quantity || 0) > 10).length;
    const mediumStock = inventoryData.filter(item => (item.quantity || 0) >= 5 && (item.quantity || 0) <= 10).length;
    const lowStock = inventoryData.filter(item => (item.quantity || 0) > 0 && (item.quantity || 0) < 5).length;
    
    // تجميع المنتجات حسب اللون
    const productsByColor = inventoryData.reduce((acc, item) => {
      const productName = item.name || item.product_name || 'غير محدد';
      const color = item.color || item.color_name || 'غير محدد';
      const size = item.size || item.size_name || 'غير محدد';
      
      if (!acc[productName]) {
        acc[productName] = {};
      }
      if (!acc[productName][color]) {
        acc[productName][color] = [];
      }
      
      acc[productName][color].push({
        size,
        quantity: item.quantity || 0,
        price: item.price || item.selling_price || item.sale_price || 0
      });
      
      return acc;
    }, {});

    // تاريخ اليوم بالميلادي
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-GB');
    const formattedTime = today.toLocaleTimeString('en-GB', { hour12: false });
    
    reportElement.innerHTML = `
      <div style="padding: 30px; background: white; min-height: 100vh;">
        <!-- Header الرئيسي -->
        <div style="
          padding: 60px 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          margin-bottom: 30px;
          border-radius: 25px;
          box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
        ">
          <h1 style="
            font-size: 48px;
            font-weight: 800;
            margin: 0 0 15px 0;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
            letter-spacing: -0.5px;
          ">RYUS BRAND</h1>
          <p style="font-size: 24px; margin: 0 0 20px 0; font-weight: 600; opacity: 0.95;">نظام إدارة المخزون المتقدم</p>
          <div style="
            background: rgba(255,255,255,0.2);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            display: inline-block;
          ">
            <p style="font-size: 18px; margin: 0; font-weight: 500;">📅 ${formattedDate} • ⏰ ${formattedTime}</p>
          </div>
        </div>

        <!-- الإحصائيات الرئيسية -->
        <div style="
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        ">
          <div style="
            background: linear-gradient(135deg, #ff6b6b, #ee5a52);
            color: white;
            padding: 30px 20px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 15px 35px rgba(255, 107, 107, 0.3);
            grid-column: span 2;
          ">
            <div style="font-size: 42px; font-weight: 900; margin-bottom: 8px;">${formatCurrency(totalValue).replace('د.ع', '')}</div>
            <div style="font-size: 16px; opacity: 0.95; font-weight: 600;">القيمة (د.ع)</div>
          </div>
          <div style="
            background: linear-gradient(135deg, #4ecdc4, #44a08d);
            color: white;
            padding: 30px 20px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 15px 35px rgba(78, 205, 196, 0.3);
          ">
            <div style="font-size: 42px; font-weight: 900; margin-bottom: 8px;">${availableItems}</div>
            <div style="font-size: 16px; opacity: 0.95; font-weight: 600;">متاح</div>
          </div>
          <div style="
            background: linear-gradient(135deg, #ffa726, #ff9800);
            color: white;
            padding: 30px 20px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 15px 35px rgba(255, 167, 38, 0.3);
          ">
            <div style="font-size: 42px; font-weight: 900; margin-bottom: 8px;">${reservedItems}</div>
            <div style="font-size: 16px; opacity: 0.95; font-weight: 600;">محجوز</div>
          </div>
          <div style="
            background: linear-gradient(135deg, #ab47bc, #8e24aa);
            color: white;
            padding: 30px 20px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 15px 35px rgba(171, 71, 188, 0.3);
          ">
            <div style="font-size: 42px; font-weight: 900; margin-bottom: 8px;">${goodStock}</div>
            <div style="font-size: 16px; opacity: 0.95; font-weight: 600;">جيد</div>
          </div>
          <div style="
            background: linear-gradient(135deg, #42a5f5, #1e88e5);
            color: white;
            padding: 30px 20px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 15px 35px rgba(66, 165, 245, 0.3);
          ">
            <div style="font-size: 42px; font-weight: 900; margin-bottom: 8px;">${mediumStock}</div>
            <div style="font-size: 16px; opacity: 0.95; font-weight: 600;">متوسط</div>
          </div>
          <div style="
            background: linear-gradient(135deg, #66bb6a, #43a047);
            color: white;
            padding: 30px 20px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 15px 35px rgba(102, 187, 106, 0.3);
          ">
            <div style="font-size: 42px; font-weight: 900; margin-bottom: 8px;">${lowStock}</div>
            <div style="font-size: 16px; opacity: 0.95; font-weight: 600;">منخفض</div>
          </div>
        </div>

        <!-- قسم تفاصيل مخزون المنتجات -->
        <div style="
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          color: white;
          padding: 30px;
          border-radius: 20px;
          margin-bottom: 30px;
          box-shadow: 0 20px 60px rgba(44, 62, 80, 0.3);
        ">
          <h2 style="font-size: 28px; margin: 0 0 20px 0; font-weight: 700; text-align: center;">
            📊 تفاصيل مخزون المنتجات
          </h2>
          
          <!-- إحصائيات سريعة -->
          <div style="
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          ">
            <div style="
              background: rgba(75, 192, 192, 0.2);
              border: 2px solid #4bc0c0;
              border-radius: 15px;
              padding: 20px;
              text-align: center;
            ">
              <div style="font-size: 24px; font-weight: 900; color: #4bc0c0;">جيد</div>
              <div style="font-size: 32px; font-weight: 900; margin: 5px 0;">${goodStock}</div>
            </div>
            <div style="
              background: rgba(255, 193, 7, 0.2);
              border: 2px solid #ffc107;
              border-radius: 15px;
              padding: 20px;
              text-align: center;
            ">
              <div style="font-size: 24px; font-weight: 900; color: #ffc107;">متوسط</div>
              <div style="font-size: 32px; font-weight: 900; margin: 5px 0;">${mediumStock}</div>
            </div>
            <div style="
              background: rgba(255, 99, 132, 0.2);
              border: 2px solid #ff6384;
              border-radius: 15px;
              padding: 20px;
              text-align: center;
            ">
              <div style="font-size: 24px; font-weight: 900; color: #ff6384;">منخفض</div>
              <div style="font-size: 32px; font-weight: 900; margin: 5px 0;">${lowStock}</div>
            </div>
            <div style="
              background: rgba(153, 102, 255, 0.2);
              border: 2px solid #9966ff;
              border-radius: 15px;
              padding: 20px;
              text-align: center;
            ">
              <div style="font-size: 24px; font-weight: 900; color: #9966ff;">إجمالي</div>
              <div style="font-size: 32px; font-weight: 900; margin: 5px 0;">${Object.keys(productsByColor).length}</div>
            </div>
          </div>
        </div>

        <!-- تفاصيل المنتجات بالألوان والمقاسات -->
        ${Object.entries(productsByColor).map(([productName, colors], productIndex) => `
          <div style="
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 20px;
            margin-bottom: 30px;
            overflow: hidden;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
          ">
            <!-- عنوان المنتج -->
            <div style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 25px;
              text-align: center;
            ">
              <h3 style="font-size: 24px; margin: 0; font-weight: 700;">${productName}</h3>
              <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">
                إجمالي ${Object.values(colors).flat().reduce((sum, size) => sum + size.quantity, 0)} قطعة - 
                ${Object.keys(colors).length} لون متوفر
              </p>
            </div>

            <!-- الألوان والمقاسات -->
            <div style="padding: 30px;">
              <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
              ">
                ${Object.entries(colors).map(([colorName, sizes], colorIndex) => {
                  const colorTotal = sizes.reduce((sum, size) => sum + size.quantity, 0);
                  const colorStatus = colorTotal > 10 ? '#4bc0c0' : colorTotal >= 5 ? '#ffc107' : colorTotal > 0 ? '#ff6384' : '#6c757d';
                  
                  return `
                    <div style="
                      background: white;
                      border-radius: 15px;
                      padding: 20px;
                      box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                      border-left: 5px solid ${colorStatus};
                    ">
                      <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid #f8f9fa;
                      ">
                        <h4 style="
                          font-size: 20px;
                          margin: 0;
                          color: #2c3e50;
                          font-weight: 700;
                        ">${colorName}</h4>
                        <div style="
                          background: ${colorStatus};
                          color: white;
                          padding: 8px 15px;
                          border-radius: 25px;
                          font-weight: 700;
                          font-size: 14px;
                        ">
                          إجمالي ${colorTotal} قطعة
                        </div>
                      </div>
                      
                      <!-- المقاسات -->
                      <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                        gap: 10px;
                      ">
                        ${sizes.map(size => {
                          const sizeStatus = size.quantity > 10 ? '#28a745' : size.quantity >= 5 ? '#ffc107' : size.quantity > 0 ? '#dc3545' : '#6c757d';
                          return `
                            <div style="
                              background: linear-gradient(135deg, ${sizeStatus}, ${sizeStatus}dd);
                              color: white;
                              padding: 12px 8px;
                              border-radius: 12px;
                              text-align: center;
                              box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                            ">
                              <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">${size.size}</div>
                              <div style="font-size: 20px; font-weight: 900;">${size.quantity}</div>
                              <div style="font-size: 12px; opacity: 0.9;">قطعة</div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `).join('')}

        <!-- Footer -->
        <div style="
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          padding: 30px;
          border-radius: 15px;
          text-align: center;
          margin-top: 40px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.1);
        ">
          <p style="font-size: 18px; margin: 0 0 10px 0; font-weight: 600;">
            تم إنشاء هذا التقرير بواسطة نظام RYUS BRAND لإدارة المخزون
          </p>
          <p style="font-size: 14px; margin: 0; opacity: 0.9;">
            جميع الحقوق محفوظة © ${new Date().getFullYear()} • ${formattedDate} ${formattedTime}
          </p>
        </div>
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
    pdf.save(`RYUS_BRAND_Inventory_Report_${formattedDate.replace(/\//g, '-')}.pdf`);

    // إزالة العنصر المؤقت
    document.body.removeChild(reportElement);

  } catch (error) {
    console.error('خطأ في إنشاء PDF:', error);
    throw error;
  }
};