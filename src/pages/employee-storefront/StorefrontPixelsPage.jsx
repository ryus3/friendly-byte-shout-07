import React, { useEffect, useState } from 'react';
import { BarChart3, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

const PROVIDERS = [
  { id: 'meta', label: 'Meta Pixel (Facebook/Instagram)', placeholder: '1234567890123456' },
  { id: 'google', label: 'Google Analytics / Tag', placeholder: 'G-XXXXXXXXXX' },
  { id: 'tiktok', label: 'TikTok Pixel', placeholder: 'CXXXXXXXXXXX' },
  { id: 'snapchat', label: 'Snapchat Pixel', placeholder: 'xxxxxxxx-xxxx-...' },
];

const StorefrontPixelsPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [pixels, setPixels] = useState([]);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);
    const { data } = await supabase.from('employee_marketing_pixels').select('*').eq('employee_id', u.id);
    setPixels(data || []);
    setLoading(false);
  };

  const upsert = async (provider, pixel_id, is_active = true) => {
    const existing = pixels.find(p => p.provider === provider);
    if (existing) {
      await supabase.from('employee_marketing_pixels').update({ pixel_id, is_active }).eq('id', existing.id);
    } else {
      await supabase.from('employee_marketing_pixels').insert({ employee_id: user.id, provider, pixel_id, is_active });
    }
    toast({ title: '✅ تم الحفظ' });
    init();
  };

  const remove = async (id) => {
    await supabase.from('employee_marketing_pixels').delete().eq('id', id);
    init();
  };

  if (loading) return <StorefrontPageShell title="بكسلات التتبع" icon={BarChart3}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell title="بكسلات التتبع والإعلانات" subtitle="ربط بكسلات Meta, Google, TikTok" icon={BarChart3} accent="from-purple-500 to-fuchsia-600">
      {PROVIDERS.map(p => {
        const cur = pixels.find(x => x.provider === p.id);
        const [val, setVal] = [cur?.pixel_id || '', (v) => upsert(p.id, v)];
        return <PixelCard key={p.id} provider={p} current={cur} onSave={(id) => upsert(p.id, id)} onToggle={(active) => upsert(p.id, cur?.pixel_id || '', active)} onDelete={() => cur && remove(cur.id)} />;
      })}
    </StorefrontPageShell>
  );
};

const PixelCard = ({ provider, current, onSave, onToggle, onDelete }) => {
  const [val, setVal] = useState(current?.pixel_id || '');
  useEffect(() => { setVal(current?.pixel_id || ''); }, [current?.pixel_id]);
  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-white font-bold">{provider.label}</h3>
        {current && (
          <div className="flex items-center gap-2">
            <Switch checked={current.is_active} onCheckedChange={onToggle} />
            <span className="text-xs text-white/60">{current.is_active ? 'نشط' : 'معطّل'}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input value={val} onChange={e => setVal(e.target.value)} placeholder={provider.placeholder} className="flex-1 min-w-0" dir="ltr" />
        <Button onClick={() => onSave(val)} className="bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white">
          <Plus className="h-4 w-4 ml-1" /> حفظ
        </Button>
        {current && (
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </GlassCard>
  );
};

export default StorefrontPixelsPage;
