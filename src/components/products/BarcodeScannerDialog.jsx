import React from 'react';
import UnifiedQRScanner from '@/components/shared/UnifiedQRScanner';

/**
 * مكون توافق عكسي لـ BarcodeScannerDialog
 * يستخدم الآن UnifiedQRScanner الموحد
 */
const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  return (
    <UnifiedQRScanner
      open={open}
      onOpenChange={onOpenChange}
      onScanSuccess={onScanSuccess}
      title="قارئ الباركود الذكي"
      description="📱 يقرأ: QR Codes وجميع أنواع الباركود. وجه الكاميرا للكود للحصول على تفاصيل كاملة"
      elementId="barcode-scanner-reader"
    />
  );
};

export default BarcodeScannerDialog;