import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useVariants } from '@/contexts/VariantsContext';
import { Palette, Tag } from 'lucide-react';

const MultiSizeTypeSelector = ({ 
  selectedColors, 
  colorSizeTypes, 
  onColorSizeTypesChange 
}) => {
  const { sizes } = useVariants();
  
  // Get unique size types (excluding free size)
  const availableSizeTypes = [...new Set(
    sizes
      .filter(s => s.name !== 'فري سايز' && s.name !== 'Free Size')
      .map(s => s.type)
  )];

  const getSizeTypeLabel = (type) => {
    switch (type) {
      case 'letter': return 'حرفية (S, M, L...)';
      case 'number': return 'رقمية (38, 40...)';
      case 'shoe': return 'أحذية';
      case 'baby': return 'أطفال';
      default: return type;
    }
  };

  const handleSizeTypeToggle = (colorId, sizeType, checked) => {
    onColorSizeTypesChange(prev => {
      const updated = { ...prev };
      if (!updated[colorId]) {
        updated[colorId] = [];
      }
      
      if (checked) {
        if (!updated[colorId].includes(sizeType)) {
          updated[colorId] = [...updated[colorId], sizeType];
        }
      } else {
        updated[colorId] = updated[colorId].filter(t => t !== sizeType);
      }
      
      return updated;
    });
  };

  const getSelectedTypesCount = (colorId) => {
    return colorSizeTypes[colorId]?.length || 0;
  };

  if (selectedColors.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-blue/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Tag className="h-5 w-5" />
          اختيار أنواع القياسات لكل لون
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          يمكنك اختيار أنواع قياسات مختلفة لكل لون حسب طبيعة المنتج
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {selectedColors.map((color) => (
          <div key={color.id} className="p-4 border rounded-lg bg-background/50">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-6 h-6 rounded-full border-2 border-border"
                style={{ backgroundColor: color.hex_code || '#6b7280' }}
              />
              <div className="flex-1">
                <h4 className="font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  {color.name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">
                    أنواع القياسات المحددة:
                  </span>
                  {getSelectedTypesCount(color.id) > 0 ? (
                    <Badge variant="secondary">
                      {getSelectedTypesCount(color.id)} نوع محدد
                    </Badge>
                  ) : (
                    <Badge variant="outline">لم يتم التحديد</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableSizeTypes.map((sizeType) => (
                <div key={sizeType} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id={`${color.id}-${sizeType}`}
                    checked={colorSizeTypes[color.id]?.includes(sizeType) || false}
                    onCheckedChange={(checked) => 
                      handleSizeTypeToggle(color.id, sizeType, checked)
                    }
                  />
                  <Label 
                    htmlFor={`${color.id}-${sizeType}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {getSizeTypeLabel(sizeType)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {selectedColors.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>ملاحظة:</strong> إذا لم تحدد أي نوع قياس للون معين، سيتم استخدام النوع الافتراضي (حرفية)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MultiSizeTypeSelector;