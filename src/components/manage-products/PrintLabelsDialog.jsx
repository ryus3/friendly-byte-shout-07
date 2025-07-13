import React, { useState, useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, Minus, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const LabelPreview = React.forwardRef(({ labelsToPrint }, ref) => {
  return (
    <div ref={ref} className="print-area">
      <div className="label-grid">
        {labelsToPrint.map((label, index) => (
          <div key={index} className="label-card">
            <div className="label-content">
              <p className="label-product-name">{label.name}</p>
              <p className="label-variant-info">{label.color} / {label.size}</p>
              <div className="label-barcode-container">
                <Barcode value={label.barcode} height={25} width={1.2} fontSize={0} margin={2} />
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
    if (products) {
        products.forEach(product => {
            if (product && product.variants && product.variants.length > 0) {
                product.variants.forEach(variant => {
                    const sku = variant.barcode || `${product.name}-${variant.color?.name || 'DEF'}-${variant.size?.name || 'DEF'}`;
                    const quantity = labelQuantities[sku] || 0;
                    for (let i = 0; i < quantity; i++) {
                        labels.push({
                            name: product.name,
                            color: variant.color?.name || variant.color || 'غير محدد',
                            size: variant.size?.name || variant.size || 'غير محدد',
                            price: variant.price || product.base_price || product.price || 0,
                            barcode: variant.barcode || sku
                        });
                    }
                });
            }
        });
    }
    return labels;
  }, [products, labelQuantities]);

  const setAllQuantitiesToStock = () => {
    const newQuantities = {};
    products.forEach(p => {
      if(p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const sku = v.barcode || `${p.name}-${v.color?.name || 'DEF'}-${v.size?.name || 'DEF'}`;
          const stockQuantity = v.inventory?.[0]?.quantity || v.quantity || 1;
          newQuantities[sku] = stockQuantity;
        });
      }
    });
    setLabelQuantities(newQuantities);
  };
  
  const clearAllQuantities = () => {
    setLabelQuantities({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>طباعة ملصقات الباركود</DialogTitle>
          <DialogDescription>
            حدد كمية الملصقات لكل متغير ثم اضغط على طباعة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh]">
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">تحديد الكميات</h4>
                <div className="flex gap-2">
                    <Button onClick={setAllQuantitiesToStock} variant="outline" size="sm">تحديد الكل حسب المخزون</Button>
                    <Button onClick={clearAllQuantities} variant="destructive" size="sm">تصفير الكل</Button>
                </div>
            </div>
            <ScrollArea className="border rounded-lg p-4">
              <div className="space-y-4">
                {products && products.map(product => (
                  <div key={product.id}>
                    <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                    <div className="space-y-2">
                      {product.variants && product.variants.length > 0 ? product.variants.map(variant => {
                        const sku = variant.barcode || `${product.name}-${variant.color?.name || 'DEF'}-${variant.size?.name || 'DEF'}`;
                        const stockQuantity = variant.inventory?.[0]?.quantity || variant.quantity || 0;
                        return (
                          <div key={sku} className="grid grid-cols-3 gap-2 items-center">
                            <Label className="col-span-1">
                              {variant.color?.name || variant.color || 'غير محدد'}, {variant.size?.name || variant.size || 'غير محدد'} 
                              <span className="text-muted-foreground">({stockQuantity})</span>
                            </Label>
                            <div className="col-span-2 flex items-center gap-2">
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(sku, (labelQuantities[sku] || 0) - 1)}><Minus className="w-4 h-4" /></Button>
                              <Input
                                type="number"
                                className="w-20 text-center"
                                value={labelQuantities[sku] || 0}
                                onChange={(e) => handleQuantityChange(sku, parseInt(e.target.value) || 0)}
                              />
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(sku, (labelQuantities[sku] || 0) + 1)}><Plus className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        );
                      }) : <p className="text-muted-foreground">لا توجد متغيرات لهذا المنتج</p>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div>
            <h4 className="font-semibold mb-2">معاينة الطباعة</h4>
            <div className="border rounded-lg p-4 h-[55vh] overflow-auto bg-muted">
                <div className="label-grid">
                 {labelsToPrint.slice(0, 100).map((label, index) => (
                    <div key={index} className="label-card bg-white text-black">
                      <div className="label-content">
                        <p className="label-product-name">{label.name}</p>
                        <p className="label-variant-info">{label.color} / {label.size}</p>
                        <div className="label-barcode-container">
                          <Barcode value={label.barcode} height={25} width={1.2} fontSize={0} margin={2} />
                        </div>
                        <p className="label-price">{(label.price || 0).toLocaleString()} د.ع</p>
                      </div>
                    </div>
                    ))}
                </div>
                {labelsToPrint.length > 100 && <p className="text-center text-muted-foreground mt-4">... وأكثر</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <div className="w-full flex justify-between items-center">
            <span className="font-semibold">إجمالي الملصقات: {labelsToPrint.length}</span>
            <div>
              <DialogClose asChild>
                <Button variant="outline">إلغاء</Button>
              </DialogClose>
              <Button onClick={handlePrint} className="mr-2">
                <Printer className="w-4 h-4 ml-2" />
                طباعة
              </Button>
            </div>
          </div>
        </DialogFooter>
        <div className="hidden">
           <LabelPreview ref={printComponentRef} labelsToPrint={labelsToPrint} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintLabelsDialog;