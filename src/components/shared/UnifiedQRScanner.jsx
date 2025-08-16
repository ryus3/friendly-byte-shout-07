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
  console.log('🔥 [QR Component] تم تحميل UnifiedQRScanner!');
  
  const { 
    isScanning, 
    error, 
    hasFlash, 
    flashEnabled, 
    startScanning, 
    stopScanning, 
    toggleFlash 
  } = useQRScanner(onScanSuccess);

  React.useEffect(() => {
    console.log('🔄 [QR Component] تغير حالة open:', open);
    
    if (open && !isScanning && !error) {
      console.log('⏰ [QR Component] سيبدأ المسح خلال 500ms...');
      const timer = setTimeout(() => {
        console.log('🚀 [QR Component] بدء المسح الآن!');
        startScanning(elementId);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!open) {
      console.log('🛑 [QR Component] إغلاق المسح...');
      stopScanning();
    }
  }, [open, isScanning, error, startScanning, stopScanning, elementId]);

  React.useEffect(() => {
    return () => {
      console.log('🧹 [QR Component] تنظيف المكون...');
      stopScanning();
    };
  }, [stopScanning]);

  const handleClose = () => {
    console.log('❌ [QR Component] المستخدم أغلق الحوار');
    stopScanning();
    onOpenChange(false);
  };

  const handleRetry = () => {
    console.log('🔄 [QR Component] إعادة المحاولة...');
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
            
            {/* أزرار التحكم في الكاميرا */}
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
              {hasFlash && (
                <p className="text-xs text-green-500 mt-1">
                  💡 استخدم زر الفلاش في الأعلى للإضاءة
                </p>
              )}
            </div>
          )}
          </div>

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
          {!error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Camera className="w-4 h-4" />
                <span className="font-semibold text-sm">نصائح للاستخدام:</span>
              </div>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• تأكد من وجود إضاءة كافية</li>
                <li>• اجعل QR Code واضحاً ومسطحاً</li>
                <li>• احتفظ بمسافة مناسبة (10-20 سم)</li>
                <li>• اسمح للموقع بالوصول للكاميرا</li>
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