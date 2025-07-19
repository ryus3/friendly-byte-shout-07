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
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);

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

      // إعدادات محسنة للقراءة - تدعم جميع أنواع الباركود
      const config = {
        fps: 10,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // حجم كبير للتحديد
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.7);
          return {
            width: size,
            height: Math.floor(size * 0.5) // مستطيل عريض للباركود
          };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        // تحسين دعم الباركود التقليدي
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        async (decodedText, decodedResult) => {
          console.log("🎯 تم قراءة الكود:", decodedText);
          
          // صوت نجاح
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgBSmEyvLZhj8IFWm98OyfUgwOUarm0nQgBSl+y/LVey0GO2q+8N2bSDsBJXfH89mTRAsVWLPn7q1cEgBHmN/nynkiBjR+zfP');
            audio.volume = 0.3;
            audio.play();
          } catch (e) {}

          // إشعار المسح
          toast({
            title: "✅ تم المسح بنجاح!",
            description: `الكود: ${decodedText}`,
            variant: "success"
          });

          // إرسال النتيجة
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
      <DialogContent className="max-w-md w-[95vw] h-[85vh] p-3 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-primary text-base">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4z"/>
              <path d="M13 13h1.5v1.5H13V13zm0 3h1.5v1.5H13V16zm3 0h1.5v1.5H16V16zm1.5-3H19v1.5h-1.5V13zm0 3H19v1.5h-1.5V16zm3-3H22v1.5h-1.5V13z"/>
            </svg>
            قارئ الباركود
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-3">
          {/* أزرار التحكم */}
          <div className="flex justify-center gap-2">
            {hasFlash && (
              <Button
                variant={flashEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleFlash}
                className="flex items-center gap-1 text-xs px-3 py-1"
              >
                {flashEnabled ? <FlashlightOff className="w-3 h-3" /> : <Flashlight className="w-3 h-3" />}
                {flashEnabled ? "إطفاء" : "فلاش"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs px-3 py-1"
            >
              إغلاق
            </Button>
          </div>

          {/* منطقة المسح */}
          <div className="flex-1 relative">
            <div 
              id="reader" 
              className="w-full h-full rounded-lg overflow-hidden border-2 border-primary/30 bg-black"
            />
          </div>
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-2 bg-green-50 rounded-lg border border-green-200 flex-shrink-0">
              <div className="flex items-center justify-center gap-2 text-green-700 text-sm">
                <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium">🔍 قارئ نشط</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                وجه الكاميرا للباركود أو QR وانتظر
              </p>
            </div>
          )}
          
          {!isScanning && !error && (
            <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200 flex-shrink-0">
              <div className="text-blue-600 text-sm">
                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-1"></div>
                <span>جاري التشغيل...</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertTriangle className="h-3 w-3" />
            <AlertTitle className="text-sm">خطأ</AlertTitle>
            <AlertDescription className="text-xs">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;