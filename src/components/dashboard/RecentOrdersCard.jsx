import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, MapPin, Truck, Home, Clock, ArrowUpRight, Sparkles } from 'lucide-react';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getStatusForComponent } from '@/lib/order-status-translator';
import ScrollingText from '@/components/ui/scrolling-text';

const RecentOrdersCard = ({ recentOrders }) => {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const navigate = useNavigate();

  const handleViewOrder = (order) => { setSelectedOrder(order); setIsDetailsOpen(true); };
  const handleViewAll = () => navigate('/my-orders');

  const getStatusBadge = (order) => {
    const cfg = getStatusForComponent(order, 'recentOrders');
    const Icon = cfg.icon;
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border backdrop-blur-sm text-[11px] font-bold",
        cfg.color || 'text-foreground',
        "border-current/30 bg-current/5"
      )}>
        <Icon className="w-3 h-3 flex-shrink-0" />
        <ScrollingText text={cfg.label} className="min-w-0 max-w-[90px]" />
      </div>
    );
  };

  const getDeliveryType = (order) => {
    const dp = order.delivery_partner;
    if (dp && dp !== 'محلي') return dp;
    return 'محلي';
  };

  const getOrderId = (order) =>
    order.tracking_number || order.qr_id || order.delivery_partner_order_id || order.order_number || String(order.id || 0).padStart(4, '0');

  const formatDate = (s) => {
    const d = new Date(s);
    const diffH = Math.floor((Date.now() - d) / 3600000);
    if (diffH < 1) return 'منذ قليل';
    if (diffH < 24) return `منذ ${diffH} ساعة`;
    const days = Math.floor(diffH / 24);
    if (days === 1) return 'منذ يوم';
    if (days < 7) return `منذ ${days} أيام`;
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const getStatusTime = (o) => formatDate(o.status_changed_at || o.updated_at || o.created_at);
  const getLocationLabel = (o) => [o.customer_city, o.customer_province].filter(Boolean).join(' - ') || 'عنوان غير محدد';

  const ranks = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];

  return (
    <>
      <Card className="glass-effect h-full border-primary/20 flex flex-col overflow-hidden relative shadow-2xl shadow-primary/10">
        {/* aurora */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-20 w-56 h-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-56 h-56 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <CardHeader className="relative border-b border-border/40 pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-3 text-lg text-foreground">
              <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/25 to-cyan-500/15 border border-primary/30 shadow-lg shadow-primary/20">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <Sparkles className="w-3 h-3 text-cyan-300 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold">الطلبات الأخيرة</span>
                <span className="text-[11px] font-normal text-muted-foreground">آخر {Math.min(5, recentOrders?.length || 0)} طلبات حية</span>
              </div>
            </CardTitle>
            {recentOrders?.length > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-[11px] font-bold text-primary">
                {recentOrders.length}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="relative flex-1 flex flex-col p-3">
          {recentOrders && recentOrders.length > 0 ? (
            <div className="relative space-y-2">
              {/* timeline rail */}
              <div className="absolute right-[22px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/15 to-transparent" />

              {recentOrders.slice(0, 5).map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => handleViewOrder(order)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm cursor-pointer",
                    "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/15 hover:-translate-y-0.5 transition-all duration-300"
                  )}
                >
                  {/* shimmer on hover */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

                  <div className="relative flex items-center gap-3 p-3">
                    {/* timeline node / rank */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-cyan-500/20 border border-primary/40 flex items-center justify-center shadow-inner shadow-primary/20">
                        <span className="text-primary font-bold text-lg">{ranks[index] || (index+1)}</span>
                      </div>
                      {index === 0 && (
                        <motion.span
                          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0.2, 0.7] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 rounded-full border-2 border-primary/60"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-extrabold text-primary tracking-wide">#{getOrderId(order)}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3 h-3" />{getStatusTime(order)}
                          </span>
                        </div>
                        {getStatusBadge(order)}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 min-w-0 flex-1 bg-muted/30 rounded-md px-2 py-1">
                          <MapPin className="w-3 h-3 text-primary/70 flex-shrink-0" />
                          <ScrollingText text={getLocationLabel(order)} className="text-[11px] font-medium text-foreground" />
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold flex-shrink-0 border",
                          getDeliveryType(order) === 'محلي'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        )}>
                          {getDeliveryType(order) === 'محلي' ? <Home className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                          <span className="truncate max-w-[60px]">{getDeliveryType(order)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <ShoppingCart className="w-7 h-7 text-primary/60" />
              </div>
              <p className="text-sm font-bold">لا توجد طلبات حديثة</p>
              <p className="text-xs mt-1">ستظهر الطلبات الجديدة هنا</p>
            </div>
          )}

          {recentOrders?.length > 0 && (
            <Button
              variant="ghost"
              onClick={handleViewAll}
              className="mt-3 w-full text-primary hover:bg-primary/10 group font-semibold"
            >
              عرض جميع الطلبات
              <ArrowUpRight className="w-4 h-4 mr-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>
          )}
        </CardContent>
      </Card>
      <OrderDetailsDialog order={selectedOrder} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
    </>
  );
};

export default RecentOrdersCard;
