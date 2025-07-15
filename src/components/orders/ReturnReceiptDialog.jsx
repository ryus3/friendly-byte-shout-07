import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackageCheck, QrCode, Loader2, CheckCircle, Package } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Html5QrcodeScanner } from 'html5-qrcode';

const ReturnReceiptDialog = ({ open, onClose, order, onSuccess }) => {
  const [returnItems, setReturnItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerMode, setScannerMode] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');

  useEffect(() => {
    if (order?.items) {
      // تهيئة قائمة المنتجات المرجعة
      setReturnItems(order.items.map(item => ({
        ...item,
        returnQuantity: item.quantity // افتراضياً جميع الكمية مرجعة
      })));
    }
  }, [order]);

  useEffect(() => {
    return () => {
      // تنظيف الماسح عند إغلاق المكون
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scanner]);

  const startScanner = () => {
    setScannerMode(true);
    
    // إنشاء ماسح باركود جديد
    const qrScanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      false
    );

    qrScanner.render(
      (decodedText) => {
        // نجح المسح
        handleBarcodeScanned(decodedText);
        qrScanner.clear().catch(console.error);
        setScannerMode(false);
      },
      (error) => {
        // خطأ في المسح - تجاهل
        console.log('QR scan error:', error);
      }
    );

    setScanner(qrScanner);
  };

  const stopScanner = () => {
    if (scanner) {
      scanner.clear().catch(console.error);
      setScanner(null);
    }
    setScannerMode(false);
  };

  const handleBarcodeScanned = (barcode) => {
    // البحث عن المنتج بالباركود
    const item = returnItems.find(item => 
      item.barcode === barcode || 
      item.product?.barcode === barcode ||
      item.variant?.barcode === barcode
    );

    if (item) {
      // تحديد المنتج كمستلم
      setReturnItems(prev => 
        prev.map(i => 
          i.id === item.id 
            ? { ...i, isReceived: true }
            : i
        )
      );
      
      toast({
        title: "تم المسح بنجاح",
        description: `تم تحديد ${item.name} كمستلم`,
        variant: "success"
      });
    } else {
      toast({
        title: "باركود غير صحيح",
        description: "لم يتم العثور على هذا المنتج في الطلب المرجع",
        variant: "destructive"
      });
    }
  };

  const handleManualBarcodeSubmit = () => {
    if (manualBarcode.trim()) {
      handleBarcodeScanned(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    setReturnItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, returnQuantity: Math.max(0, Math.min(newQuantity, item.quantity)) }
          : item
      )
    );
  };

  const toggleItemReceived = (itemId) => {
    setReturnItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, isReceived: !item.isReceived }
          : item
      )
    );
  };

  const handleProcessReturn = async () => {
    try {
      setIsProcessing(true);

      // تحديث المخزون لكل منتج مستلم
      for (const item of returnItems) {
        if (item.isReceived && item.returnQuantity > 0) {
          // إضافة الكمية المرجعة إلى المخزون
          const { error: inventoryError } = await supabase
            .from('inventory')
            .update({
              quantity: supabase.sql`quantity + ${item.returnQuantity}`,
              updated_at: new Date().toISOString()
            })
            .eq('product_id', item.product_id)
            .eq('variant_id', item.variant_id || null);

          if (inventoryError) {
            throw new Error(`خطأ في تحديث المخزون للمنتج ${item.name}: ${inventoryError.message}`);
          }
        }
      }

      // تحديث حالة الطلب إلى "مستلم الراجع"
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'return_received',
          updated_at: new Date().toISOString(),
          notes: `${order.notes || ''}\n\nتم استلام الراجع في ${new Date().toLocaleString('ar-EG')}`
        })
        .eq('id', order.id);

      if (orderError) {
        throw new Error(`خطأ في تحديث حالة الطلب: ${orderError.message}`);
      }

      toast({
        title: "تم استلام الراجع بنجاح",
        description: "تم إرجاع المنتجات إلى المخزون وتحديث حالة الطلب",
        variant: "success"
      });

      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      console.error('خطأ في معالجة الراجع:', error);
      toast({
        title: "خطأ في استلام الراجع",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const receivedItemsCount = returnItems.filter(item => item.isReceived).length;
  const totalReturnValue = returnItems.reduce((sum, item) => 
    item.isReceived ? sum + (item.unit_price * item.returnQuantity) : sum, 0
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-green-500" />
            استلام الطلب المرجع - {order?.tracking_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* معلومات الطلب */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">اسم الزبون:</span>
                  <p className="font-medium">{order?.customer_name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">إجمالي الطلب:</span>
                  <p className="font-medium">{order?.total_amount?.toLocaleString()} د.ع</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">حالة الاستلام:</span>
                  <p className="font-medium">
                    {receivedItemsCount} من {returnItems.length} منتج
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* أدوات المسح */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">أدوات المسح والاستلام</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={scannerMode ? stopScanner : startScanner}
                    className="flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    {scannerMode ? 'إيقاف المسح' : 'مسح باركود'}
                  </Button>
                </div>
              </div>

              {/* مسح يدوي */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="manualBarcode">إدخال باركود يدوياً</Label>
                  <Input
                    id="manualBarcode"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    placeholder="أدخل الباركود هنا..."
                    onKeyPress={(e) => e.key === 'Enter' && handleManualBarcodeSubmit()}
                  />
                </div>
                <Button 
                  onClick={handleManualBarcodeSubmit}
                  disabled={!manualBarcode.trim()}
                  className="mt-6"
                >
                  تأكيد
                </Button>
              </div>

              {/* منطقة الماسح */}
              {scannerMode && (
                <div className="border rounded-lg p-4">
                  <div id="qr-reader" className="w-full"></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* قائمة المنتجات */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">منتجات الطلب المرجع</h3>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {returnItems.map((item) => (
                    <Card key={item.id} className={`transition-all ${item.isReceived ? 'bg-green-50 border-green-200' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{item.name}</h4>
                              {item.isReceived && (
                                <Badge variant="success" className="text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  مستلم
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              <span>الكمية الأصلية: {item.quantity}</span>
                              {item.variant?.color?.name && (
                                <span className="mx-2">• اللون: {item.variant.color.name}</span>
                              )}
                              {item.variant?.size?.name && (
                                <span className="mx-2">• المقاس: {item.variant.size.name}</span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              سعر الوحدة: {item.unit_price?.toLocaleString()} د.ع
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="text-center">
                              <Label className="text-xs">كمية الراجع</Label>
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={item.returnQuantity}
                                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                            </div>
                            <Button
                              variant={item.isReceived ? "success" : "outline"}
                              size="sm"
                              onClick={() => toggleItemReceived(item.id)}
                              className="flex items-center gap-1"
                            >
                              <Package className="w-4 h-4" />
                              {item.isReceived ? 'مستلم' : 'استلام'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ملخص الاستلام */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">المنتجات المستلمة</p>
                  <p className="text-2xl font-bold text-green-600">{receivedItemsCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
                  <p className="text-2xl font-bold">{returnItems.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">قيمة المسترد</p>
                  <p className="text-2xl font-bold text-blue-600">{totalReturnValue.toLocaleString()} د.ع</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={handleProcessReturn}
            disabled={isProcessing || receivedItemsCount === 0}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                تأكيد استلام الراجع ({receivedItemsCount} منتج)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnReceiptDialog;