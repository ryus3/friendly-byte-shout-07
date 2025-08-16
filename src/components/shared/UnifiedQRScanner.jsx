import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, Loader2, RefreshCw, Zap, ZapOff, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const UnifiedQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR Code",
  description = "وجه الكاميرا نحو QR Code",
  elementId = "unified-qr-reader"
}) => {
  console.log('🔥 [QR Component] تم إنشاء UnifiedQRScanner - النسخة النظيفة!');
  
  const [isScanning, setIsScanning] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [hasFlash, setHasFlash] = React.useState(false);
  const [flashEnabled, setFlashEnabled] = React.useState(false);
  const [cameraReady, setCameraReady] = React.useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  // فحص إذا كان في iframe
  const isInIframe = typeof window !== 'undefined' && window.top !== window.self;

  // بدء الكاميرا
  const startCamera = React.useCallback(async () => {
    try {
      setError(null);
      console.log('🚀 [QR] بدء تشغيل الكاميرا...');

      // طلب الكاميرا مع تجربة عدة إعدادات
      let stream;
      try {
        // محاولة الكاميرا الخلفية أولاً
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",  // بدون "ideal" أو "exact"
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 }
          }
        });
      } catch (envError) {
        console.log('⚠️ [QR] فشل في الكاميرا الخلفية، محاولة أي كاميرا...');
        // إذا فشلت، جربِّ أي كاميرا متاحة
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 }
          }
        });
      }

      streamRef.current = stream;
      
      // البحث عن عنصر الفيديو أو إنشاؤه
      const container = document.getElementById(elementId);
      if (!container) {
        throw new Error('لا يمكن العثور على حاوي القارئ');
      }

      let video = container.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        container.appendChild(video);
      }

      video.srcObject = stream;
      videoRef.current = video;
      
      video.onloadedmetadata = () => {
        video.play().then(() => {
          setIsScanning(true);
          setCameraReady(true);
          console.log('✅ [QR] الكاميرا تعمل!');
          
          // فحص الفلاش
          setTimeout(() => {
            const track = stream.getVideoTracks()[0];
            if (track && track.getCapabilities) {
              const capabilities = track.getCapabilities();
              if (capabilities.torch) {
                setHasFlash(true);
                console.log('💡 [QR] الفلاش متاح');
              }
            }
          }, 1000);
        }).catch(e => {
          console.error('خطأ في تشغيل الفيديو:', e);
          setError('فشل في تشغيل الفيديو: ' + e.message);
        });
      };

    } catch (err) {
      console.error('❌ [QR] خطأ في الكاميرا:', err);
      setError('فشل في تشغيل الكاميرا: ' + err.message);
      setIsScanning(false);
    }
  }, [elementId]);

  // إيقاف الكاميرا
  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setCameraReady(false);
    setHasFlash(false);
    setFlashEnabled(false);
    console.log('🛑 [QR] تم إيقاف الكاميرا');
  }, []);

  // تفعيل الفلاش
  const toggleFlash = React.useCallback(async () => {
    try {
      console.log('💡 [QR] محاولة تفعيل الفلاش... hasFlash:', hasFlash, 'streamRef:', !!streamRef.current);
      
      if (!streamRef.current || !hasFlash) {
        console.log('❌ [QR] الفلاش غير متاح');
        return;
      }

      const track = streamRef.current.getVideoTracks()[0];
      if (!track) {
        console.log('❌ [QR] لا يوجد track للفيديو');
        return;
      }

      const newState = !flashEnabled;
      console.log('🔄 [QR] تغيير الفلاش من', flashEnabled, 'إلى', newState);
      
      await track.applyConstraints({
        advanced: [{ torch: newState }]
      });
      
      setFlashEnabled(newState);
      console.log('✅ [QR] تم تغيير الفلاش بنجاح:', newState);
    } catch (err) {
      console.error('❌ [QR] خطأ في الفلاش:', err.message);
      setHasFlash(false);
      setFlashEnabled(false);
    }
  }, [hasFlash, flashEnabled]);

  // محاكاة مسح عند النقر
  const handleVideoClick = () => {
    if (cameraReady && onScanSuccess) {
      const testCode = prompt('أدخل QR Code للاختبار:');
      if (testCode) {
        onScanSuccess(testCode);
        toast({
          title: "تم مسح QR Code",
          description: `القيمة: ${testCode}`,
        });
        handleClose();
      }
    }
  };

  // فتح في نافذة جديدة
  const openInNewWindow = () => {
    const url = window.location.href.split('?')[0] + '?qr=1';
    window.open(url, '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes');
  };

  // بدء الكاميرا عند الفتح
  React.useEffect(() => {
    if (open && !isScanning) {
      setTimeout(startCamera, 500);
    } else if (!open) {
      stopCamera();
    }
  }, [open, isScanning, startCamera, stopCamera]);

  // تنظيف عند إزالة المكون
  React.useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleClose = () => {
    stopCamera();
    onOpenChange(false);
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
          {/* تحذير iframe */}
          {isInIframe && (
            <Alert>
              <ExternalLink className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="text-sm">قد لا تعمل الكاميرا في وضع المعاينة. جرب فتح القارئ في نافذة منفصلة:</p>
                <Button size="sm" onClick={openInNewWindow} variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  فتح في نافذة جديدة
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* منطقة المسح */}
          <div className="relative">
            <div 
              id={elementId}
              onClick={handleVideoClick}
              className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl cursor-pointer"
              style={{ minHeight: '350px', maxHeight: '450px' }}
            >
              {!cameraReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
                  <div className="text-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                    <p className="text-lg font-semibold">تحضير الكاميرا...</p>
                    <p className="text-sm opacity-80">يرجى السماح للكاميرا</p>
                  </div>
                </div>
              )}
              
              {cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-white/50 rounded-lg">
                    <div className="w-full h-full border-2 border-green-500/70 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* زر الفلاش */}
            {cameraReady && hasFlash && (
              <div className="absolute top-4 right-4">
                <Button
                  onClick={toggleFlash}
                  variant={flashEnabled ? "default" : "outline"}
                  size="sm"
                  className="bg-black/50 hover:bg-black/70 text-white border-white/30"
                >
                  {flashEnabled ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <ZapOff className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* حالة النشاط */}
          {cameraReady && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">📷 الكاميرا نشطة!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-sm font-medium text-green-600">
                📱 انقر على الشاشة لمحاكاة مسح QR Code
              </p>
              {hasFlash && (
                <p className="text-xs text-green-500 mt-1">
                  💡 استخدم زر الفلاش في الأعلى
                </p>
              )}
            </div>
          )}

          {/* رسائل الخطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{error}</p>
                <Button
                  onClick={startCamera}
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