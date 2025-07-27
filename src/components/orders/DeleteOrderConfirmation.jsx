import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteOrderConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  orderNumber?: string;
  loading?: boolean;
}

export const DeleteOrderConfirmation = ({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
  loading = false
}: DeleteOrderConfirmationProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[425px] bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200 dark:border-red-800">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-red-800 dark:text-red-200">
            تأكيد حذف الطلب
          </AlertDialogTitle>
          <AlertDialogDescription className="text-red-700 dark:text-red-300 text-base leading-relaxed">
            هل أنت متأكد من رغبتك في حذف الطلب؟
            {orderNumber && (
              <span className="block mt-2 font-semibold text-red-800 dark:text-red-200">
                رقم الطلب: {orderNumber}
              </span>
            )}
            <span className="block mt-3 text-sm text-red-600 dark:text-red-400">
              ⚠️ سيتم تحرير المخزون المحجوز تلقائياً
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex gap-3 mt-6">
          <AlertDialogCancel 
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          >
            إلغاء
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري الحذف...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                حذف الطلب
              </div>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};