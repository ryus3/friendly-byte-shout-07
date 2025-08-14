import React from 'react';
import NativeQRScanner from '@/components/qr/NativeQRScanner';

/**
 * مكون توافق عكسي لـ BarcodeScannerDialog
 * يستخدم الآن UnifiedQRScanner الموحد
 */
const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  return (
    <NativeQRScanner
      open={open}
      onOpenChange={onOpenChange}
      onScanSuccess={onScanSuccess}
      title="قارئ QR Code المحسن"
    />
  );
};

export default BarcodeScannerDialog;