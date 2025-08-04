import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Calendar, Eye, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import useOrdersAnalytics from '@/hooks/useOrdersAnalytics';

const TopProductsDialog = ({ open, onOpenChange, employeeId = null, productsData = [] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [productStats, setProductStats] = useState([]);
  
  // استخدام البيانات الممررة من Dashboard بدلاً من useOrdersAnalytics
  console.log('🔥 TopProductsDialog - البيانات الواردة:', {
    productsData,
    length: productsData?.length || 0
  });

  const periods = [
    { key: 'week', label: 'الأسبوع الماضي' },
    { key: 'month', label: 'الشهر الماضي' },
    { key: '3months', label: '3 أشهر' },
    { key: '6months', label: '6 أشهر' },
    { key: 'year', label: 'السنة الماضية' },
    { key: 'all', label: 'كل الفترات' }
  ];

  // استخدام البيانات الممررة مباشرة
  useEffect(() => {
    if (productsData && productsData.length > 0) {
      // تحويل البيانات إلى الهيكل المطلوب
      const processedProducts = productsData.map((product) => ({
        productName: product.label || 'منتج غير محدد',
        totalQuantity: parseInt(product.value?.replace(/\D/g, '')) || 0,
        total_sold: parseInt(product.value?.replace(/\D/g, '')) || 0,
        total_revenue: 0,
        orders_count: 0
      }));
      
      console.log('🔥 TopProductsDialog - البيانات المعالجة:', processedProducts);
      setProductStats(processedProducts);
    } else {
      setProductStats([]);
    }
  }, [productsData]);
  // دالة فلترة البيانات حسب الفترة الزمنية (يمكن تطويرها لاحقاً)
  const getFilteredProducts = () => {
    return productStats;
  };

  const totalQuantity = productStats.reduce((sum, product) => sum + (product.total_sold || 0), 0);
  const totalRevenue = productStats.reduce((sum, product) => sum + (product.total_revenue || 0), 0);
  const totalOrders = productStats.reduce((sum, product) => sum + (product.orders_count || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-orange-500" />
            </div>
            المنتجات الأكثر طلباً
          </DialogTitle>
        </DialogHeader>

        {false ? ( // إزالة loading state لأن البيانات تأتي من Dashboard مباشرة
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">جاري التحليل...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* فلترة الفترة الزمنية */}
            <div className="flex flex-wrap gap-1">
              {periods.map((period) => (
                <Button
                  key={period.key}
                  variant={selectedPeriod === period.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period.key)}
                  className="text-xs px-2 py-1 h-8"
                >
                  {period.label}
                </Button>
              ))}
            </div>

            {/* الإحصائيات العامة */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-red-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">إجمالي الكمية</p>
                    <p className="text-xl font-bold text-white">{totalQuantity}</p>
                  </div>
                  <ShoppingCart className="w-5 h-5 text-white/80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">إجمالي الإيرادات</p>
                    <p className="text-xl font-bold text-white">{totalRevenue.toLocaleString()}</p>
                  </div>
                  <DollarSign className="w-5 h-5 text-white/80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-emerald-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">عدد المنتجات</p>
                    <p className="text-xl font-bold text-white">{productStats.length}</p>
                  </div>
                  <Package className="w-5 h-5 text-white/80" />
                </div>
              </div>
            </div>

            {/* قائمة المنتجات */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                تفاصيل المنتجات ({productStats.length})
              </h3>
              
              {productStats.length > 0 ? (
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {productStats.map((product, index) => (
                    <motion.div
                      key={product.productName}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <div className="bg-gradient-to-br from-card to-card/60 rounded-lg p-3 border border-border/60 hover:border-primary/30 transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm text-foreground truncate">{product.productName}</h4>
                              <p className="text-xs text-muted-foreground">{product.totalQuantity} قطعة مباعة</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-right">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">الإيرادات</p>
                              <p className="font-bold text-sm text-green-600 dark:text-green-400">
                                {product.totalRevenue.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">المبيعات</p>
                              <p className="font-bold text-sm text-blue-600 dark:text-blue-400">
                                {product.orderCount}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* شريط التقدم */}
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-muted-foreground">المساهمة</span>
                            <span className="text-xs font-bold text-primary">
                              {totalQuantity > 0 ? ((product.totalQuantity / totalQuantity) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-300"
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
                <div className="bg-gradient-to-br from-card to-card/60 rounded-lg p-8 border border-border/60">
                  <div className="text-center">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground mb-1">لا توجد بيانات منتجات</p>
                    <p className="text-xs text-muted-foreground">لا توجد طلبات مكتملة للفترة المحددة</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TopProductsDialog;