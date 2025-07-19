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

            // البحث عن الكاميرا الخلفية أولاً
            const backCamera = cameras.find(camera => 
              camera.label.toLowerCase().includes('back') || 
              camera.label.toLowerCase().includes('rear') ||
              camera.label.toLowerCase().includes('environment')
            );
            
            const cameraConfig = backCamera ? backCamera.id : { facingMode: "environment" };

            await html5QrCode.start(
              cameraConfig,
              {
                fps: 20, // تقليل معدل الإطارات قليلاً للاستقرار
                qrbox: function(viewfinderWidth, viewfinderHeight) {
                  // صندوق مسح متجاوب
                  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                  const qrboxSize = Math.floor(minEdge * 0.7);
                  return {
                    width: qrboxSize,
                    height: qrboxSize * 0.7
                  };
                },
                aspectRatio: 1.777778, // 16:9
                disableFlip: false,
                videoConstraints: {
                  facingMode: "environment" // فرض استخدام الكاميرا الخلفية
                }
              },
              (decodedText, decodedResult) => {
                // مسح ناجح
                console.log("Barcode scanned successfully:", decodedText);
                onScanSuccess(decodedText);
              },
              (errorMessage) => {
                // تجاهل أخطاء المسح العادية
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
              <rect x="3" y="5" width="18" height="14" stroke="currentColor" strokeWidth="2" fill="none" rx="2"/>
              <path d="M5 8h1M5 10h1M5 12h1M5 14h1M5 16h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 8h2M8 10h1M8 12h2M8 14h1M8 16h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 8h1M12 10h2M12 12h1M12 14h2M12 16h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 8h2M16 10h1M16 12h2M16 14h1M16 16h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            قارئ الباركود السريع
          </DialogTitle>
          <DialogDescription className="text-sm">
            🎯 <strong>وجه الكاميرا للباركود</strong> - سيتم إضافة المنتجات تلقائياً للسلة
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div 
            id="reader" 
            className="w-full rounded-xl overflow-hidden border-2 border-primary/30 bg-gray-900"
            style={{ minHeight: '300px', maxHeight: '400px' }}
          />
          
          {isScanning && (
            <div className="text-center p-4 bg-green-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold">📱 الكاميرا الخلفية نشطة!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-green-600">
                  ✅ وجه الهاتف للباركود على الملصق
                </p>
                <p className="text-xs text-green-500">
                  🚀 المنتجات ستضاف للسلة فوراً عند القراءة
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  💡 اتركها مفتوحة لمسح عدة منتجات متتالية
                </p>
              </div>
            </div>
          )}
          
          {!isScanning && !error && (
            <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-blue-600">
                <span className="font-medium">🔄 جاري تشغيل الكاميرا الخلفية...</span>
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
              <strong>💡 للهاتف:</strong> تأكد من تمكين الكاميرا وأغلق التطبيقات الأخرى التي تستخدمها
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