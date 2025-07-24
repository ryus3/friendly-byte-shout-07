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

  // حساب إحصائيات المنتجات بناءً على الطلبات المكتملة
  const productStats = useMemo(() => {
    if (!orders || orders.length === 0) {
      console.log('❌ لا توجد طلبات متاحة');
      return [];
    }

    // فلترة الطلبات حسب الفترة المحددة والحالة المكتملة
    const filteredOrders = orders.filter(order => {
      // التأكد من أن الطلب مكتمل (تم التوصيل فقط) - يخصم من المخزون عندما يكون delivered
      const isDelivered = order.delivery_status === 'delivered' || 
                         order.status === 'delivered' || 
                         order.order_status === 'delivered';
      
      // استبعاد الطلبات المرجعة أو الملغية
      const isReturnedOrCancelled = order.status === 'returned' || 
                                   order.status === 'cancelled' ||
                                   order.delivery_status === 'returned' ||
                                   order.delivery_status === 'cancelled' ||
                                   order.order_status === 'returned' ||
                                   order.order_status === 'cancelled';
      
      if (!isDelivered || isReturnedOrCancelled) return false;

      const orderDate = new Date(order.created_at || order.order_date);
      const now = new Date();
      
      switch (selectedPeriod) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
        case '3months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return orderDate >= threeMonthsAgo;
        case '6months':
          const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          return orderDate >= sixMonthsAgo;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return orderDate >= yearAgo;
        case 'all':
        default:
          return true;
      }
    });

    console.log('✅ طلبات مكتملة تم العثور عليها:', filteredOrders.length);

    // تجميع البيانات حسب المنتج
    const productMap = new Map();

    filteredOrders.forEach(order => {
      let orderItems = [];
      
      try {
        // أولاً: جرب استخراج البيانات من order_items (الطريقة الصحيحة)
        if (order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0) {
          orderItems = order.order_items.map(item => ({
            product_name: item.products?.name || item.product_name || 'منتج غير محدد',
            name: item.products?.name || item.product_name || 'منتج غير محدد',
            quantity: item.quantity || 1,
            price: item.unit_price || item.price || 0,
            unit_price: item.unit_price || item.price || 0,
            total_price: item.total_price || (item.quantity * (item.unit_price || item.price || 0)),
            image: item.products?.images?.[0] || item.product_variants?.images?.[0] || null
          }));
        }
        // ثانياً: جرب التنسيقات القديمة للـ items
        else if (typeof order.items === 'string' && order.items.trim()) {
          orderItems = JSON.parse(order.items);
        } else if (order.items && Array.isArray(order.items)) {
          orderItems = order.items;
        } else if (order.products && Array.isArray(order.products)) {
          orderItems = order.products;
        } else if (order.item_details && Array.isArray(order.item_details)) {
          orderItems = order.item_details;
        } else if (typeof order.product_details === 'string' && order.product_details.trim()) {
          orderItems = JSON.parse(order.product_details);
        } else if (order.product_details && Array.isArray(order.product_details)) {
          orderItems = order.product_details;
        }
        
        // ثالثاً: إذا لم نجد أي عناصر، جرب استخراج البيانات من حقول الطلب المباشرة
        if ((!orderItems || orderItems.length === 0) && order.product_name) {
          orderItems = [{
            product_name: order.product_name,
            name: order.product_name,
            quantity: order.quantity || 1,
            price: order.unit_price || order.selling_price || (order.total_amount ? order.total_amount / (order.quantity || 1) : 0),
            total_price: order.total_amount || 0
          }];
        }
      } catch (e) {
        console.warn('خطأ في تحليل عناصر الطلب للطلب', order.id, ':', e);
        // محاولة استخراج البيانات من الحقول المباشرة
        if (order.product_name && order.quantity) {
          orderItems = [{
            product_name: order.product_name,
            name: order.product_name,
            quantity: order.quantity,
            price: order.total_amount ? order.total_amount / order.quantity : 0
          }];
        }
      }

      console.log(`📦 الطلب ${order.id}: تم العثور على ${orderItems.length} منتج`);

      if (Array.isArray(orderItems) && orderItems.length > 0) {
        orderItems.forEach(item => {
          const productKey = item.product_name || item.name || item.productName || item.title || item.product_id || 'منتج غير محدد';
          const quantity = parseInt(item.quantity) || parseInt(item.qty) || parseInt(item.amount) || 1;
          const price = parseFloat(item.price) || parseFloat(item.unit_price) || parseFloat(item.selling_price) || parseFloat(item.total_price) || 0;
          const totalItemValue = quantity * price;

          if (!productMap.has(productKey)) {
            productMap.set(productKey, {
              name: productKey,
              totalQuantity: 0,
              totalRevenue: 0,
              orderCount: 0,
              avgPrice: 0,
              image: item.image || item.product_image || item.images?.[0] || item.img || null
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

    console.log('✅ خريطة المنتجات النهائية:', Array.from(productMap.entries()).length, 'منتج');
    
    // طباعة عينة من البيانات للتحقق
    if (productMap.size > 0) {
      const sampleProduct = Array.from(productMap.values())[0];
      console.log('🔍 عينة منتج:', sampleProduct);
    }

    // تحويل البيانات إلى مصفوفة وترتيبها
    const sortedProducts = Array.from(productMap.values())
      .filter(product => product.totalQuantity > 0) // فقط المنتجات التي لها كمية
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 15);

    console.log('📊 المنتجات المرتبة:', sortedProducts.length);
    return sortedProducts;
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
            <div className="bg-gradient-to-br from-orange-400 to-yellow-500 rounded-xl p-6 border border-orange-200/50 dark:border-orange-700/50 shadow-lg backdrop-blur-sm text-white relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/10 rounded-full"></div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-white/90 mb-1">إجمالي الكمية</p>
                  <p className="text-3xl font-bold text-white">{totalQuantity}</p>
                  <p className="text-xs text-white/70 mt-1">قطعة مباعة</p>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl p-6 border border-green-200/50 dark:border-green-700/50 shadow-lg backdrop-blur-sm text-white relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/10 rounded-full"></div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-white/90 mb-1">إجمالي الإيرادات</p>
                  <p className="text-3xl font-bold text-white">
                    {totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/70 mt-1">دينار عراقي</p>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-6 border border-red-200/50 dark:border-red-700/50 shadow-lg backdrop-blur-sm text-white relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/10 rounded-full"></div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-white/90 mb-1">عدد المنتجات</p>
                  <p className="text-3xl font-bold text-white">{productStats.length}</p>
                  <p className="text-xs text-white/70 mt-1">منتج مختلف</p>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
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