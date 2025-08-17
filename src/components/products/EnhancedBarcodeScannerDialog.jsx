import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, Flashlight, FlashlightOff, ShoppingCart, Package, Search } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useCart } from '@/hooks/useCart';
import { findProductByBarcode } from '@/lib/barcode-utils';

const EnhancedBarcodeScannerDialog = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  mode = 'scan', // 'scan', 'cart', 'inventory'
  title = "قارئ الـ QR Code الذكي"
}) => {
  const readerRef = useRef(null);
  const videoTrackRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const { allProducts: products } = useInventory();
  const { addFromQRScan } = useCart();

  useEffect(() => {
    if (open) {
      setError(null);
      setIsScanning(false);
      setFoundProduct(null);
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    try {
      setError(null);
      
      // طلب صلاحية الكاميرا
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permissionError) {
        setError("🚫 يجب السماح للكاميرا أولاً. اضغط 'السماح' عند ظهور الطلب.");
        return;
      }
      
      // التحقق من الكاميرات المتاحة
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setError("لا توجد كاميرا متاحة");
        return;
      }

      const html5QrCode = new Html5Qrcode("reader");
      readerRef.current = html5QrCode;

      // إعدادات محسنة للهواتف المحمولة
      const config = {
        fps: 30,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.85);
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        async (decodedText, decodedResult) => {
          // منع المسح المتكرر
          const now = Date.now();
          if (now - lastScanTimeRef.current < 1000) return;
          lastScanTimeRef.current = now;
          
          console.log("🎯 تم قراءة كود:", decodedText);
          setScanCount(prev => prev + 1);
          
          await handleScanResult(decodedText);
        },
        (errorMessage) => {
          // تجاهل أخطاء عدم وجود كود
        }
      );

      // إعداد الفلاش
      await setupFlash();
      setIsScanning(true);

    } catch (err) {
      console.error("خطأ في تشغيل المسح:", err);
      setError(`خطأ في تشغيل قارئ الباركود: ${err.message}`);
      setIsScanning(false);
    }
  };

  const setupFlash = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      const track = stream.getVideoTracks()[0];
      videoTrackRef.current = track;
      const capabilities = track.getCapabilities();
      setHasFlash(!!capabilities.torch);
    } catch (e) {
      console.log("Flash not supported");
    }
  };

  const handleScanResult = async (decodedText) => {
    let parsedData = decodedText;
    let productInfo = null;
    
    try {
      // محاولة تحليل JSON
      const jsonData = JSON.parse(decodedText);
      if (jsonData && (jsonData.type === 'product' || jsonData.product_id)) {
        productInfo = { ...jsonData, barcode: decodedText };
      }
    } catch (e) {
      // نص بسيط
    }

    // البحث عن المنتج في المخزون
    const searchResult = findProductByBarcode(decodedText, products || []);
    if (searchResult) {
      setFoundProduct(searchResult);
      
      if (mode === 'cart') {
        // إضافة مباشرة للسلة
        const success = addFromQRScan(decodedText, products);
        if (success) {
          // صوت نجاح
          playSuccessSound();
          toast({
            title: "✅ تمت الإضافة للسلة",
            description: `${searchResult.product.name} - ${searchResult.variant?.color || 'افتراضي'} - ${searchResult.variant?.size || 'افتراضي'}`,
            variant: "success"
          });
        }
      } else {
        toast({
          title: "✅ تم العثور على المنتج",
          description: `${searchResult.product.name}`,
          variant: "success"
        });
      }
    } else {
      toast({
        title: "⚠️ المنتج غير موجود",
        description: `الباركود: ${decodedText.substring(0, 20)}`,
        variant: "destructive"
      });
    }

    playSuccessSound();
    
    // إرسال النتيجة
    if (onScanSuccess) {
      onScanSuccess(productInfo || parsedData, searchResult);
    }
  };

  const playSuccessSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgBSmEyvLZhj8IFWm98OyfUgwOUarm0nQgBSl+y/LVey0GO2q+8N2bSDsBJXfH89mTRAsVWLPn7q1cEgBHmN/nynkiBjR+zfP');
      audio.volume = 0.15;
      audio.play();
    } catch (e) {}
  };

  const stopScanner = async () => {
    try {
      if (readerRef.current && readerRef.current.isScanning) {
        await readerRef.current.stop();
      }
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
    } catch (err) {
      console.error("خطأ في إيقاف المسح:", err);
    }
    setIsScanning(false);
    setFlashEnabled(false);
  };

  const toggleFlash = async () => {
    if (!videoTrackRef.current || !hasFlash) return;
    
    try {
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: !flashEnabled }]
      });
      setFlashEnabled(!flashEnabled);
      
      toast({
        title: flashEnabled ? "⚫ تم إطفاء الفلاش" : "💡 تم تشغيل الفلاش",
        variant: "success"
      });
    } catch (err) {
      console.error("خطأ في الفلاش:", err);
      toast({
        title: "❌ خطأ في الفلاش",
        description: "لا يمكن تشغيل الفلاش على هذا الجهاز",
        variant: "destructive"
      });
    }
  };

  const handleManualSearch = () => {
    if (!manualInput.trim()) {
      setError('يرجى إدخال الباركود');
      return;
    }
    handleScanResult(manualInput.trim());
    setManualInput('');
  };

  const handleAddToCart = () => {
    if (!foundProduct) return;
    
    const success = addFromQRScan(foundProduct.variant?.barcode || foundProduct.product.barcode, products);
    if (success) {
      setFoundProduct(null);
    }
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'cart': return <ShoppingCart className="w-6 h-6" />;
      case 'inventory': return <Package className="w-6 h-6" />;
      default: return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="5" height="5" fill="currentColor"/>
          <rect x="3" y="16" width="5" height="5" fill="currentColor"/>
          <rect x="16" y="3" width="5" height="5" fill="currentColor"/>
          <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
          <rect x="5" y="5" width="1" height="1" fill="white"/>
          <rect x="5" y="18" width="1" height="1" fill="white"/>
          <rect x="18" y="5" width="1" height="1" fill="white"/>
        </svg>
      );
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'cart': return '🛒 امسح لإضافة منتجات للسلة مباشرة';
      case 'inventory': return '📦 امسح لإدارة المخزون والجرد';
      default: return '📱 وجه الكاميرا للكود للحصول على تفاصيل كاملة';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            {getModeIcon()}
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {getModeDescription()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* أزرار التحكم */}
          {isScanning && (
            <div className="flex justify-center gap-3">
              {hasFlash && (
                <Button
                  variant={flashEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleFlash}
                  className="flex items-center gap-2"
                >
                  {flashEnabled ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
                  {flashEnabled ? "إطفاء الفلاش" : "تشغيل الفلاش"}
                </Button>
              )}
            </div>
          )}

          {/* منطقة المسح */}
          <div 
            id="reader" 
            className="w-full rounded-xl overflow-hidden border-4 border-primary/50 bg-black shadow-2xl"
            style={{ minHeight: '350px', maxHeight: '450px' }}
          />

          {/* البحث اليدوي */}
          <div className="space-y-2">
            <label className="text-sm font-medium">أو أدخل الباركود يدوياً:</label>
            <div className="flex gap-2">
              <Input
                placeholder="امسح أو اكتب الباركود"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
              />
              <Button onClick={handleManualSearch} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* عرض المنتج المكتشف */}
          {foundProduct && mode !== 'cart' && (
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-primary">تم العثور على المنتج:</h4>
              <div className="space-y-1">
                <div><strong>الاسم:</strong> {foundProduct.product.name}</div>
                {foundProduct.variant && (
                  <>
                    <div><strong>اللون:</strong> {foundProduct.variant.color}</div>
                    <div><strong>المقاس:</strong> {foundProduct.variant.size}</div>
                    <div><strong>المخزون:</strong> {foundProduct.variant.quantity}</div>
                  </>
                )}
              </div>
              
              {mode === 'scan' && (
                <div className="flex gap-2">
                  <Button onClick={handleAddToCart} className="flex-1">
                    <ShoppingCart className="w-4 h-4 ml-2" />
                    إضافة للسلة
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center gap-3 text-green-700 mb-2">
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-bold text-lg">🚀 قراءة QR Code نشطة!</span>
                <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-600">
                  ⚡ يقرأ QR Codes مع التفاصيل الكاملة للمنتجات
                </p>
                {scanCount > 0 && (
                  <p className="text-xs text-primary font-bold">
                    📊 تم قراءة {scanCount} كود
                  </p>
                )}
                {hasFlash && (
                  <p className="text-xs text-purple-600 font-medium">
                    💡 استخدم الفلاش في الإضاءة المنخفضة
                  </p>
                )}
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
            <AlertDescription>
              {error}
              <br />
              <strong>💡 للحل:</strong> تأكد من السماح للكاميرا وأعد تحميل الصفحة
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

export default EnhancedBarcodeScannerDialog;