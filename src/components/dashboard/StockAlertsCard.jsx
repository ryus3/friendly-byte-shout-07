import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, TriangleAlert, AlertCircle, ArrowUpRight, Sparkles, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useInventory } from '@/contexts/SuperProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useFilteredStockNotifications } from '@/hooks/useFilteredStockNotifications';
import { useAuth } from '@/contexts/UnifiedAuthContext';

import DefaultProductImage from '@/components/ui/default-product-image';
import devLog from '@/lib/devLogger';

const StockAlertsCard = () => {
  const navigate = useNavigate();
  const { products, settings } = useInventory();
  const { isAdmin, isDepartmentManager, canViewStockAlerts, canManageInventory } = usePermissions();
  const { user } = useAuth();

  const filteredProducts = useFilteredStockNotifications(products);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handleRefresh = () => devLog.log('📦 Stock alerts refreshed');
    window.addEventListener('refresh-inventory', handleRefresh);
    return () => window.removeEventListener('refresh-inventory', handleRefresh);
  }, []);

  const myProducts = useMemo(() => {
    if (!filteredProducts) return [];
    if (isAdmin) return filteredProducts;
    const uid = user?.id || user?.user_id;
    if (!uid) return [];
    return filteredProducts.filter(p => p.owner_user_id === uid);
  }, [filteredProducts, isAdmin, user?.id, user?.user_id]);

  const threshold = settings?.lowStockThreshold || 5;

  const lowStockProducts = useMemo(() => {
    if (!myProducts || !Array.isArray(myProducts)) return [];
    const items = [];
    myProducts.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        const lowStockVariants = product.variants.filter(v => {
          const q = v.quantity || 0;
          return q > 0 && q <= threshold;
        });
        if (lowStockVariants.length > 0) {
          const totalQty = lowStockVariants.reduce((s, v) => s + (v.quantity || 0), 0);
          items.push({
            id: product.id,
            productName: product.name,
            productImage: product.images?.[0],
            lowStockVariantsCount: lowStockVariants.length,
            allVariantsCount: product.variants.length,
            totalLowStockQuantity: totalQty,
            criticalCount: lowStockVariants.filter(v => (v.quantity || 0) <= Math.max(1, Math.floor(threshold / 2))).length,
          });
        }
      }
    });
    return items.sort((a, b) => a.totalLowStockQuantity - b.totalLowStockQuantity);
  }, [myProducts, threshold]);

  const ownsAnyProducts = isAdmin || (myProducts && myProducts.length > 0);
  const canViewAlerts = (canViewStockAlerts || canManageInventory || isAdmin || isDepartmentManager) && ownsAnyProducts;
  if (!canViewAlerts) return null;

  const total = lowStockProducts.length;
  const criticalTotal = lowStockProducts.reduce((s, p) => s + p.criticalCount, 0);

  const handleViewAll = () => navigate('/inventory');
  const handleLowStockProductClick = (p) => navigate(`/inventory?product=${p.id}`, { state: { productId: p.id, highlight: true } });

  const getLevel = (qty) => {
    const half = Math.max(1, Math.floor(threshold / 2));
    if (qty <= half) return { label: 'حرج', cls: 'from-rose-500 to-red-600', text: 'text-rose-100', dot: 'bg-rose-400', ring: 'ring-rose-500/40' };
    return { label: 'منخفض', cls: 'from-amber-500 to-orange-600', text: 'text-amber-100', dot: 'bg-amber-400', ring: 'ring-amber-500/40' };
  };

  return (
    <Card className="glass-effect h-full border-border/60 flex flex-col overflow-hidden relative shadow-2xl shadow-amber-500/5">
      {/* aurora bg */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-rose-500/10 blur-3xl" />
      </div>

      <CardHeader className="relative pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg text-foreground">
            <div className={cn(
              "relative p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/10 border border-amber-500/30 shadow-inner",
              isRefreshing && "animate-pulse"
            )}>
              <TriangleAlert className="w-5 h-5 text-amber-500" />
              {criticalTotal > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_hsl(0_85%_60%/0.8)]"
                />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold">تنبيهات المخزون</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                المتغيرات منخفضة المخزون (1 - {threshold})
              </span>
            </div>
          </CardTitle>
          {total > 0 && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 250, damping: 18 }}
              className="relative"
            >
              <div className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white text-sm font-extrabold shadow-lg shadow-rose-500/40">
                {total}
              </div>
            </motion.div>
          )}
        </div>

        {/* mini KPI strip */}
        {total > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground">حرج</div>
                <div className="text-sm font-bold text-rose-300">{criticalTotal}</div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground">يحتاج تجديد</div>
                <div className="text-sm font-bold text-amber-300">{total - criticalTotal}</div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="relative p-3 space-y-2">
        {total > 0 ? (
          <>
            {lowStockProducts.slice(0, 5).map((product, idx) => {
              const lvl = getLevel(product.totalLowStockQuantity / Math.max(1, product.lowStockVariantsCount));
              const fillPct = Math.min(100, Math.max(8, (product.totalLowStockQuantity / (threshold * product.lowStockVariantsCount || 1)) * 100));
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  onClick={() => handleLowStockProductClick(product)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm cursor-pointer",
                    "hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300"
                  )}
                >
                  {/* left status bar */}
                  <div className={cn("absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b", lvl.cls)} />

                  <div className="flex items-center gap-3 p-3 pr-4">
                    {/* image */}
                    <div className={cn(
                      "relative w-12 h-12 rounded-xl overflow-hidden border border-border/40 ring-2 ring-offset-2 ring-offset-background flex-shrink-0",
                      lvl.ring
                    )}>
                      {product.productImage ? (
                        <img src={product.productImage} alt={product.productName} className="w-full h-full object-cover" />
                      ) : (
                        <DefaultProductImage className="w-full h-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-foreground truncate">{product.productName}</h4>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r text-white shadow",
                          lvl.cls
                        )}>{lvl.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {product.lowStockVariantsCount} من {product.allVariantsCount} متغيرات
                      </p>
                      {/* progress bar */}
                      <div className="mt-2 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${fillPct}%` }}
                          transition={{ duration: 0.9, delay: idx * 0.06, ease: 'easeOut' }}
                          className={cn("h-full bg-gradient-to-r rounded-full", lvl.cls)}
                        />
                      </div>
                    </div>

                    {/* qty pill */}
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg bg-gradient-to-br",
                        lvl.cls
                      )}>
                        {product.totalLowStockQuantity}
                      </div>
                      <span className="text-[9px] text-muted-foreground">إجمالي</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <Button
              variant="ghost"
              className="w-full mt-2 text-amber-500 hover:bg-amber-500/10 group font-semibold"
              onClick={handleViewAll}
            >
              عرض كل التنبيهات
              <ArrowUpRight className="w-4 h-4 mr-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10"
          >
            <div className="relative w-16 h-16 mx-auto mb-3">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <p className="text-emerald-400 font-bold text-base">مخزون ممتاز</p>
            <p className="text-muted-foreground text-xs mt-1">
              {isRefreshing ? "جاري فحص المخزون..." : "لا توجد متغيرات منخفضة المخزون"}
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockAlertsCard;
