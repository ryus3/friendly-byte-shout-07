import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Copy, Check, RefreshCw, Trash2, ExternalLink, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

const CNAME_TARGET = 'ryus.lovable.app';
const A_RECORD_TARGET = '185.158.133.1';
const BASE_DOMAIN = 'ryusbrand.com';

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
  const [showSubdomainGuide, setShowSubdomainGuide] = useState(false);
  const [showCustomGuide, setShowCustomGuide] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { setLoading(false); return; }
    setUser(u);
    const { data: s } = await supabase.from('employee_storefront_settings').select('*').eq('employee_id', u.id).maybeSingle();
    setSettings(s);
    setSlug(s?.slug || '');
    const { data: d } = await supabase.from('storefront_custom_domains').select('*').eq('employee_id', u.id).order('created_at', { ascending: false });
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
    const { error } = await supabase.from('employee_storefront_settings').update({ slug }).eq('employee_id', user.id);
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
    const { error } = await supabase.from('storefront_custom_domains').insert({ employee_id: user.id, domain: dom, status: 'pending' });
    if (error) {
      toast({ title: 'فشل الإضافة', description: error.message?.includes('duplicate') ? 'هذا الدومين مسجل مسبقاً' : error.message, variant: 'destructive' });
    } else {
      setNewDomain('');
      toast({ title: '✅ تمت إضافة الدومين', description: 'أضف سجل CNAME ثم اضغط إعادة التحقق' });
      init();
    }
  };

  const deleteDomain = async (id) => {
    await supabase.from('storefront_custom_domains').delete().eq('id', id);
    init();
  };

  const recheck = async (d) => {
    toast({ title: '🔍 جاري التحقق...', description: 'فحص سجلات DNS لدومينك' });
    try {
      const { data, error } = await supabase.functions.invoke('verify-custom-domain', { body: { domain: d.domain } });
      if (error) throw error;
      if (data?.verified) {
        await supabase.from('storefront_custom_domains').update({ status: 'verified' }).eq('id', d.id);
        toast({ title: '✅ تم التحقق', description: 'دومينك مُهيّأ بشكل صحيح' });
      } else {
        toast({ title: '⏳ لم يُتحقق بعد', description: data?.reason || 'تأكد من سجل CNAME وانتظر انتشار DNS' });
      }
      init();
    } catch (e) {
      toast({ title: 'تعذّر التحقق', description: e.message, variant: 'destructive' });
    }
  };

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  const storeUrl = settings?.slug ? `${window.location.origin}/storefront/${settings.slug}` : '';
  const subdomainUrl = settings?.slug ? `https://${settings.slug}.${BASE_DOMAIN}` : '';

  if (loading) return <StorefrontPageShell title="الدومين" icon={Globe}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell title="الدومين والرابط" subtitle="رابط افتراضي، سبدومين، أو دومين مخصص" icon={Globe} accent="from-sky-500 to-indigo-500">
      {/* Default Slug */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-lg text-white">رابط المتجر الافتراضي</h2>
        </div>
        <div className="space-y-2">
          <span className="text-xs text-white/50 break-all" dir="ltr">{window.location.origin}/storefront/</span>
          <div className="flex items-center gap-2">
            <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="my-store" className="flex-1 min-w-0" dir="ltr" />
            <Button onClick={saveSlug} disabled={saving} className="shrink-0">{saving ? 'حفظ...' : 'حفظ'}</Button>
          </div>
        </div>
        {slugError && <p className="text-xs text-destructive mt-2">{slugError}</p>}
        {storeUrl && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20 mt-3">
            <code className="flex-1 text-sm font-mono text-primary truncate" dir="ltr">{storeUrl}</code>
            <Button variant="ghost" size="sm" onClick={() => copy(storeUrl, 'url')}>
              {copiedKey === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.open(storeUrl, '_blank')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Subdomain Guide */}
      <GlassCard>
        <button onClick={() => setShowSubdomainGuide(s => !s)} className="w-full flex items-center justify-between text-right">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">سبدومين على {BASE_DOMAIN}</h2>
          </div>
          {showSubdomainGuide ? <ChevronUp className="h-5 w-5 text-white/60" /> : <ChevronDown className="h-5 w-5 text-white/60" />}
        </button>

        {showSubdomainGuide && (
          <div className="mt-4 space-y-3 text-sm">
            {subdomainUrl && (
              <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
                <p className="text-cyan-300 text-xs mb-1">رابط السبدومين المتوقع لمتجرك:</p>
                <code className="text-white font-mono text-sm" dir="ltr">{subdomainUrl}</code>
              </div>
            )}
            <div className="text-white/80 space-y-2">
              <p className="font-bold">📌 خطوات تفعيل السبدومين (يحتاج تنفيذ من المسؤول):</p>
              <ol className="list-decimal pr-5 space-y-1.5 text-white/70">
                <li>إضافة سجل <b>Wildcard</b> في DNS الدومين الرئيسي ({BASE_DOMAIN}):
                  <div className="bg-black/30 p-2 rounded mt-1 font-mono text-xs" dir="ltr">
                    Type: CNAME | Name: * | Value: {CNAME_TARGET}
                  </div>
                </li>
                <li>تسجيل <b>*.{BASE_DOMAIN}</b> في Project Settings → Domains في Lovable لتفعيل SSL.</li>
                <li>الانتظار حتى 24 ساعة لانتشار DNS وتفعيل الشهادة.</li>
                <li>بعد ذلك يفتح متجر كل موظف تلقائياً على <code>{`{slug}.${BASE_DOMAIN}`}</code></li>
              </ol>
              <p className="text-amber-300 text-xs mt-2">💡 Wildcard SSL يتطلب خطة Lovable Business. كبديل، يمكن تسجيل كل سبدومين يدوياً.</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Custom Domains */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-5 w-5 text-fuchsia-400" />
          <h2 className="font-bold text-lg text-white">دومين مخصص (Custom Domain)</h2>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="shop.example.com" className="flex-1" dir="ltr" />
          <Button onClick={addDomain}>إضافة</Button>
        </div>

        <button onClick={() => setShowCustomGuide(s => !s)} className="w-full flex items-center justify-between text-right p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <span className="text-amber-300 text-sm font-bold">📌 تعليمات ربط الدومين</span>
          {showCustomGuide ? <ChevronUp className="h-4 w-4 text-amber-300" /> : <ChevronDown className="h-4 w-4 text-amber-300" />}
        </button>

        {showCustomGuide && (
          <div className="mt-3 p-4 bg-black/30 border border-amber-500/20 rounded-xl text-sm space-y-3">
            <div>
              <p className="text-white font-bold mb-2">للسبدومين (مثل shop.yourdomain.com):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/40 p-2 rounded text-xs text-amber-200" dir="ltr">CNAME | shop | {CNAME_TARGET}</code>
                <Button variant="ghost" size="sm" onClick={() => copy(CNAME_TARGET, 'cname')}>
                  {copiedKey === 'cname' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-white font-bold mb-2">للدومين الرئيسي (yourdomain.com):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/40 p-2 rounded text-xs text-amber-200" dir="ltr">A | @ | {A_RECORD_TARGET}</code>
                <Button variant="ghost" size="sm" onClick={() => copy(A_RECORD_TARGET, 'arec')}>
                  {copiedKey === 'arec' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-white/60 text-xs">قد يستغرق انتشار DNS حتى 24 ساعة. سيتم إصدار شهادة SSL تلقائياً بعد التحقق.</p>
            <p className="text-amber-300 text-xs">⚠️ بعد إضافة سجلات DNS، أبلغ المسؤول لتسجيل الدومين في Lovable لإصدار شهادة SSL.</p>
          </div>
        )}

        <div className="space-y-2 mt-4">
          {domains.length === 0 ? (
            <p className="text-center text-white/50 py-6 text-sm">لا توجد دومينات مخصصة بعد</p>
          ) : domains.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold truncate text-white" dir="ltr">{d.domain}</p>
                <p className="text-xs text-white/50">{new Date(d.created_at).toLocaleDateString('ar-IQ')}</p>
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
      </GlassCard>
    </StorefrontPageShell>
  );
};

export default StorefrontDomainPage;
