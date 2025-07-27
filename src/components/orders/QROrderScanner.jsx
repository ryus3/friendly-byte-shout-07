import React, { useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Search, Package, RotateCcw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const QROrderScanner = ({ isOpen, onClose, onOrderFound, onUpdateOrderStatus }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [foundOrder, setFoundOrder] = useState(null);
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // البحث عن طلب بـ QR ID
  const searchOrderByQR = async (qrId) => {
    try {
      setError('');
      
      // البحث في الطلبات العادية
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name),
            product_variants (
              *,
              colors (name),
              sizes (name)
            )
          )
        `)
        .eq('qr_id', qrId)
        .single();

      if (orderError && orderError.code !== 'PGRST116') {
        throw orderError;
      }

      if (order) {
        setFoundOrder(order);
        if (onOrderFound) onOrderFound(order);
        return order;
      }

      // إذا لم يوجد في الطلبات العادية، البحث في طلبات شركات التوصيل
      setError('الطلب غير موجود في النظام أو QR ID غير صحيح');
      return null;

    } catch (error) {
      console.error('Error searching for order:', error);
      setError('حدث خطأ أثناء البحث عن الطلب');
      return null;
    }
  };

  // بدء المسح
  const startScanning = () => {
    setIsScanning(true);
    setError('');
    setFoundOrder(null);

    // إنشاء ماسح QR
    setTimeout(() => {
      html5QrCodeRef.current = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 300, height: 300 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          supportedScanTypes: []
        },
        false
      );

    // عند نجاح المسح
    const onScanSuccess = async (decodedText) => {
      html5QrCodeRef.current?.clear();
      setIsScanning(false);
      
      // البحث عن الطلب
      await searchOrderByQR(decodedText);
    };

    // عند فشل المسح
    const onScanFailure = (error) => {
      // لا نعرض أخطاء المسح المستمرة
    };

      html5QrCodeRef.current.render(onScanSuccess, onScanFailure);
    }, 100);
  };

  // إيقاف المسح
  const stopScanning = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.clear();
    }
    setIsScanning(false);
  };

  // البحث اليدوي
  const handleManualSearch = async () => {
    if (!manualInput.trim()) {
      setError('يرجى إدخال QR ID');
      return;
    }
    await searchOrderByQR(manualInput.trim());
  };

  // التعامل مع الطلبات الراجعة
  const handleReturnedOrder = async (action) => {
    if (!foundOrder) return;

    try {
      if (action === 'return_to_stock') {
        await onUpdateOrderStatus(foundOrder.id, 'returned_in_stock');
        toast({
          title: "تم الاستلام",
          description: "تم استلام الطلب الراجع وإرجاعه للمخزن",
          variant: "success"
        });
      }
      
      setFoundOrder(null);
      setManualInput('');
      onClose();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث حالة الطلب",
        variant: "destructive"
      });
    }
  };

  // تنظيف عند الإغلاق
  const handleClose = () => {
    stopScanning();
    setFoundOrder(null);
    setManualInput('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 gradient-text">
            <QrCode className="h-5 w-5" />
            مسح QR للطلبات
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!foundOrder ? (
            <>
              {/* خيارات المسح */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={startScanning}
                  disabled={isScanning}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                  variant={isScanning ? "secondary" : "default"}
                >
                  <QrCode className="h-4 w-4" />
                  {isScanning ? 'جاري المسح...' : 'مسح QR'}
                </Button>
                
                <Button
                  onClick={stopScanning}
                  disabled={!isScanning}
                  variant="outline"
                >
                  إيقاف المسح
                </Button>
              </div>

              {/* المسح بالكاميرا */}
              {isScanning && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div id="qr-reader" ref={scannerRef}></div>
                </div>
              )}

              {/* البحث اليدوي */}
              <div className="space-y-2">
                <label className="text-sm font-medium">أو أدخل QR ID يدوياً:</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="QR-ORD-123456"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                  />
                  <Button onClick={handleManualSearch} size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* عرض الأخطاء */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            /* عرض تفاصيل الطلب المكتشف */
            <div className="space-y-4">
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  تم العثور على الطلب: <strong>#{foundOrder.order_number}</strong>
                </AlertDescription>
              </Alert>

              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div><strong>العميل:</strong> {foundOrder.customer_name}</div>
                <div><strong>الهاتف:</strong> {foundOrder.customer_phone}</div>
                <div><strong>الحالة:</strong> {getStatusLabel(foundOrder.status)}</div>
                <div><strong>المبلغ:</strong> {foundOrder.final_amount?.toLocaleString()} د.ع</div>
                <div><strong>QR ID:</strong> {foundOrder.qr_id}</div>
              </div>

              {/* أزرار خاصة للطلبات الراجعة */}
              {(foundOrder.status === 'returned' || foundOrder.status === 'cancelled') && (
                <div className="space-y-2">
                  <Alert>
                    <RotateCcw className="h-4 w-4" />
                    <AlertDescription>
                      هذا طلب راجع. ماذا تريد أن تفعل؟
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={() => handleReturnedOrder('return_to_stock')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Package className="h-4 w-4 ml-2" />
                      استلام في المخزن
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setFoundOrder(null)}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 ml-2" />
                البحث عن طلب آخر
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// دالة مساعدة لعرض اسم الحالة
const getStatusLabel = (status) => {
  const labels = {
    'pending': 'قيد التجهيز',
    'shipped': 'تم الشحن',
    'delivery': 'قيد التوصيل',
    'delivered': 'تم التسليم',
    'completed': 'مكتمل',
    'returned': 'راجعة',
    'returned_in_stock': 'راجع للمخزن',
    'cancelled': 'ملغي'
  };
  return labels[status] || status;
};

export default QROrderScanner;