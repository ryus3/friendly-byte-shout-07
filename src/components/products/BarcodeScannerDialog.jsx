import React from 'react';
import MobileQRScanner from '@/components/qr/MobileQRScanner';

/**
 * قارئ الباركود الأصلي مع الفلاش والشكل الجميل
 */
const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  return (
    <MobileQRScanner
      open={open}
      onOpenChange={onOpenChange}
      onScanSuccess={onScanSuccess}
      title="🔍 قارئ الباركود الذكي"
      elementId="barcode-scanner-reader"
    />
  );
};

export default BarcodeScannerDialog;