import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

const StorefrontLoyaltyPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ enabled: false, points_per_1000: 25, redemption_rate: 0.05 });

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);
    const { data: s } = await supabase.from('employee_storefront_settings').select('loyalty_enabled, loyalty_points_per_1000, loyalty_redemption_rate').eq('employee_id', u.id).maybeSingle();
    if (s) setForm({
      enabled: !!s.loyalty_enabled,
      points_per_1000: s.loyalty_points_per_1000 ?? 25,
      redemption_rate: s.loyalty_redemption_rate ?? 0.05,
    });
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('employee_storefront_settings').update({
      loyalty_enabled: form.enabled,
      loyalty_points_per_1000: Number(form.points_per_1000) || 0,
      loyalty_redemption_rate: Number(form.redemption_rate) || 0,
    }).eq('employee_id', user.id);
    setSaving(false);
    if (error) toast({ title: 'فشل', description: error.message, variant: 'destructive' });
    else toast({ title: '✅ تم الحفظ' });
  };

  if (loading) return <StorefrontPageShell title="برنامج الولاء" icon={Gift}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell
      title="برنامج الولاء"
      subtitle="كافئ عملاءك بنقاط على كل عملية شراء"
      icon={Gift}
      accent="from-rose-500 to-pink-600"
      headerExtra={<Button onClick={save} disabled={saving} className="bg-gradient-to-r from-rose-500 to-pink-600 text-white">{saving ? 'حفظ...' : 'حفظ'}</Button>}
    >
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-bold text-lg">تفعيل برنامج الولاء</h2>
            <p className="text-white/60 text-sm">يحصل العملاء على نقاط مع كل طلب يمكن استبدالها بخصومات</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
        </div>

        {form.enabled && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div>
              <Label className="text-white/70 text-xs mb-2 block">عدد النقاط لكل 1000 د.ع</Label>
              <Input type="number" value={form.points_per_1000} onChange={e => setForm(f => ({ ...f, points_per_1000: e.target.value }))} />
              <p className="text-white/40 text-[10px] mt-1">مثال: 25 نقطة لكل 1000 د.ع — طلب 10000 د.ع = 250 نقطة</p>
            </div>
            <div>
              <Label className="text-white/70 text-xs mb-2 block">قيمة النقطة عند الاستبدال (د.ع)</Label>
              <Input type="number" step="0.01" value={form.redemption_rate} onChange={e => setForm(f => ({ ...f, redemption_rate: e.target.value }))} />
              <p className="text-white/40 text-[10px] mt-1">مثال: 0.05 — أي 100 نقطة = 5 د.ع خصم</p>
            </div>
          </div>
        )}
      </GlassCard>
    </StorefrontPageShell>
  );
};

export default StorefrontLoyaltyPage;
