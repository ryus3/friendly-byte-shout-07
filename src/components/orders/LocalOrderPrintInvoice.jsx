import React, { forwardRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * فاتورة طباعة الطلب المحلي.
 * - تيكيت بعرض 80mm تقريباً (قابل للطباعة على A4 أيضاً)
 * - يحتوي QR لتحديث حالة الطلب من المندوب
 * - يدعم RTL + خط Amiri
 *
 * يُستخدم داخل LocalOrderPrintDialog لطباعة طلب واحد أو عدة طلبات (دفعة واحدة).
 */
const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

const LocalOrderPrintInvoice = forwardRef(({ order, baseUrl }, ref) => {
  const items = order?.order_items || order?.items || [];
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantity) || 1) * (Number(it.unit_price ?? it.price ?? 0)), 0),
    [items]
  );
  const delivery = Number(order?.delivery_fee || 0);
  const discount = Number(order?.discount || 0);
  const total = Number(order?.total_amount ?? subtotal + delivery - discount);

  const qrPayload = `${baseUrl || 'https://pos.ryusbrand.com'}/track/local/${order?.id || ''}`;

  return (
    <div
      ref={ref}
      dir="rtl"
      className="local-invoice bg-white text-black p-4 mx-auto"
      style={{ width: '80mm', fontFamily: 'Amiri, system-ui, sans-serif', pageBreakAfter: 'always' }}
    >
      <div className="text-center border-b border-black/30 pb-2 mb-2">
        <div className="text-lg font-extrabold tracking-wide">RYUS</div>
        <div className="text-[11px] opacity-80">فاتورة طلب محلي</div>
        <div className="text-base font-bold mt-1">{order?.order_number || `RYUS-${(order?.id || '').slice(0, 8)}`}</div>
        <div className="text-[10px] opacity-70">{order?.created_at ? new Date(order.created_at).toLocaleString('ar-IQ') : ''}</div>
      </div>

      <div className="text-[12px] space-y-0.5 mb-2">
        <div><span className="font-bold">العميل:</span> {order?.customer_name || '—'}</div>
        <div><span className="font-bold">الهاتف:</span> {order?.customer_phone || '—'}</div>
        <div>
          <span className="font-bold">العنوان:</span> {order?.customer_province || order?.customer_city || ''}
          {order?.customer_address ? ` — ${order.customer_address}` : ''}
        </div>
        {order?.notes && <div><span className="font-bold">ملاحظة:</span> {order.notes}</div>}
      </div>

      <table className="w-full text-[11px] border-collapse mb-2">
        <thead>
          <tr className="border-b border-black/40">
            <th className="text-right py-1">المنتج</th>
            <th className="text-center py-1 w-8">الكمية</th>
            <th className="text-left py-1 w-16">السعر</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-black/10">
              <td className="py-1">
                {it.product_name || it.name || '—'}
                {(it.color || it.size) && (
                  <div className="text-[10px] opacity-70">
                    {it.color ? it.color : ''}{it.size ? ` / ${it.size}` : ''}
                  </div>
                )}
              </td>
              <td className="text-center py-1">{it.quantity || 1}</td>
              <td className="text-left py-1">{fmt(it.unit_price ?? it.price ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-[12px] border-t border-black/40 pt-1 space-y-0.5">
        <div className="flex justify-between"><span>المجموع الفرعي</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between"><span>أجور التوصيل</span><span>{fmt(delivery)}</span></div>
        {discount > 0 && <div className="flex justify-between"><span>الخصم</span><span>-{fmt(discount)}</span></div>}
        <div className="flex justify-between font-extrabold text-[14px] border-t border-black/40 mt-1 pt-1">
          <span>الإجمالي</span><span>{fmt(total)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center gap-1">
        <QRCodeSVG value={qrPayload} size={110} includeMargin={false} />
        <div className="text-[10px] opacity-70 text-center">امسح للوصول إلى تفاصيل الطلب وتحديث الحالة</div>
      </div>

      <div className="text-center text-[10px] mt-3 opacity-70">
        منشئ الطلب: {order?.created_by_name || '—'}
      </div>
    </div>
  );
});

LocalOrderPrintInvoice.displayName = 'LocalOrderPrintInvoice';
export default LocalOrderPrintInvoice;
