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

  // إنشاء بيانات QR Code
  const qrData = JSON.stringify({
    id: `QR_${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    type: 'product',
    product_id: productId,
    variant_id: variantId,
    product_name: productName,
    color: color,
    size: size,
    price: price,
    generated_at: Date.now(),
    version: '2.0'
  });

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
              border: 2px solid #000; 
              background: white;
              display: flex;
              align-items: center;
              padding: 16px;
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
            }
            .product-name {
              font-size: 32px;
              font-weight: 900;
              color: #000;
              margin-bottom: 8px;
              font-family: 'Arial Black', Arial, sans-serif;
            }
            .product-details {
              font-size: 24px;
              font-weight: bold;
              color: #000;
              margin-bottom: 16px;
            }
            .price {
              font-size: 40px;
              font-weight: 900;
              color: #000;
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
      
      // رسم QR Code على اليسار
      ctx.drawImage(img, 20, 20, 160, 160);
      
      // إضافة النص على اليمين
      ctx.fillStyle = 'black';
      ctx.textAlign = 'right';
      
      // اسم المنتج
      ctx.font = '900 32px Arial';
      ctx.fillText(`${productName} RYUS`, canvas.width - 20, 60);
      
      // اللون والمقاس
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`${size} / ${color}`, canvas.width - 20, 100);
      
      // السعر
      if (price) {
        ctx.font = '900 40px Arial';
        ctx.fillText(`${price.toLocaleString()} د.ع`, canvas.width - 20, 150);
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
          {/* معاينة الملصق - تصميم مطابق للصورة */}
          <div 
            ref={labelRef}
            className="label w-[400px] h-[200px] border-2 border-black bg-white flex items-center p-4"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {/* QR Code على اليسار */}
            <div className="flex-shrink-0 mr-4">
              <QRCodeSVG
                value={qrData}
                size={160}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            
            {/* معلومات المنتج على اليمين */}
            <div className="flex-1 text-right">
              <div className="text-4xl font-black text-black mb-2" style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
                {productName} RYUS
              </div>
              <div className="text-3xl font-bold text-black mb-4">
                {size} / {color}
              </div>
              {price && (
                <div className="text-5xl font-black text-black">
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