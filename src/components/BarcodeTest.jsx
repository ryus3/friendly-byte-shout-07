import React from 'react';
import Barcode from 'react-barcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BarcodeTest = () => {
  const testBarcodes = [
    'PROD-جوز-S-NQMC',
    'PRDPROMA298371',
    'TSTGEN584712AB',
    'WSHCAZFS5847M'
  ];

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>اختبار عرض الباركود</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {testBarcodes.map((barcode, index) => (
          <div key={index} className="border rounded p-4 bg-white">
            <p className="font-mono text-sm mb-2">{barcode}</p>
            <div className="flex justify-center">
              <Barcode 
                value={barcode} 
                height={60}
                width={2}
                fontSize={12}
                displayValue={true}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BarcodeTest;