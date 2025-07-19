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
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
      <html>
        <head>
          <title>طباعة ملصق QR Code</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: white;
            }
            .label { 
              width: 400px; 
              height: 200px; 
              border: 3px solid #000; 
              background: white;
              display: flex;
              align-items: center;
              padding: 12px;
              margin: 0 auto;
              font-family: Arial, sans-serif;
            }
            .qr-section {
              flex-shrink: 0;
              margin-right: 16px;
            }
            .product-info {
              flex: 1;
              text-align: right;
              direction: rtl;
              display: flex;
              flex-direction: column;
              justify-content: center;
              height: 100%;
            }
            .product-name {
              font-size: 26px;
              font-weight: 900;
              color: #000;
              margin-bottom: 4px;
              font-family: 'Arial Black', Arial, sans-serif;
              line-height: 1.1;
            }
            .product-details {
              font-size: 18px;
              font-weight: bold;
              color: #000;
              margin-bottom: 12px;
              line-height: 1.1;
            }
            .price {
              font-size: 28px;
              font-weight: 900;
              color: #000;
              line-height: 1.1;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .label { margin: 0; page-break-after: always; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    newWindow.document.close();
    newWindow.print();
  };

  const handleDownload = () => {
    // تحويل SVG إلى Canvas ثم إلى صورة
    const svg = labelRef.current.querySelector('svg');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 200;
      
      // رسم خلفية بيضاء
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // حدود سوداء
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      // رسم QR Code على اليسار
      ctx.drawImage(img, 16, 16, 150, 150);
      
      // إضافة النص على اليمين - محاذاة جانبية
      ctx.fillStyle = 'black';
      ctx.textAlign = 'right';
      
      // اسم المنتج
      ctx.font = '900 26px Arial';
      ctx.fillText(`${productName} RYUS`, canvas.width - 16, 50);
      
      // اللون والمقاس
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`${size} / ${color}`, canvas.width - 16, 75);
      
      // السعر
      if (price) {
        ctx.font = '900 28px Arial';
        ctx.fillText(`${price.toLocaleString()} د.ع`, canvas.width - 16, 110);
      }
      
      // تحميل الصورة
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-label-${productName.replace(/\s+/g, '-')}.png`;
        a.click();
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
          {/* معاينة الملصق - تصميم مطابق للصورة بالضبط */}
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
            
            {/* معلومات المنتج على اليمين - محاذاة جانبية */}
            <div className="flex-1 h-full flex flex-col justify-center" style={{ direction: 'rtl', textAlign: 'right' }}>
              <div 
                className="text-black font-black mb-1"
                style={{ 
                  fontSize: '26px',
                  fontFamily: 'Arial Black, Arial, sans-serif',
                  lineHeight: '1.1',
                  fontWeight: '900'
                }}
              >
                {productName} RYUS
              </div>
              <div 
                className="text-black font-bold mb-3"
                style={{ 
                  fontSize: '18px',
                  lineHeight: '1.1',
                  fontWeight: 'bold'
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
                    fontWeight: '900'
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