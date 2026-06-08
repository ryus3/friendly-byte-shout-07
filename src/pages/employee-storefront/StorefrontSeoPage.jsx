import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

const StorefrontSeoPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ seo_title: '', seo_description: '', seo_keywords: '', og_image_url: '' });

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);
    const { data: s } = await supabase.from('employee_storefront_settings').select('seo_title, seo_description, seo_keywords, og_image_url').eq('employee_id', u.id).maybeSingle();
    if (s) setForm({
      seo_title: s.seo_title || '',
      seo_description: s.seo_description || '',
      seo_keywords: s.seo_keywords || '',
      og_image_url: s.og_image_url || '',
    });
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('employee_storefront_settings').update(form).eq('employee_id', user.id);
    setSaving(false);
    if (error) toast({ title: 'فشل', description: error.message, variant: 'destructive' });
    else toast({ title: '✅ تم الحفظ' });
  };

  if (loading) return <StorefrontPageShell title="SEO" icon={Search}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell
      title="SEO و الفهرسة"
      subtitle="تحسين ظهور متجرك في محركات البحث"
      icon={Search}
      accent="from-teal-500 to-emerald-600"
      headerExtra={<Button onClick={save} disabled={saving} className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white">{saving ? 'حفظ...' : 'حفظ'}</Button>}
    >
      <GlassCard>
        <div className="space-y-4">
          <div>
            <Label className="text-white/70 text-xs mb-2 block">عنوان الصفحة (Title)</Label>
            <Input value={form.seo_title} onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))} placeholder="متجر الشمري — أزياء عصرية" maxLength={60} />
            <p className="text-[10px] text-white/40 mt-1">{form.seo_title.length}/60 — يفضّل أقل من 60 حرفاً</p>
          </div>
          <div>
            <Label className="text-white/70 text-xs mb-2 block">الوصف (Meta Description)</Label>
            <textarea
              value={form.seo_description}
              onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
              rows={3}
              maxLength={160}
              className="w-full rounded-md bg-background/50 border border-input p-3 text-white text-sm"
              placeholder="اكتشف أحدث منتجاتنا بأفضل الأسعار والجودة..."
            />
            <p className="text-[10px] text-white/40 mt-1">{form.seo_description.length}/160 — يفضّل أقل من 160 حرفاً</p>
          </div>
          <div>
            <Label className="text-white/70 text-xs mb-2 block">الكلمات المفتاحية (مفصولة بفاصلة)</Label>
            <Input value={form.seo_keywords} onChange={e => setForm(f => ({ ...f, seo_keywords: e.target.value }))} placeholder="أزياء، عراق، تسوق، أحذية" />
          </div>
          <div>
            <Label className="text-white/70 text-xs mb-2 block">صورة المشاركة (Open Graph)</Label>
            <Input value={form.og_image_url} onChange={e => setForm(f => ({ ...f, og_image_url: e.target.value }))} placeholder="https://..." dir="ltr" />
            {form.og_image_url && <img src={form.og_image_url} alt="OG" className="mt-2 rounded-xl max-h-40 object-cover" />}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-white font-bold mb-2">معاينة Google</h3>
        <div className="bg-white rounded-xl p-3 text-right">
          <p className="text-[#1a0dab] text-lg font-medium truncate">{form.seo_title || 'عنوان متجرك'}</p>
          <p className="text-[#006621] text-xs truncate">{window.location.origin}</p>
          <p className="text-[#545454] text-sm line-clamp-2">{form.seo_description || 'وصف متجرك يظهر هنا'}</p>
        </div>
      </GlassCard>
    </StorefrontPageShell>
  );
};

export default StorefrontSeoPage;
