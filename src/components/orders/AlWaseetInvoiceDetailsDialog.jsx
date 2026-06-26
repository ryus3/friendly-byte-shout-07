import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  DollarSign,
  Phone,
  MapPin,
  Database,
  Wifi,
  Building,
  TrendingUp,
  Link2,
  CheckCircle2,
  Clock3,
  Hash,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useAlWaseetInvoices } from '@/hooks/useAlWaseetInvoices';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InvoiceProfitsTab from './InvoiceProfitsTab';
import { cn } from '@/lib/utils';

const AlWaseetInvoiceDetailsDialog = ({ isOpen, onClose, invoice, viewerUserId = null }) => {
  const {
    invoiceOrders,
    loading,
    fetchInvoiceOrders,
    linkInvoiceWithLocalOrders,
  } = useAlWaseetInvoices();

  const [linkedOrders, setLinkedOrders] = useState([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [dataSource, setDataSource] = useState('database');
  const [fetchNotice, setFetchNotice] = useState(null);

  const isReceived = !!invoice && (
    invoice.received === true ||
    invoice.received_flag === true ||
    invoice.status === 'تم الاستلام من قبل التاجر' ||
    invoice.status_normalized?.toLowerCase() === 'received'
  );

  useEffect(() => {
    if (isOpen && invoice) {
      const invoiceId = invoice.external_id || invoice.id;
      if (invoiceId) {
        setFetchNotice(null);
        fetchInvoiceOrders(invoiceId).then(result => {
          if (result?.dataSource) setDataSource(result.dataSource);
          const expected = parseInt(invoice.linked_orders_count || invoice.orders_count || invoice.delivered_orders_count) || 0;
          const got = (result?.orders || []).length;
          if (expected > 0 && got === 0) {
            setFetchNotice('تعذّر جلب تفاصيل الطلبات من شركة التوصيل الآن. الفاتورة محفوظة وسيُعاد المحاولة تلقائياً عند المزامنة التالية.');
          }
        }).catch(() => {
          setFetchNotice('تعذّر الاتصال بشركة التوصيل لجلب تفاصيل الطلبات. الفاتورة محفوظة.');
        });
        loadLinkedOrders();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoice?.id, invoice?.external_id, isReceived, viewerUserId]);

  const loadLinkedOrders = async () => {
    const invoiceId = invoice?.external_id || invoice?.id;
    if (!invoiceId) return;
    setLoadingLinked(true);
    try {
      const linked = await linkInvoiceWithLocalOrders(invoiceId, viewerUserId);
      setLinkedOrders(linked);
    } catch (error) {
      console.error('Error loading linked orders:', error);
    } finally {
      setLoadingLinked(false);
    }
  };

  const amount = parseFloat(invoice?.amount || invoice?.merchant_price) || 0;
  const expectedCount = parseInt(invoice?.linked_orders_count || invoice?.orders_count || invoice?.delivered_orders_count) || 0;
  const cachedCount = invoiceOrders.length;
  const linkedCount = linkedOrders.length;
  const completion = expectedCount > 0 ? Math.min(100, Math.round((cachedCount / expectedCount) * 100)) : 0;
  const linkRate = cachedCount > 0 ? Math.min(100, Math.round((linkedCount / cachedCount) * 100)) : 0;

  const linkedTrackings = useMemo(() => new Set(linkedOrders.map(o => String(o.tracking_number || ''))), [linkedOrders]);
  const linkedByTracking = useMemo(() => {
    const m = new Map();
    linkedOrders.forEach(o => { if (o.tracking_number) m.set(String(o.tracking_number), o); });
    return m;
  }, [linkedOrders]);

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full h-[92vh] p-0 flex flex-col overflow-hidden overflow-x-hidden border-0 bg-background">
        {/* Hero Header */}
        <div className="relative flex-shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-16 -right-10 w-56 h-56 rounded-full bg-accent/10 blur-3xl" />
          <DialogHeader dir="rtl" className="relative p-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="text-right">
                  <DialogTitle className="text-lg font-bold tracking-tight">
                    فاتورة #{invoice.external_id || invoice.id}
                  </DialogTitle>
                  {(invoice.account_username || invoice.partner_name_ar) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 justify-end">
                      <Building className="h-3 w-3" />
                      {invoice.partner_name_ar || 'الوسيط'} • {invoice.account_username || 'حساب رئيسي'}
                    </p>
                  )}
                </div>
              </div>
              <Badge
                variant={isReceived ? 'default' : 'secondary'}
                className={cn(
                  'gap-1.5 px-3 py-1 text-xs font-semibold shadow-sm',
                  isReceived
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                )}
              >
                {isReceived ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                {isReceived ? 'مُستلمة' : 'معلقة'}
              </Badge>
            </div>

            {/* KPI strip */}
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <KpiTile icon={<DollarSign className="h-3.5 w-3.5" />} label="المبلغ" value={`${amount.toLocaleString()} د.ع`} tone="primary" />
              <KpiTile icon={<Package className="h-3.5 w-3.5" />} label="عدد الطلبات" value={expectedCount || cachedCount} tone="sky" />
              <KpiTile icon={<Database className="h-3.5 w-3.5" />} label="محفوظ" value={`${cachedCount}/${expectedCount || cachedCount}`} tone="violet" sub={`${completion}%`} />
              <KpiTile icon={<Link2 className="h-3.5 w-3.5" />} label="مرتبط محلياً" value={linkedCount} tone="emerald" sub={`${linkRate}%`} />
            </div>

            {expectedCount > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-primary to-primary/60 transition-all duration-700 rounded-full"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right">
                  اكتمال الكاش {completion}% • نسبة الربط {linkRate}%
                </p>
              </div>
            )}
          </DialogHeader>
        </div>

        <Tabs defaultValue="details" dir="rtl" className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 sm:px-6 pt-2 flex-shrink-0 border-b">
            <TabsList className="grid w-full grid-cols-2 bg-muted/40">
              <TabsTrigger value="details" className="gap-2">
                <Package className="w-4 h-4" />
                تفاصيل الفاتورة
              </TabsTrigger>
              <TabsTrigger value="profits" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                الأرباح والمستحقات
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-5 mt-0 space-y-6 max-w-full">
            {/* Linked Local Orders — Timeline style */}
            <section dir="rtl">
              <SectionHeader
                icon={<Sparkles className="h-4 w-4 text-emerald-500" />}
                title="الطلبات المحلية المرتبطة"
                count={linkedCount}
              />
              {loadingLinked ? (
                <SkeletonRows />
              ) : linkedOrders.length === 0 ? (
                <EmptyState text="لا توجد طلبات محلية مرتبطة بهذه الفاتورة" />
              ) : (
                <ol className="relative space-y-2 pr-4 border-r border-dashed border-border/60">
                  {linkedOrders.map((order) => (
                    <LocalOrderRow key={order.id} order={order} />
                  ))}
                </ol>
              )}
            </section>

            {/* Al-Waseet Orders */}
            <section dir="rtl">
              <SectionHeader
                icon={<Package className="h-4 w-4 text-sky-500" />}
                title="طلبات شركة التوصيل"
                count={cachedCount}
                right={
                  <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                    {isReceived || dataSource !== 'api' ? (
                      <><Database className="h-3 w-3" /> محفوظ</>
                    ) : (
                      <><Wifi className="h-3 w-3" /> مباشر</>
                    )}
                  </Badge>
                }
              />
              {loading ? (
                <SkeletonRows />
              ) : invoiceOrders.length === 0 ? (
                <EmptyState
                  text={fetchNotice || 'لا توجد طلبات في هذه الفاتورة'}
                  sub={fetchNotice ? `العدد المتوقع: ${expectedCount}` : null}
                />
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {invoiceOrders.map((order) => {
                    const trackingKey = String(order.qr_id || order.id);
                    const localOrder = linkedByTracking.get(trackingKey);
                    return (
                      <WaseetOrderRow
                        key={order.id}
                        order={order}
                        linked={linkedTrackings.has(trackingKey)}
                        localOrder={localOrder}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="profits" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-4 mt-0 max-w-full">
            <InvoiceProfitsTab invoice={invoice} linkedOrders={linkedOrders} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const toneMap = {
  primary: 'from-primary/15 to-primary/5 text-primary border-primary/20',
  sky: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-300 border-sky-500/20',
  violet: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-300 border-violet-500/20',
  emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
};

const KpiTile = ({ icon, label, value, sub, tone = 'primary' }) => (
  <div className={cn(
    'relative rounded-xl border bg-gradient-to-br p-2.5 backdrop-blur-sm',
    toneMap[tone]
  )}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="opacity-80">{icon}</div>
    </div>
    <div className="mt-1 flex items-baseline justify-between gap-1">
      <span className="text-sm font-bold text-foreground">{value}</span>
      {sub && <span className="text-[10px] font-semibold opacity-80">{sub}</span>}
    </div>
  </div>
);

const SectionHeader = ({ icon, title, count, right }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">{icon}</div>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {typeof count === 'number' && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
      )}
    </div>
    {right}
  </div>
);

const SkeletonRows = () => (
  <div className="space-y-2">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
    ))}
  </div>
);

const EmptyState = ({ text, sub }) => (
  <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-6 text-center">
    <p className="text-sm text-muted-foreground">{text}</p>
    {sub && <p className="text-[10px] text-muted-foreground/70 mt-1">{sub}</p>}
  </div>
);

const LocalOrderRow = ({ order }) => (
  <li className="relative">
    <span className="absolute -right-[21px] top-3 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-l from-emerald-500/5 to-transparent p-3 hover:from-emerald-500/10 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1 font-mono text-[11px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
              <Hash className="h-3 w-3" />
              {order.tracking_number || '—'}
            </Badge>
            <span className="font-semibold text-sm truncate">{order.customer_name}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {order.customer_phone && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customer_phone}</span>
            )}
            {(order.account_username || order.partner_name_ar) && (
              <span className="flex items-center gap-1 text-primary/80">
                <Building className="h-3 w-3" />{order.account_username || 'حساب رئيسي'}
              </span>
            )}
          </div>
        </div>
        <div className="text-left flex-shrink-0">
          <p className="text-sm font-bold text-foreground">{(order.final_amount || 0).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">د.ع</p>
        </div>
      </div>
    </div>
  </li>
);

const WaseetOrderRow = ({ order, linked, localOrder }) => {
  // ✅ مصدر الحقيقة للسعر = مبلغ شركة التوصيل (order.invoice_amount/order.price)
  // وليس final_amount المخزّن قبل الإرسال للشركة. يقبل صفر/سالب.
  const apiAmount = (order.invoice_amount !== undefined && order.invoice_amount !== null)
    ? Number(order.invoice_amount)
    : (parseFloat(order.price) || 0);
  const apiDeliveryFee = parseFloat(order.delivery_price) || 0;
  const amount = apiAmount;
  const deliveryFee = localOrder?.delivery_fee != null ? Number(localOrder.delivery_fee) : apiDeliveryFee;
  const displayName = localOrder?.customer_name || order.client_name;
  const displayPhone = localOrder?.customer_phone || order.client_mobile;
  const cityParts = [
    localOrder?.customer_city || order.city_name,
    localOrder?.customer_province,
  ].filter(Boolean);
  const locationLabel = cityParts.join(' — ') || localOrder?.customer_address || 'غير محدد';
  const isReturned = amount <= 0;

  return (
    <div className={cn(
      'rounded-xl border bg-card p-3 transition-all hover:shadow-sm',
      linked ? 'border-emerald-500/30' : 'border-border/60',
      isReturned && 'border-orange-500/40 bg-orange-500/5'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-[11px] max-w-full truncate">#{order.qr_id || order.id}</Badge>
            {linked ? (
              <Badge className="h-5 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Link2 className="h-3 w-3 ml-1" />مرتبط
              </Badge>
            ) : (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">بانتظار الربط</Badge>
            )}
            {isReturned && (
              <Badge className="h-5 px-1.5 text-[10px] bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                {amount < 0 ? 'مرتجع' : 'بدون دفع'}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium truncate">{displayName}</p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            {displayPhone && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{displayPhone}</span>
            )}
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{locationLabel}</span>
          </div>
        </div>
        <div className="text-left flex-shrink-0">
          <p className={cn('text-sm font-bold', isReturned ? 'text-orange-600' : '')}>{amount.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">شحن {deliveryFee.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default AlWaseetInvoiceDetailsDialog;
