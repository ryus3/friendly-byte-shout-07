import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';
import { Flashlight, FlashlightOff, X } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useCart } from '@/hooks/useCart';
import { findProductByBarcode } from '@/lib/barcode-utils';
import devLog from '@/lib/devLogger';

const BarcodeScannerDialog = ({ 
  open, 
  onOpenChange, 
  onScanSuccess,
  mode = 'scan', // 'scan', 'cart'
  title = "ماسح QR السريع"
}) => {
  const readerRef = useRef(null);
  const videoTrackRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [addedProducts, setAddedProducts] = useState([]);

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
    setIsScanning(false);
    setFlashEnabled(false);
    setScanCount(0);
    setAddedProducts([]);
  };

  const startScanner = async () => {
    try {
      // التحقق من دعم الكاميرا
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('الكاميرا غير مدعومة في هذا المتصفح');
      }

      // التحقق من الكاميرات المتاحة
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error('لا توجد كاميرا متاحة في هذا الجهاز');
      }

      // إنشاء ماسح جديد
      const html5QrCode = new Html5Qrcode("reader");
      readerRef.current = html5QrCode;

      // إعدادات محسنة للمسح السريع
      const config = {
        fps: 20, // معدل إطارات أعلى للمسح السريع
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // منطقة مسح أكبر للهواتف المحمولة
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.85);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        showTorchButtonIfSupported: false, // نستخدم زر الفلاش المخصص
        videoConstraints: {
          facingMode: { ideal: "environment" },
          aspectRatio: { ideal: 1 },
          frameRate: { ideal: 20, max: 30 }
        }
      };

      // محاولة استخدام الكاميرا الخلفية
      let cameraConfig = { facingMode: "environment" };
      
      // للهواتف المحمولة - البحث عن الكاميرا الخلفية
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
          if (!errorMessage.includes('NotFoundException')) {
            // Ignore scanner errors
          }
        }
      );

      setIsScanning(true);
      
      // فحص دعم الفلاش
      setTimeout(() => {
        checkFlashSupport();
      }, 500);

    } catch (err) {
      console.error("خطأ في تشغيل المسح:", err);
      setIsScanning(false);
      
      let errorMessage = 'خطأ في تشغيل الماسح';
      if (err.message.includes('Permission')) {
        errorMessage = 'يرجى السماح للكاميرا والمحاولة مرة أخرى';
      } else if (err.message.includes('NotFoundError')) {
        errorMessage = 'لا توجد كاميرا متاحة في الجهاز';
      } else if (err.message.includes('NotReadableError')) {
        errorMessage = 'الكاميرا مستخدمة في تطبيق آخر، يرجى إغلاقه';
      }

      toast({
        title: "❌ خطأ في الماسح",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleScanResult = async (decodedText) => {
    // منع المسح المتكرر - تقليل الوقت إلى 250ms للمسح السريع
    const now = Date.now();
    if (now - lastScanTimeRef.current < 250) {
      return;
    }
    lastScanTimeRef.current = now;
    
    setScanCount(prev => prev + 1);
    
    // إضافة اهتزاز للهاتف المحمول
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
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
            setAddedProducts(prev => [...prev, resultMessage]);
            playSuccessSound();
            toast({
              title: "✅ تمت الإضافة",
              description: `${resultMessage} (${scanCount + 1})`,
              duration: 1500,
            });
          }
        }
      }
    } catch (e) {
      if (mode === 'cart') {
        const added = addFromQRScan(decodedText, products);
        if (added) {
          const foundProduct = findProductByBarcode(decodedText, products);
          if (foundProduct) {
            resultMessage = `${foundProduct.product.name} - ${foundProduct.variant.color} - ${foundProduct.variant.size}`;
            setAddedProducts(prev => [...prev, resultMessage]);
            playSuccessSound();
            toast({
              title: "✅ تمت الإضافة",
              description: `${resultMessage} (${scanCount + 1})`,
              duration: 1500,
            });
          }
        }
      } else {
        resultMessage = decodedText.startsWith('QR_') 
          ? `كود QR: ${decodedText}` 
          : `معرف: ${decodedText.substring(0, 20)}${decodedText.length > 20 ? '...' : ''}`;
          
        toast({
          title: "✅ تم المسح",
          description: `${resultMessage} (${scanCount + 1})`,
          duration: 1500,
        });
      }
    }
    
    // صوت نجاح سريع
    playSuccessSound();
    
    if (onScanSuccess) {
      onScanSuccess(productInfo || decodedText);
    }
  };

  const playSuccessSound = () => {
    try {
      // استخدام صوت أقصر للمسح السريع
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Fallback للأجهزة التي لا تدعم AudioContext
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgBSmEyvLZhj8IFWm98OyfUgwOUarm0nQgBSl+y/LVey0GO2q+8N2bSDsBJXfH89mTRAsVWLPn7q1cEgBHmN/nynkiBjR+zfP');
        audio.volume = 0.1;
        audio.play();
      } catch (e2) {}
    }
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
    } catch (e) {
      devLog.log("Flash check failed:", e);
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
        return;
      }
      
      const stream = videoElement.srcObject;
      const track = stream.getVideoTracks()[0];
      
      await track.applyConstraints({
        advanced: [{ torch: !flashEnabled }]
      });
      
      setFlashEnabled(!flashEnabled);
    } catch (err) {
      console.error("خطأ في الفلاش:", err);
    }
  };

  const handleClose = () => {
    stopScanner();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="5" height="5" fill="currentColor"/>
              <rect x="3" y="16" width="5" height="5" fill="currentColor"/>
              <rect x="16" y="3" width="5" height="5" fill="currentColor"/>
              <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
              <rect x="5" y="5" width="1" height="1" fill="white"/>
              <rect x="5" y="18" width="1" height="1" fill="white"/>
              <rect x="18" y="5" width="1" height="1" fill="white"/>
            </svg>
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {mode === 'cart' ? (
              "🚀 امسح أكواد QR بسرعة لإضافة المنتجات للسلة"
            ) : (
              "📱 وجه الكاميرا للكود للمسح السريع"
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* أزرار التحكم البسيطة */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {isScanning && hasFlash && (
                <Button
                  variant={flashEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleFlash}
                  className="flex items-center gap-2"
                >
                  {flashEnabled ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
                </Button>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              إغلاق
            </Button>
          </div>

          {/* منطقة المسح */}
          <div 
            id="reader" 
            className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl"
            style={{ minHeight: '350px', maxHeight: '450px' }}
          />
          
          {/* معلومات المسح */}
          {isScanning && (
            <div className="text-center p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold">🚀 الماسح نشط!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              {scanCount > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-primary">
                    📊 تم مسح {scanCount} كود
                  </p>
                  {mode === 'cart' && addedProducts.length > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      ✅ آخر منتج: {addedProducts[addedProducts.length - 1]}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;