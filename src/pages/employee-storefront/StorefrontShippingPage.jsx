import React, { useEffect, useState } from 'react';
import { Truck, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

const StorefrontShippingPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [zones, setZones] = useState([]);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);
    const { data } = await supabase.from('storefront_shipping_zones').select('*').eq('employee_id', u.id).order('display_order');
    setZones(data || []);
    setLoading(false);
  };

  const addZone = async () => {
    const { data } = await supabase.from('storefront_shipping_zones').insert({
      employee_id: user.id,
      zone_name: 'منطقة جديدة',
      cities: [],
      shipping_fee: 5000,
      estimated_days_min: 1,
      estimated_days_max: 3,
      is_active: true,
    }).select().single();
    if (data) setZones(prev => [...prev, data]);
  };

  const updateZone = (id, patch) => setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));

  const saveZone = async (z) => {
    const { error } = await supabase.from('storefront_shipping_zones').update({
      zone_name: z.zone_name,
      cities: z.cities,
      shipping_fee: Number(z.shipping_fee) || 0,
      free_shipping_min: z.free_shipping_min ? Number(z.free_shipping_min) : null,
      estimated_days_min: Number(z.estimated_days_min) || 1,
      estimated_days_max: Number(z.estimated_days_max) || 1,
      is_active: z.is_active,
    }).eq('id', z.id);
    if (error) toast({ title: 'فشل', description: error.message, variant: 'destructive' });
    else toast({ title: '✅ تم الحفظ' });
  };

  const deleteZone = async (id) => {
    await supabase.from('storefront_shipping_zones').delete().eq('id', id);
    setZones(prev => prev.filter(z => z.id !== id));
  };

  if (loading) return <StorefrontPageShell title="الشحن والمناطق" icon={Truck}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell
      title="الشحن والمناطق"
      subtitle="عرّف مناطق الشحن ورسومها وأوقات التسليم"
      icon={Truck}
      accent="from-orange-500 to-red-500"
      headerExtra={<Button onClick={addZone} className="bg-gradient-to-r from-orange-500 to-red-500 text-white"><Plus className="h-4 w-4 ml-1" /> إضافة منطقة</Button>}
    >
      {zones.length === 0 && (
        <GlassCard>
          <p className="text-white/60 text-center py-6">لا توجد مناطق شحن. أضف أول منطقة من الزر أعلاه.</p>
        </GlassCard>
      )}

      {zones.map(z => (
        <GlassCard key={z.id}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70 text-xs">اسم المنطقة</Label>
              <Input value={z.zone_name} onChange={e => updateZone(z.id, { zone_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-white/70 text-xs">المدن (افصل بفاصلة)</Label>
              <Input
                value={(z.cities || []).join('، ')}
                onChange={e => updateZone(z.id, { cities: e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean) })}
                placeholder="بغداد، البصرة، أربيل"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs">رسوم الشحن (د.ع)</Label>
              <Input type="number" value={z.shipping_fee} onChange={e => updateZone(z.id, { shipping_fee: e.target.value })} />
            </div>
            <div>
              <Label className="text-white/70 text-xs">شحن مجاني فوق (د.ع - اختياري)</Label>
              <Input type="number" value={z.free_shipping_min ?? ''} onChange={e => updateZone(z.id, { free_shipping_min: e.target.value })} />
            </div>
            <div>
              <Label className="text-white/70 text-xs">أقل مدة (أيام)</Label>
              <Input type="number" value={z.estimated_days_min} onChange={e => updateZone(z.id, { estimated_days_min: e.target.value })} />
            </div>
            <div>
              <Label className="text-white/70 text-xs">أكثر مدة (أيام)</Label>
              <Input type="number" value={z.estimated_days_max} onChange={e => updateZone(z.id, { estimated_days_max: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Switch checked={z.is_active} onCheckedChange={v => updateZone(z.id, { is_active: v })} />
              <span className="text-white/70 text-sm">نشطة</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => deleteZone(z.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button onClick={() => saveZone(z)} className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <Save className="h-4 w-4 ml-1" /> حفظ
              </Button>
            </div>
          </div>
        </GlassCard>
      ))}
    </StorefrontPageShell>
  );
};

export default StorefrontShippingPage;
