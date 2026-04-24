import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import InvoiceSyncSettings from './InvoiceSyncSettings';
import { Activity } from 'lucide-react';

/**
 * 🚀 Dialog wrapper for the Unified Sync Center
 */
const InvoiceSyncSettingsDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Activity className="w-5 h-5 text-primary" />
            مركز المزامنة الموحّد
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-2 overflow-y-auto max-h-[calc(90vh-80px)]">
          <InvoiceSyncSettings />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceSyncSettingsDialog;
