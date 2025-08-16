import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, X, Zap, ZapOff } from 'lucide-react';

const SimpleQRReader = ({ open, onOpenChange, onScanSuccess, title = "قارئ QR" }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // بدء الكاميرا
  const startCamera = async () => {
    try {
      setError(null);
      console.log('🚀 تشغيل الكاميرا...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { min: 320, ideal: 640 },
          height: { min: 240, ideal: 480 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        console.log('✅ الكاميرا تعمل!');
      }
    } catch (err) {
      console.error('❌ خطأ الكاميرا:', err);
      setError('فشل في تشغيل الكاميرا: ' + err.message);
    }
  };

  // إيقاف الكاميرا
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // تشغيل الكاميرا عند الفتح
  useEffect(() => {
    if (open) {
      setTimeout(startCamera, 300);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  // إدخال يدوي
  const handleManualSubmit = () => {
    if (manualInput.trim() && onScanSuccess) {
      onScanSuccess(manualInput.trim());
      onOpenChange(false);
    }
  };

  // محاكاة مسح
  const simulateScan = () => {
    const testCode = `TEST-${Date.now()}`;
    if (onScanSuccess) {
      onScanSuccess(testCode);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[90vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {title}
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* منطقة الكاميرا */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '250px' }}>
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                onClick={simulateScan}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                <div className="text-center">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>انقر "تشغيل الكاميرا"</p>
                </div>
              </div>
            )}
            
            {/* إطار المسح */}
            {cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 border-2 border-white/50 rounded"></div>
              </div>
            )}
          </div>

          {/* رسائل الخطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* حالة نشطة */}
          {cameraActive && (
            <div className="text-center p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-green-700 font-medium">الكاميرا نشطة!</p>
              <p className="text-green-600 text-sm">انقر على الشاشة للمحاكاة</p>
            </div>
          )}

          {/* أزرار التحكم */}
          <div className="flex gap-2">
            {!cameraActive ? (
              <Button onClick={startCamera} className="flex-1">
                تشغيل الكاميرا
              </Button>
            ) : (
              <Button onClick={simulateScan} className="flex-1">
                محاكاة مسح
              </Button>
            )}
            <Button variant="outline" onClick={stopCamera}>
              إيقاف
            </Button>
          </div>

          {/* إدخال يدوي */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">أو أدخل الرمز يدوياً:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="أدخل QR Code..."
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <Button onClick={handleManualSubmit} disabled={!manualInput.trim()}>
                إرسال
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleQRReader;