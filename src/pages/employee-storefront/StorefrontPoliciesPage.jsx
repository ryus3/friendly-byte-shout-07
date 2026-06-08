import React, { useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

const PAGES = [
  { type: 'privacy', label: 'سياسة الخصوصية', defaultTitle: 'سياسة الخصوصية' },
  { type: 'returns', label: 'سياسة الإرجاع', defaultTitle: 'سياسة الإرجاع والاستبدال' },
  { type: 'terms', label: 'الشروط والأحكام', defaultTitle: 'الشروط والأحكام' },
  { type: 'about', label: 'من نحن', defaultTitle: 'من نحن' },
  { type: 'contact', label: 'اتصل بنا', defaultTitle: 'اتصل بنا' },
];

const StorefrontPoliciesPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [pages, setPages] = useState({});
  const [active, setActive] = useState('privacy');
  const [saving, setSaving] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);
    const { data } = await supabase.from('storefront_pages').select('*').eq('employee_id', u.id);
    const map = {};
    PAGES.forEach(p => {
      const existing = (data || []).find(d => d.page_type === p.type);
      map[p.type] = existing || { page_type: p.type, title: p.defaultTitle, content: '', is_published: true };
    });
    setPages(map);
    setLoading(false);
  };

  const update = (type, patch) => setPages(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const save = async (type) => {
    setSaving(true);
    const p = pages[type];
    const { error } = await supabase.from('storefront_pages').upsert({
      employee_id: user.id,
      page_type: type,
      title: p.title,
      content: p.content,
      is_published: p.is_published,
    }, { onConflict: 'employee_id,page_type' });
    setSaving(false);
    if (error) toast({ title: 'فشل', description: error.message, variant: 'destructive' });
    else toast({ title: '✅ تم الحفظ' });
  };

  if (loading) return <StorefrontPageShell title="السياسات والصفحات" icon={FileText}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell title="السياسات والصفحات" subtitle="حرر صفحات متجرك الثابتة" icon={FileText} accent="from-indigo-500 to-blue-600">
      <GlassCard>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="grid grid-cols-5 bg-white/5 mb-4 h-auto">
            {PAGES.map(p => (
              <TabsTrigger key={p.type} value={p.type} className="text-[10px] sm:text-xs data-[state=active]:bg-fuchsia-500/30 data-[state=active]:text-white text-white/70 px-1 py-2">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {PAGES.map(p => {
            const cur = pages[p.type];
            return (
              <TabsContent key={p.type} value={p.type} className="space-y-4">
                <div>
                  <Label className="text-white/70 text-xs mb-2 block">عنوان الصفحة</Label>
                  <Input value={cur?.title || ''} onChange={e => update(p.type, { title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-white/70 text-xs mb-2 block">المحتوى (يدعم HTML بسيط)</Label>
                  <textarea
                    value={cur?.content || ''}
                    onChange={e => update(p.type, { content: e.target.value })}
                    rows={14}
                    className="w-full rounded-md bg-background/50 border border-input p-3 text-white text-sm"
                    placeholder={`اكتب محتوى صفحة ${p.label} هنا...`}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!cur?.is_published} onCheckedChange={v => update(p.type, { is_published: v })} />
                    <span className="text-white/70 text-sm">منشورة</span>
                  </div>
                  <Button onClick={() => save(p.type)} disabled={saving} className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white">
                    <Save className="h-4 w-4 ml-2" />
                    {saving ? 'حفظ...' : 'حفظ الصفحة'}
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </GlassCard>
    </StorefrontPageShell>
  );
};

export default StorefrontPoliciesPage;
