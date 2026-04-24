// 🚀 تحميل ديناميكي: jspdf و html2canvas يُحمَّلان فقط عند الحاجة (تقليل bundle الأولي)
let _jsPDF = null;
let _html2canvas = null;
const loadPdfDeps = async () => {
  if (!_jsPDF) {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);
    _jsPDF = jsPDF;
    _html2canvas = html2canvas;
  }
  return { jsPDF: _jsPDF, html2canvas: _html2canvas };
};

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
        <!-- Header مصغر وأنيق -->
        <div style="
          padding: 40px 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          margin-bottom: 25px;
          border-radius: 20px;
          box-shadow: 0 15px 40px rgba(102, 126, 234, 0.3);
        ">
          <h1 style="
            font-size: 36px;
            font-weight: 800;
            margin: 0 0 10px 0;
            text-shadow: 1px 1px 4px rgba(0,0,0,0.3);
            letter-spacing: -0.3px;
          ">RYUS BRAND</h1>
          <p style="font-size: 18px; margin: 0 0 15px 0; font-weight: 600; opacity: 0.95;">نظام إدارة المخزون المتقدم</p>
          <div style="
            background: rgba(255,255,255,0.2);
            border-radius: 12px;
            padding: 12px 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            display: inline-block;
          ">
            <p style="font-size: 15px; margin: 0; font-weight: 500;">📅 ${formattedDate} • ⏰ ${formattedTime}</p>
          </div>
        </div>

        <!-- الكروت الرئيسية - ثورة التصميم -->
        <div style="
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 15px;
          margin-bottom: 35px;
        ">
          <div style="
            background: linear-gradient(135deg, #ff6b9d, #c44569);
            color: white;
            padding: 25px 15px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 12px 30px rgba(255, 107, 157, 0.4);
            grid-column: span 2;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          ">
            <div style="
              position: absolute;
              top: -50%;
              right: -50%;
              width: 100%;
              height: 100%;
              background: rgba(255,255,255,0.1);
              border-radius: 50%;
            "></div>
                              <div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 10px 0;">
                                <div style="font-size: 36px; font-weight: 900; margin: 0; text-shadow: 1px 1px 3px rgba(0,0,0,0.2); line-height: 1; padding: 0;">${formatCurrency(totalValue).replace('د.ع', '')}</div>
                                <div style="font-size: 14px; opacity: 0.95; font-weight: 600; text-align: center; line-height: 1; margin: 8px 0 0 0; padding: 0;">القيمة الإجمالية (د.ع)</div>
                              </div>
          </div>
          
          <div style="
            background: linear-gradient(135deg, #4facfe, #00f2fe);
            color: white;
            padding: 25px 15px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 12px 30px rgba(79, 172, 254, 0.4);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          ">
            <div style="
              position: absolute;
              top: -30%;
              left: -30%;
              width: 80%;
              height: 80%;
              background: rgba(255,255,255,0.1);
              border-radius: 50%;
            "></div>
                              <div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 10px 0;">
                                <div style="font-size: 36px; font-weight: 900; margin: 0; line-height: 1; padding: 0;">${availableItems}</div>
                                <div style="font-size: 14px; opacity: 0.95; font-weight: 600; text-align: center; line-height: 1; margin: 8px 0 0 0; padding: 0;">متوفر</div>
                              </div>
          </div>
          
          <div style="
            background: linear-gradient(135deg, #fa709a, #fee140);
            color: white;
            padding: 25px 15px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 12px 30px rgba(250, 112, 154, 0.4);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          ">
            <div style="
              position: absolute;
              bottom: -40%;
              right: -40%;
              width: 90%;
              height: 90%;
              background: rgba(255,255,255,0.1);
              border-radius: 50%;
            "></div>
                              <div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 10px 0;">
                                <div style="font-size: 36px; font-weight: 900; margin: 0; text-shadow: 1px 1px 3px rgba(0,0,0,0.2); line-height: 1; padding: 0;">${reservedItems}</div>
                                <div style="font-size: 14px; opacity: 0.95; font-weight: 600; text-align: center; line-height: 1; margin: 8px 0 0 0; padding: 0;">محجوز</div>
                              </div>
          </div>
          
          <div style="
            background: linear-gradient(135deg, #a8edea, #fed6e3);
            color: #2c3e50;
            padding: 25px 15px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 12px 30px rgba(168, 237, 234, 0.4);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          ">
            <div style="
              position: absolute;
              top: -20%;
              left: -50%;
              width: 100%;
              height: 100%;
              background: rgba(255,255,255,0.3);
              border-radius: 50%;
            "></div>
                              <div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 10px 0;">
                                <div style="font-size: 36px; font-weight: 900; margin: 0; line-height: 1; padding: 0;">${goodStock}</div>
                                <div style="font-size: 14px; font-weight: 600; opacity: 0.8; text-align: center; line-height: 1; margin: 8px 0 0 0; padding: 0;">ممتاز</div>
                              </div>
          </div>
          
          <div style="
            background: linear-gradient(135deg, #ffecd2, #fcb69f);
            color: #2c3e50;
            padding: 25px 15px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 12px 30px rgba(255, 236, 210, 0.4);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          ">
            <div style="
              position: absolute;
              bottom: -30%;
              left: -30%;
              width: 80%;
              height: 80%;
              background: rgba(255,255,255,0.3);
              border-radius: 50%;
            "></div>
                              <div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 10px 0;">
                                <div style="font-size: 36px; font-weight: 900; margin: 0; line-height: 1; padding: 0;">${mediumStock}</div>
                                <div style="font-size: 14px; font-weight: 600; opacity: 0.8; text-align: center; line-height: 1; margin: 8px 0 0 0; padding: 0;">متوسط</div>
                              </div>
          </div>
        </div>

        <!-- تفاصيل المنتجات بالألوان والمقاسات -->
        ${Object.entries(productsByColor).map(([productName, colors], productIndex) => {
          const productTotal = Object.values(colors).flat().reduce((sum, size) => sum + size.quantity, 0);
          return `
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
              position: relative;
            ">
              <h3 style="font-size: 24px; margin: 0; font-weight: 700;">${productName}</h3>
              <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 15px;
                gap: 30px;
              ">
                <div style="
                  background: rgba(255,255,255,0.2);
                  padding: 10px 20px;
                  border-radius: 25px;
                  backdrop-filter: blur(10px);
                ">
                  <span style="font-size: 20px; font-weight: 800;">${productTotal}</span>
                  <span style="font-size: 14px; opacity: 0.9; margin-right: 5px;">قطعة إجمالي</span>
                </div>
                <div style="
                  background: rgba(255,255,255,0.2);
                  padding: 10px 20px;
                  border-radius: 25px;
                  backdrop-filter: blur(10px);
                ">
                  <span style="font-size: 20px; font-weight: 800;">${Object.keys(colors).length}</span>
                  <span style="font-size: 14px; opacity: 0.9; margin-right: 5px;">لون متوفر</span>
                </div>
              </div>
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
                  
                  return `
                    <div style="
                      background: white;
                      border-radius: 15px;
                      padding: 20px;
                      box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                      border-top: 4px solid #667eea;
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
                          background: linear-gradient(135deg, #667eea, #764ba2);
                          color: white;
                          padding: 8px 15px;
                          border-radius: 25px;
                          font-weight: 700;
                          font-size: 14px;
                        ">
                          ${colorTotal} قطعة
                        </div>
                      </div>
                      
                      <!-- المقاسات -->
                      <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
                        gap: 12px;
                      ">
                        ${sizes.map(size => {
                          let sizeGradient, textColor, statusInfo;
                          if (size.quantity > 10) {
                            sizeGradient = 'linear-gradient(135deg, #a8edea, #fed6e3)';
                            textColor = '#2c3e50';
                            statusInfo = 'متوفر';
                          } else if (size.quantity >= 5) {
                            sizeGradient = 'linear-gradient(135deg, #ffecd2, #fcb69f)';
                            textColor = '#2c3e50';
                            statusInfo = 'متوفر';
                          } else if (size.quantity > 0) {
                            sizeGradient = 'linear-gradient(135deg, #fa709a, #fee140)';
                            textColor = 'white';
                            statusInfo = 'متوفر';
                          } else {
                            sizeGradient = 'linear-gradient(135deg, #e0e0e0, #bdbdbd)';
                            textColor = '#666';
                            statusInfo = 'محجوز';
                          }
                          
                          return `
                            <div style="
                              background: ${sizeGradient};
                              color: ${textColor};
                              padding: 18px 12px;
                              border-radius: 16px;
                              text-align: center;
                              box-shadow: 0 6px 20px rgba(0,0,0,0.15);
                              position: relative;
                              overflow: hidden;
                              min-height: 100px;
                              display: flex;
                              flex-direction: column;
                              justify-content: center;
                              align-items: center;
                            ">
                              <div style="
                                position: absolute;
                                top: -30%;
                                right: -30%;
                                width: 80%;
                                height: 80%;
                                background: rgba(255,255,255,0.2);
                                border-radius: 50%;
                              "></div>
                               <div style="position: relative; z-index: 2; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 8px 0;">
                                  <div style="font-size: 18px; font-weight: 800; margin: 0; line-height: 1; padding: 0;">${size.size}</div>
                                  <div style="font-size: 24px; font-weight: 900; margin: 6px 0; line-height: 1; padding: 0;">${size.quantity}</div>
                                  <div style="font-size: 12px; opacity: 0.85; font-weight: 600; line-height: 1; margin: 4px 0 0 0; padding: 0;">${statusInfo}</div>
                                </div>
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
        `;
        }).join('')}

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