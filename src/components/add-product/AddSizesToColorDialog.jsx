import React, { useState } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Check } from 'lucide-react';

const AddSizesToColorDialog = ({ open, onOpenChange, color, existingVariants, onAddSizes }) => {
  const { sizes } = useVariants();
  const [selectedSizeType, setSelectedSizeType] = useState('letter');
  const [selectedSizes, setSelectedSizes] = useState([]);

  // Get existing size IDs for this color
  const existingSizeIds = existingVariants
    .filter(v => v.color_id === color?.id || v.colorId === color?.id)
    .map(v => v.size_id || v.sizeId);

  // Filter sizes by type and exclude existing ones
  const availableSizes = sizes
    .filter(size => size.type === selectedSizeType)
    .filter(size => !existingSizeIds.includes(size.id));

  const handleSizeToggle = (sizeId) => {
    setSelectedSizes(prev => 
      prev.includes(sizeId) 
        ? prev.filter(id => id !== sizeId)
        : [...prev, sizeId]
    );
  };

  const handleAddSizes = () => {
    if (selectedSizes.length === 0) return;

    const sizesToAdd = selectedSizes.map(sizeId => {
      const size = sizes.find(s => s.id === sizeId);
      return {
        color_id: color.id,
        size_id: sizeId,
        size: size.name,
        quantity: 0,
        hint: '',
        barcode: `${color.name}-${size.name}-${Date.now()}`,
        inventory: { quantity: 0 }
      };
    });

    onAddSizes(sizesToAdd);
    setSelectedSizes([]);
    onOpenChange(false);
  };

  const sizeTypes = [
    { value: 'letter', label: 'حرفي (S, M, L, XL)' },
    { value: 'number', label: 'رقمي (34, 36, 38)' },
    { value: 'free', label: 'مقاس حر' }
  ];

  // Sort sizes correctly
  const sortedAvailableSizes = availableSizes.sort((a, b) => {
    if (selectedSizeType === 'letter') {
      const letterOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
      const aIndex = letterOrder.indexOf(a.name.toUpperCase());
      const bIndex = letterOrder.indexOf(b.name.toUpperCase());
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
    }
    
    if (selectedSizeType === 'number') {
      const aNum = parseInt(a.name);
      const bNum = parseInt(b.name);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    }
    
    return a.name.localeCompare(b.name);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            إضافة قياسات جديدة للون {color?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* نوع القياس */}
          <div>
            <Label className="text-sm font-medium mb-3 block">نوع القياس</Label>
            <RadioGroup 
              value={selectedSizeType} 
              onValueChange={setSelectedSizeType}
              className="grid grid-cols-1 gap-2"
            >
              {sizeTypes.map(type => (
                <div key={type.value} className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label htmlFor={type.value} className="text-sm">
                    {type.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* القياسات المتاحة */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              القياسات المتاحة ({sortedAvailableSizes.length})
            </Label>
            
            {sortedAvailableSizes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">✅ جميع القياسات من هذا النوع مضافة بالفعل</p>
                <p className="text-xs mt-1">جرب نوع قياس آخر</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {sortedAvailableSizes.map(size => (
                  <div
                    key={size.id}
                    className={`
                      relative border rounded-lg p-3 cursor-pointer transition-all
                      ${selectedSizes.includes(size.id) 
                        ? 'border-primary bg-primary/10 shadow-sm' 
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                    onClick={() => handleSizeToggle(size.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{size.name}</span>
                      {selectedSizes.includes(size.id) && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <Checkbox
                      checked={selectedSizes.includes(size.id)}
                      onChange={() => handleSizeToggle(size.id)}
                      className="absolute top-1 right-1 h-3 w-3"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* القياسات المختارة */}
          {selectedSizes.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                القياسات المختارة ({selectedSizes.length})
              </Label>
              <div className="flex flex-wrap gap-1">
                {selectedSizes.map(sizeId => {
                  const size = sizes.find(s => s.id === sizeId);
                  return (
                    <Badge 
                      key={sizeId} 
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleSizeToggle(sizeId)}
                    >
                      {size?.name} ×
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* أزرار التحكم */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            إلغاء
          </Button>
          <Button
            onClick={handleAddSizes}
            disabled={selectedSizes.length === 0}
            className="flex-1"
          >
            إضافة {selectedSizes.length > 0 && `(${selectedSizes.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSizesToColorDialog;