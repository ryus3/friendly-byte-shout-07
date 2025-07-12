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
      <ScrollArea className="h-64 pr-3">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.variantSku} className="grid grid-cols-12 items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <div className="col-span-4">
                <p className="font-semibold text-sm truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.color}, {item.size}</p>
              </div>
              <div className="col-span-2">
                <Input 
                  type="number" 
                  value={item.quantity} 
                  onChange={e => onUpdate(item.variantSku, 'quantity', parseInt(e.target.value) || 0)} 
                  className="h-8 text-center"
                />
              </div>
              <div className="col-span-3">
                <Input 
                  type="number" 
                  value={item.costPrice} 
                  onChange={e => onUpdate(item.variantSku, 'costPrice', parseFloat(e.target.value) || 0)} 
                  className="h-8 text-center"
                />
              </div>
              <div className="col-span-2 text-center">
                <p className="font-semibold text-sm">
                  {(item.costPrice * item.quantity).toLocaleString()}
                </p>
              </div>
              <div className="col-span-1 text-left">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(item.variantSku)}
                  className="w-8 h-8 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold">التكلفة الإجمالية</span>
          <span className="text-xl font-bold text-primary">
            {totalCost.toLocaleString()} د.ع
          </span>
        </div>
      </div>
    </div>
  );
};

export default PurchaseItemsPreview;