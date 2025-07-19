import React, { useState, useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
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
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 15px;
          align-items: center;
        }
        
        .label-card {
          width: 300px;
          height: 150px;
          border: 3px solid #000000;
          padding: 8px;
          page-break-inside: avoid;
          display: flex;
          align-items: center;
          border-radius: 0;
          background: #ffffff;
          font-family: Arial, sans-serif;
          direction: ltr;
        }
        
        .qr-section {
          flex-shrink: 0;
          margin-right: 12px;
        }
        
        .product-info {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
          align-items: center;
        }
        
        .label-product-name {
          font-size: 20px;
          font-weight: 900;
          margin-bottom: 3px;
          line-height: 1.1;
          color: #000000;
          font-family: 'Arial Black', Arial, sans-serif;
        }
        
        .label-variant-info {
          font-size: 14px;
          margin-bottom: 8px;
          color: #000000;
          font-weight: bold;
          line-height: 1.1;
        }
        
        .label-price {
          font-size: 21px;
          font-weight: 900;
          color: #000000;
          line-height: 1.1;
        }
        
        @media print {
          .print-area {
            display: block !important;
          }
          body {
            -webkit-print-color-adjust: exact;
          }
          .label-grid {
            align-items: center !important;
          }
        }
      `}</style>
      <div className="label-grid">
        {labelsToPrint.map((label, index) => (
          <div key={index} className="label-card">
            <div className="qr-section">
              <QRCodeSVG
                value={label.qrData}
                size={120}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="product-info">
              <h3 className="label-product-name">{label.name} RYUS</h3>
              <p className="label-variant-info">{label.size} / {label.color}</p>
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
    pageStyle: `@page { size: A4 portrait; margin: 8mm; } @media print { body { -webkit-print-color-adjust: exact; } .label-grid { align-items: center !important; } }`
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
      variants: product.variants?.map(variant => {
        // إنشاء QR Code بسيط وحقيقي
        const qrData = variant.barcode || variant.id;
        
        return {
          sku: variant.barcode || `${product.id}-${variant.id}`,
          color: variant.colors?.name || variant.color || 'افتراضي',
          size: variant.sizes?.name || variant.size || 'افتراضي',
          price: variant.price || product.base_price || 0,
          quantity: variant.inventory?.[0]?.quantity || variant.quantity || 0,
          barcode: variant.barcode || variant.id,
          qrData: qrData
        };
      }) || []
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
                            barcode: variant.barcode || variant.sku,
                            qrData: variant.qrData
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
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] flex flex-col p-0 gap-0">
        <div className="p-6 pb-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              طباعة ملصقات QR
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              حدد كمية الملصقات لكل متغير واحصل على ملصقات QR احترافية قابلة للقراءة
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-6 pt-2 overflow-hidden">
          {/* قسم تحديد الكميات */}
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                تحديد الكميات
              </h4>
              <div className="flex gap-2">
                <Button 
                  onClick={setAllQuantitiesToStock} 
                  variant="outline" 
                  size="sm"
                  className="hover:bg-primary/10 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                  </svg>
                  حسب المخزون
                </Button>
                <Button 
                  onClick={clearAllQuantities} 
                  variant="destructive" 
                  size="sm"
                  className="hover:bg-destructive/90 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  تصفير الكل
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 border border-border rounded-xl p-4 bg-card max-h-[450px]">
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
            <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              معاينة الطباعة
            </h4>
            <ScrollArea className="flex-1 border border-border rounded-xl bg-gray-50 max-h-[450px]">
              <div className="p-4">
                <style>{`
                  .simple-label-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    padding: 15px;
                    align-items: center;
                  }
                  
                  .simple-label-card {
                    width: 300px;
                    height: 150px;
                    border: 3px solid #000000;
                    padding: 8px;
                    display: flex;
                    align-items: center;
                    border-radius: 0;
                    background: #ffffff;
                    font-family: Arial, sans-serif;
                    direction: ltr;
                  }
                  
                  .simple-qr-section {
                    flex-shrink: 0;
                    margin-right: 12px;
                  }
                  
                  .simple-product-info {
                    flex: 1;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    height: 100%;
                    align-items: center;
                  }
                  
                  .simple-label-product-name {
                    font-size: 20px;
                    font-weight: 900;
                    margin-bottom: 3px;
                    line-height: 1.1;
                    color: #000000;
                    font-family: 'Arial Black', Arial, sans-serif;
                  }
                  
                  .simple-label-variant-info {
                    font-size: 14px;
                    margin-bottom: 8px;
                    color: #000000;
                    font-weight: bold;
                    line-height: 1.1;
                  }
                  
                  .simple-label-price {
                    font-size: 21px;
                    font-weight: 900;
                    color: #000000;
                    line-height: 1.1;
                  }
                `}</style>
                <div className="simple-label-grid">
                  {labelsToPrint.map((label, index) => (
                    <div key={index} className="simple-label-card">
                      <div className="simple-qr-section">
                        <QRCodeSVG
                          value={label.qrData}
                          size={120}
                          level="M"
                          includeMargin={false}
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                      </div>
                      <div className="simple-product-info">
                        <h3 className="simple-label-product-name">{label.name} RYUS</h3>
                        <p className="simple-label-variant-info">{label.size} / {label.color}</p>
                        <p className="simple-label-price">{label.price.toLocaleString()} د.ع</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {labelsToPrint.length > 0 && (
                  <div className="text-center text-muted-foreground mt-4 p-3 bg-white rounded-lg border">
                    <span className="font-medium">إجمالي الملصقات: {labelsToPrint.length}</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="p-6 pt-4 border-t">
          <DialogFooter className="flex-shrink-0">
            <div className="w-full flex justify-between items-center">
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-muted-foreground">إجمالي الملصقات:</span>
                <span className="text-primary bg-primary/10 px-2 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {labelsToPrint.length}
                </span>
              </div>
              <div className="flex gap-3">
                <DialogClose asChild>
                  <Button variant="outline" className="hover:bg-muted/80 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    إلغاء
                  </Button>
                </DialogClose>
                <Button 
                  onClick={handlePrint} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-2"
                  disabled={labelsToPrint.length === 0}
                >
                  <Printer className="w-4 h-4" />
                  طباعة ({labelsToPrint.length})
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
        
        <div className="hidden">
           <LabelPreview ref={printComponentRef} labelsToPrint={labelsToPrint} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintLabelsDialog;