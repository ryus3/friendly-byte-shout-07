import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle } from 'lucide-react';

const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  const readerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      const startScanner = async () => {
        try {
          await Html5Qrcode.getCameras();
          const html5QrCode = new Html5Qrcode("reader");
          readerRef.current = html5QrCode;

          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText, decodedResult) => {
              onScanSuccess(decodedText);
              onOpenChange(false);
            },
            (errorMessage) => {
              // handle scan failure, usually better to ignore
            }
          ).catch(err => {
            setError("فشل تشغيل الكاميرا. يرجى التأكد من منح الإذن والتحقق من عدم استخدامها بواسطة تطبيق آخر.");
            console.error(err);
          });
        } catch (err) {
          setError("لم يتم العثور على كاميرا أو تم رفض الإذن. يرجى تمكين الوصول إلى الكاميرا في إعدادات المتصفح.");
          console.error(err);
        }
      };
      startScanner();
    }

    return () => {
      if (readerRef.current && readerRef.current.isScanning) {
        readerRef.current.stop().catch(err => console.error("Failed to stop scanner", err));
      }
    };
  }, [open, onOpenChange, onScanSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera />
            مسح الباركود
          </DialogTitle>
          <DialogDescription>
            وجّه الكاميرا نحو الباركود لمسحه.
          </DialogDescription>
        </DialogHeader>
        <div id="reader" style={{ width: '100%' }}></div>
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