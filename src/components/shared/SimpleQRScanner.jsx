import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsQR from 'jsqr';

const SimpleQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "مسح QR Code" 
}) => {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // بدء الكاميرا - أبسط طريقة ممكنة
  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🚀 بدء تشغيل الكاميرا...');

      // التحقق من دعم المتصفح
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('المتصفح لا يدعم الكاميرا');
        setIsLoading(false);
        return;
      }

      // طلب الكاميرا بأبسط الإعدادات
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });

      console.log('✅ تم الحصول على تدفق الكاميرا');
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // انتظار تحميل الفيديو
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = resolve;
          videoRef.current.onerror = reject;
        });

        // تشغيل الفيديو
        await videoRef.current.play();
        console.log('✅ الفيديو يعمل');
        
        // بدء المسح
        startScanning();
        setIsLoading(false);
      }

    } catch (err) {
      console.error('❌ خطأ في الكاميرا:', err);
      let errorMessage = 'خطأ في تشغيل الكاميرا';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'تم رفض إذن الكاميرا. اسمح للموقع بالوصول للكاميرا';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'لا توجد كاميرا متاحة';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'الكاميرا مستخدمة في تطبيق آخر';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // بدء المسح
  const startScanning = () => {
    if (intervalRef.current) return;
    
    console.log('🔍 [Simple QR] بدء مسح QR...');
    intervalRef.current = setInterval(() => {
      scanQRCode();
    }, 100);
  };

  // مسح QR من الفيديو
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (canvas.width === 0 || canvas.height === 0) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data) {
        console.log('🎯 [Simple QR] QR Code وُجد!', code.data);
        handleQRDetected(code.data);
      }
    } catch (err) {
      console.log('⚠️ [Simple QR] خطأ طفيف في المسح:', err.message);
    }
  };

  // عند العثور على QR
  const handleQRDetected = (qrCode) => {
    console.log('🎯 [Simple QR] تم العثور على QR:', qrCode);
    stopCamera();
    onScanSuccess?.(qrCode);
    toast({
      title: "تم مسح QR بنجاح!",
      description: `القيمة: ${qrCode}`,
    });
    onOpenChange(false);
  };

  // إيقاف الكاميرا
  const stopCamera = () => {
    console.log('🛑 [Simple QR] إيقاف الكاميرا...');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 [Simple QR] تم إيقاف track:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    console.log('✅ [Simple QR] تم إيقاف الكاميرا بالكامل');
  };

  // تشغيل عند الفتح
  useEffect(() => {
    if (open) {
      console.log('📱 [Simple QR] فتح الماسح الضوئي');
      startCamera();
    } else {
      console.log('❌ [Simple QR] إغلاق الماسح الضوئي');
      stopCamera();
    }
    
    return () => {
      console.log('🧹 [Simple QR] تنظيف الماسح الضوئي');
      stopCamera();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* الفيديو */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* مؤشر المسح */}
            {!isLoading && !error && (
              <div className="absolute inset-4 border-2 border-white rounded-lg opacity-75">
                <div className="w-full h-full border-2 border-green-500 rounded-lg animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 text-white px-3 py-1 rounded text-sm">
                    وجّه الكاميرا نحو QR Code
                  </div>
                </div>
              </div>
            )}

            {/* حالة التحميل */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="text-white text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>جاري تشغيل الكاميرا...</p>
                </div>
              </div>
            )}
          </div>

          {/* Canvas مخفي للمعالجة */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* خطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="space-y-2">
                  <p>{error}</p>
                  <Button
                    onClick={startCamera}
                    size="sm"
                    variant="outline"
                  >
                    إعادة المحاولة
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* أزرار */}
          <div className="flex gap-2">
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
              <X className="w-4 h-4 mr-2" />
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleQRScanner;