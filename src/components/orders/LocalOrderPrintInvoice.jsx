import React, { forwardRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * فاتورة طباعة الطلب المحلي.
 * - تيكيت بعرض 80mm
 * - يدعم هيدر مخصّص (شعار/اسم محل/هاتف/عنوان) من إعدادات النظام
 * - يدعم QR لتحديث الحالة (يفتح /track/local/<id>)
 * - تفاصيل منتج كاملة (اسم + لون + قياس + كمية)
 * - عنوان كامل: المدينة - المنطقة - تفاصيل/أقرب نقطة دالة
 * - الإجمالي = المجموع الفرعي + التوصيل - الخصم (شامل التوصيل)
 */
const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

const LocalOrderPrintInvoice = forwardRef(({ order, header = {}, baseUrl }, ref) => {
  const items = order?.order_items || order?.items || [];

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, it) =>
          s + (Number(it.quantity) || 1) * (Number(it.unit_price ?? it.price ?? 0)),
        0
      ),
    [items]
  );

  const delivery = Number(order?.delivery_fee || 0);
  const discount = Number(order?.discount || 0);
  // ✅ الإجمالي شامل التوصيل دائماً للطلب المحلي
  const total = subtotal + delivery - discount;

  // ✅ عنوان كامل: المدينة - المنطقة - عنوان تفصيلي - أقرب نقطة دالة
  const addressParts = [
    order?.customer_city,
    order?.customer_province,
    order?.customer_address && order.customer_address !== 'لم يُحدد' ? order.customer_address : null,
    order?.nearest_landmark,
  ].filter(Boolean);
  const fullAddress = addressParts.join(' — ') || 'لم يُحدد';

  const qrPayload = `${baseUrl || 'https://pos.ryusbrand.com'}/track/local/${order?.id || ''}`;

  const shopName = header?.shop_name || 'RYUS';
  const shopLogo = header?.logo_url;
  const shopPhone = header?.phone;
  const shopAddress = header?.address;
  const footerNote = header?.footer_note;

  return (
    <div
      ref={ref}
      dir="rtl"
      className="local-invoice bg-white text-black p-4 mx-auto"
      style={{
        width: '80mm',
        fontFamily: 'Amiri, system-ui, sans-serif',
        pageBreakAfter: 'always',
      }}
    >
      {/* الهيدر المخصّص */}
      <div className="text-center border-b border-black/30 pb-2 mb-2">
        {shopLogo && (
          <img
            src={shopLogo}
            alt="logo"
            style={{ maxHeight: 48, margin: '0 auto 4px', display: 'block' }}
            crossOrigin="anonymous"
          />
        )}
        <div className="text-lg font-extrabold tracking-wide">{shopName}</div>
        {shopPhone && <div className="text-[11px] opacity-80">📞 {shopPhone}</div>}
        {shopAddress && <div className="text-[10px] opacity-70">{shopAddress}</div>}
        <div className="text-[11px] opacity-80 mt-1">فاتورة طلب محلي</div>
        <div className="text-base font-bold mt-1">
          {order?.order_number || `RYUS-${(order?.id || '').slice(0, 8)}`}
        </div>
        <div className="text-[10px] opacity-70">
          {order?.created_at ? new Date(order.created_at).toLocaleString('ar-IQ') : ''}
        </div>
      </div>

      {/* بيانات العميل */}
      <div className="text-[12px] space-y-0.5 mb-2">
        <div>
          <span className="font-bold">العميل:</span> {order?.customer_name || '—'}
        </div>
        <div>
          <span className="font-bold">الهاتف:</span> {order?.customer_phone || '—'}
        </div>
        <div>
          <span className="font-bold">العنوان:</span> {fullAddress}
        </div>
        {order?.notes && (
          <div>
            <span className="font-bold">ملاحظة:</span> {order.notes}
          </div>
        )}
      </div>

      {/* جدول المنتجات */}
      <table className="w-full text-[11px] border-collapse mb-2">
        <thead>
          <tr className="border-b border-black/40">
            <th className="text-right py-1">المنتج</th>
            <th className="text-center py-1 w-8">الكمية</th>
            <th className="text-left py-1 w-16">السعر</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center py-2 opacity-70">
                لا توجد منتجات
              </td>
            </tr>
          )}
          {items.map((it, i) => {
            const productName = it.product_name || it.products?.name || it.name || 'منتج';
            const color = it.color_name || it.colors?.name || it.color;
            const size = it.size_name || it.sizes?.name || it.size;
            const variantLabel = [color, size].filter((v) => v && v !== '-').join(' / ');
            const lineTotal =
              Number(it.total_price ?? (Number(it.unit_price ?? it.price ?? 0) * (Number(it.quantity) || 1))) || 0;
            return (
              <tr key={i} className="border-b border-black/10">
                <td className="py-1">
                  <div className="font-bold">{productName}</div>
                  {variantLabel && (
                    <div className="text-[10px] opacity-70">{variantLabel}</div>
                  )}
                </td>
                <td className="text-center py-1">{it.quantity || 1}</td>
                <td className="text-left py-1">{fmt(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* الإجماليات */}
      <div className="text-[12px] border-t border-black/40 pt-1 space-y-0.5">
        <div className="flex justify-between">
          <span>المجموع الفرعي</span>
          <span>{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>أجور التوصيل</span>
          <span>{fmt(delivery)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>الخصم</span>
            <span>-{fmt(discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-[14px] border-t border-black/40 mt-1 pt-1">
          <span>الإجمالي (شامل التوصيل)</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      {/* QR */}
      <div className="mt-3 flex flex-col items-center gap-1">
        <QRCodeSVG value={qrPayload} size={110} includeMargin={false} />
        <div className="text-[10px] opacity-70 text-center">
          امسح للوصول إلى تفاصيل الطلب وتحديث الحالة
        </div>
      </div>

      <div className="text-center text-[10px] mt-3 opacity-70">
        منشئ الطلب: {order?.created_by_name || '—'}
      </div>
      {footerNote && (
        <div className="text-center text-[10px] mt-1 opacity-80 italic">
          {footerNote}
        </div>
      )}
    </div>
  );
});

LocalOrderPrintInvoice.displayName = 'LocalOrderPrintInvoice';
export default LocalOrderPrintInvoice;
