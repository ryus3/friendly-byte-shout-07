import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, Loader2 } from 'lucide-react';
import LocalOrderPrintInvoice from './LocalOrderPrintInvoice';
import { supabase } from '@/integrations/supabase/client';

/**
 * نافذة طباعة الفاتورة المحلية:
 *  - تجلب تفاصيل الطلب الكاملة (order_items + المنتج + اللون + القياس)
 *  - تجلب هيدر الفاتورة المخصّص من settings.local_invoice_header
 *  - تدعم طلباً واحداً أو مجموعة طلبات
 */
const LocalOrderPrintDialog = ({ open, onOpenChange, orders = [] }) => {
  const printRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [fullOrders, setFullOrders] = useState([]);
  const [header, setHeader] = useState({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1) هيدر الفاتورة المخصّص
        const { data: hdr } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'local_invoice_header')
          .maybeSingle();
        if (!cancelled) {
          let h = {};
          try {
            h = typeof hdr?.value === 'string' ? JSON.parse(hdr.value) : (hdr?.value || {});
          } catch {
            h = {};
          }
          setHeader(h);
        }

        // 2) تفاصيل كاملة لكل طلب
        const ids = orders.map((o) => o.id).filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) setFullOrders([]);
          return;
        }

        const { data: rows } = await supabase
          .from('orders')
          .select(
            `id, order_number, customer_name, customer_phone, customer_city,
             customer_province, customer_address, total_amount, delivery_fee,
             discount, notes, created_at, created_by,
             order_items (
               id, quantity, unit_price, total_price,
               products ( name ),
               product_variants (
                 colors ( name ),
                 sizes ( name )
               )
             )`
          )
          .in('id', ids);

        // جلب أسماء المنشئين دفعة واحدة
        const creatorIds = [...new Set((rows || []).map((r) => r.created_by).filter(Boolean))];
        let creators = {};
        if (creatorIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', creatorIds);
          (profs || []).forEach((p) => {
            creators[p.user_id] = p.full_name;
          });
        }

        if (!cancelled) {
          const enriched = (rows || []).map((r) => ({
            ...r,
            created_by_name: creators[r.created_by] || '—',
            order_items: (r.order_items || []).map((it) => ({
              ...it,
              product_name: it.products?.name,
              color_name: it.product_variants?.colors?.name,
              size_name: it.product_variants?.sizes?.name,
            })),
          }));
          // الاحتفاظ بترتيب الطلبات الممرّرة
          const map = new Map(enriched.map((o) => [o.id, o]));
          setFullOrders(ids.map((id) => map.get(id)).filter(Boolean));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orders]);

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;

    const win = window.open('', '_blank', 'width=420,height=720');
    if (!win) return;

    const styles = `
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: 'Amiri', system-ui, sans-serif; direction: rtl; color: #000; margin: 0; }
      .local-invoice { width: 80mm; padding: 8px; }
      table { width: 100%; border-collapse: collapse; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-left { text-align: left; }
      .font-bold { font-weight: 700; }
      .font-extrabold { font-weight: 800; }
      .italic { font-style: italic; }
      .opacity-70 { opacity: 0.7; }
      .opacity-80 { opacity: 0.8; }
      .border-b { border-bottom: 1px solid rgba(0,0,0,0.4); }
      .border-t { border-top: 1px solid rgba(0,0,0,0.4); }
      .flex { display: flex; }
      .justify-between { justify-content: space-between; }
      .items-center { align-items: center; }
      .flex-col { flex-direction: column; }
      .gap-1 { gap: 4px; }
      .mt-1 { margin-top: 4px; }
      .mt-3 { margin-top: 12px; }
      .mb-2 { margin-bottom: 8px; }
      .pt-1 { padding-top: 4px; }
      .pb-2 { padding-bottom: 8px; }
      .py-1 { padding-top: 4px; padding-bottom: 4px; }
      .space-y-0\\.5 > * + * { margin-top: 2px; }
      .text-\\[10px\\] { font-size: 10px; }
      .text-\\[11px\\] { font-size: 11px; }
      .text-\\[12px\\] { font-size: 12px; }
      .text-\\[14px\\] { font-size: 14px; }
      .text-base { font-size: 14px; }
      .text-lg { font-size: 18px; }
      .tracking-wide { letter-spacing: 0.05em; }
      .w-8 { width: 32px; }
      .w-16 { width: 64px; }
      .w-full { width: 100%; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      .bg-white { background: #fff; }
      .text-black { color: #000; }
      .border-collapse { border-collapse: collapse; }
      img { max-width: 100%; }
    `;

    win.document.open();
    win.document.write(`
      <!doctype html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>طباعة فواتير محلية</title>
          <style>${styles}</style>
        </head>
        <body>${node.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>طباعة فاتورة محلية ({fullOrders.length || orders.length})</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div ref={printRef} className="space-y-4 my-2">
            {fullOrders.map((o) => (
              <LocalOrderPrintInvoice key={o.id} order={o} header={header} />
            ))}
            {fullOrders.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                لا توجد طلبات محلية لطباعتها.
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 me-1" /> إغلاق
          </Button>
          <Button onClick={handlePrint} disabled={loading || fullOrders.length === 0}>
            <Printer className="w-4 h-4 me-1" /> طباعة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocalOrderPrintDialog;
