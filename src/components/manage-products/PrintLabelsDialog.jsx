import React, { useState, useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, Minus, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateUniqueBarcode } from '@/lib/barcode-utils';

const LabelPreview = React.forwardRef(({ labelsToPrint }, ref) => {
  return (
    <div ref={ref} className="print-area">
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .print-area {
            display: block !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .label-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5mm !important;
            padding: 10mm !important;
            background: white !important;
          }
          
          .label-card {
            width: 60mm !important;
            height: 40mm !important;
            border: 2px solid #000 !important;
            padding: 2mm !important;
            page-break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: white !important;
            box-sizing: border-box !important;
          }
          
          .label-header {
            text-align: center !important;
            margin-bottom: 1mm !important;
          }
          
          .label-product-name {
            font-size: 11px !important;
            font-weight: bold !important;
            margin: 0 !important;
            line-height: 1.1 !important;
            color: #000 !important;
          }
          
          .label-variant-info {
            font-size: 9px !important;
            margin: 0 !important;
            color: #000 !important;
          }
          
          .label-barcode-container {
            text-align: center !important;
            margin: 1mm 0 !important;
            height: 15mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
          }
          
          .label-barcode-container svg {
            max-width: 100% !important;
            height: auto !important;
            background: white !important;
          }
          
          .label-barcode-container svg rect {
            fill: white !important;
          }
          
          .label-barcode-container svg path,
          .label-barcode-container svg rect[fill="#000000"],
          .label-barcode-container svg rect[fill="black"] {
            fill: #000 !important;
          }
          
          .label-price {
            font-size: 12px !important;
            font-weight: bold !important;
            text-align: center !important;
            margin: 0 !important;
            color: #000 !important;
          }
          
          .no-barcode {
            font-size: 8px !important;
            color: #000 !important;
            text-align: center !important;
          }
        }
        
        @media screen {
          .label-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            padding: 16px;
            background: #f8f9fa;
          }
          
          .label-card {
            width: 200px;
            height: 140px;
            border: 2px solid #e2e8f0;
            padding: 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .label-header {
            text-align: center;
            margin-bottom: 8px;
          }
          
          .label-product-name {
            font-size: 14px;
            font-weight: bold;
            margin: 0;
            line-height: 1.2;
            color: #1a1a1a;
          }
          
          .label-variant-info {
            font-size: 12px;
            margin: 0;
            color: #666;
          }
          
          .label-barcode-container {
            text-align: center;
            margin: 8px 0;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px dashed #ddd;
            border-radius: 4px;
            background: white;
          }
          
          .label-barcode-container svg {
            max-width: 100%;
            height: auto;
          }
          
          .label-price {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin: 0;
            color: #1a1a1a;
          }
          
          .no-barcode {
            color: #999;
            font-size: 10px;
            text-align: center;
          }
        }
      `}</style>
      <div className="label-grid">
        {labelsToPrint.map((label, index) => (
          <div key={index} className="label-card">
            <div className="label-header">
              <h3 className="label-product-name">{label.name}</h3>
              <p className="label-variant-info">{label.color} / {label.size}</p>
            </div>
            
            <div className="label-barcode-container">
              {label.barcode && label.barcode.trim() !== '' && label.barcode !== 'لا يوجد باركود' ? (
                <div>
                  <Barcode 
                    value={label.barcode} 
                    format="CODE128"
                    height={30}
                    width={1.8}
                    fontSize={8}
                    margin={1}
                    displayValue={true}
                    background="#FFFFFF"
                    lineColor="#000000"
                    textAlign="center"
                    textPosition="bottom"
                    textMargin={2}
                  />
                </div>
              ) : (
                <div className="no-barcode">
                  <p>لا يوجد باركود</p>
                  <p className="text-xs">{label.color} - {label.size}</p>
                </div>
              )}
            </div>
            
            <p className="label-price">{(label.price || 0).toLocaleString()} د.ع</p>
          </div>
        ))}
      </div>
    </div>
  );
});

const PrintLabelsDialog = ({ open, onOpenChange, products }) => {
  const [labelQuantities, setLabelQuantities] = useState({});
  const printComponentRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current,
    pageStyle: `
      @page { 
        size: A4; 
        margin: 10mm; 
      } 
      @media print { 
        body { 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact;
          print-color-adjust: exact;
        } 
      }
    `
  });

  const handleQuantityChange = (sku, value) => {
    setLabelQuantities(prev => ({ ...prev, [sku]: Math.max(0, value) }));
  };
  
  const labelsToPrint = useMemo(() => {
    const labels = [];
    
    if (!products || products.length === 0) return labels;
    
    console.log('🏷️ معالجة المنتجات للطباعة:', products);
    
    products.forEach(product => {
      console.log('🏷️ معالجة المنتج:', product.name, { 
        productBarcode: product.barcode, 
        variantsCount: product.variants?.length || 0 
      });
      
      if (product.variants && product.variants.length > 0) {
        // منتج بمتغيرات
        product.variants.forEach(variant => {
          const sku = `${product.id}-${variant.id}`;
          const quantity = labelQuantities[sku] || 1;
          
          console.log('🏷️ معالجة المتغير:', {
            sku,
            variantBarcode: variant.barcode,
            productBarcode: product.barcode,
            colorName: variant.colors?.name || variant.color,
            sizeName: variant.sizes?.name || variant.size
          });
          
          // استخدام الباركود من المتغير أولاً، ثم من المنتج
          const barcode = variant.barcode || product.barcode;
          
          for (let i = 0; i < quantity; i++) {
            labels.push({
              name: product.name,
              color: variant.colors?.name || variant.color || 'غير محدد',
              size: variant.sizes?.name || variant.size || 'غير محدد',
              price: variant.price || product.base_price || 0,
              barcode: barcode,
              sku
            });
          }
        });
      } else {
        // منتج بدون متغيرات
        const sku = product.id;
        const quantity = labelQuantities[sku] || 1;
        const barcode = product.barcode;
        
        console.log('🏷️ منتج بدون متغيرات:', {
          name: product.name,
          barcode: barcode
        });
        
        for (let i = 0; i < quantity; i++) {
          labels.push({
            name: product.name,
            color: 'عام',
            size: 'عام',
            price: product.base_price || 0,
            barcode: barcode,
            sku
          });
        }
      }
    });
    
    console.log('🏷️ ملصقات جاهزة للطباعة:', labels);
    return labels;
  }, [products, labelQuantities]);

  const setAllQuantitiesToStock = () => {
    const newQuantities = {};
    if (!products) return;
    
    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          const sku = `${product.id}-${variant.id}`;
          const stockQuantity = variant.inventory?.[0]?.quantity || variant.quantity || 1;
          newQuantities[sku] = stockQuantity;
        });
      } else {
        const sku = product.id;
        const stockQuantity = product.quantity || 1;
        newQuantities[sku] = stockQuantity;
      }
    });
    setLabelQuantities(newQuantities);
  };

  const totalLabels = Object.values(labelQuantities).reduce((sum, qty) => sum + qty, 0);

  if (!products || products.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>لا توجد منتجات</DialogTitle>
            <DialogDescription>لا توجد منتجات لطباعة الملصقات</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">إغلاق</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>طباعة ملصقات المنتجات</DialogTitle>
          <DialogDescription>
            اختر كمية الملصقات لكل متغير واطبع الملصقات
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 max-h-[60vh]">
          <div className="flex justify-between items-center">
            <Button onClick={setAllQuantitiesToStock} variant="outline">
              تعيين الكميات حسب المخزون
            </Button>
            <p className="text-sm text-muted-foreground">
              إجمالي الملصقات: {totalLabels}
            </p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-4">
              {products.map(product => (
                <div key={product.id} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">{product.name}</h4>
                  {product.variants && product.variants.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {product.variants.map(variant => {
                        const sku = `${product.id}-${variant.id}`;
                        const currentQuantity = labelQuantities[sku] || 0;
                        return (
                          <div key={variant.id} className="flex items-center gap-2 p-2 border rounded">
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {variant.colors?.name || variant.color || 'غير محدد'} / {variant.sizes?.name || variant.size || 'غير محدد'}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {variant.barcode || 'سيتم التوليد تلقائياً'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(sku, currentQuantity - 1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input 
                                type="number" 
                                value={currentQuantity} 
                                onChange={(e) => handleQuantityChange(sku, parseInt(e.target.value) || 0)}
                                className="w-16 h-8 text-center"
                                min="0"
                              />
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(sku, currentQuantity + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">منتج عام</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {product.barcode || 'سيتم التوليد تلقائياً'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(product.id, (labelQuantities[product.id] || 0) - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input 
                          type="number" 
                          value={labelQuantities[product.id] || 0} 
                          onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-center"
                          min="0"
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(product.id, (labelQuantities[product.id] || 0) + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {labelsToPrint.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h5 className="font-medium mb-2">معاينة الملصقات</h5>
              <ScrollArea className="h-32">
                <div className="grid grid-cols-6 gap-2">
                  {labelsToPrint.slice(0, 12).map((label, index) => (
                    <div key={index} className="border rounded p-1 text-xs bg-white">
                      <p className="font-medium truncate">{label.name}</p>
                      <p className="text-muted-foreground">{label.color}/{label.size}</p>
                      <p className="font-mono text-xs">{label.barcode}</p>
                    </div>
                  ))}
                  {labelsToPrint.length > 12 && (
                    <div className="border rounded p-1 text-xs bg-muted flex items-center justify-center">
                      +{labelsToPrint.length - 12} ملصق
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <div className="flex gap-2">
              <Button 
                onClick={handlePrint} 
                disabled={totalLabels === 0}
                className="bg-primary hover:bg-primary/90"
              >
                <Printer className="w-4 h-4 ml-2" />
                طباعة ({totalLabels} ملصق)
              </Button>
            </div>
          </div>
        </DialogFooter>
        
        {/* معاينة الطباعة المخفية */}
        <div className="hidden">
          <LabelPreview ref={printComponentRef} labelsToPrint={labelsToPrint} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintLabelsDialog;