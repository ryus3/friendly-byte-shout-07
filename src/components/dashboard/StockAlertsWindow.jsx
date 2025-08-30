import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/contexts/InventoryContext';
import { useNavigate } from 'react-router-dom';
import { useBottomSheet } from '@/hooks/useBottomSheet';
import { 
  AlertTriangle, 
  TrendingDown, 
  Package, 
  AlertCircle,
  X,
  Eye,
  ChevronDown,
  Calendar,
  ShoppingCart,
  Barcode,
  Activity,
  DollarSign
} from 'lucide-react';

const StockAlertsWindow = ({ open, onOpenChange }) => {
  const { products, settings } = useInventory();
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState('all');
  
  const bottomSheet = useBottomSheet(open, () => onOpenChange(false));

  // حساب المنتجات منخفضة المخزون مع تفاصيل شاملة
  const lowStockProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    const threshold = settings?.lowStockThreshold || 10;
    const lowStockItems = [];

    products.forEach(product => {
      if (product.variants && Array.isArray(product.variants)) {
        product.variants.forEach(variant => {
          const quantity = parseInt(variant.quantity) || 0;
          if (quantity > 0 && quantity <= threshold) {
            const lastUpdate = variant.updated_at || product.updated_at || new Date().toISOString();
            const daysSinceUpdate = Math.floor((Date.now() - new Date(lastUpdate)) / (1000 * 60 * 60 * 24));
            
            lowStockItems.push({
              id: `${product.id}-${variant.id}`,
              productId: product.id,
              variantId: variant.id,
              name: product.name,
              size: variant.size,
              color: variant.color,
              quantity: quantity,
              minStock: threshold,
              image: product.image,
              category: product.category,
              department: product.department,
              sku: variant.sku || product.sku,
              price: variant.price || product.price,
              cost: variant.cost || product.cost,
              supplier: product.supplier || 'غير محدد',
              lastUpdate: lastUpdate,
              daysSinceUpdate: daysSinceUpdate,
              reorderPoint: Math.max(5, Math.floor(threshold * 0.5)),
              estimatedValue: (variant.price || product.price || 0) * quantity,
              status: quantity <= threshold * 0.25 ? 'critical' : 
                     quantity <= threshold * 0.5 ? 'warning' : 'low'
            });
          }
        });
      }
    });

    return lowStockItems.sort((a, b) => {
      // ترتيب حسب الأولوية ثم الكمية
      const priorityOrder = { critical: 3, warning: 2, low: 1 };
      if (a.status !== b.status) {
        return priorityOrder[b.status] - priorityOrder[a.status];
      }
      return a.quantity - b.quantity;
    });
  }, [products, settings?.lowStockThreshold]);

  // تحديد مستوى المخزون مع تفاصيل أكثر
  const getStockLevel = useCallback((stock, minStock) => {
    const percentage = (stock / minStock) * 100;
    
    if (percentage <= 25) {
      return { 
        level: 'critical', 
        label: 'حرج جداً',
        style: 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white shadow-lg shadow-red-500/30 border-red-500',
        cardStyle: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-lg shadow-red-500/10',
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50 border-red-200',
        priority: 'عالية جداً',
        action: 'طلب فوري'
      };
    } else if (percentage <= 50) {
      return { 
        level: 'warning', 
        label: 'تحذيري',
        style: 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-lg shadow-orange-500/30 border-orange-500',
        cardStyle: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg shadow-orange-500/10',
        icon: AlertCircle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 border-orange-200',
        priority: 'عالية',
        action: 'مراجعة قريبة'
      };
    } else {
      return { 
        level: 'low', 
        label: 'منخفض',
        style: 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-700 text-white shadow-lg shadow-yellow-500/30 border-yellow-500',
        cardStyle: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 shadow-lg shadow-yellow-500/10',
        icon: TrendingDown,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 border-yellow-200',
        priority: 'متوسطة',
        action: 'مراقبة'
      };
    }
  }, []);

  // فلترة المنتجات حسب المستوى المحدد
  const filteredProducts = useMemo(() => {
    if (selectedLevel === 'all') return lowStockProducts;
    
    return lowStockProducts.filter(product => {
      const { level } = getStockLevel(product.quantity, product.minStock);
      return level === selectedLevel;
    });
  }, [lowStockProducts, selectedLevel, getStockLevel]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const total = lowStockProducts.length;
    const critical = lowStockProducts.filter(p => {
      const { level } = getStockLevel(p.quantity, p.minStock);
      return level === 'critical';
    }).length;
    const warning = lowStockProducts.filter(p => {
      const { level } = getStockLevel(p.quantity, p.minStock);
      return level === 'warning';
    }).length;
    const low = lowStockProducts.filter(p => {
      const { level } = getStockLevel(p.quantity, p.minStock);
      return level === 'low';
    }).length;

    const totalValue = lowStockProducts.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);

    return { total, critical, warning, low, totalValue };
  }, [lowStockProducts, getStockLevel]);

  const handleProductClick = useCallback((variant) => {
    navigate('/inventory', { 
      state: { 
        highlightProduct: variant.productId,
        highlightVariant: variant.variantId 
      } 
    });
    onOpenChange(false);
  }, [navigate, onOpenChange]);

  const handleViewInventory = useCallback(() => {
    navigate('/inventory');
    onOpenChange(false);
  }, [navigate, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black transition-opacity duration-300"
        style={{ opacity: bottomSheet.backdropOpacity }}
        onClick={() => onOpenChange(false)}
      />
      
      {/* Bottom Sheet */}
      <div
        ref={bottomSheet.containerRef}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background border-t border-border shadow-2xl transition-transform duration-300 ease-out"
        style={{ 
          transform: bottomSheet.transform,
          height: '95vh',
          maxHeight: '95vh',
          willChange: 'transform'
        }}
        {...bottomSheet.handlers}
      >
        {/* Drag Handle */}
        <div className="flex-shrink-0 flex justify-center py-3 bg-background border-b border-border/30">
          <div 
            className="w-12 h-1.5 bg-muted-foreground/30 rounded-full cursor-grab active:cursor-grabbing transition-colors hover:bg-muted-foreground/50"
            {...bottomSheet.handlers}
          />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-border/50 bg-gradient-to-r from-background via-background/80 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  تنبيهات المخزون المنخفض
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lowStockProducts.length} منتج يحتاج إلى إعادة تموين
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards - Sticky */}
        <div className="flex-shrink-0 p-4 border-b border-border/30 bg-background/90 backdrop-blur-md sticky top-0 z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Card */}
            <Card 
              className={`relative overflow-hidden p-4 cursor-pointer transition-all duration-300 border-2 ${
                selectedLevel === 'all' 
                  ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 border-blue-500 scale-105' 
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg shadow-blue-500/10 hover:scale-105'
              }`}
              onClick={() => setSelectedLevel('all')}
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${selectedLevel === 'all' ? 'text-blue-100' : 'text-blue-600'}`}>
                    إجمالي التنبيهات
                  </p>
                  <p className={`text-2xl font-bold ${selectedLevel === 'all' ? 'text-white' : 'text-blue-700'}`}>
                    {stats.total}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${selectedLevel === 'all' ? 'bg-white/20' : 'bg-blue-500/10'}`}>
                  <Package className={`h-6 w-6 ${selectedLevel === 'all' ? 'text-white' : 'text-blue-600'}`} />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-10 translate-x-10"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-8 -translate-x-8"></div>
            </Card>

            {/* Critical Card */}
            <Card 
              className={`relative overflow-hidden p-4 cursor-pointer transition-all duration-300 border-2 ${
                selectedLevel === 'critical' 
                  ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white shadow-lg shadow-red-500/30 border-red-500 scale-105' 
                  : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg shadow-red-500/10 hover:scale-105'
              }`}
              onClick={() => setSelectedLevel('critical')}
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${selectedLevel === 'critical' ? 'text-red-100' : 'text-red-600'}`}>
                    حرج جداً
                  </p>
                  <p className={`text-2xl font-bold ${selectedLevel === 'critical' ? 'text-white' : 'text-red-700'}`}>
                    {stats.critical}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${selectedLevel === 'critical' ? 'bg-white/20' : 'bg-red-500/10'}`}>
                  <AlertTriangle className={`h-6 w-6 ${selectedLevel === 'critical' ? 'text-white' : 'text-red-600'}`} />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-10 translate-x-10"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-8 -translate-x-8"></div>
            </Card>

            {/* Low Card */}
            <Card 
              className={`relative overflow-hidden p-4 cursor-pointer transition-all duration-300 border-2 ${
                selectedLevel === 'low' 
                  ? 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-700 text-white shadow-lg shadow-yellow-500/30 border-yellow-500 scale-105' 
                  : 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg shadow-yellow-500/10 hover:scale-105'
              }`}
              onClick={() => setSelectedLevel('low')}
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${selectedLevel === 'low' ? 'text-yellow-100' : 'text-yellow-600'}`}>
                    منخفض
                  </p>
                  <p className={`text-2xl font-bold ${selectedLevel === 'low' ? 'text-white' : 'text-yellow-700'}`}>
                    {stats.low}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${selectedLevel === 'low' ? 'bg-white/20' : 'bg-yellow-500/10'}`}>
                  <TrendingDown className={`h-6 w-6 ${selectedLevel === 'low' ? 'text-white' : 'text-yellow-600'}`} />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-10 translate-x-10"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-8 -translate-x-8"></div>
            </Card>

            {/* Warning Card */}
            <Card 
              className={`relative overflow-hidden p-4 cursor-pointer transition-all duration-300 border-2 ${
                selectedLevel === 'warning' 
                  ? 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-lg shadow-orange-500/30 border-orange-500 scale-105' 
                  : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg shadow-orange-500/10 hover:scale-105'
              }`}
              onClick={() => setSelectedLevel('warning')}
            >
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${selectedLevel === 'warning' ? 'text-orange-100' : 'text-orange-600'}`}>
                    تحذيري
                  </p>
                  <p className={`text-2xl font-bold ${selectedLevel === 'warning' ? 'text-white' : 'text-orange-700'}`}>
                    {stats.warning}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${selectedLevel === 'warning' ? 'bg-white/20' : 'bg-orange-500/10'}`}>
                  <AlertCircle className={`h-6 w-6 ${selectedLevel === 'warning' ? 'text-white' : 'text-orange-600'}`} />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-10 translate-x-10"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-8 -translate-x-8"></div>
            </Card>
          </div>
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    لا توجد تنبيهات مخزون
                  </h3>
                  <p className="text-muted-foreground">
                    جميع المنتجات لديها مخزون كافٍ
                  </p>
                </div>
              ) : (
                filteredProducts.map((variant) => {
                  const stockInfo = getStockLevel(variant.quantity, variant.minStock);
                  const IconComponent = stockInfo.icon;
                  
                  return (
                    <Card 
                      key={variant.id}
                      className={`p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${stockInfo.cardStyle} min-h-[140px]`}
                      onClick={() => handleProductClick(variant)}
                    >
                      <div className="flex items-start gap-4 h-full">
                        {/* Priority Indicator */}
                        <div className={`w-1 h-full rounded-full ${
                          stockInfo.level === 'critical' ? 'bg-red-500' :
                          stockInfo.level === 'warning' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`} />

                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted border-2 border-white shadow-lg">
                            {variant.image ? (
                              <img 
                                src={variant.image} 
                                alt={variant.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-foreground text-lg line-clamp-1">
                                {variant.name}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <Badge variant="outline" className="text-sm font-medium">
                                  {variant.size} - {variant.color}
                                </Badge>
                                {variant.sku && (
                                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Barcode className="h-4 w-4" />
                                    {variant.sku}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <Badge className={`${stockInfo.style} px-3 py-1 text-sm font-semibold`}>
                              <IconComponent className="h-4 w-4 mr-1" />
                              {stockInfo.label}
                            </Badge>
                          </div>

                          {/* Stock Details Grid */}
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">الكمية الحالية</span>
                                <span className={`font-bold text-lg ${stockInfo.color}`}>
                                  {variant.quantity}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">الحد الأدنى</span>
                                <span className="font-semibold">{variant.minStock}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">القيمة المقدرة</span>
                                <span className="font-bold flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {variant.estimatedValue?.toLocaleString() || '0'}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">آخر تحديث</span>
                                <span className="font-medium flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {variant.daysSinceUpdate} يوم
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">الأولوية</span>
                                <span className={`font-bold ${stockInfo.color}`}>
                                  {stockInfo.priority}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">المورد</span>
                                <span className="font-medium">{variant.supplier}</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div className="flex items-center justify-between text-xs mb-2">
                              <span className="text-muted-foreground font-medium">مستوى المخزون</span>
                              <span className={`${stockInfo.color} font-bold`}>
                                {Math.round((variant.quantity / variant.minStock) * 100)}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-3 shadow-inner">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 shadow-sm ${
                                  stockInfo.level === 'critical' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                  stockInfo.level === 'warning' ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 
                                  'bg-gradient-to-r from-yellow-500 to-yellow-600'
                                }`}
                                style={{ 
                                  width: `${Math.min(100, Math.max(8, (variant.quantity / variant.minStock) * 100))}%` 
                                }}
                              />
                            </div>
                          </div>

                          {/* Action Section */}
                          <div className={`p-3 rounded-lg ${stockInfo.bgColor} flex items-center justify-between`}>
                            <div>
                              <span className={`text-sm font-bold ${stockInfo.color} block`}>
                                إجراء مطلوب: {stockInfo.action}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                يُنصح بإعادة الطلب عند الوصول إلى {variant.reorderPoint} قطعة
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" className="h-8 text-xs px-3">
                                <ShoppingCart className="h-3 w-3 mr-1" />
                                طلب
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-xs px-3">
                                <Activity className="h-3 w-3 mr-1" />
                                تفاصيل
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-border/50 bg-background/90 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              إجمالي القيمة المعرضة للخطر: <span className="font-bold text-foreground">{stats.totalValue?.toLocaleString() || '0'} د.ع</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="px-6"
              >
                إغلاق
              </Button>
              <Button
                onClick={handleViewInventory}
                className="px-6 bg-primary hover:bg-primary/90"
              >
                <Eye className="h-4 w-4 mr-2" />
                عرض المخزون
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StockAlertsWindow;