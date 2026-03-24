import React, { useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Search, Package, RotateCcw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useDuplicateCustomerAlert } from '@/hooks/useDuplicateCustomerAlert';

const QROrderScanner = ({ isOpen, onClose, onOrderFound, onUpdateOrderStatus }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [foundOrder, setFoundOrder] = useState(null);
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  // تنبيه عميل مكرر عند العثور على طلب يحتوي رقم هاتف
  useDuplicateCustomerAlert(foundOrder?.customer_phone, { trigger: !!foundOrder });

  // البحث عن طلب بالرقم الموحد (tracking_number أولاً، ثم order_number، ثم qr_id)
  const searchOrderByQR = async (searchValue) => {
    try {
      setError('');
      
      // البحث الموحد - يبحث في جميع الحقول بنفس الوقت
      let { data: orders, error: orderError } = await supabase
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
        .or(`tracking_number.eq.${searchValue},order_number.eq.${searchValue},qr_id.eq.${searchValue}`)
        .limit(1);

      if (orderError) {
        console.error('خطأ في البحث:', orderError);
        throw orderError;
      }

      const order = orders?.[0];
      if (!order) {
        setError('الطلب غير موجود في النظام أو الرقم غير صحيح');
        return null;
      }

      // إذا لم يوجد، البحث بـ order_number
      if (!order && orderError?.code === 'PGRST116') {
        ({ data: order, error: orderError } = await supabase
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
          .eq('order_number', searchValue)
          .single());
      }

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

    // إنشاء ماسح QR محسن للهواتف المحمولة
    setTimeout(() => {
      html5QrCodeRef.current = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 15, // تقليل fps للاستقرار في الهواتف
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return Math.floor(minEdge * 0.8); // زيادة حجم المسح للهواتف
          },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          videoConstraints: {
            facingMode: { ideal: "environment" },
            aspectRatio: { ideal: 1 },
            frameRate: { ideal: 15, max: 30 }
          },
          rememberLastUsedCamera: true, // تذكر الكاميرا المستخدمة
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
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
      setError('يرجى إدخال رقم التتبع أو QR ID');
      return;
    }
    await searchOrderByQR(manualInput.trim());
  };

  // التعامل مع الطلبات الراجعة مع تحديث المخزون
  const handleReturnedOrder = async (action) => {
    if (!foundOrder) return;

    try {
      if (action === 'return_to_stock') {
        // تحديث حالة الطلب إلى راجع للمخزن
        await onUpdateOrderStatus(foundOrder.id, 'returned_in_stock');
        
        // تحديث المخزون - إعادة كميات المنتجات للمخزن
        if (foundOrder.order_items && foundOrder.order_items.length > 0) {
          const updatePromises = foundOrder.order_items.map(async (item) => {
            if (item.product_variants && item.variant_id) {
              // تحديث كمية المتغير
              const { error: updateError } = await supabase
                .from('product_variants')
                .update({
                  quantity: (item.product_variants.quantity || 0) + item.quantity
                })
                .eq('id', item.variant_id);
              
              if (updateError) {
                console.error('خطأ في تحديث المخزون:', updateError);
              }
            }
          });
          
          await Promise.all(updatePromises);
          
          toast({
            title: "✅ تم الاستلام بنجاح",
            description: `تم استلام الطلب ${foundOrder.order_number} وإعادة ${foundOrder.order_items.length} منتج للمخزن`,
            variant: "success"
          });
        } else {
          toast({
            title: "تم الاستلام",
            description: "تم استلام الطلب الراجع وتحديث حالته",
            variant: "success"
          });
        }
      } else if (action === 'partial_return') {
        // إرجاع جزئي - سيتم تطويره لاحقاً
        toast({
          title: "الإرجاع الجزئي",
          description: "هذه الميزة قيد التطوير",
          variant: "default"
        });
      }
      
      setFoundOrder(null);
      setManualInput('');
      onClose();
    } catch (error) {
      console.error('خطأ في معالجة الطلب الراجع:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث حالة الطلب أو المخزون",
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
                <label className="text-sm font-medium">أو أدخل رقم التتبع يدوياً:</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="رقم التتبع (مثل: 98783797)"
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
                  تم العثور على الطلب: <strong>#{foundOrder.tracking_number || foundOrder.order_number}</strong>
                </AlertDescription>
              </Alert>

              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div><strong>العميل:</strong> {foundOrder.customer_name}</div>
                <div><strong>الهاتف:</strong> {foundOrder.customer_phone}</div>
                <div><strong>الحالة:</strong> {getStatusLabel(foundOrder.status)}</div>
                <div><strong>المبلغ:</strong> {(foundOrder.final_amount || 0).toLocaleString()} د.ع</div>
                <div><strong>رقم التتبع:</strong> {foundOrder.tracking_number || foundOrder.order_number}</div>
                {foundOrder.tracking_number && foundOrder.order_number !== foundOrder.tracking_number && (
                  <div><strong>رقم النظام:</strong> {foundOrder.order_number}</div>
                )}
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
                      استلام في المخزن + تحديث المخزون
                    </Button>
                    <Button
                      onClick={() => handleReturnedOrder('partial_return')}
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      إرجاع جزئي (قيد التطوير)
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