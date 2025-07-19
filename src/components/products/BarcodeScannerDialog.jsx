import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
      <DialogContent className="max-w-lg w-[95vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 4v16M10 4v16M14 4v16M18 4v16" />
            </svg>
            مسح الباركود السريع
          </DialogTitle>
          <DialogDescription className="text-sm">
            🔥 <strong>مسح سريع مستمر!</strong> وجّه الكاميرا نحو الباركود وسيتم إضافة المنتجات تلقائياً
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div 
            id="reader" 
            className="w-full rounded-xl overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10"
            style={{ minHeight: '280px', maxHeight: '350px' }}
          />
          
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">📱 الكاميرا جاهزة للمسح!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-green-600">
                  ✅ يعمل على الهاتف والحاسوب
                </p>
                <p className="text-xs text-green-500">
                  🚀 مرر الكاميرا فوق أي باركود - ستتم الإضافة فوراً!
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  💡 نصيحة: اتركها مفتوحة لمسح عشرات المنتجات بسرعة
                </p>
              </div>
            </div>
          )}
          
          {!isScanning && !error && (
            <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-blue-600">
                <span className="font-medium">🔄 جاري تشغيل الكاميرا...</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في الكاميرا</AlertTitle>
            <AlertDescription>
              {error}
              <br />
              <strong>💡 للهاتف:</strong> تأكد من تمكين الكاميرا في إعدادات المتصفح
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-center pt-2">
          <Button 
            onClick={() => onOpenChange(false)} 
            variant="outline" 
            className="w-full hover:bg-muted/80"
          >
            إغلاق المسح
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;