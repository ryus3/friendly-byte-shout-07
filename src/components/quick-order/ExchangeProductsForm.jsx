import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Package, PackageCheck, X, Plus } from 'lucide-react';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';

export const ExchangeProductsForm = ({
  cart,
  onAddOutgoing,
  onAddIncoming,
  onRemoveItem,
  deliveryFee = 5000,
  onManualPriceDiffChange
}) => {
  const [outgoingDialogOpen, setOutgoingDialogOpen] = useState(false);
  const [incomingDialogOpen, setIncomingDialogOpen] = useState(false);
  const [manualPriceDiff, setManualPriceDiff] = useState(0);
  
  const handleManualPriceDiffChange = (value) => {
    setManualPriceDiff(value);
    if (onManualPriceDiffChange) {
      onManualPriceDiffChange(value);
    }
  };
  
  // ✅ حساب المجاميع من cart
  const outgoingItems = cart.filter(item => item.item_direction === 'outgoing');
  const incomingItems = cart.filter(item => item.item_direction === 'incoming');
  
  const outgoingTotal = outgoingItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const incomingTotal = incomingItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  
  const priceDiff = incomingTotal - outgoingTotal;
  const totalPriceDiff = priceDiff + manualPriceDiff;
  const totalAmount = totalPriceDiff + deliveryFee;

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <ArrowRight className="w-5 h-5" />
        تفاصيل الاستبدال
      </h3>
      
      {/* المنتجات الصادرة (الخارجة للزبون) */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              المنتجات الصادرة (الخارجة)
            </div>
            <Badge variant="outline">{outgoingItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            type="button"
            variant="outline" 
            className="w-full"
            onClick={() => setOutgoingDialogOpen(true)}
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة منتج صادر
          </Button>
          
          {outgoingItems.length > 0 && (
            <div className="space-y-2">
              {outgoingItems.map((item, index) => (
                <div key={index} className="p-3 bg-background rounded-lg border flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.size} • {item.color} • الكمية: {item.quantity || 1}
                    </p>
                    <p className="text-sm font-semibold mt-2 text-blue-600">
                      السعر: {((item.price || 0) * (item.quantity || 1)).toLocaleString()} د.ع
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="text-sm font-semibold text-blue-600 pt-2 border-t">
                المجموع: {outgoingTotal.toLocaleString()} د.ع
              </div>
            </div>
          )}
          
          <ProductSelectionDialog
            open={outgoingDialogOpen}
            onOpenChange={setOutgoingDialogOpen}
            onConfirm={(selectedItems) => {
              selectedItems.forEach(item => {
                onAddOutgoing({ ...item, item_direction: 'outgoing' });
              });
              setOutgoingDialogOpen(false);
            }}
            initialCart={[]}
          />
        </CardContent>
      </Card>
      
      {/* المنتجات الواردة (الداخلة من الزبون) */}
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4" />
              المنتجات الواردة (الداخلة)
            </div>
            <Badge variant="outline">{incomingItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            type="button"
            variant="outline" 
            className="w-full"
            onClick={() => setIncomingDialogOpen(true)}
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة منتج وارد
          </Button>
          
          {incomingItems.length > 0 && (
            <div className="space-y-2">
              {incomingItems.map((item, index) => (
                <div key={index} className="p-3 bg-background rounded-lg border border-green-200 flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.size} • {item.color} • الكمية: {item.quantity || 1}
                    </p>
                    <p className="text-sm font-semibold mt-2 text-green-600">
                      السعر: {((item.price || 0) * (item.quantity || 1)).toLocaleString()} د.ع
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveItem(outgoingItems.length + index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="text-sm font-semibold text-green-600 pt-2 border-t">
                المجموع: {incomingTotal.toLocaleString()} د.ع
              </div>
            </div>
          )}
          
          <ProductSelectionDialog
            open={incomingDialogOpen}
            onOpenChange={setIncomingDialogOpen}
            onConfirm={(selectedItems) => {
              selectedItems.forEach(item => {
                onAddIncoming({ ...item, item_direction: 'incoming' });
              });
              setIncomingDialogOpen(false);
            }}
            initialCart={[]}
          />
        </CardContent>
      </Card>
      
      {/* ملخص الحسابات */}
      {(outgoingItems.length > 0 || incomingItems.length > 0) && (
        <Card className="border-purple-300 bg-purple-50 dark:bg-purple-900/20">
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold mb-3">ملخص الحسابات</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>مجموع المنتجات الصادرة:</span>
                <span>{outgoingTotal.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>مجموع المنتجات الواردة:</span>
                <span>{incomingTotal.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>فرق السعر التلقائي:</span>
                <span className={`font-semibold ${priceDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceDiff >= 0 ? '+' : ''}{priceDiff.toLocaleString()} د.ع
                </span>
              </div>
              
              {/* حقل فرق السعر اليدوي */}
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="manualPriceDiff" className="text-xs">فرق سعر إضافي (اختياري)</Label>
                <Input
                  id="manualPriceDiff"
                  type="number"
                  value={manualPriceDiff}
                  onChange={(e) => handleManualPriceDiffChange(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground">
                  يُضاف للفرق التلقائي
                </p>
              </div>
              
              {manualPriceDiff !== 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>فرق السعر الإجمالي:</span>
                  <span className="font-semibold">
                    {totalPriceDiff >= 0 ? '+' : ''}{totalPriceDiff.toLocaleString()} د.ع
                  </span>
                </div>
              )}
              
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