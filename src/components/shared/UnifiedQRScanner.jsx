import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, Loader2, RefreshCw, Zap, ZapOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useQRScanner } from '@/hooks/useQRScanner';

const UnifiedQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR Code",
  description = "وجه الكاميرا نحو QR Code",
  elementId = "unified-qr-reader"
}) => {
  const { 
    isScanning, 
    error, 
    hasFlash, 
    flashEnabled, 
    startScanning, 
    stopScanning, 
    toggleFlash 
  } = useQRScanner(onScanSuccess);

  // محاكاة scan عند النقر على الشاشة
  const handleVideoClick = () => {
    if (isScanning && onScanSuccess) {
      // محاكاة قراءة QR code للاختبار
      const testCode = prompt('أدخل QR Code للاختبار:');
      if (testCode) {
        onScanSuccess(testCode);
        toast({
          title: "تم مسح QR Code",
          description: `القيمة: ${testCode}`,
        });
      }
    }
  };

  React.useEffect(() => {
    if (open && !isScanning && !error) {
      const timer = setTimeout(() => {
        startScanning(elementId);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!open) {
      stopScanning();
    }
  }, [open, isScanning, error, startScanning, stopScanning, elementId]);

  React.useEffect(() => {
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
              onClick={handleVideoClick}
              className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl cursor-pointer"
              style={{ minHeight: '350px', maxHeight: '450px' }}
            >
              {!isScanning && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
                  <div className="text-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-3" />
                    <p className="text-lg font-semibold">تحضير الكاميرا...</p>
                    <p className="text-sm opacity-80">يرجى السماح للكاميرا</p>
                  </div>
                </div>
              )}
              
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-white/50 rounded-lg">
                    <div className="w-full h-full border-2 border-green-500/70 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* أزرار التحكم */}
            {isScanning && hasFlash && (
              <div className="absolute top-4 right-4 flex gap-2">
                <Button
                  onClick={toggleFlash}
                  variant={flashEnabled ? "default" : "outline"}
                  size="sm"
                  className="bg-black/50 hover:bg-black/70 text-white border-white/30"
                >
                  {flashEnabled ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <ZapOff className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">📷 الكاميرا نشطة!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-sm font-medium text-green-600">
                📱 انقر على الشاشة لمحاكاة مسح QR Code
              </p>
              {hasFlash && (
                <p className="text-xs text-green-500 mt-1">
                  💡 استخدم زر الفلاش في الأعلى
                </p>
              )}
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

          {/* نصائح */}
          {!error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Camera className="w-4 h-4" />
                <span className="font-semibold text-sm">نصائح:</span>
              </div>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• اسمح للموقع بالوصول للكاميرا</li>
                <li>• انقر على الشاشة لمحاكاة مسح QR</li>
                <li>• استخدم زر الفلاش في الإضاءة المنخفضة</li>
              </ul>
            </div>
          )}
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