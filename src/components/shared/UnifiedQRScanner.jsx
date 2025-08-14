import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, AlertTriangle, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * قارئ QR موحد ومبسط - يعمل على جميع الأجهزة
 */
const UnifiedQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR Code",
  description = "وجه الكاميرا نحو QR Code",
  elementId = "unified-qr-reader"
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const readerRef = useRef(null);

  // بدء المسح
  const startScanning = async () => {
    console.log('🚀 بدء قارئ QR الموحد');
    
    try {
      setError(null);
      setIsScanning(false);

      // التحقق من وجود العنصر
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      // إنشاء قارئ QR
      const html5QrCode = new Html5Qrcode(elementId);
      readerRef.current = html5QrCode;

      // إعدادات بسيطة ومضمونة
      const config = {
        fps: 10,
        qrbox: { width: 300, height: 300 }
      };

      // بدء المسح
      await html5QrCode.start(
        // إعدادات كاميرا بسيطة
        { 
          width: 640, 
          height: 480 
        },
        config,
        // عند نجاح المسح
        (decodedText) => {
          console.log('✅ تم قراءة QR Code:', decodedText);
          
          toast({
            title: "✅ تم قراءة QR Code بنجاح",
            description: `الكود: ${decodedText.substring(0, 30)}${decodedText.length > 30 ? '...' : ''}`,
            variant: "success"
          });

          onScanSuccess?.(decodedText);
        },
        // تجاهل أخطاء عدم وجود كود
        () => {}
      );

      setIsScanning(true);
      console.log('✅ تم تشغيل قارئ QR بنجاح');

    } catch (err) {
      console.error('❌ خطأ في قارئ QR:', err);
      
      let errorMsg = 'خطأ في تشغيل الكاميرا';
      
      if (err.message.includes('Permission denied') || err.message.includes('NotAllowedError')) {
        errorMsg = 'يرجى السماح للكاميرا في إعدادات المتصفح';
      } else if (err.message.includes('NotFoundError')) {
        errorMsg = 'لا توجد كاميرا متاحة على هذا الجهاز';
      } else if (err.message.includes('NotReadableError')) {
        errorMsg = 'الكاميرا مستخدمة من تطبيق آخر';
      }
      
      setError(errorMsg);
      setIsScanning(false);
    }
  };

  // إيقاف المسح
  const stopScanning = async () => {
    console.log('⏹️ إيقاف قارئ QR');
    
    try {
      if (readerRef.current && readerRef.current.isScanning) {
        await readerRef.current.stop();
      }
      readerRef.current = null;
    } catch (err) {
      console.error('⚠️ خطأ في إيقاف القارئ:', err);
    }
    
    setIsScanning(false);
  };

  // بدء المسح عند فتح الحوار
  useEffect(() => {
    if (open && !isScanning && !error) {
      const timer = setTimeout(() => {
        startScanning();
      }, 500); // تأخير أطول للتأكد من تحميل DOM
      return () => clearTimeout(timer);
    } else if (!open) {
      stopScanning();
    }
  }, [open]);

  // تنظيف عند إغلاق المكون
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const handleClose = () => {
    stopScanning();
    onOpenChange(false);
  };

  const handleRetry = () => {
    setError(null);
    startScanning();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[95vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            <Camera className="w-6 h-6" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* منطقة المسح */}
          <div className="relative">
            <div 
              id={elementId}
              className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl"
              style={{ minHeight: '350px', maxHeight: '450px' }}
            />
            
            {/* طبقة التحميل */}
            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
                <div className="text-center text-white">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                  <p className="text-lg font-semibold">تحضير الكاميرا...</p>
                  <p className="text-sm opacity-80">يرجى السماح للكاميرا</p>
                </div>
              </div>
            )}
          </div>
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">🚀 قارئ QR نشط!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-sm font-medium text-green-600">
                📱 وجه الكاميرا نحو الرمز للحصول على أفضل النتائج
              </p>
            </div>
          )}

          {/* رسائل الخطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{error}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  إعادة المحاولة
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* نصائح الاستخدام */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">نصائح للاستخدام:</span>
            </div>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• تأكد من وجود إضاءة كافية</li>
              <li>• اجعل QR Code واضحاً ومسطحاً</li>
              <li>• احتفظ بمسافة مناسبة (10-20 سم)</li>
            </ul>
          </div>
        </div>
        
        <div className="flex justify-center pt-2">
          <Button 
            onClick={handleClose}
            variant="outline" 
            className="w-full hover:bg-muted/80"
          >
            إغلاق القارئ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedQRScanner;