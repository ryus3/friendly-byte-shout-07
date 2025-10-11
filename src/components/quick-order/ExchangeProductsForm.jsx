import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Package, PackageCheck } from 'lucide-react';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';

export const ExchangeProductsForm = ({
  cart,
  onSelectOutgoing,
  onSelectIncoming,
  outgoingProduct,
  incomingProduct,
  deliveryFee = 5000
}) => {
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  
  const priceDiff = incomingProduct && outgoingProduct 
    ? incomingProduct.price - outgoingProduct.price 
    : 0;
  
  const totalAmount = priceDiff + deliveryFee;

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <ArrowRight className="w-5 h-5" />
        تفاصيل الاستبدال
      </h3>
      
      {/* المنتج الصادر (الخارج للزبون) */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            المنتج الصادر (الخارج)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SearchableSelectFixed
            value={outgoingProduct?.id || ''}
            onValueChange={onSelectOutgoing}
            options={cart.map(item => ({
              value: item.id,
              label: `${item.productName} - ${item.color} - ${item.size}`
            }))}
            placeholder="اختر المنتج المراد إرساله"
            emptyText="السلة فارغة"
            className="w-full"
          />
          
          {outgoingProduct && (
            <div className="p-3 bg-background rounded-lg border">
              <p className="text-sm font-medium">{outgoingProduct.productName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {outgoingProduct.size} • {outgoingProduct.color}
              </p>
              <p className="text-sm font-semibold mt-2 text-blue-600">
                السعر: {outgoingProduct.price.toLocaleString()} د.ع
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* المنتج الوارد (الداخل من الزبون) */}
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageCheck className="w-4 h-4" />
            المنتج الوارد (الداخل)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            type="button"
            variant="outline" 
            className="w-full"
            onClick={() => setProductSelectOpen(true)}
          >
            اختر المنتج الجديد
          </Button>
          
          {incomingProduct && (
            <div className="p-3 bg-background rounded-lg border border-green-200">
              <p className="text-sm font-medium">{incomingProduct.productName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {incomingProduct.size} • {incomingProduct.color}
              </p>
              <p className="text-sm font-semibold mt-2 text-green-600">
                السعر: {incomingProduct.price.toLocaleString()} د.ع
              </p>
            </div>
          )}
          
          <ProductSelectionDialog
            open={productSelectOpen}
            onOpenChange={setProductSelectOpen}
            onSelectProduct={(product) => {
              onSelectIncoming(product);
              setProductSelectOpen(false);
            }}
          />
        </CardContent>
      </Card>
      
      {/* ملخص الحسابات */}
      {outgoingProduct && incomingProduct && (
        <Card className="border-purple-300 bg-purple-50 dark:bg-purple-900/20">
          <CardContent className="p-4">
            <h4 className="font-semibold mb-3">ملخص الحسابات</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>فرق السعر:</span>
                <span className={`font-semibold ${priceDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceDiff >= 0 ? '+' : ''}{priceDiff.toLocaleString()} د.ع
                </span>
              </div>
              <div className="flex justify-between">
                <span>رسوم التوصيل:</span>
                <span className="font-semibold">{deliveryFee.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>المبلغ المطلوب:</span>
                <span className={totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {totalAmount.toLocaleString()} د.ع
                </span>
              </div>
            </div>
            
            {totalAmount < 0 && (
              <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs">
                ⚠️ سيتم دفع {Math.abs(totalAmount).toLocaleString()} د.ع للزبون
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
