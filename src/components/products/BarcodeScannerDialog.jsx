import React from 'react';
import UnifiedQRScanner from '@/components/shared/UnifiedQRScanner';

/**
 * قارئ الباركود الأصلي - يستخدم useQRScanner مع الفلاش
 */
const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }) => {
  return (
    <UnifiedQRScanner
      open={open}
      onOpenChange={onOpenChange}
      onScanSuccess={onScanSuccess}
      title="🔍 قارئ الباركود الذكي"
      description="📱 يقرأ: QR Codes وجميع أنواع الباركود. وجه الكاميرا للكود للحصول على تفاصيل كاملة"
      elementId="barcode-scanner-reader"
    />
  );
};

export default BarcodeScannerDialog;