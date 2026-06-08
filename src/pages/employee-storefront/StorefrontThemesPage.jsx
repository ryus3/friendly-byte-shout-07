import React, { useEffect, useState } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

const PRESETS = [
  { id: 'glass-aurora', name: 'Glass Aurora', desc: 'زجاجي مع ألوان شفقية', preview: 'from-fuchsia-500 via-purple-500 to-blue-500' },
  { id: 'minimal', name: 'Minimal Clean', desc: 'بسيط ونظيف', preview: 'from-slate-200 via-white to-slate-100' },
  { id: 'luxury-gold', name: 'Luxury Gold', desc: 'فخم بألوان ذهبية', preview: 'from-amber-600 via-yellow-500 to-amber-700' },
  { id: 'neon-cyber', name: 'Neon Cyber', desc: 'مستقبلي نيون', preview: 'from-cyan-400 via-fuchsia-500 to-purple-600' },
  { id: 'sunset-warm', name: 'Sunset Warm', desc: 'دافئ غروب', preview: 'from-orange-500 via-rose-500 to-pink-600' },
  { id: 'forest-natural', name: 'Forest Natural', desc: 'طبيعي أخضر', preview: 'from-emerald-600 via-green-500 to-teal-600' },
  { id: 'ocean-deep', name: 'Ocean Deep', desc: 'محيطي عميق', preview: 'from-blue-700 via-cyan-600 to-teal-500' },
  { id: 'noir-bold', name: 'Noir Bold', desc: 'أسود جريء', preview: 'from-zinc-900 via-zinc-700 to-zinc-900' },
];

const StorefrontThemesPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [theme, setTheme] = useState({
    preset: 'glass-aurora',
    primary: '#a855f7',
    accent: '#3b82f6',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    customCss: '',
  });

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);
    const { data: s } = await supabase
      .from('employee_storefront_settings').select('*').eq('employee_id', u.id).maybeSingle();
    setSettings(s);
    if (s) {
      setTheme({
        preset: s.theme_preset || 'glass-aurora',
        primary: s.primary_color || '#a855f7',
        accent: s.accent_color || '#3b82f6',
        fontHeading: s.theme_fonts?.heading || 'Inter',
        fontBody: s.theme_fonts?.body || 'Inter',
        customCss: s.custom_css || '',
      });
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('employee_storefront_settings')
      .update({
        theme_preset: theme.preset,
        primary_color: theme.primary,
        accent_color: theme.accent,
        theme_colors: { primary: theme.primary, accent: theme.accent },
        theme_fonts: { heading: theme.fontHeading, body: theme.fontBody },
        custom_css: theme.customCss,
      }).eq('employee_id', user.id);
    setSaving(false);
    if (error) toast({ title: 'فشل الحفظ', description: error.message, variant: 'destructive' });
    else toast({ title: '✅ تم حفظ الثيم', description: 'سيظهر على متجرك خلال ثوانٍ' });
  };

  if (loading) return <StorefrontPageShell title="الثيمات والتصميم" icon={Palette}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell
      title="الثيمات والتصميم"
      subtitle="اختر قالباً جاهزاً أو خصّص الألوان والخطوط"
      icon={Palette}
      accent="from-fuchsia-500 to-rose-500"
      headerExtra={<Button onClick={save} disabled={saving} className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white">{saving ? 'حفظ...' : 'حفظ التغييرات'}</Button>}
    >
      <GlassCard>
        <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-400" /> قوالب جاهزة</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setTheme(t => ({ ...t, preset: p.id }))}
              className={`relative overflow-hidden rounded-2xl border-2 transition-all p-3 text-right ${theme.preset === p.id ? 'border-fuchsia-400 scale-[1.02]' : 'border-white/10 hover:border-white/30'}`}
            >
              <div className={`h-20 rounded-xl bg-gradient-to-br ${p.preview} mb-2`} />
              <p className="text-white text-sm font-bold">{p.name}</p>
              <p className="text-white/50 text-[10px]">{p.desc}</p>
              {theme.preset === p.id && (
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-fuchsia-500 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-white font-bold mb-4">الألوان المخصصة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-white/70 text-xs mb-2 block">اللون الرئيسي</Label>
            <div className="flex gap-2">
              <input type="color" value={theme.primary} onChange={e => setTheme(t => ({ ...t, primary: e.target.value }))} className="h-10 w-16 rounded cursor-pointer bg-transparent" />
              <Input value={theme.primary} onChange={e => setTheme(t => ({ ...t, primary: e.target.value }))} className="flex-1" />
            </div>
          </div>
          <div>
            <Label className="text-white/70 text-xs mb-2 block">اللون الثانوي</Label>
            <div className="flex gap-2">
              <input type="color" value={theme.accent} onChange={e => setTheme(t => ({ ...t, accent: e.target.value }))} className="h-10 w-16 rounded cursor-pointer bg-transparent" />
              <Input value={theme.accent} onChange={e => setTheme(t => ({ ...t, accent: e.target.value }))} className="flex-1" />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-white font-bold mb-4">الخطوط</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-white/70 text-xs mb-2 block">خط العناوين</Label>
            <select value={theme.fontHeading} onChange={e => setTheme(t => ({ ...t, fontHeading: e.target.value }))} className="w-full h-10 rounded-md bg-background/50 border border-input text-white px-3">
              {['Inter','Cairo','Tajawal','Almarai','Amiri','IBM Plex Sans Arabic'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-white/70 text-xs mb-2 block">خط النصوص</Label>
            <select value={theme.fontBody} onChange={e => setTheme(t => ({ ...t, fontBody: e.target.value }))} className="w-full h-10 rounded-md bg-background/50 border border-input text-white px-3">
              {['Inter','Cairo','Tajawal','Almarai','Amiri','IBM Plex Sans Arabic'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-white font-bold mb-2">CSS مخصص (متقدم)</h2>
        <p className="text-xs text-white/50 mb-3">أضف أنماط CSS تطبق على متجرك العام</p>
        <textarea
          value={theme.customCss}
          onChange={e => setTheme(t => ({ ...t, customCss: e.target.value }))}
          rows={6}
          dir="ltr"
          placeholder=":root { --custom-radius: 1rem; }"
          className="w-full rounded-md bg-black/30 border border-white/10 p-3 text-white font-mono text-sm"
        />
      </GlassCard>
    </StorefrontPageShell>
  );
};

export default StorefrontThemesPage;
