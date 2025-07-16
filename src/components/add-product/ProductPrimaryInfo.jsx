import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ImageUploader from '@/components/manage-products/ImageUploader';

const ProductPrimaryInfo = ({ productInfo, setProductInfo, generalImages, onImageSelect, onImageRemove }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductInfo(prev => ({ ...prev, [name]: value }));
  };

  const getInitialImagePreview = (image) => {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (image instanceof File) return URL.createObjectURL(image);
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>المعلومات الأساسية والصور</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">اسم المنتج</Label>
            <Input id="name" name="name" value={productInfo.name} onChange={handleInputChange} required />
          </div>
          <div>
            <Label htmlFor="price">السعر الأساسي (د.ع)</Label>
            <Input id="price" name="price" type="number" value={productInfo.price} onChange={handleInputChange} required />
          </div>
          <div>
            <Label htmlFor="costPrice">سعر التكلفة (اختياري)</Label>
            <Input id="costPrice" name="costPrice" type="number" value={productInfo.costPrice} onChange={handleInputChange} />
          </div>
        </div>
        <div>
          <Label htmlFor="description">وصف المنتج (اختياري)</Label>
          <Textarea id="description" name="description" value={productInfo.description} onChange={handleInputChange} />
        </div>
        <div>
          <Label>الصور العامة (4 صور كحد أقصى)</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="aspect-w-1 aspect-h-1">
                <ImageUploader
                  onImageSelect={(file) => onImageSelect(index, file)}
                  onImageRemove={() => onImageRemove(index)}
                  initialImage={getInitialImagePreview(generalImages[index])}
                />
              </div>
            ))}
                </div>
                
                {/* نسبة ربح الموظف */}
                <div className="space-y-2">
                  <Label htmlFor="employeeProfitPercentage">نسبة ربح الموظف (%)</Label>
                  <Input
                    id="employeeProfitPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="نسبة ربح الموظف من هذا المنتج (اختياري)"
                    value={productInfo.employeeProfitPercentage}
                    onChange={(e) => setProductInfo({...productInfo, employeeProfitPercentage: e.target.value})}
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    يمكن تعديل هذه النسبة لاحقاً من قواعد الأرباح للموظفين في الإعدادات
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      };
      
      export default ProductPrimaryInfo;