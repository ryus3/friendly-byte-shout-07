import React from 'react';
    import { Accordion } from '@/components/ui/accordion';
    import InventoryItem from './InventoryItem';
    import { Package } from 'lucide-react';
    import { Skeleton } from '@/components/ui/skeleton';

    const InventoryList = ({ items, onEditStock, canEdit, stockFilter, isLoading, onSelectionChange, selectedItems, isMobile }) => {
      if (isLoading) {
        return (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        );
      }

      return (
        <div className="glass-effect rounded-xl border border-white/20 overflow-hidden">
          {items && items.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {items.map(item => (
                <InventoryItem
                  key={item.id}
                  item={item}
                  onEditStock={onEditStock}
                  canEdit={canEdit}
                  stockFilter={stockFilter}
                  onSelectionChange={onSelectionChange}
                  isSelected={selectedItems.includes(item.id)}
                  isMobile={isMobile}
                />
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">لا توجد عناصر</h3>
              <p className="text-gray-500">جرب تغيير معايير البحث أو الفلترة</p>
            </div>
          )}
        </div>
      );
    };

    export default InventoryList;