import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, Flashlight, FlashlightOff } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import jsQR from 'jsqr';

const WorkingQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR" 
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // بدء الكاميرا
  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🚀 Starting camera...');

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported');
      }

      // أبسط إعدادات ممكنة
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: { ideal: "environment" }
        }
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // fallback to any camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        const video = videoRef.current;
        video.setAttribute('playsinline', true);
        video.setAttribute('webkit-playsinline', true);
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play()
              .then(() => {
                console.log('✅ Video playing');
                // Check for flash capability
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities();
                setHasFlash(!!capabilities.torch);
                
                startScanning();
                setIsLoading(false);
                resolve();
              })
              .catch(reject);
          };
          video.onerror = reject;
        });
      }

    } catch (err) {
      console.error('❌ Camera error:', err);
      let message = 'فشل في تشغيل الكاميرا';
      
      if (err.name === 'NotAllowedError') {
        message = 'رُفض إذن الكاميرا - اسمح بالوصول للكاميرا';
      } else if (err.name === 'NotFoundError') {
        message = 'لا توجد كاميرا متاحة';
      } else if (err.name === 'NotReadableError') {
        message = 'الكاميرا مستخدمة في تطبيق آخر';
      }
      
      setError(message);
      setIsLoading(false);
    }
  }, []);

  // بدء المسح
  const startScanning = useCallback(() => {
    if (animationRef.current) return;
    
    console.log('🔍 Starting QR scan...');
    
    const scan = () => {
      if (!videoRef.current || !canvasRef.current || !streamRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code && code.data) {
              console.log('🎯 QR Found:', code.data);
              handleQRDetected(code.data);
              return;
            }
          } catch (e) {
            // Silent fail for scan errors
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(scan);
    };
    
    animationRef.current = requestAnimationFrame(scan);
  }, []);

  // عند العثور على QR
  const handleQRDetected = useCallback((qrCode) => {
    console.log('🎯 QR Detected:', qrCode);
    stopCamera();
    onScanSuccess?.(qrCode);
    toast({
      title: "تم مسح QR بنجاح!",
      description: `القيمة: ${qrCode.substring(0, 50)}...`,
    });
    onOpenChange(false);
  }, [onScanSuccess, onOpenChange]);

  // إيقاف الكاميرا
  const stopCamera = useCallback(() => {
    console.log('🛑 Stopping camera...');
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setFlashEnabled(false);
    setHasFlash(false);
  }, []);

  // تبديل الفلاش
  const toggleFlash = useCallback(async () => {
    try {
      if (!streamRef.current) return;
      
      const track = streamRef.current.getVideoTracks()[0];
      const newState = !flashEnabled;
      
      await track.applyConstraints({
        advanced: [{ torch: newState }]
      });
      
      setFlashEnabled(newState);
      toast({
        title: newState ? "تم تشغيل الفلاش" : "تم إطفاء الفلاش",
      });
    } catch (err) {
      console.log('Flash not supported');
    }
  }, [flashEnabled]);

  // تشغيل/إيقاف عند الفتح
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {title}
            </div>
            {hasFlash && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFlash}
                className="h-8 w-8 p-0"
              >
                {flashEnabled ? (
                  <FlashlightOff className="w-4 h-4" />
                ) : (
                  <Flashlight className="w-4 h-4" />
                )}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* منطقة الكاميرا */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* إطار المسح */}
            {!isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white rounded-lg">
                  <div className="w-full h-full border-2 border-green-400 rounded-lg animate-pulse"></div>
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm">
                  وجّه الكاميرا نحو QR Code
                </div>
              </div>
            )}

            {/* حالة التحميل */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p>جاري تشغيل الكاميرا...</p>
                </div>
              </div>
            )}

            {/* رسالة الخطأ */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                <div className="text-white text-center p-4">
                  <p className="mb-2">{error}</p>
                  <Button
                    onClick={startCamera}
                    size="sm"
                    variant="secondary"
                  >
                    إعادة المحاولة
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Canvas مخفي */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* أزرار التحكم */}
          <div className="flex gap-2">
            <Button 
              onClick={() => onOpenChange(false)} 
              variant="outline" 
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkingQRScanner;