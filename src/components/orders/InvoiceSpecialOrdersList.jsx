import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Banknote, Hash, User as UserIcon, AlertCircle } from 'lucide-react';

/**
 * قائمة "طلبات تحتاج انتباهك" داخل تفاصيل الفاتورة.
 * ثلاثة أقسام:
 *  🟢 زيادة من شركة التوصيل
 *  🟠 خصم من شركة التوصيل
 *  🔴 تحصيل خارج القناة (مبلغ الوسيط = 0 لكن الطلب مُسلَّم — دفع إلكتروني/المالك يتحمّل التوصيل)
 *
 * @param {Object} props
 * @param {Object} props.calc      مخرجات computeInvoiceProfits (يحوي deltaOrders + offChannelOrders)
 * @param {Array}  props.orders    صفوف orders (مرفقة بمعلومات tracking_number/customer_name لتعزيز العرض)
 * @param {Object} props.namesMap  user_id → full_name
 * @param {Function} props.fmt     دالة تنسيق العملة
 */
const InvoiceSpecialOrdersList = ({ calc, orders = [], namesMap = {}, fmt }) => {
  const ordersById = useMemo(() => {
    const m = new Map();
    (orders || []).forEach((o) => m.set(o.id, o));
    return m;
  }, [orders]);

  const formatCur = fmt || ((n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`);

  const deltaOrders = calc?.deltaOrders || [];
  const offChannelOrders = calc?.offChannelOrders || [];

  const increases = deltaOrders.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta);
  const decreases = deltaOrders.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta);

  if (increases.length === 0 && decreases.length === 0 && offChannelOrders.length === 0) {
    return null;
  }

  const renderOrderRow = (item, kind) => {
    const o = ordersById.get(item.order_id);
    const tracking = o?.tracking_number || o?.order_number || (item.order_id?.slice?.(0, 8) ?? '—');
    const customer = o?.customer_name || o?.customer?.name || '—';
    const creatorName = namesMap[item.created_by] || namesMap[o?.created_by] || '—';

    const cfg = {
      increase: {
        wrap: 'border-emerald-500/30 bg-emerald-500/5',
        amountColor: 'text-emerald-600',
        prefix: '+',
        amount: item.delta,
      },
      decrease: {
        wrap: 'border-orange-500/30 bg-orange-500/5',
        amountColor: 'text-orange-600',
        prefix: '−',
        amount: Math.abs(item.delta),
      },
      offchannel: {
        wrap: 'border-amber-500/40 bg-amber-500/5',
        amountColor: 'text-amber-700 dark:text-amber-300',
        prefix: '',
        amount: item.expected_amount,
      },
    }[kind];

    return (
      <div
        key={`${kind}-${item.order_id}`}
        className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${cfg.wrap}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate">{tracking}</div>
            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
              <UserIcon className="w-3 h-3" />
              {customer}
              {kind === 'offchannel' && item.delivery_fee_absorbed > 0 && (
                <span className="ms-1">• توصيل {formatCur(item.delivery_fee_absorbed)}</span>
              )}
              {kind === 'offchannel' && creatorName !== '—' && (
                <span className="ms-1">• الموظف: {creatorName}</span>
              )}
            </div>
          </div>
        </div>
        <Badge variant="secondary" className={`font-bold ${cfg.amountColor} bg-background/60 border`}>
          {cfg.prefix}{formatCur(cfg.amount)}
        </Badge>
      </div>
    );
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-right text-sm">
          <AlertCircle className="w-4 h-4 text-primary" />
          طلبات تحتاج انتباهك ({increases.length + decreases.length + offChannelOrders.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {increases.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold">زيادة من شركة التوصيل ({increases.length})</span>
            </div>
            <div className="space-y-1.5">{increases.map((it) => renderOrderRow(it, 'increase'))}</div>
          </section>
        )}

        {decreases.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 text-orange-700 dark:text-orange-300">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-bold">خصم من شركة التوصيل ({decreases.length})</span>
            </div>
            <div className="space-y-1.5">{decreases.map((it) => renderOrderRow(it, 'decrease'))}</div>
          </section>
        )}

        {offChannelOrders.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300">
              <Banknote className="w-4 h-4" />
              <span className="text-xs font-bold">
                تحصيلات خارج القناة ({offChannelOrders.length}) — دفع إلكتروني / المالك يتحمّل التوصيل
              </span>
            </div>
            <div className="space-y-1.5">{offChannelOrders.map((it) => renderOrderRow(it, 'offchannel'))}</div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              * هذه الطلبات مبلغها من شركة التوصيل = 0 لكنها مُسلَّمة فعلاً. المبلغ المعروض هو
              قيمة المنتجات المتوقّع تحصيلها من الموظف أو إثباتها كدفع إلكتروني (سيتم تفعيل
              نافذة التصنيف وتأكيد المالك في المرحلة التالية).
            </p>
          </section>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceSpecialOrdersList;
