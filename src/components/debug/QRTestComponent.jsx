import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import { toast } from '@/components/ui/use-toast';
import { QrCode, TestTube } from 'lucide-react';

const QRTestComponent = () => {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);

  const handleScanSuccess = (result) => {
    console.log('✅ نتيجة المسح:', result);
    setLastScanResult(result);
    setScannerOpen(false);
    
    toast({
      title: "✅ تم قراءة QR Code بنجاح",
      description: typeof result === 'object' 
        ? `منتج: ${result.product_name}` 
        : `البيانات: ${result}`,
      variant: "success"
    });
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          اختبار قارئ QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={() => setScannerOpen(true)}
          className="w-full flex items-center gap-2"
        >
          <QrCode className="w-4 h-4" />
          تشغيل قارئ QR Code
        </Button>
        
        {lastScanResult && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-semibold text-sm mb-2">آخر نتيجة مسح:</p>
            <pre className="text-xs bg-background p-2 rounded overflow-auto">
              {JSON.stringify(lastScanResult, null, 2)}
            </pre>
          </div>
        )}
        
        <BarcodeScannerDialog 
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onScanSuccess={handleScanSuccess}
        />
      </CardContent>
    </Card>
  );
};

export default QRTestComponent;