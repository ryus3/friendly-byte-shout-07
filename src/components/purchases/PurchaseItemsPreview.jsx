import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Package } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const PurchaseItemsPreview = ({ items, onRemove, onUpdate }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-muted-foreground/30 rounded-xl bg-muted/20">
        <div className="p-3 bg-muted rounded-full w-fit mx-auto mb-3">
          <Package className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">لم يتم إضافة أي منتجات بعد</p>
        <p className="text-muted-foreground/70 text-xs mt-1">اضغط "إضافة" لاختيار المنتجات</p>
      </div>
    );
  }

  const totalCost = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);

  return (
    <div className="space-y-2">
      <ScrollArea className="max-h-48">
        <div className="space-y-2 pl-1">
          {items.map((item, index) => (
            <div 
              key={item.variantSku} 
              className="relative p-3 bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl border border-border/50 overflow-hidden"
            >
              {/* رقم العنصر */}
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">{index + 1}</span>
              </div>
              
              {/* اسم المنتج وزر الحذف */}
              <div className="flex justify-between items-start gap-2 mb-2 pr-6">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-foreground">{item.productName}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.color} • {item.size}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(item.variantSku)}
                  className="w-7 h-7 shrink-0 text-destructive hover:bg-destructive/10 rounded-full"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              
              {/* الكمية والسعر والإجمالي */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground block">الكمية</label>
                  <Input 
                    type="number" 
                    value={item.quantity} 
                    onChange={e => onUpdate(item.variantSku, 'quantity', parseInt(e.target.value) || 0)} 
                    className="h-8 text-center text-sm w-full min-w-0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground block">السعر</label>
                  <Input 
                    type="number" 
                    value={item.costPrice} 
                    onChange={e => onUpdate(item.variantSku, 'costPrice', parseFloat(e.target.value) || 0)} 
                    className="h-8 text-center text-sm w-full min-w-0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground block">الإجمالي</label>
                  <div className="h-8 flex items-center justify-center bg-primary/10 rounded-md text-sm font-bold text-primary">
                    {(item.costPrice * item.quantity).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* إجمالي المنتجات */}
      <div className="pt-2 border-t border-border/50">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">إجمالي المنتجات ({items.length})</span>
          <span className="text-sm font-bold text-primary">
            {totalCost.toLocaleString()} د.ع
          </span>
        </div>
      </div>
    </div>
  );
};

export default PurchaseItemsPreview;