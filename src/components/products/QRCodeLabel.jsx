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
              width: 300px; 
              height: 400px; 
              border: 2px solid #333; 
              border-radius: 12px;
              padding: 16px;
              background: white;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              margin: 0 auto;
            }
            .qr-section {
              text-align: center;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .product-info {
              text-align: center;
              margin-top: 12px;
            }
            .product-name {
              font-size: 16px;
              font-weight: bold;
              color: #333;
              margin-bottom: 8px;
              line-height: 1.2;
            }
            .product-details {
              font-size: 12px;
              color: #666;
              margin-bottom: 4px;
            }
            .price {
              font-size: 18px;
              font-weight: bold;
              color: #2563eb;
              margin-top: 8px;
            }
            .logo {
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              color: #4f46e5;
              margin-top: 12px;
              border-top: 1px solid #e5e7eb;
              padding-top: 8px;
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
      canvas.width = 300;
      canvas.height = 400;
      
      // رسم خلفية بيضاء
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // رسم QR Code
      ctx.drawImage(img, 50, 50, 200, 200);
      
      // إضافة النص
      ctx.fillStyle = 'black';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(productName, canvas.width/2, 280);
      
      ctx.font = '12px Arial';
      ctx.fillText(`اللون: ${color}`, canvas.width/2, 300);
      ctx.fillText(`المقاس: ${size}`, canvas.width/2, 320);
      
      if (price) {
        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`${price} د.ع`, canvas.width/2, 350);
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
          {/* معاينة الملصق */}
          <div 
            ref={labelRef}
            className="label w-[300px] h-[400px] border-2 border-gray-300 rounded-lg p-4 bg-white flex flex-col justify-between"
          >
            <div className="qr-section text-center flex-1 flex flex-col justify-center items-center">
              <QRCodeSVG
                value={qrData}
                size={200}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            
            <div className="product-info text-center mt-3">
              <div className="product-name text-lg font-bold text-gray-800 mb-2 leading-tight">
                {productName}
              </div>
              <div className="product-details text-sm text-gray-600 mb-1">
                اللون: {color}
              </div>
              <div className="product-details text-sm text-gray-600 mb-1">
                المقاس: {size}
              </div>
              {price && (
                <div className="price text-xl font-bold text-blue-600 mt-2">
                  {price.toLocaleString()} د.ع
                </div>
              )}
            </div>
            
            <div className="logo text-center text-sm font-bold text-indigo-600 mt-3 border-t border-gray-200 pt-2">
              نظام إدارة المخزون الذكي
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