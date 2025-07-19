import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const PurchaseDetailsDialog = ({ purchase, open, onOpenChange }) => {
  if (!purchase) return null;
  
  const totalItemsCost = (purchase.items || []).reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const shippingCost = purchase.shipping_cost || 0; // من العمود المنفصل
  const transferCost = purchase.transfer_cost || 0; // تكاليف التحويل
  const totalCost = totalItemsCost + shippingCost + transferCost;

  // استخدام تاريخ الشراء الفعلي
  const purchaseDate = purchase.purchase_date || purchase.created_at || new Date();
  const formattedDate = purchaseDate ? format(new Date(purchaseDate), 'd MMMM yyyy', { locale: ar }) : 'غير محدد';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="gradient-text">تفاصيل فاتورة الشراء</DialogTitle>
          <DialogDescription>
            فاتورة رقم #{purchase.purchase_number} بتاريخ {formattedDate}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-2">معلومات المورد</h4>
            <div className="text-muted-foreground">
              <p><strong>المورد:</strong> {purchase.supplier}</p>
              {purchase.notes && (
                <p className="mt-2"><strong>ملاحظات:</strong> {purchase.notes}</p>
              )}
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3">المنتجات</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {(purchase.items || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.color} - {item.size} × {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {(item.costPrice * item.quantity).toLocaleString()} د.ع
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.costPrice.toLocaleString()} د.ع / قطعة
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">تكلفة المنتجات</span>
                <span>{totalItemsCost.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">مصاريف الشحن</span>
                <span>{shippingCost.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">تكاليف التحويل</span>
                <span>{transferCost.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-lg font-semibold">التكلفة الإجمالية</span>
                <span className="text-xl font-bold text-primary">
                  {totalCost.toLocaleString()} د.ع
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseDetailsDialog;