import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle, Flashlight, FlashlightOff } from 'lucide-react';

const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  const readerRef = useRef(null);
  const videoTrackRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    if (open) {
      setError(null);
      setIsScanning(false);
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    try {
      setError(null);
      
      // التحقق من دعم الكاميرا
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setError("لا توجد كاميرا متاحة");
        return;
      }

      const html5QrCode = new Html5Qrcode("reader");
      readerRef.current = html5QrCode;

      // إعدادات محسنة للقراءة السريعة
      const config = {
        fps: 30, // سرعة عالية للمسح السريع
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // منطقة أكبر لالتقاط أكثر من ملصق
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.95);
          return {
            width: size,
            height: Math.floor(size * 0.8)
          };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        async (decodedText, decodedResult) => {
          // منع المسح المتكرر للكود نفسه
          const now = Date.now();
          if (now - lastScanTimeRef.current < 100) {
            return;
          }
          lastScanTimeRef.current = now;
          
          console.log("🎯 تم قراءة الكود:", decodedText);
          setScanCount(prev => prev + 1);
          
          // صوت نجاح خفيف
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgBSmEyvLZhj8IFWm98OyfUgwOUarm0nQgBSl+y/LVey0GO2q+8N2bSDsBJXfH89mTRAsVWLPn7q1cEgBHmN/nynkiBjR+zfP');
            audio.volume = 0.15;
            audio.play();
          } catch (e) {}

          // إرسال النتيجة بدون إغلاق المسح
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // تجاهل أخطاء عدم وجود كود
        }
      );

      // التحقق من دعم الفلاش
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        const track = stream.getVideoTracks()[0];
        videoTrackRef.current = track;
        const capabilities = track.getCapabilities();
        setHasFlash(!!capabilities.torch);
        // لا نوقف الستريم هنا لأن الكاميرا تعمل
      } catch (e) {
        console.log("Flash not supported");
      }

      setIsScanning(true);

    } catch (err) {
      console.error("خطأ في تشغيل المسح:", err);
      setError(`خطأ في تشغيل قارئ الباركود: ${err.message}`);
      setIsScanning(false);
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

  const toggleFlash = async () => {
    if (!videoTrackRef.current || !hasFlash) return;
    
    try {
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: !flashEnabled }]
      });
      setFlashEnabled(!flashEnabled);
      
      toast({
        title: flashEnabled ? "⚫ تم إطفاء الفلاش" : "💡 تم تشغيل الفلاش",
        variant: "success"
      });
    } catch (err) {
      console.error("خطأ في الفلاش:", err);
      toast({
        title: "❌ خطأ في الفلاش",
        description: "لا يمكن تشغيل الفلاش على هذا الجهاز",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4z"/>
              <path d="M13 13h1.5v1.5H13V13zm0 3h1.5v1.5H13V16zm3 0h1.5v1.5H16V16zm1.5-3H19v1.5h-1.5V13zm0 3H19v1.5h-1.5V16zm3-3H22v1.5h-1.5V13z"/>
            </svg>
            قارئ الباركود المحترف
          </DialogTitle>
          <DialogDescription className="text-sm">
            📱 <strong>يقرأ:</strong> جميع أنواع الباركود والـ QR Code<br/>
            🎯 <strong>وجه الكاميرا للكود</strong> وانتظر لثانية واحدة
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* أزرار التحكم */}
          {isScanning && (
            <div className="flex justify-center gap-3">
              {hasFlash && (
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
            </div>
          )}

          {/* منطقة المسح */}
          <div 
            id="reader" 
            className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl"
            style={{ minHeight: '400px', maxHeight: '500px' }}
          />
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">🚀 مسح سريع نشط!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-600">
                  ⚡ يقرأ عشرات الملصقات بسرعة فائقة
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  📱 مرر الكاميرا على الملصقات بسرعة
                </p>
                {scanCount > 0 && (
                  <p className="text-xs text-primary font-bold">
                    📊 تم قراءة {scanCount} كود
                  </p>
                )}
                {hasFlash && (
                  <p className="text-xs text-purple-600 font-medium">
                    💡 استخدم الفلاش في الإضاءة المنخفضة
                  </p>
                )}
              </div>
            </div>
          )}
          
          {!isScanning && !error && (
            <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-blue-600">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <span className="font-medium">🔄 جاري تشغيل قارئ الباركود المحسن...</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في القارئ</AlertTitle>
            <AlertDescription>
              {error}
              <br />
              <strong>💡 للحل:</strong> تأكد من السماح للكاميرا وأعد تحميل الصفحة
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-center pt-2">
          <Button 
            onClick={() => onOpenChange(false)} 
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

export default BarcodeScannerDialog;