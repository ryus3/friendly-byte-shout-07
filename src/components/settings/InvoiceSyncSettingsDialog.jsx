import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import InvoiceSyncSettings from './InvoiceSyncSettings';

/**
 * Dialog wrapper for InvoiceSyncSettings
 */
const InvoiceSyncSettingsDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            جدولة مزامنة الفواتير
          </DialogTitle>
        </DialogHeader>
        <InvoiceSyncSettings />
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceSyncSettingsDialog;
