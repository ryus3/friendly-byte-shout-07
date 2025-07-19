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
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [capabilities, setCapabilities] = useState(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setIsScanning(true);
      
      const startScanner = async () => {
        try {
          // طلب أذونات الكاميرا مع الفلاش
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            } 
          });
          
          // حفظ إمكانيات الكاميرا للفلاش
          const track = stream.getVideoTracks()[0];
          setCapabilities(track.getCapabilities());
          stream.getTracks().forEach(track => track.stop());

          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length) {
            const html5QrCode = new Html5Qrcode("reader");
            readerRef.current = html5QrCode;

            // إعدادات مثالية لقراءة الباركود والـ QR
            const config = {
              fps: 30, // زيادة معدل الإطارات للحساسية العالية
              qrbox: function(viewfinderWidth, viewfinderHeight) {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                return {
                  width: Math.floor(minEdge * 0.8),
                  height: Math.floor(minEdge * 0.6)
                };
              },
              aspectRatio: 1.0,
              disableFlip: false,
              // تحسينات متقدمة للقراءة
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
              },
              // إعدادات الفيديو المحسنة
              videoConstraints: {
                facingMode: "environment",
                focusMode: "continuous",
                exposureMode: "continuous",
                whiteBalanceMode: "continuous"
              },
              // تحسين دقة القراءة
              rememberLastUsedCamera: true
            };

            await html5QrCode.start(
              { facingMode: "environment" },
              config,
              (decodedText, decodedResult) => {
                console.log("✅ تم المسح بنجاح:", decodedText);
                // صوت نجاح المسح
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgBSmEyvLZhj8IFWm98OyfUgwOUarm0nQgBSl+y/LVey0GO2q+8N2bSDsBJXfH89mTRAsVWLPn7q1cEgBHmN/nynkiBjR+zfP');
                audio.play().catch(() => {});
                onScanSuccess(decodedText);
              },
              (errorMessage) => {
                // تجاهل أخطاء المسح العادية (عدم وجود كود)
              }
            );
            setIsScanning(true);
          }
        } catch (err) {
          console.error("❌ خطأ في الكاميرا:", err);
          setError("خطأ في تشغيل الكاميرا. تأكد من منح الأذونات والتأكد من عدم استخدام كاميرا من تطبيق آخر");
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

  // وظيفة تشغيل/إطفاء الفلاش
  const toggleFlash = async () => {
    if (readerRef.current && capabilities?.torch) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        const track = stream.getVideoTracks()[0];
        await track.applyConstraints({
          advanced: [{ torch: !flashEnabled }]
        });
        setFlashEnabled(!flashEnabled);
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Flash error:", err);
      }
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
            قارئ الباركود السريع
          </DialogTitle>
          <DialogDescription className="text-sm">
            📱 <strong>للايفون:</strong> تأكد من السماح لـ Safari بالوصول للكاميرا في الإعدادات<br/>
            🎯 <strong>وجه الكاميرا للباركود</strong> - سيتم إضافة المنتجات تلقائياً للسلة
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* أزرار التحكم */}
          {isScanning && (
            <div className="flex justify-center gap-2 mb-4">
              {capabilities?.torch && (
                <Button
                  variant={flashEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleFlash}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {flashEnabled ? "إطفاء الفلاش" : "تشغيل الفلاش"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2"
              >
                إغلاق المسح
              </Button>
            </div>
          )}

          <div 
            id="reader" 
            className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-gray-900 shadow-2xl"
            style={{ minHeight: '350px', maxHeight: '450px' }}
          />
          
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">🔍 قارئ نشط ومحسن!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-600">
                  ✅ يقرأ جميع أنواع الباركود والـ QR بحساسية عالية
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  💡 وجه الكاميرا نحو الكود على مسافة 10-30 سم
                </p>
                <p className="text-xs text-purple-600 font-medium">
                  🚀 يعمل مع الإضاءة المنخفضة - استخدم الفلاش عند الحاجة
                </p>
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
            إغلاق القارئ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;