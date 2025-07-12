import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Plus, X, Settings } from 'lucide-react';
import { useVariants } from '@/contexts/VariantsContext';

const ProductSizesByColor = ({ 
  selectedColors, 
  sizesByColor, 
  setSizesByColor,
  globalSizeType,
  setGlobalSizeType 
}) => {
  const { sizes } = useVariants();
  const [useGlobalSizes, setUseGlobalSizes] = useState(true);

  const letterSizes = sizes.filter(size => size.type === 'letter');
  const numberSizes = sizes.filter(size => size.type === 'number');

  const handleGlobalSizeTypeChange = (type) => {
    setGlobalSizeType(type);
    if (useGlobalSizes) {
      const updatedSizes = {};
      selectedColors.forEach(color => {
        updatedSizes[color.id] = {
          type: type,
          sizes: type === 'letter' ? letterSizes : numberSizes
        };
      });
      setSizesByColor(updatedSizes);
    }
  };

  const handleColorSizeTypeChange = (colorId, type) => {
    setSizesByColor(prev => ({
      ...prev,
      [colorId]: {
        type: type,
        sizes: type === 'letter' ? letterSizes : numberSizes
      }
    }));
  };

  const handleCustomSizesChange = (colorId, selectedSizeIds) => {
    const sizeType = sizesByColor[colorId]?.type || globalSizeType;
    const availableSizes = sizeType === 'letter' ? letterSizes : numberSizes;
    const selectedSizes = availableSizes.filter(size => selectedSizeIds.includes(size.id));
    
    setSizesByColor(prev => ({
      ...prev,
      [colorId]: {
        ...prev[colorId],
        sizes: selectedSizes
      }
    }));
  };

  const toggleGlobalSizes = (enabled) => {
    setUseGlobalSizes(enabled);
    if (enabled) {
      // Apply global settings to all colors
      const updatedSizes = {};
      selectedColors.forEach(color => {
        updatedSizes[color.id] = {
          type: globalSizeType,
          sizes: globalSizeType === 'letter' ? letterSizes : numberSizes
        };
      });
      setSizesByColor(updatedSizes);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          إعداد القياسات لكل لون
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Settings */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">استخدام نفس القياسات لجميع الألوان</Label>
              <p className="text-xs text-muted-foreground">تطبيق نوع قياس واحد على جميع الألوان</p>
            </div>
            <Switch
              checked={useGlobalSizes}
              onCheckedChange={toggleGlobalSizes}
            />
          </div>
          
          {useGlobalSizes && (
            <div className="space-y-2">
              <Label>نوع القياس الموحد</Label>
              <Select value={globalSizeType} onValueChange={handleGlobalSizeTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">قياسات حرفية (S, M, L, XL)</SelectItem>
                  <SelectItem value="number">قياسات رقمية (38, 40, 42, 44)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator />

        {/* Individual Color Settings */}
        {!useGlobalSizes && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                يمكنك تخصيص نوع القياس لكل لون بشكل منفصل
              </p>
            </div>
            
            {selectedColors.map(color => (
              <Card key={color.id} className="border-l-4" style={{ borderLeftColor: color.hex }}>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div>
                          <h4 className="font-medium">{color.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {sizesByColor[color.id]?.type === 'letter' ? 'قياسات حرفية' : 'قياسات رقمية'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {sizesByColor[color.id]?.sizes?.length || 0} قياس
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <Label>نوع القياس</Label>
                      <Select 
                        value={sizesByColor[color.id]?.type || globalSizeType}
                        onValueChange={(type) => handleColorSizeTypeChange(color.id, type)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="letter">قياسات حرفية (S, M, L, XL)</SelectItem>
                          <SelectItem value="number">قياسات رقمية (38, 40, 42, 44)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>القياسات المتاحة</Label>
                      <div className="flex flex-wrap gap-2">
                        {(sizesByColor[color.id]?.type === 'letter' ? letterSizes : numberSizes).map(size => {
                          const isSelected = sizesByColor[color.id]?.sizes?.some(s => s.id === size.id);
                          return (
                            <Badge
                              key={size.id}
                              variant={isSelected ? "default" : "outline"}
                              className="cursor-pointer hover:bg-primary/10"
                              onClick={() => {
                                const currentSizes = sizesByColor[color.id]?.sizes || [];
                                const sizeIds = currentSizes.map(s => s.id);
                                const newSizeIds = isSelected 
                                  ? sizeIds.filter(id => id !== size.id)
                                  : [...sizeIds, size.id];
                                handleCustomSizesChange(color.id, newSizeIds);
                              }}
                            >
                              {size.name}
                              {isSelected && <X className="w-3 h-3 ml-1" />}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">ملخص الإعدادات</h4>
          <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
            {selectedColors.map(color => (
              <div key={color.id} className="flex items-center justify-between">
                <span>{color.name}</span>
                <span>
                  {sizesByColor[color.id]?.type === 'letter' ? 'حرفي' : 'رقمي'} 
                  ({sizesByColor[color.id]?.sizes?.length || 0} قياس)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductSizesByColor;