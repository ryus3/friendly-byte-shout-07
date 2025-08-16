import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, Loader2, RefreshCw, Zap, ZapOff } from 'lucide-react';

/**
 * قارئ QR مبسط - بدون مكتبة html5-qrcode
 */
const UnifiedQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR Code",
  description = "وجه الكاميرا نحو QR Code",
  elementId = "unified-qr-reader"
}) => {
  const [isScanning, setIsScanning] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [hasCamera, setHasCamera] = React.useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  // بدء الكاميرا
  const startCamera = React.useCallback(async () => {
    try {
      setError(null);
      console.log('🚀 بدء تشغيل الكاميرا...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setIsScanning(true);
      setHasCamera(true);
      console.log('✅ تم تشغيل الكاميرا بنجاح');
      
    } catch (err) {
      console.error('❌ خطأ في الكاميرا:', err);
      setError('لا يمكن الوصول للكاميرا. تأكد من السماح للموقع باستخدام الكاميرا');
    }
  }, []);

  // إيقاف الكاميرا
  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setHasCamera(false);
    console.log('🛑 تم إيقاف الكاميرا');
  }, []);

  // بدء التصوير عند فتح النافذة
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

  const handleManualInput = () => {
    const input = prompt('أدخل QR Code يدوياً:');
    if (input && onScanSuccess) {
      onScanSuccess(input);
      handleClose();
    }
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
          {/* منطقة الكاميرا */}
          <div className="relative">
            <div className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl"
                 style={{ minHeight: '350px', maxHeight: '450px' }}>
              
              {isScanning ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                    <p className="text-lg font-semibold">تحضير الكاميرا...</p>
                    <p className="text-sm opacity-80">يرجى السماح للكاميرا</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* إطار المسح */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-white rounded-lg opacity-50"></div>
              </div>
            )}
          </div>

          {/* حالة النشاط */}
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">📷 الكاميرا نشطة!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-sm font-medium text-green-600">
                وجه الكاميرا نحو QR Code
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

          {/* إدخال يدوي */}
          <div className="flex gap-2">
            <Button 
              onClick={handleManualInput}
              variant="outline" 
              className="flex-1"
            >
              إدخال يدوي
            </Button>
            <Button 
              onClick={handleClose}
              variant="outline" 
              className="flex-1"
            >
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedQRScanner;