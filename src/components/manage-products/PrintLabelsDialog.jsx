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
      <style>{`
        .label-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6mm;
          padding: 8mm;
          justify-items: center;
        }
        
        .label-card {
          width: 50mm;
          height: 35mm;
          border: 1.5px solid #2563eb;
          padding: 2mm;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: white;
          border-radius: 4mm;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .label-content {
          text-align: center;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        .label-product-name {
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 1mm;
          line-height: 1.1;
          color: #1e40af;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .label-variant-info {
          font-size: 9px;
          margin-bottom: 2mm;
          color: #64748b;
          font-weight: 600;
          background: #f1f5f9;
          padding: 1mm;
          border-radius: 2mm;
        }
        
        .label-barcode-container {
          margin: 1mm 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .label-barcode-number {
          font-size: 6px;
          color: #475569;
          margin-top: 1mm;
          font-family: monospace;
          letter-spacing: 0.5px;
        }
        
        .label-price {
          font-size: 10px;
          font-weight: 800;
          margin-top: 1mm;
          color: #dc2626;
          background: #fee2e2;
          padding: 1mm;
          border-radius: 2mm;
          border: 1px solid #fca5a5;
        }
        
        @media print {
          .print-area {
            display: block !important;
          }
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="label-grid">
        {labelsToPrint.map((label, index) => (
          <div key={index} className="label-card">
            <div className="label-content">
              <h3 className="label-product-name">{label.name}</h3>
              <p className="label-variant-info">{label.color} • {label.size}</p>
              <div className="label-barcode-container">
                <Barcode 
                  value={label.barcode} 
                  height={20} 
                  width={1.5} 
                  fontSize={0} 
                  margin={0}
                  background="transparent"
                  lineColor="#1e40af"
                  displayValue={false}
                />
                <p className="label-barcode-number">{label.barcode}</p>
              </div>
              <p className="label-price">{label.price.toLocaleString()} د.ع</p>
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
  
  // تحويل البيانات إلى الشكل المطلوب
  const processedProducts = useMemo(() => {
    if (!products) return [];
    
    return products.map(product => ({
      id: product.id,
      name: product.name,
      variants: product.variants?.map(variant => ({
        sku: variant.barcode || `${product.id}-${variant.id}`,
        color: variant.colors?.name || variant.color || 'غير محدد',
        size: variant.sizes?.name || variant.size || 'غير محدد',
        price: variant.price || product.base_price || 0,
        quantity: variant.inventory?.[0]?.quantity || variant.quantity || 0,
        barcode: variant.barcode || `${product.id}-${variant.id}`
      })) || []
    }));
  }, [products]);
  
  const labelsToPrint = useMemo(() => {
    const labels = [];
    if (processedProducts) {
        processedProducts.forEach(product => {
            if (product && product.variants) {
                product.variants.forEach(variant => {
                    const quantity = labelQuantities[variant.sku] || 0;
                    for (let i = 0; i < quantity; i++) {
                        labels.push({
                            name: product.name,
                            color: variant.color,
                            size: variant.size,
                            price: variant.price,
                            barcode: variant.barcode || variant.sku
                        });
                    }
                });
            }
        });
    }
    return labels;
  }, [processedProducts, labelQuantities]);

  const setAllQuantitiesToStock = () => {
    const newQuantities = {};
    processedProducts.forEach(p => {
      p.variants.forEach(v => {
        newQuantities[v.sku] = v.quantity;
      });
    });
    setLabelQuantities(newQuantities);
  };
  
  const clearAllQuantities = () => {
    setLabelQuantities({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 border-b pb-4">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            🏷️ طباعة ملصقات الباركود
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            حدد كمية الملصقات لكل متغير واحصل على ملصقات احترافية قابلة للقراءة
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 py-4 overflow-hidden">
          {/* قسم تحديد الكميات */}
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-semibold text-foreground">📊 تحديد الكميات</h4>
              <div className="flex gap-2">
                <Button 
                  onClick={setAllQuantitiesToStock} 
                  variant="outline" 
                  size="sm"
                  className="hover:bg-primary/10 transition-colors"
                >
                  📦 حسب المخزون
                </Button>
                <Button 
                  onClick={clearAllQuantities} 
                  variant="destructive" 
                  size="sm"
                  className="hover:bg-destructive/90 transition-colors"
                >
                  🗑️ تصفير الكل
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 border border-border rounded-xl p-4 bg-card">
              <div className="space-y-6">
                {processedProducts && processedProducts.map(product => (
                  <div key={product.id} className="bg-muted/30 rounded-lg p-4 border border-border/50">
                    <h3 className="font-bold text-lg mb-3 text-primary">{product.name}</h3>
                    <div className="grid gap-3">
                      {product.variants.map(variant => (
                        <div key={variant.sku} className="bg-background rounded-lg p-3 border border-border/30">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex-1">
                              <span className="font-medium text-foreground">{variant.color}</span>
                              <span className="mx-2 text-muted-foreground">•</span>
                              <span className="font-medium text-foreground">{variant.size}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                (متوفر: {variant.quantity})
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-destructive/10" 
                              onClick={() => handleQuantityChange(variant.sku, (labelQuantities[variant.sku] || 0) - 1)}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Input
                              type="number"
                              className="w-16 text-center font-medium"
                              value={labelQuantities[variant.sku] || 0}
                              onChange={(e) => handleQuantityChange(variant.sku, parseInt(e.target.value) || 0)}
                            />
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-primary/10" 
                              onClick={() => handleQuantityChange(variant.sku, (labelQuantities[variant.sku] || 0) + 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* قسم معاينة الطباعة */}
          <div className="flex flex-col space-y-4">
            <h4 className="text-lg font-semibold text-foreground">👀 معاينة الطباعة</h4>
            <div className="flex-1 border border-border rounded-xl p-4 overflow-auto bg-muted/10">
              <style>{`
                .preview-label-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                  gap: 12px;
                  padding: 12px;
                }
                
                .preview-label-card {
                  width: 120px;
                  height: 85px;
                  border: 2px solid hsl(var(--primary));
                  padding: 6px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  border-radius: 8px;
                  background: white;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  transition: transform 0.2s ease;
                }
                
                .preview-label-card:hover {
                  transform: scale(1.05);
                }
                
                .preview-label-content {
                  text-align: center;
                  height: 100%;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                
                .preview-label-product-name {
                  font-size: 9px;
                  font-weight: 800;
                  margin-bottom: 2px;
                  line-height: 1.1;
                  color: hsl(var(--primary));
                  text-transform: uppercase;
                }
                
                .preview-label-variant-info {
                  font-size: 7px;
                  margin-bottom: 3px;
                  color: #64748b;
                  font-weight: 600;
                  background: #f1f5f9;
                  padding: 1px 3px;
                  border-radius: 3px;
                }
                
                .preview-label-barcode-container {
                  margin: 2px 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                }
                
                .preview-label-barcode-number {
                  font-size: 5px;
                  color: #475569;
                  margin-top: 1px;
                  font-family: monospace;
                }
                
                .preview-label-price {
                  font-size: 8px;
                  font-weight: 800;
                  color: #dc2626;
                  background: #fee2e2;
                  padding: 1px 3px;
                  border-radius: 3px;
                  border: 1px solid #fca5a5;
                }
              `}</style>
              <div className="preview-label-grid">
                {labelsToPrint.slice(0, 50).map((label, index) => (
                  <div key={index} className="preview-label-card">
                    <div className="preview-label-content">
                      <h3 className="preview-label-product-name">{label.name}</h3>
                      <p className="preview-label-variant-info">{label.color} • {label.size}</p>
                      <div className="preview-label-barcode-container">
                        <Barcode 
                          value={label.barcode} 
                          height={12} 
                          width={1.2} 
                          fontSize={0} 
                          margin={0}
                          background="transparent"
                          lineColor="hsl(var(--primary))"
                          displayValue={false}
                        />
                        <p className="preview-label-barcode-number">{label.barcode}</p>
                      </div>
                      <p className="preview-label-price">{label.price.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                ))}
              </div>
              {labelsToPrint.length > 50 && (
                <p className="text-center text-muted-foreground mt-4 p-4 bg-muted/50 rounded-lg">
                  📄 عرض أول 50 ملصق من إجمالي {labelsToPrint.length} ملصق
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span className="text-muted-foreground">إجمالي الملصقات:</span>
              <span className="text-primary bg-primary/10 px-3 py-1 rounded-full">
                {labelsToPrint.length}
              </span>
            </div>
            <div className="flex gap-3">
              <DialogClose asChild>
                <Button variant="outline" className="hover:bg-muted/80">
                  ❌ إلغاء
                </Button>
              </DialogClose>
              <Button 
                onClick={handlePrint} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={labelsToPrint.length === 0}
              >
                <Printer className="w-4 h-4 ml-2" />
                🖨️ طباعة ({labelsToPrint.length})
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