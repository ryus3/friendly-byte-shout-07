import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';

const QRCodeLabel = ({ 
  productName, 
  color = 'افتراضي', 
  size = 'افتراضي', 
  price, 
  productId, 
  variantId,
  className = '' 
}) => {
  const labelRef = useRef(null);

  // إنشاء QR Code بسيط وحقيقي
  const qrData = variantId || productId || `PROD_${Date.now().toString(36).toUpperCase()}`;

  const handlePrint = () => {
    const printContent = labelRef.current;
    
    // استخدام CSS للطباعة المباشرة من DOM
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة ملصق QR Code</title>
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              font-family: Arial, sans-serif;
              background: white;
              direction: ltr;
            }
            
            /* نسخ نفس الستايل الخاص بالمعاينة */
            .print-container {
              width: 400px; 
              height: 200px; 
              border: 3px solid #000; 
              background: white;
              display: flex;
              align-items: center;
              padding: 12px;
              margin: 20px auto;
              font-family: Arial, sans-serif;
              direction: ltr;
            }
            
            .qr-section {
              flex-shrink: 0;
              margin-right: 16px;
            }
            
            .product-info {
              flex: 1;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
            }
            
            .product-name {
              font-size: 26px;
              font-family: 'Arial Black', Arial, sans-serif;
              line-height: 1.1;
              font-weight: 900;
              color: #000;
              margin-bottom: 4px;
              text-align: center;
            }
            
            .product-details {
              font-size: 18px;
              line-height: 1.1;
              font-weight: bold;
              color: #000;
              margin-bottom: 12px;
              text-align: center;
            }
            
            .price {
              font-size: 28px;
              line-height: 1.1;
              font-weight: 900;
              color: #000;
              text-align: center;
            }
            
            @media print {
              body { 
                margin: 0; 
                padding: 0; 
              }
              .print-container { 
                margin: 0; 
                page-break-after: always; 
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="qr-section">
              ${printContent.querySelector('div:first-child').innerHTML}
            </div>
            <div class="product-info">
              <div class="product-name">${productName} RYUS</div>
              <div class="product-details">${size} / ${color}</div>
              ${price ? `<div class="price">${price.toLocaleString()} د.ع</div>` : ''}
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // تأخير بسيط للتأكد من تحميل المحتوى
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownload = () => {
    // إنشاء canvas للتحميل
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svg = labelRef.current.querySelector('svg');
    
    if (!svg) return;
    
    canvas.width = 400;
    canvas.height = 200;
    
    // رسم خلفية بيضاء
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // رسم حدود سوداء
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // تحويل SVG إلى Image للرسم
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      // رسم QR Code على اليسار
      ctx.drawImage(img, 16, 16, 150, 150);
      
      // إضافة النص - محاذاة وسط مطابقة للمعاينة
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      
      // اسم المنتج
      ctx.font = '900 26px Arial';
      ctx.fillText(`${productName} RYUS`, canvas.width - 120, 50);
      
      // اللون والمقاس
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`${size} / ${color}`, canvas.width - 120, 80);
      
      // السعر
      if (price) {
        ctx.font = '900 28px Arial';
        ctx.fillText(`${price.toLocaleString()} د.ع`, canvas.width - 120, 120);
      }
      
      // تحميل الصورة
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-label-${productName.replace(/\s+/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
      
      URL.revokeObjectURL(svgUrl);
    };
    
    img.src = svgUrl;
  };

  return (
    <Card className={`w-fit ${className}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* معاينة الملصق - تصميم مطابق للطبع بالضبط */}
          <div 
            ref={labelRef}
            className="w-[400px] h-[200px] border-[3px] border-black bg-white flex items-center p-3"
            style={{ 
              fontFamily: 'Arial, sans-serif',
              direction: 'ltr' 
            }}
          >
            {/* QR Code بسيط على اليسار */}
            <div className="flex-shrink-0 mr-4">
              <QRCodeSVG
                value={qrData}
                size={150}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            
            {/* معلومات المنتج على اليمين - محاذاة وسط مطابقة للطبع */}
            <div className="flex-1 h-full flex flex-col justify-center items-center text-center">
              <div 
                className="text-black font-black mb-1"
                style={{ 
                  fontSize: '26px',
                  fontFamily: 'Arial Black, Arial, sans-serif',
                  lineHeight: '1.1',
                  fontWeight: '900',
                  textAlign: 'center'
                }}
              >
                {productName} RYUS
              </div>
              <div 
                className="text-black font-bold mb-3"
                style={{ 
                  fontSize: '18px',
                  lineHeight: '1.1',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}
              >
                {size} / {color}
              </div>
              {price && (
                <div 
                  className="text-black font-black"
                  style={{ 
                    fontSize: '28px',
                    lineHeight: '1.1',
                    fontWeight: '900',
                    textAlign: 'center'
                  }}
                >
                  {price.toLocaleString()} د.ع
                </div>
              )}
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              تحميل
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRCodeLabel;