import React from 'react';
import Barcode from 'react-barcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, Barcode as BarcodeIcon } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ImageUploader from '@/components/manage-products/ImageUploader';

const ColorVariantCard = ({ color, allSizesForType, variants, setVariants, price, costPrice, handleImageSelect, handleImageRemove, initialImage, dragHandleProps }) => {
  
  const handleVariantChange = (colorId, sizeId, field, value) => {
    setVariants(prev => prev.map(v => 
      (v.colorId === colorId && v.sizeId === sizeId) ? { ...v, [field]: value } : v
    ));
  };

  const handleRemoveSizeFromColor = (sizeId) => {
    setVariants(prev => prev.filter(v => !(v.colorId === color.id && v.sizeId === sizeId)));
  };

  const getInitialImagePreview = (image) => {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (image instanceof File) return URL.createObjectURL(image);
    return null;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-4 bg-muted/50 p-4">
        <div {...dragHandleProps} className="cursor-grab p-1">
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="w-8 h-8 rounded-full border" style={{backgroundColor: color.hex_code}}></div>
        <CardTitle className="text-xl">{color.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 aspect-w-1 aspect-h-1">
           <ImageUploader 
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              initialImage={getInitialImagePreview(initialImage)}
           />
        </div>
        <div className="md:col-span-2 space-y-2">
           <Label className="mb-2 block">الكميات والأسعار والقياسات</Label>
            {allSizesForType.map(variant => {
              if (!variant || variant.colorId !== color.id) return null;
              
              return (
                <div key={variant.sizeId} className="grid grid-cols-12 items-end gap-2 p-2 border rounded-md">
                    <Label className="text-center col-span-2">{variant.size}</Label>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">الكمية</Label>
                      <Input type="number" placeholder="0" defaultValue={variant.quantity || 0} onChange={e => handleVariantChange(color.id, variant.sizeId, 'quantity', parseInt(e.target.value) || 0)} required />
                    </div>
                     <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">التكلفة</Label>
                      <Input type="number" defaultValue={variant.costPrice || costPrice || 0} onChange={e => handleVariantChange(color.id, variant.sizeId, 'costPrice', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">البيع</Label>
                      <Input type="number" defaultValue={variant.price || price || 0} onChange={e => handleVariantChange(color.id, variant.sizeId, 'price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">تلميح</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Input type="text" placeholder="..." defaultValue={variant.hint || ''} onChange={e => handleVariantChange(color.id, variant.sizeId, 'hint', e.target.value)} />
                          </TooltipTrigger>
                          <TooltipContent><p>تلميح خاص بهذا القياس لهذا المنتج فقط</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Dialog>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground">
                                <BarcodeIcon className="w-5 h-5" />
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent><p>عرض الباركود (SKU)</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>باركود المتغير (SKU)</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center p-4">
                          <Barcode value={variant.sku} />
                          <p className="mt-2 font-mono">{variant.sku}</p>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" className="col-span-1 text-destructive hover:text-destructive" onClick={() => handleRemoveSizeFromColor(variant.sizeId)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              )
            })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ColorVariantCard;