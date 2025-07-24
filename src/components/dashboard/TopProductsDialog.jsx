import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Calendar, Eye, TrendingUp, DollarSign, User as UserIcon } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { filterOrdersByPeriod } from '@/lib/dashboard-helpers';
import { motion } from 'framer-motion';

const TopProductsDialog = ({ open, onOpenChange }) => {
  const { orders } = useOrders();
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const periods = [
    { key: 'week', label: 'الأسبوع الماضي' },
    { key: 'month', label: 'الشهر الماضي' },
    { key: '3months', label: '3 أشهر' },
    { key: '6months', label: '6 أشهر' },
    { key: 'year', label: 'السنة الماضية' },
    { key: 'all', label: 'كل الفترات' }
  ];

  const productStats = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    // فلترة الطلبات حسب الفترة المحددة والطلبات المُوصَّلة فقط
    const filteredOrders = filterOrdersByPeriod(orders, selectedPeriod)
      .filter(order => order.status === 'delivered');

    // تجميع البيانات حسب المنتج
    const productMap = new Map();

    filteredOrders.forEach(order => {
      let orderItems = [];
      
      try {
        if (order.items && typeof order.items === 'string') {
          orderItems = JSON.parse(order.items);
        } else if (order.items && Array.isArray(order.items)) {
          orderItems = order.items;
        } else if (order.order_items && Array.isArray(order.order_items)) {
          orderItems = order.order_items;
        }
      } catch (e) {
        console.error('Error parsing order items:', e);
        return;
      }

      if (Array.isArray(orderItems)) {
        orderItems.forEach(item => {
          const productKey = item.product_name || item.name || item.productName || 'منتج غير محدد';
          const quantity = parseInt(item.quantity) || 1;
          const price = parseFloat(item.price) || parseFloat(item.unit_price) || 0;
          const totalItemValue = quantity * price;

          if (!productMap.has(productKey)) {
            productMap.set(productKey, {
              name: productKey,
              totalQuantity: 0,
              totalRevenue: 0,
              orderCount: 0,
              avgPrice: 0,
              image: item.image || item.product_image || null
            });
          }

          const productData = productMap.get(productKey);
          productData.totalQuantity += quantity;
          productData.totalRevenue += totalItemValue;
          productData.orderCount += 1;
          productData.avgPrice = productData.totalRevenue / productData.totalQuantity;
        });
      }
    });

    // تحويل البيانات إلى مصفوفة
    return Array.from(productMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 15);
  }, [orders, selectedPeriod]);

  const totalQuantity = productStats.reduce((sum, product) => sum + product.totalQuantity, 0);
  const totalRevenue = productStats.reduce((sum, product) => sum + product.totalRevenue, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-500" />
            </div>
            إحصائيات المنتجات الأكثر طلباً
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* فلترة الفترة الزمنية */}
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <Button
                key={period.key}
                variant={selectedPeriod === period.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.key)}
                className="text-sm"
              >
                <Calendar className="w-4 h-4 mr-2" />
                {period.label}
              </Button>
            ))}
          </div>

          {/* الإحصائيات العامة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/20 dark:from-orange-400/10 dark:to-orange-500/20 rounded-xl p-6 border border-orange-200/50 dark:border-orange-700/50 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">إجمالي الكمية</p>
                  <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{totalQuantity}</p>
                  <p className="text-xs text-orange-500/70 dark:text-orange-400/70 mt-1">قطعة مباعة</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Package className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-green-600/20 dark:from-green-400/10 dark:to-green-500/20 rounded-xl p-6 border border-green-200/50 dark:border-green-700/50 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">إجمالي الإيرادات</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-500/70 dark:text-green-400/70 mt-1">دينار عراقي</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 dark:from-blue-400/10 dark:to-blue-500/20 rounded-xl p-6 border border-blue-200/50 dark:border-blue-700/50 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">عدد المنتجات</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{productStats.length}</p>
                  <p className="text-xs text-blue-500/70 dark:text-blue-400/70 mt-1">منتج مختلف</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* قائمة المنتجات */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5" />
              تفاصيل المنتجات
            </h3>
            
            {productStats.length > 0 ? (
              <div className="grid gap-3">
                {productStats.map((product, index) => (
                  <motion.div
                    key={product.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="bg-gradient-to-br from-card to-card/60 hover:from-card/80 hover:to-card/40 rounded-xl p-6 border border-border/60 hover:border-primary/30 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-bold shadow-lg">
                            {index + 1}
                          </div>
                          <div className="flex items-center gap-3">
                            {product.image ? (
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="w-12 h-12 rounded-lg object-cover border border-border/30"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-lg text-foreground mb-1 line-clamp-1">{product.name}</h4>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                {product.orderCount} طلب
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-6 text-left">
                          <div className="text-center">
                            <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <Package className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">الكمية المباعة</p>
                            <p className="font-bold text-lg text-orange-600 dark:text-orange-400">{product.totalQuantity}</p>
                          </div>
                          <div className="text-center">
                            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
                            <p className="font-bold text-lg text-green-600 dark:text-green-400">
                              {product.totalRevenue.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">متوسط السعر</p>
                            <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                              {Math.round(product.avgPrice).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* شريط التقدم */}
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-muted-foreground">نسبة المساهمة</span>
                          <span className="text-xs font-bold text-primary">
                            {totalQuantity > 0 ? ((product.totalQuantity / totalQuantity) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500 shadow-sm"
                            style={{ 
                              width: `${totalQuantity > 0 ? (product.totalQuantity / totalQuantity) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-card to-card/60 rounded-xl p-12 border border-border/60 shadow-lg">
                <div className="text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold text-muted-foreground mb-2">لا توجد بيانات متاحة</p>
                  <p className="text-sm text-muted-foreground">لا توجد منتجات مباعة للفترة المحددة</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TopProductsDialog;