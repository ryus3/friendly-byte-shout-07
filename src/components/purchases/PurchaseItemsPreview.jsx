import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const PurchaseItemsPreview = ({ items, onRemove, onUpdate }) => {
  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-4 border border-dashed rounded-lg">
        لم يتم إضافة أي منتجات بعد.
      </div>
    );
  }

  const totalCost = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);

  return (
    <div className="space-y-2">
      <ScrollArea className="h-64 pr-1">
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.variantSku} className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
              {/* اسم المنتج وزر الحذف */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.color}, {item.size}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(item.variantSku)}
                  className="w-7 h-7 shrink-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              {/* الكمية والسعر والإجمالي */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">الكمية</label>
                  <Input 
                    type="number" 
                    value={item.quantity} 
                    onChange={e => onUpdate(item.variantSku, 'quantity', parseInt(e.target.value) || 0)} 
                    className="h-8 text-center text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">السعر</label>
                  <Input 
                    type="number" 
                    value={item.costPrice} 
                    onChange={e => onUpdate(item.variantSku, 'costPrice', parseFloat(e.target.value) || 0)} 
                    className="h-8 text-center text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">الإجمالي</label>
                  <div className="h-8 flex items-center justify-center bg-background rounded-md border text-sm font-semibold">
                    {(item.costPrice * item.quantity).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="pt-3 border-t">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">التكلفة الإجمالية</span>
          <span className="text-lg font-bold text-primary">
            {totalCost.toLocaleString()} د.ع
          </span>
        </div>
      </div>
    </div>
  );
};

export default PurchaseItemsPreview;
