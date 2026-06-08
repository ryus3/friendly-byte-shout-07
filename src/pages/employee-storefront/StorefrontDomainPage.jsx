import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Copy, Check, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const CNAME_TARGET = 'ryus.lovable.app';

const StorefrontDomainPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { setLoading(false); return; }
    setUser(u);
    const { data: s } = await supabase
      .from('employee_storefront_settings')
      .select('*').eq('employee_id', u.id).single();
    setSettings(s);
    setSlug(s?.slug || '');
    const { data: d } = await supabase
      .from('storefront_custom_domains')
      .select('*').eq('employee_id', u.id).order('created_at', { ascending: false });
    setDomains(d || []);
    setLoading(false);
  };

  const validateSlug = (val) => /^[a-z0-9-]{3,40}$/.test(val);

  const saveSlug = async () => {
    if (!validateSlug(slug)) {
      setSlugError('السلاج: حروف إنجليزية صغيرة وأرقام و - فقط (3-40 حرف)');
      return;
    }
    setSlugError('');
    setSaving(true);
    const { error } = await supabase
      .from('employee_storefront_settings')
      .update({ slug }).eq('employee_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'فشل الحفظ', description: error.message?.includes('duplicate') ? 'هذا السلاج محجوز' : error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ تم تحديث رابط المتجر' });
      init();
    }
  };

  const addDomain = async () => {
    const dom = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom)) {
      toast({ title: 'دومين غير صالح', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('storefront_custom_domains')
      .insert({ employee_id: user.id, domain: dom, status: 'pending' });
    if (error) {
      toast({ title: 'فشل الإضافة', description: error.message?.includes('duplicate') ? 'هذا الدومين مسجل مسبقاً' : error.message, variant: 'destructive' });
    } else {
      setNewDomain('');
      toast({ title: '✅ تمت إضافة الدومين', description: 'أضف سجل CNAME من لوحة المسجِّل للتحقق' });
      init();
    }
  };

  const deleteDomain = async (id) => {
    await supabase.from('storefront_custom_domains').delete().eq('id', id);
    init();
  };

  const recheck = async (d) => {
    // محاكاة فحص: في الواقع يجب التحقق DNS عبر edge function
    toast({ title: 'سيتم التحقق', description: `أضف CNAME ${d.domain} → ${CNAME_TARGET} ثم أعد المحاولة بعد دقائق` });
  };

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  const storeUrl = settings?.slug ? `${window.location.origin}/storefront/${settings.slug}` : '';

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-fuchsia-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            الدومين والرابط
          </h1>
          <p className="text-muted-foreground">ادر رابط متجرك الافتراضي أو اربط دومين مخصص</p>
        </div>

        {/* Default Slug */}
        <Card className="backdrop-blur-xl bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">رابط المتجر الافتراضي</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{window.location.origin}/storefront/</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-store"
                className="flex-1"
              />
              <Button onClick={saveSlug} disabled={saving}>{saving ? 'حفظ...' : 'حفظ'}</Button>
            </div>
            {slugError && <p className="text-xs text-destructive">{slugError}</p>}
            {storeUrl && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                <code className="flex-1 text-sm font-mono text-primary truncate">{storeUrl}</code>
                <Button variant="ghost" size="sm" onClick={() => copy(storeUrl, 'url')}>
                  {copiedKey === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.open(storeUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Domains */}
        <Card className="backdrop-blur-xl bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-fuchsia-400" />
              <h2 className="font-bold text-lg">دومين مخصص (Custom Domain)</h2>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="shop.example.com"
                className="flex-1"
              />
              <Button onClick={addDomain}>إضافة</Button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm space-y-2">
              <p className="font-bold">📌 تعليمات الربط:</p>
              <p>في لوحة مسجِّل الدومين أضف سجل CNAME:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/30 p-2 rounded">@ أو subdomain → {CNAME_TARGET}</code>
                <Button variant="ghost" size="sm" onClick={() => copy(CNAME_TARGET, 'cname')}>
                  {copiedKey === 'cname' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">قد يستغرق التحقق من DNS حتى 24 ساعة.</p>
            </div>

            <div className="space-y-2">
              {domains.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">لا توجد دومينات مخصصة بعد</p>
              ) : domains.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold truncate">{d.domain}</p>
                    <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString('ar-IQ')}</p>
                  </div>
                  <Badge variant={d.status === 'verified' ? 'default' : d.status === 'failed' ? 'destructive' : 'secondary'}>
                    {d.status === 'verified' ? '✅ موثّق' : d.status === 'failed' ? '❌ فشل' : '⏳ معلّق'}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => recheck(d)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteDomain(d.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StorefrontDomainPage;
