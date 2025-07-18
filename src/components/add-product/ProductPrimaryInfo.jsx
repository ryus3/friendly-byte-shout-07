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

  // حساب نسبة الربح تلقائياً
  const handleProfitCalculation = (field, value) => {
    const newInfo = { ...productInfo, [field]: value };
    
    if (field === 'profitPercentage' && newInfo.costPrice) {
      const costPrice = parseFloat(newInfo.costPrice);
      const profitPercentage = parseFloat(value);
      const price = costPrice + (costPrice * profitPercentage / 100);
      newInfo.price = price.toFixed(2);
    } else if ((field === 'price' || field === 'costPrice') && newInfo.price && newInfo.costPrice) {
      const price = parseFloat(newInfo.price);
      const costPrice = parseFloat(newInfo.costPrice);
      const profitPercentage = ((price - costPrice) / costPrice * 100);
      newInfo.profitPercentage = profitPercentage.toFixed(2);
    }
    
    setProductInfo(newInfo);
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
            <Input 
              id="price" 
              name="price" 
              type="number" 
              value={productInfo.price} 
              onChange={(e) => handleProfitCalculation('price', e.target.value)} 
              required 
            />
          </div>
          <div>
            <Label htmlFor="costPrice">سعر التكلفة (اختياري)</Label>
            <Input 
              id="costPrice" 
              name="costPrice" 
              type="number" 
              value={productInfo.costPrice} 
              onChange={(e) => handleProfitCalculation('costPrice', e.target.value)} 
            />
          </div>
          <div>
            <Label htmlFor="profitAmount">ربح الموظف (د.ع)</Label>
            <Input 
              id="profitAmount" 
              name="profitAmount" 
              type="number" 
              min="0"
              step="1000"
              placeholder="مثال: 5000"
              value={productInfo.profitAmount || ''} 
              onChange={handleInputChange} 
            />
            <p className="text-xs text-muted-foreground mt-1">
              مبلغ ثابت يحصل عليه الموظف عند بيع هذا المنتج (لا يحصل المدير على ربح)
            </p>
          </div>
          <div>
            <Label htmlFor="profitPercentage">نسبة الربح (%)</Label>
            <Input 
              id="profitPercentage" 
              name="profitPercentage" 
              type="number" 
              min="0"
              step="0.01"
              placeholder="مثال: 25"
              value={productInfo.profitPercentage || ''} 
              onChange={(e) => handleProfitCalculation('profitPercentage', e.target.value)} 
            />
            <p className="text-xs text-muted-foreground mt-1">
              نسبة الربح المئوية على سعر التكلفة - يتم حساب السعر تلقائياً
            </p>
            {productInfo.costPrice && productInfo.profitPercentage && (
              <div className="text-xs text-green-600 mt-1">
                ربح متوقع: {((parseFloat(productInfo.price || 0) - parseFloat(productInfo.costPrice || 0))).toFixed(0)} د.ع
              </div>
            )}
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
               </div>
            </CardContent>
          </Card>
        );
      };
      
      export default ProductPrimaryInfo;