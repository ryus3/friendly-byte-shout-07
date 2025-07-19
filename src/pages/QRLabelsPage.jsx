import React, { useState, useEffect } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import QRCodeLabel from '@/components/products/QRCodeLabel';
import { Search, Printer, FileDown, QrCode, Package } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const QRLabelsPage = () => {
  const { products } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    if (!products) return;
    
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredProducts(filtered);
  }, [products, searchTerm]);

  const toggleProductSelection = (productId) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const selectAllProducts = () => {
    setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const printAllSelected = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "تحذير",
        description: "يرجى اختيار منتجات للطباعة",
        variant: "destructive"
      });
      return;
    }

    const selectedProductsData = filteredProducts.filter(p => selectedProducts.has(p.id));
    
    // إنشاء نافذة طباعة
    const printWindow = window.open('', '_blank');
    const labelsHTML = selectedProductsData.map(product => {
      // الحصول على بيانات QR Code
      const qrData = JSON.stringify({
        id: `QR_${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        type: 'product',
        product_id: product.id,
        product_name: product.name,
        color: 'افتراضي',
        size: 'افتراضي',
        price: product.base_price,
        generated_at: Date.now(),
        version: '2.0'
      });

      return `
        <div class="label-container" style="
          width: 300px; 
          height: 400px; 
          border: 2px solid #333; 
          border-radius: 12px;
          padding: 16px;
          background: white;
          display: inline-block;
          margin: 10px;
          page-break-inside: avoid;
          vertical-align: top;
        ">
          <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
              <div id="qr-${product.id}"></div>
            </div>
            <div style="text-align: center; margin-top: 12px;">
              <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 8px; line-height: 1.2;">
                ${product.name}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                رقم المنتج: ${product.barcode || 'غير محدد'}
              </div>
              ${product.base_price ? `
                <div style="font-size: 18px; font-weight: bold; color: #2563eb; margin-top: 8px;">
                  ${product.base_price.toLocaleString()} د.ع
                </div>
              ` : ''}
            </div>
            <div style="text-align: center; font-size: 12px; font-weight: bold; color: #4f46e5; margin-top: 12px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
              نظام إدارة المخزون الذكي
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة ملصقات QR Code</title>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: white;
              direction: rtl;
            }
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              justify-content: flex-start;
              gap: 10px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .label-container { page-break-inside: avoid; margin: 5px; }
            }
          </style>
        </head>
        <body>
          <h2 style="text-align: center; margin-bottom: 20px;">ملصقات QR Code للمنتجات</h2>
          <div class="labels-container">
            ${labelsHTML}
          </div>
          <script>
            // إنشاء QR Codes
            ${selectedProductsData.map(product => {
              const qrData = JSON.stringify({
                id: `QR_${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
                type: 'product',
                product_id: product.id,
                product_name: product.name,
                color: 'افتراضي',
                size: 'افتراضي',
                price: product.base_price,
                generated_at: Date.now(),
                version: '2.0'
              });
              
              return `
                QRCode.toCanvas(document.getElementById('qr-${product.id}'), '${qrData}', {
                  width: 200,
                  margin: 2,
                  color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                  }
                });
              `;
            }).join('\n')}
            
            // طباعة تلقائية بعد تحميل QR Codes
            setTimeout(() => {
              window.print();
            }, 1000);
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    toast({
      title: "نجاح",
      description: `تم إرسال ${selectedProducts.size} ملصق للطباعة`,
      variant: "success"
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* رأس الصفحة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <QrCode className="w-8 h-8 text-primary" />
            طباعة ملصقات QR Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="البحث في المنتجات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={selectAllProducts} variant="outline">
                اختيار الكل ({filteredProducts.length})
              </Button>
              <Button onClick={clearSelection} variant="outline">
                إلغاء الاختيار
              </Button>
              <Button 
                onClick={printAllSelected}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={selectedProducts.size === 0}
              >
                <Printer className="w-4 h-4 ml-2" />
                طباعة المحدد ({selectedProducts.size})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* قائمة المنتجات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <Card 
            key={product.id}
            className={`cursor-pointer transition-all ${
              selectedProducts.has(product.id) 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:shadow-md'
            }`}
            onClick={() => toggleProductSelection(product.id)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg line-clamp-2">
                      {product.name}
                    </h3>
                    {product.base_price && (
                      <p className="text-blue-600 font-bold text-lg">
                        {product.base_price.toLocaleString()} د.ع
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {selectedProducts.has(product.id) && (
                      <Badge variant="default" className="bg-green-600">
                        محدد
                      </Badge>
                    )}
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                </div>
                
                {product.barcode && (
                  <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                    الرقم: {product.barcode}
                  </div>
                )}
                
                <div className="pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      // طباعة منفردة
                      setSelectedProducts(new Set([product.id]));
                      setTimeout(() => printAllSelected(), 100);
                    }}
                  >
                    <Printer className="w-4 h-4 ml-2" />
                    طباعة فردية
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-500 mb-2">
              لا توجد منتجات
            </h3>
            <p className="text-gray-400">
              {searchTerm ? 'لم يتم العثور على منتجات مطابقة للبحث' : 'لا توجد منتجات في النظام'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* معاينة الملصق */}
      {selectedProducts.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>معاينة الملصق</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Array.from(selectedProducts).slice(0, 3).map(productId => {
                const product = filteredProducts.find(p => p.id === productId);
                if (!product) return null;
                
                return (
                  <QRCodeLabel
                    key={product.id}
                    productName={product.name}
                    price={product.base_price}
                    productId={product.id}
                    className="scale-75 origin-top-left"
                  />
                );
              })}
              {selectedProducts.size > 3 && (
                <div className="flex items-center justify-center w-[225px] h-[300px] border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center text-gray-500">
                    <QrCode className="w-8 h-8 mx-auto mb-2" />
                    <p>+ {selectedProducts.size - 3} ملصق إضافي</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QRLabelsPage;