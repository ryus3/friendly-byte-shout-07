import React from 'react';
import MobileQRScanner from '@/components/qr/MobileQRScanner';

/**
 * مكون توافق عكسي لـ BarcodeScannerDialog
 * يستخدم الآن UnifiedQRScanner الموحد
 */
const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  return (
    <MobileQRScanner
      open={open}
      onOpenChange={onOpenChange}
      onScanSuccess={onScanSuccess}
      title="قارئ الباركود للهاتف"
      elementId="barcode-scanner-reader"
    />
  );
};

export default BarcodeScannerDialog;