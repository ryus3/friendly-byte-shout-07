import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle } from 'lucide-react';

const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  const readerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setIsScanning(true);
      
      const startScanner = async () => {
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length) {
            const html5QrCode = new Html5Qrcode("reader");
            readerRef.current = html5QrCode;

            // استخدام الكاميرا الخلفية مع إعدادات محسنة للسرعة
            const cameraId = cameras.find(camera => 
              camera.label.toLowerCase().includes('back') || 
              camera.label.toLowerCase().includes('rear')
            )?.id || cameras[0].id;

            await html5QrCode.start(
              cameraId,
              {
                fps: 30, // زيادة معدل الإطارات للمسح السريع
                qrbox: { width: 300, height: 200 }, // منطقة مسح أكبر
                aspectRatio: 1.0,
                disableFlip: false, // تمكين قلب الصورة
              },
              (decodedText, decodedResult) => {
                // مسح ناجح - إضافة فورية
                console.log("Barcode scanned:", decodedText);
                onScanSuccess(decodedText);
                // عدم إغلاق النافذة للمسح المستمر
                // onOpenChange(false);
              },
              (errorMessage) => {
                // تجاهل أخطاء المسح العادية للحصول على أداء أفضل
              }
            );
            setIsScanning(true);
          }
        } catch (err) {
          console.error("Camera error:", err);
          setError("فشل في تشغيل الكاميرا. تأكد من منح الإذن للوصول إلى الكاميرا.");
          setIsScanning(false);
        }
      };
      
      startScanner();
    } else {
      setIsScanning(false);
    }

    return () => {
      if (readerRef.current && readerRef.current.isScanning) {
        readerRef.current.stop().catch(err => console.error("Failed to stop scanner", err));
        setIsScanning(false);
      }
    };
  }, [open, onScanSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 4v16M10 4v16M14 4v16M18 4v16" />
            </svg>
            مسح الباركود السريع
          </DialogTitle>
          <DialogDescription>
            وجّه الكاميرا نحو الباركود. سيتم إضافة المنتجات تلقائياً عند المسح.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div 
            id="reader" 
            className="w-full rounded-lg overflow-hidden border-2 border-primary/20"
            style={{ minHeight: '300px' }}
          />
          
          {isScanning && (
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-primary">
                <div className="animate-pulse w-2 h-2 bg-primary rounded-full"></div>
                <span className="font-medium">جاهز للمسح...</span>
                <div className="animate-pulse w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                مرر الكاميرا فوق الباركود لإضافة المنتج فوراً
              </p>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في الكاميرا</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;