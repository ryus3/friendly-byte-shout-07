import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CreditCard, Landmark, Banknote, Gift, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOffChannelCollections } from '@/hooks/useOffChannelCollections';
import { useToast } from '@/components/ui/use-toast';

const TYPES = [
  { value: 'electronic_payment', label: 'دفع إلكتروني (زين كاش / ماستر / آسيا)', icon: CreditCard },
  { value: 'bank_transfer',      label: 'تحويل بنكي',                              icon: Landmark },
  { value: 'employee_cash',      label: 'نقد قبضه الموظف من الزبون',              icon: Banknote },
  { value: 'full_discount',      label: 'خصم كامل (هدية للزبون)',                  icon: Gift },
  { value: 'owner_delivery_only',label: 'المالك يتحمّل التوصيل فقط',                icon: Truck },
];

/**
 * نافذة تصنيف طلب خارج القناة.
 * - تجلب السجل من off_channel_collections (تنشئه إن لم يوجد).
 * - تحسب owner_due_amount تلقائياً حسب النوع وقاعدة ربح الموظف.
 */
const OffChannelClassifyDialog = ({ open, onOpenChange, order, onClassified }) => {
  const { toast } = useToast();
  const { rows, classify, reload } = useOffChannelCollections({ scope: 'order', orderIds: order?.id ? [order.id] : [] });

  const [type, setType] = useState('electronic_payment');
  const [paid, setPaid] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [empProfitRule, setEmpProfitRule] = useState(0);

  const record = rows[0];

  // قيمة ابتدائية: المبلغ المتوقَّع = total_amount + delivery_fee
  useEffect(() => {
    if (!order) return;
    const defaultPaid = (Number(order.total_amount) || 0) + (Number(order.delivery_fee) || 0);
    setPaid(defaultPaid);
    setNote('');
    setType('electronic_payment');
  }, [order?.id]);

  // جلب قاعدة ربح الموظف منشئ الطلب
  useEffect(() => {
    if (!order?.created_by) { setEmpProfitRule(0); return; }
    (async () => {
      // إجمالي ربح الموظف من جدول profits لهذا الطلب
      const { data: p } = await supabase.from('profits')
        .select('employee_profit').eq('order_id', order.id).maybeSingle();
      setEmpProfitRule(Number(p?.employee_profit) || 0);
    })();
  }, [order?.id, order?.created_by]);

  const calc = useMemo(() => {
    const customerPaid = Number(paid) || 0;
    const deliveryFee = Number(order?.delivery_fee) || 0;
    let employeeShare = 0;
    let ownerDue = 0;
    if (type === 'full_discount') {
      employeeShare = 0; ownerDue = 0;
    } else if (type === 'owner_delivery_only') {
      employeeShare = 0; ownerDue = 0; // المالك يتحمّل التوصيل، لا دَيْن
    } else {
      employeeShare = empProfitRule; // ربح الموظف يبقى له
      ownerDue = Math.max(0, customerPaid - employeeShare);
    }
    return { customerPaid, deliveryFee, employeeShare, ownerDue };
  }, [paid, type, empProfitRule, order?.delivery_fee]);

  const handleSave = async () => {
    if (!record?.id) {
      toast({ variant: 'destructive', title: 'لا يوجد سجل لهذا الطلب', description: 'لم يتم اكتشاف الطلب تلقائياً.' });
      return;
    }
    setSaving(true);
    const { error } = await classify(record.id, {
      collection_type: type,
      customer_paid_amount: calc.customerPaid,
      employee_profit_share: calc.employeeShare,
      owner_due_amount: calc.ownerDue,
      note,
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'فشل الحفظ', description: error.message });
      return;
    }
    toast({ title: 'تم التصنيف', description: type === 'full_discount' || type === 'owner_delivery_only' || calc.ownerDue <= 0
      ? 'تم إقفال السجل.' : 'بانتظار تأكيد المالك للاستلام.' });
    onOpenChange(false);
    onClassified?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">تصنيف طلب خارج القناة #{order?.tracking_number || order?.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-right">
          <div className="text-xs text-muted-foreground">
            الزبون: {order?.customer_name || '—'} • التوصيل: {(Number(order?.delivery_fee) || 0).toLocaleString()} د.ع
          </div>

          <div>
            <Label className="text-sm font-bold mb-2 block">نوع التحصيل</Label>
            <RadioGroup value={type} onValueChange={setType} className="space-y-1">
              {TYPES.map(t => (
                <div key={t.value} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/40 border">
                  <RadioGroupItem value={t.value} id={`occ-${t.value}`} />
                  <Label htmlFor={`occ-${t.value}`} className="flex items-center gap-2 cursor-pointer text-sm flex-1">
                    <t.icon className="w-4 h-4 text-primary" />
                    {t.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {!['full_discount','owner_delivery_only'].includes(type) && (
            <div>
              <Label htmlFor="paid" className="text-sm font-bold">المبلغ المقبوض من الزبون (شامل التوصيل)</Label>
              <Input id="paid" type="number" value={paid} onChange={(e) => setPaid(e.target.value)} dir="ltr" className="mt-1" />
            </div>
          )}

          <div>
            <Label htmlFor="note" className="text-sm font-bold">ملاحظة (اختياري)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" placeholder="رقم العملية / اسم البنك / أي تفاصيل..." />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span>المقبوض من الزبون:</span><b>{calc.customerPaid.toLocaleString()} د.ع</b></div>
            <div className="flex justify-between"><span>نصيب الموظف:</span><b className="text-emerald-600">{calc.employeeShare.toLocaleString()} د.ع</b></div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span>دَيْن الموظف للمالك:</span>
              <b className="text-rose-600">{calc.ownerDue.toLocaleString()} د.ع</b>
            </div>
            <p className="text-[10px] text-muted-foreground">* أي مبلغ خارج القناة يبقى بانتظار تأكيد المالك حتى لو كان المحصّل مديراً.</p>
          </div>
        </div>
        <DialogFooter className="flex-row-reverse">
          <Button onClick={handleSave} disabled={saving || !record?.id}>
            {saving && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
            حفظ التصنيف
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OffChannelClassifyDialog;
