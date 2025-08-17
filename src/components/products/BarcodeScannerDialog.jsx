import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle, Flashlight, FlashlightOff, ShoppingCart, RefreshCw, Zap, Info } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useCart } from '@/hooks/useCart';
import { findProductByBarcode } from '@/lib/barcode-utils';

const BarcodeScannerDialog = ({ 
  open, 
  onOpenChange, 
  onScanSuccess,
  mode = 'scan', // 'scan', 'cart'
  title = "قارئ الـ QR Code المحسن"
}) => {
  const readerRef = useRef(null);
  const videoTrackRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  
  // حالات محسنة
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle, starting, active, error
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const { toast } = useToast();
  const { products } = useInventory();
  const { addFromQRScan } = useCart();

  useEffect(() => {
    if (open) {
      resetState();
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open]);

  const resetState = () => {
    setError(null);
    setIsScanning(false);
    setFlashEnabled(false);
    setScanCount(0);
    setCameraStatus('idle');
    setDiagnosticInfo('');
    setRetryCount(0);
  };

  const startScanner = async () => {
    try {
      setCameraStatus('starting');
      setError(null);
      setDiagnosticInfo('🔄 بدء تشغيل الماسح...');
      
      // التحقق من دعم الكاميرا أولاً
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('الكاميرا غير مدعومة في هذا المتصفح');
      }

      setDiagnosticInfo('🔍 فحص الكاميرات المتاحة...');
      
      // التحقق من الكاميرات المتاحة
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error('لا توجد كاميرا متاحة في هذا الجهاز');
      }

      setDiagnosticInfo(`📱 تم العثور على ${cameras.length} كاميرا`);

      // إنشاء ماسح جديد
      setDiagnosticInfo('⚙️ إعداد ماسح QR...');
      const html5QrCode = new Html5Qrcode("reader");
      readerRef.current = html5QrCode;

      // إعدادات محسنة للهواتف المحمولة
      const config = {
        fps: 15, // تقليل fps للاستقرار
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // حساب QR box ديناميكياً حسب حجم الشاشة
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.8);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        showTorchButtonIfSupported: true, // زر الفلاش للهواتف
        videoConstraints: {
          facingMode: { ideal: "environment" },
          aspectRatio: { ideal: 1 },
          frameRate: { ideal: 15, max: 30 }
        }
      };

      setDiagnosticInfo('🚀 بدء المسح...');

      // محاولة استخدام كاميرا خلفية محددة أولاً
      let cameraConfig = { facingMode: "environment" };
      
      // للهواتف المحمولة - استخدام كاميرا محددة
      if (cameras.length > 1) {
        const backCamera = cameras.find(camera => 
          camera.label.toLowerCase().includes('back') ||
          camera.label.toLowerCase().includes('rear') ||
          camera.label.toLowerCase().includes('environment')
        );
        if (backCamera) {
          cameraConfig = backCamera.id;
        }
      }

      await html5QrCode.start(
        cameraConfig,
        config,
        async (decodedText, decodedResult) => {
          await handleScanResult(decodedText);
        },
        (errorMessage) => {
          // تجاهل أخطاء عدم وجود كود - هذا طبيعي
          if (!errorMessage.includes('NotFoundException')) {
            console.log('Scanner error (ignored):', errorMessage);
          }
        }
      );

      setCameraStatus('active');
      setIsScanning(true);
      setDiagnosticInfo('✅ الماسح نشط وجاهز!');
      
      // فحص دعم الفلاش بطريقة آمنة
      setTimeout(() => {
        checkFlashSupport();
      }, 1000);

    } catch (err) {
      console.error("خطأ في تشغيل المسح:", err);
      setCameraStatus('error');
      setIsScanning(false);
      
      // رسائل خطأ واضحة ومفيدة
      let errorMessage = 'خطأ غير معروف';
      let solution = 'جرب إعادة تحميل الصفحة';

      if (err.message.includes('Permission')) {
        errorMessage = 'تم رفض صلاحية الكاميرا';
        solution = 'اضغط "السماح" للكاميرا وأعد المحاولة';
      } else if (err.message.includes('NotFoundError')) {
        errorMessage = 'لا توجد كاميرا متاحة';
        solution = 'تأكد من وجود كاميرا في الجهاز';
      } else if (err.message.includes('NotReadableError')) {
        errorMessage = 'الكاميرا مستخدمة في تطبيق آخر';
        solution = 'أغلق التطبيقات الأخرى التي تستخدم الكاميرا';
      } else if (err.message.includes('OverconstrainedError')) {
        errorMessage = 'إعدادات الكاميرا غير مدعومة';
        solution = 'جرب كاميرا أخرى أو أعد تشغيل الجهاز';
      } else {
        errorMessage = err.message || 'فشل في تشغيل الماسح';
      }

      setError(`❌ ${errorMessage}\n\n💡 الحل المقترح: ${solution}`);
      setDiagnosticInfo(`❌ فشل: ${errorMessage}`);
      
      // محاولة إعادة تشغيل تلقائية (مع حد أقصى)
      if (retryCount < 2) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setDiagnosticInfo(`🔄 إعادة محاولة ${retryCount + 1}/3...`);
          startScanner();
        }, 2000);
      }
    }
  };

  const handleScanResult = async (decodedText) => {
    // منع المسح المتكرر
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1000) {
      return;
    }
    lastScanTimeRef.current = now;
    
    console.log("🎯 تم قراءة QR Code:", decodedText);
    setScanCount(prev => prev + 1);
    
    let productInfo = null;
    let resultMessage = '';
    
    try {
      // محاولة تحليل JSON
      const jsonData = JSON.parse(decodedText);
      if (jsonData && (jsonData.type === 'product' || jsonData.product_id)) {
        productInfo = {
          ...jsonData,
          qr_id: jsonData.id,
          barcode: decodedText
        };
        
        resultMessage = `${productInfo.product_name || 'منتج'} - ${productInfo.color || 'افتراضي'} - ${productInfo.size || 'افتراضي'}`;
        
        if (mode === 'cart') {
          const added = addFromQRScan(productInfo, products);
          if (added) {
            toast({
              title: "✅ تم إضافة المنتج للسلة",
              description: resultMessage,
            });
          }
        } else {
          toast({
            title: "✅ تم قراءة QR Code للمنتج",
            description: resultMessage,
          });
        }
      }
    } catch (e) {
      // QR Code بسيط
      console.log("📄 QR Code بسيط:", decodedText);
      
      if (mode === 'cart') {
        const added = addFromQRScan(decodedText, products);
        if (added) {
          const foundProduct = findProductByBarcode(decodedText, products);
          if (foundProduct) {
            resultMessage = `${foundProduct.product.name} - ${foundProduct.variant.color} - ${foundProduct.variant.size}`;
            toast({
              title: "✅ تم إضافة المنتج للسلة",
              description: resultMessage,
            });
          }
        }
      } else {
        resultMessage = decodedText.startsWith('QR_') 
          ? `كود QR: ${decodedText}` 
          : `معرف: ${decodedText.substring(0, 20)}${decodedText.length > 20 ? '...' : ''}`;
          
        toast({
          title: "✅ تم قراءة QR Code",
          description: resultMessage,
        });
      }
    }
    
    // صوت نجاح
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgBSmEyvLZhj8IFWm98OyfUgwOUarm0nQgBSl+y/LVey0GO2q+8N2bSDsBJXfH89mTRAsVWLPn7q1cEgBHmN/nynkiBjR+zfP');
      audio.volume = 0.15;
      audio.play();
    } catch (e) {}

    onScanSuccess(productInfo || decodedText);
  };

  const stopScanner = async () => {
    try {
      if (readerRef.current && readerRef.current.isScanning) {
        await readerRef.current.stop();
      }
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
    } catch (err) {
      console.error("خطأ في إيقاف المسح:", err);
    }
    setIsScanning(false);
    setFlashEnabled(false);
    setCameraStatus('idle');
  };

  const checkFlashSupport = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      const track = stream.getVideoTracks()[0];
      videoTrackRef.current = track;
      const capabilities = track.getCapabilities();
      setHasFlash(!!capabilities.torch);
      track.stop();
      
      if (capabilities.torch) {
        setDiagnosticInfo(prev => prev + ' 💡 الفلاش متاح');
      }
    } catch (e) {
      console.log("Flash check failed:", e);
      setHasFlash(false);
    }
  };

  const toggleFlash = async () => {
    if (!hasFlash) {
      toast({
        title: "❌ الفلاش غير مدعوم",
        description: "هذا الجهاز لا يدعم الفلاش",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const videoElement = document.querySelector('#reader video');
      if (!videoElement || !videoElement.srcObject) {
        toast({
          title: "❌ خطأ في الكاميرا",
          description: "لا يمكن الوصول للكاميرا",
          variant: "destructive"
        });
        return;
      }
      
      const stream = videoElement.srcObject;
      const track = stream.getVideoTracks()[0];
      
      await track.applyConstraints({
        advanced: [{ torch: !flashEnabled }]
      });
      
      setFlashEnabled(!flashEnabled);
      
      toast({
        title: flashEnabled ? "⚫ تم إطفاء الفلاش" : "💡 تم تشغيل الفلاش",
      });
    } catch (err) {
      console.error("خطأ في الفلاش:", err);
      toast({
        title: "❌ خطأ في الفلاش",
        description: "فشل في تشغيل الفلاش",
        variant: "destructive"
      });
    }
  };

  const restartScanner = async () => {
    setDiagnosticInfo('🔄 إعادة تشغيل الماسح...');
    await stopScanner();
    setTimeout(() => {
      setRetryCount(0);
      startScanner();
    }, 500);
  };

  const testCamera = async () => {
    try {
      setDiagnosticInfo('🧪 اختبار الكاميرا...');
      const cameras = await Html5Qrcode.getCameras();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      
      toast({
        title: "✅ اختبار الكاميرا نجح",
        description: `تم العثور على ${cameras.length} كاميرا`,
      });
      setDiagnosticInfo(`✅ اختبار نجح: ${cameras.length} كاميرا متاحة`);
    } catch (err) {
      toast({
        title: "❌ فشل اختبار الكاميرا",
        description: err.message,
        variant: "destructive"
      });
      setDiagnosticInfo(`❌ فشل الاختبار: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            {mode === 'cart' ? (
              <ShoppingCart className="w-6 h-6" />
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="5" height="5" fill="currentColor"/>
                <rect x="3" y="16" width="5" height="5" fill="currentColor"/>
                <rect x="16" y="3" width="5" height="5" fill="currentColor"/>
                <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
                <rect x="5" y="5" width="1" height="1" fill="white"/>
                <rect x="5" y="18" width="1" height="1" fill="white"/>
                <rect x="18" y="5" width="1" height="1" fill="white"/>
              </svg>
            )}
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            📱 <strong>ماسح محسن:</strong> يقرأ QR Codes بموثوقية عالية<br/>
            {mode === 'cart' ? (
              <>🛒 <strong>يضيف تلقائياً للسلة</strong> عند المسح</>
            ) : (
              <>🎯 <strong>وجه الكاميرا للكود</strong> للحصول على التفاصيل</>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* أزرار التحكم المحسنة */}
          <div className="flex justify-center gap-2 flex-wrap">
            {isScanning && hasFlash && (
              <Button
                variant={flashEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleFlash}
                className="flex items-center gap-2"
              >
                {flashEnabled ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
                {flashEnabled ? "إطفاء الفلاش" : "تشغيل الفلاش"}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={restartScanner}
              className="flex items-center gap-2"
              disabled={cameraStatus === 'starting'}
            >
              <RefreshCw className={`w-4 h-4 ${cameraStatus === 'starting' ? 'animate-spin' : ''}`} />
              إعادة تشغيل
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={testCamera}
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              اختبار الكاميرا
            </Button>
          </div>

          {/* منطقة المسح */}
          <div 
            id="reader" 
            className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl"
            style={{ minHeight: '350px', maxHeight: '450px' }}
          />
          
          {/* معلومات التشخيص */}
          {diagnosticInfo && (
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center gap-2 text-blue-700">
                <Info className="w-4 h-4" />
                <span className="text-sm font-medium">{diagnosticInfo}</span>
              </div>
            </div>
          )}
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">🚀 الماسح نشط ويعمل!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-600">
                  ⚡ يقرأ QR Codes مع معالجة محسنة للأخطاء
                </p>
                {scanCount > 0 && (
                  <p className="text-xs text-primary font-bold">
                    📊 تم قراءة {scanCount} كود
                  </p>
                )}
                {hasFlash && (
                  <p className="text-xs text-purple-600 font-medium">
                    💡 الفلاش متاح للإضاءة المنخفضة
                  </p>
                )}
              </div>
            </div>
          )}
          
          {cameraStatus === 'starting' && (
            <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-blue-600">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <span className="font-medium">🔄 تشغيل الماسح المحسن...</span>
                <p className="text-xs text-blue-500 mt-1">إعداد الكاميرا والفلاش...</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في الماسح</AlertTitle>
            <AlertDescription className="whitespace-pre-line">
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-center pt-2">
          <Button 
            onClick={() => onOpenChange(false)} 
            variant="outline" 
            className="w-full hover:bg-muted/80"
          >
            إغلاق الماسح
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;