import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useEnhancedQRScanner } from '@/hooks/useEnhancedQRScanner';

/**
 * قارئ QR موحد ومبسط - يعمل على جميع الأجهزة
 */
const UnifiedQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR Code",
  description = "وجه الكاميرا نحو QR Code",
  elementId = "unified-qr-reader"
}) => {
  // استخدام القارئ المحسن للآيفون
  const { isScanning, error, startScanning, stopScanning } = useEnhancedQRScanner(onScanSuccess);

  // بدء المسح عند فتح الحوار
  useEffect(() => {
    if (open && !isScanning && !error) {
      const timer = setTimeout(() => {
        startScanning(elementId);
      }, 800); // تأخير أطول للآيفون
      return () => clearTimeout(timer);
    } else if (!open) {
      stopScanning();
    }
  }, [open, isScanning, error, startScanning, stopScanning, elementId]);

  // تنظيف عند إغلاق المكون
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const handleClose = () => {
    stopScanning();
    onOpenChange(false);
  };

  const handleRetry = () => {
    startScanning(elementId);
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
          {/* منطقة المسح */}
          <div className="relative">
            <div 
              id={elementId}
              className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl"
              style={{ minHeight: '350px', maxHeight: '450px' }}
            />
            
            {/* طبقة التحميل */}
            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
                <div className="text-center text-white">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                  <p className="text-lg font-semibold">تحضير الكاميرا...</p>
                  <p className="text-sm opacity-80">يرجى السماح للكاميرا</p>
                </div>
              </div>
            )}
          </div>
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">🚀 قارئ QR نشط!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-sm font-medium text-green-600">
                📱 وجه الكاميرا نحو الرمز للحصول على أفضل النتائج
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
                  onClick={handleRetry}
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

          {/* نصائح الاستخدام */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">نصائح للاستخدام:</span>
            </div>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• تأكد من وجود إضاءة كافية</li>
              <li>• اجعل QR Code واضحاً ومسطحاً</li>
              <li>• احتفظ بمسافة مناسبة (10-20 سم)</li>
            </ul>
          </div>
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