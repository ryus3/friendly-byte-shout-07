import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UnifiedQRScanner from '@/components/shared/UnifiedQRScanner';
import { toast } from '@/hooks/use-toast';
import { QrCode, TestTube, CheckCircle } from 'lucide-react';

const QRTestComponent = () => {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);

  const handleScanSuccess = (result) => {
    console.log('✅ نتيجة المسح:', result);
    setLastScanResult(result);
    setScannerOpen(false);
    
    toast({
      title: "✅ اختبار QR Code نجح!",
      description: typeof result === 'object' 
        ? `منتج: ${result.product_name || 'غير محدد'}` 
        : `البيانات: ${result.substring(0, 30)}${result.length > 30 ? '...' : ''}`,
      variant: "success"
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TestTube className="w-5 h-5 text-green-600" />
          اختبار قارئ QR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={() => setScannerOpen(true)}
          className="w-full flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          <QrCode className="w-4 h-4" />
          تشغيل القارئ الموحد
        </Button>
        
        {lastScanResult && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">آخر نتيجة مسح ناجحة:</span>
            </div>
            <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-20">
              {JSON.stringify(lastScanResult, null, 2)}
            </pre>
          </div>
        )}
        
        <UnifiedQRScanner 
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onScanSuccess={handleScanSuccess}
          title="🧪 اختبار قارئ QR الموحد"
          description="قم بمسح أي QR Code للتأكد من عمل النظام بشكل صحيح"
          elementId="test-qr-reader"
        />
      </CardContent>
    </Card>
  );
};

export default QRTestComponent;