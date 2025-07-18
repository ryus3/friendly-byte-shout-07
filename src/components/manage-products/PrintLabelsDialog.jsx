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
          .print-area {
            display: block !important;
          }
          .label-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8mm;
            padding: 10mm;
          }
          .label-card {
            width: 60mm;
            height: 40mm;
            border: 1px solid #000;
            padding: 2mm;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .label-content {
            text-align: center;
          }
          .label-product-name {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 2mm;
            line-height: 1.2;
          }
          .label-variant-info {
            font-size: 8px;
            margin-bottom: 2mm;
          }
          .label-barcode-container {
            margin: 2mm 0;
            display: flex;
            justify-content: center;
          }
          .barcode-placeholder {
            font-size: 8px;
            color: #666;
            padding: 5mm 0;
          }
          .label-price {
            font-size: 9px;
            font-weight: bold;
            margin-top: 1mm;
          }
        }
        
        @media screen {
          .label-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 16px;
          }
          .label-card {
            width: 180px;
            height: 120px;
            border: 1px solid #e2e8f0;
            padding: 8px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white;
          }
          .label-content {
            text-align: center;
          }
          .label-product-name {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 4px;
            line-height: 1.2;
          }
          .label-variant-info {
            font-size: 10px;
            margin-bottom: 4px;
            color: #666;
          }
          .label-barcode-container {
            margin: 4px 0;
            display: flex;
            justify-content: center;
          }
          .barcode-placeholder {
            font-size: 8px;
            color: #666;
            padding: 8px 0;
          }
          .label-price {
            font-size: 11px;
            font-weight: bold;
            margin-top: 2px;
          }
        }
      `}</style>
      <div className="label-grid">
        {labelsToPrint.map((label, index) => (
          <div key={index} className="label-card">
            <div className="label-content">
              <p className="label-product-name">{label.name}</p>
              <p className="label-variant-info">{label.color} / {label.size}</p>
              <div className="label-barcode-container">
                {label.barcode && label.barcode.trim() !== '' && label.barcode !== 'لا يوجد باركود' ? (
                  <Barcode 
                    value={label.barcode} 
                    height={25} 
                    width={1.2} 
                    fontSize={8}
                    margin={2}
                    displayValue={true}
                  />
                ) : (
                  <div className="barcode-placeholder">يتم توليد الباركود تلقائياً</div>
                )}
              </div>
              <p className="label-price">{(label.price || 0).toLocaleString()} د.ع</p>
            </div>
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
    pageStyle: `@page { size: A4; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; } }`
  });

  const handleQuantityChange = (sku, value) => {
    setLabelQuantities(prev => ({ ...prev, [sku]: Math.max(0, value) }));
  };
  
  const labelsToPrint = useMemo(() => {
    const labels = [];
    
    if (!products || products.length === 0) return labels;
    
    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        // منتج بمتغيرات
        product.variants.forEach(variant => {
          const sku = `${product.id}-${variant.id}`;
          const quantity = labelQuantities[sku] || 1;
          
          // توليد باركود إذا لم يكن موجود أو كان فارغ
          let barcode = variant.barcode || product.barcode;
          if (!barcode || barcode.trim() === '') {
            barcode = generateUniqueBarcode(
              product.name,
              variant.colors?.name || variant.color || 'DEFAULT',
              variant.sizes?.name || variant.size || 'DEFAULT',
              product.id
            );
          }
          
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
        
        // توليد باركود إذا لم يكن موجود أو كان فارغ
        let barcode = product.barcode;
        if (!barcode || barcode.trim() === '') {
          barcode = generateUniqueBarcode(
            product.name,
            'DEFAULT',
            'DEFAULT',
            product.id
          );
        }
        
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
    
    console.log('🏷️ ملصقات محضرة للطباعة:', labels);
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
                              <p className="text-xs text-muted-foreground">
                                الباركود: {variant.barcode || 'سيتم التوليد تلقائياً'}
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
                        <p className="text-xs text-muted-foreground">
                          الباركود: {product.barcode || 'سيتم التوليد تلقائياً'}
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