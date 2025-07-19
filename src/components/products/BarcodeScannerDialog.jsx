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
          // طلب أذونات الكاميرا بشكل صريح
          await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
          }).then(stream => {
            stream.getTracks().forEach(track => track.stop());
          });

          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length) {
            const html5QrCode = new Html5Qrcode("reader");
            readerRef.current = html5QrCode;

            // تحسين إعدادات المسح للايفون
            const config = {
              fps: 10,
              qrbox: { width: 200, height: 120 },
              aspectRatio: 1.0,
              disableFlip: false,
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
              }
            };

            await html5QrCode.start(
              { facingMode: "environment" },
              config,
              (decodedText, decodedResult) => {
                console.log("✅ Scan successful:", decodedText);
                onScanSuccess(decodedText);
              },
              (errorMessage) => {
                // تجاهل أخطاء المسح العادية
              }
            );
            setIsScanning(true);
          }
        } catch (err) {
          console.error("❌ Camera error:", err);
          setError("فشل في تشغيل الكاميرا. في الايفون: انتقل لإعدادات Safari > الكاميرا > اسمح");
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