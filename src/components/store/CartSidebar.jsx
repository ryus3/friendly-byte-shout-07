import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Minus, Plus, X, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import DefaultProductImage from '@/components/ui/default-product-image';

const CartSidebar = ({ isOpen, onClose, cart, onQuickOrder }) => {
  const totalAmount = cart.reduce((sum, item) => sum + item.total, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-96 bg-background/95 backdrop-blur-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            سلة التسوق ({totalItems} منتج)
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">السلة فارغة</h3>
                <p className="text-muted-foreground">ابدأ بإضافة منتجاتك المفضلة</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex gap-3 p-3 bg-card rounded-lg border"
                  >
                    <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <DefaultProductImage className="w-full h-full" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <h4 className="font-medium text-sm line-clamp-2">{item.productName}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>اللون: {item.color}</span>
                        <span>•</span>
                        <span>المقاس: {item.size}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 border rounded">
                          <Button variant="ghost" size="icon" className="w-6 h-6">
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="w-6 h-6">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-bold text-primary">
                            {item.total.toLocaleString()} د.ع
                          </div>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-red-500">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>المجموع الفرعي:</span>
                    <span>{totalAmount.toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>التوصيل:</span>
                    <span className="text-green-600">مجاني</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>المجموع الكلي:</span>
                    <span className="text-primary">{totalAmount.toLocaleString()} د.ع</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={onQuickOrder}
                    className="w-full bg-gradient-to-r from-primary to-purple-500 text-white"
                  >
                    إتمام الطلب
                  </Button>
                  <Button variant="outline" className="w-full">
                    متابعة التسوق
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CartSidebar;