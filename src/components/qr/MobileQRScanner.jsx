import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, AlertTriangle, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * قارئ QR محسن خصيصاً للآيفون والأجهزة المحمولة
 */
const MobileQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR Code للهاتف",
  elementId = "mobile-qr-reader"
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const readerRef = useRef(null);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // الحصول على الكاميرات المتاحة
  const getCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      console.log('📷 الكاميرات المتاحة:', devices);
      setCameras(devices);
      return devices;
    } catch (err) {
      console.error('❌ خطأ في الحصول على الكاميرات:', err);
      return [];
    }
  };

  // بدء المسح مع تحسينات للآيفون
  const startScanning = async () => {
    console.log('🚀 بدء قارئ QR للآيفون والموبايل');
    setIsInitializing(true);
    setError(null);
    
    try {
      // التحقق من وجود العنصر
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      // الحصول على الكاميرات المتاحة
      const availableCameras = await getCameras();

      // إنشاء قارئ QR محسن للموبايل
      const html5QrCode = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        useBarCodeDetectorIfSupported: true
      });
      readerRef.current = html5QrCode;

      // إعدادات محسنة للآيفون والأجهزة المحمولة
      const config = {
        fps: isIOS ? 5 : 10, // fps أقل للآيفون
        qrbox: {
          width: Math.min(280, window.innerWidth - 80),
          height: Math.min(280, window.innerWidth - 80)
        },
        aspectRatio: 1.0,
        disableFlip: false,
        supportedScanTypes: [Html5QrcodeSupportedFormats.QR_CODE]
      };

      // خيارات الكاميرا مرتبة حسب الأولوية للآيفون
      const cameraOptions = [];

      // للآيفون - إعدادات خاصة
      if (isIOS) {
        cameraOptions.push(
          {
            facingMode: { exact: "environment" },
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 }
          },
          { facingMode: "environment" }
        );
      }

      // للأندرويد والأجهزة الأخرى
      cameraOptions.push(
        { facingMode: "environment" },
        { facingMode: "user" }
      );

      // استخدام أول كاميرا متاحة
      if (availableCameras.length > 0) {
        // البحث عن الكاميرا الخلفية
        const backCamera = availableCameras.find(camera => 
          camera.label.toLowerCase().includes('back') ||
          camera.label.toLowerCase().includes('rear') ||
          camera.label.toLowerCase().includes('environment')
        );
        
        if (backCamera) {
          cameraOptions.unshift(backCamera.id);
        } else {
          cameraOptions.push(availableCameras[0].id);
        }
      }

      // محاولة أخيرة بدون قيود
      cameraOptions.push(true);

      let scanningStarted = false;

      for (const cameraOption of cameraOptions) {
        if (scanningStarted) break;

        try {
          console.log('🔄 محاولة كاميرا:', cameraOption);
          
          await html5QrCode.start(
            cameraOption,
            config,
            // عند نجاح المسح
            (decodedText) => {
              console.log('✅ تم قراءة QR Code:', decodedText);
              
              // اهتزاز للإشعار (iOS/Android)
              if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
              }
              
              // إشعار بصري
              toast({
                title: "✅ تم قراءة QR Code بنجاح",
                description: `الكود: ${decodedText.substring(0, 50)}${decodedText.length > 50 ? '...' : ''}`,
                variant: "success"
              });

              onScanSuccess?.(decodedText);
            },
            // تجاهل أخطاء عدم وجود كود
            () => {}
          );

          scanningStarted = true;
          setIsScanning(true);
          setIsInitializing(false);
          console.log('✅ تم تشغيل قارئ QR بنجاح مع:', cameraOption);
          break;

        } catch (err) {
          console.log('⚠️ فشل في تشغيل الكاميرا:', cameraOption, err.message);
          continue;
        }
      }

      if (!scanningStarted) {
        throw new Error('فشل في تشغيل جميع خيارات الكاميرا المتاحة');
      }

    } catch (err) {
      console.error('❌ خطأ في قارئ QR:', err);
      
      let errorMsg = 'خطأ في تشغيل الكاميرا';
      
      if (err.message.includes('Permission denied') || err.message.includes('NotAllowedError')) {
        errorMsg = isIOS 
          ? 'يرجى السماح للكاميرا في إعدادات Safari والمحاولة مرة أخرى'
          : 'يرجى السماح للكاميرا في إعدادات المتصفح والمحاولة مرة أخرى';
      } else if (err.message.includes('NotFoundError')) {
        errorMsg = 'لا توجد كاميرا متاحة على هذا الجهاز';
      } else if (err.message.includes('NotReadableError')) {
        errorMsg = 'الكاميرا مستخدمة من تطبيق آخر. يرجى إغلاق التطبيقات الأخرى والمحاولة مرة أخرى';
      } else if (err.message.includes('OverconstrainedError')) {
        errorMsg = 'إعدادات الكاميرا غير متوافقة مع هذا الجهاز';
      }
      
      setError(errorMsg);
      setIsScanning(false);
      setIsInitializing(false);
    }
  };

  // إيقاف المسح
  const stopScanning = async () => {
    console.log('⏹️ إيقاف قارئ QR للموبايل');
    
    try {
      if (readerRef.current && readerRef.current.isScanning) {
        await readerRef.current.stop();
        await readerRef.current.clear();
      }
      readerRef.current = null;
    } catch (err) {
      console.error('⚠️ خطأ في إيقاف القارئ:', err);
    }
    
    setIsScanning(false);
    setIsInitializing(false);
  };

  // إدارة دورة حياة المكون
  useEffect(() => {
    if (open && !isScanning && !isInitializing && !error) {
      const timer = setTimeout(() => {
        startScanning();
      }, 1000); // تأخير أطول للآيفون
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
      <DialogContent className="max-w-md w-[95vw] p-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            <Smartphone className="w-6 h-6" />
            {title}
            {isIOS && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">iOS</span>}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* منطقة المسح */}
          <div className="relative">
            <div 
              id={elementId}
              className="w-full rounded-lg overflow-hidden border-2 border-primary/30 bg-black shadow-lg"
              style={{ 
                minHeight: '300px', 
                maxHeight: '400px',
                aspectRatio: '1/1'
              }}
            />
            
            {/* طبقة التحميل */}
            {(isInitializing || (!isScanning && !error)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/85 rounded-lg">
                <div className="text-center text-white">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                  <p className="text-sm font-semibold">
                    {isIOS ? 'تحضير الكاميرا للآيفون...' : 'تحضير الكاميرا...'}
                  </p>
                  <p className="text-xs opacity-70 mt-1">يرجى السماح للكاميرا</p>
                </div>
              </div>
            )}
          </div>
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center gap-2 text-green-700 mb-1">
                <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-bold text-sm">📱 الكاميرا نشطة!</span>
                <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-xs font-medium text-green-600">
                وجه الهاتف نحو QR Code بثبات
              </p>
            </div>
          )}

          {/* رسائل الخطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="text-sm">{error}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  إعادة المحاولة
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* نصائح للآيفون */}
          {isIOS && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <Smartphone className="w-3 h-3" />
                <span className="font-semibold text-xs">نصائح للآيفون:</span>
              </div>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• تأكد من السماح للكاميرا في Safari</li>
                <li>• استخدم إضاءة جيدة</li>
                <li>• امسك الهاتف بثبات</li>
              </ul>
            </div>
          )}
        </div>
        
        <div className="flex justify-center pt-2">
          <Button 
            onClick={handleClose}
            variant="outline" 
            className="w-full hover:bg-muted/80"
            size="sm"
          >
            إغلاق القارئ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MobileQRScanner;