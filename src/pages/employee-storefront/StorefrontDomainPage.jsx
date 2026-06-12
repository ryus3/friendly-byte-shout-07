import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Copy, Check, RefreshCw, Trash2, ExternalLink, Info, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import StorefrontPageShell, { GlassCard } from '@/components/employee-storefront/StorefrontPageShell';

// ✅ استضافة Vercel — كل دومين مخصص يجب أن يشير إليها
const CNAME_TARGET = 'cname.vercel-dns.com';
const A_RECORD_TARGET = '76.76.21.21';
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
    const normalized = (slug || '').trim().toLowerCase();
    if (!validateSlug(normalized)) {
      setSlugError('السلاج: حروف إنجليزية صغيرة وأرقام و - فقط (3-40 حرف)');
      return;
    }
    setSlugError('');
    setSaving(true);
    const { error } = await supabase
      .from('employee_storefront_settings')
      .update({ slug: normalized })
      .eq('employee_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'فشل الحفظ', description: error.message?.includes('duplicate') ? 'هذا السلاج محجوز' : error.message, variant: 'destructive' });
    } else {
      setSlug(normalized);
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
      toast({ title: '✅ تمت إضافة الدومين', description: 'تأكد من إضافته في Vercel ثم اضغط إعادة التحقق' });
      init();
    }
  };

  const deleteDomain = async (d) => {
    await supabase.from('storefront_custom_domains').delete().eq('id', d.id);
    // إذا كان هذا هو الدومين الافتراضي لمتجرك، أزله من الإعدادات
    if (settings?.custom_domain && settings.custom_domain.toLowerCase() === d.domain.toLowerCase()) {
      await supabase.from('employee_storefront_settings')
        .update({ custom_domain: null, custom_domain_verified: false })
        .eq('employee_id', user.id);
    }
    init();
  };

  const setAsPrimary = async (d) => {
    if (d.status !== 'verified') {
      toast({ title: 'يجب التحقق من الدومين أولاً', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('employee_storefront_settings')
      .update({ custom_domain: d.domain, custom_domain_verified: true })
      .eq('employee_id', user.id);
    if (error) {
      toast({ title: 'فشل التعيين', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ تم تعيين الدومين الافتراضي', description: `${d.domain} سيفتح متجرك مباشرة` });
      init();
    }
  };

  const recheck = async (d) => {
    toast({ title: '🔍 جاري التحقق...', description: 'فحص سجلات DNS لدومينك' });
    try {
      const { data, error } = await supabase.functions.invoke('verify-custom-domain', { body: { domain: d.domain } });
      if (error) throw error;
      if (data?.verified) {
        await supabase.from('storefront_custom_domains').update({ status: 'verified' }).eq('id', d.id);

        // ✅ اربط الدومين تلقائياً بمتجر هذا الموظف إذا لم يكن له دومين افتراضي بعد
        const hasPrimary = settings?.custom_domain && settings?.custom_domain_verified;
        if (!hasPrimary) {
          await supabase.from('employee_storefront_settings')
            .update({ custom_domain: d.domain, custom_domain_verified: true })
            .eq('employee_id', user.id);
          toast({ title: '✅ تم التحقق والربط', description: `${d.domain} أصبح يفتح متجرك مباشرة` });
        } else {
          toast({ title: '✅ تم التحقق', description: 'الدومين موثّق. اضغط النجمة لجعله الافتراضي.' });
        }
      } else {
        toast({ title: '⏳ لم يُتحقق بعد', description: data?.reason || 'تأكد من سجلات DNS وانتظر انتشار DNS' });
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
  const primaryDomain = settings?.custom_domain || '';

  const setAsRootStorefront = async () => {
    if (!user || !settings?.slug) return;
    setSaving(true);
    // إلغاء أي متجر جذر سابق ثم تعيين هذا
    const { error: clearErr } = await supabase
      .from('employee_storefront_settings')
      .update({ is_root_storefront: false })
      .neq('employee_id', user.id);
    if (!clearErr) {
      const { error } = await supabase
        .from('employee_storefront_settings')
        .update({ is_root_storefront: true })
        .eq('employee_id', user.id);
      if (error) toast({ title: 'فشل', description: error.message, variant: 'destructive' });
      else { toast({ title: 'تم', description: `${BASE_DOMAIN} يفتح الآن هذا المتجر` }); init(); }
    } else {
      toast({ title: 'فشل', description: clearErr.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) return <StorefrontPageShell title="الدومين" icon={Globe}><GlassCard><p className="text-white/60 text-center">جاري التحميل...</p></GlassCard></StorefrontPageShell>;

  return (
    <StorefrontPageShell title="الدومين والرابط" subtitle="رابط افتراضي، سبدومين، أو دومين مخصص (Vercel)" icon={Globe} accent="from-sky-500 to-indigo-500">
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
        {primaryDomain && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 mt-3">
            <Star className="h-4 w-4 text-emerald-400 fill-emerald-400" />
            <span className="text-xs text-emerald-300">الدومين الافتراضي:</span>
            <code className="flex-1 text-sm font-mono text-emerald-200 truncate" dir="ltr">{primaryDomain}</code>
          </div>
        )}
        {settings?.slug && (
          <div className="flex items-center justify-between gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 mt-3">
            <div className="flex-1 text-xs text-amber-200">
              <p className="font-semibold mb-1">متجر الجذر — {BASE_DOMAIN}</p>
              <p className="text-amber-200/70">عند تفعيله، فتح {BASE_DOMAIN} مباشرة يفتح هذا المتجر.</p>
            </div>
            {settings?.is_root_storefront ? (
              <Badge className="bg-amber-500 text-white">مفعّل</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={setAsRootStorefront} disabled={saving}>
                اجعله متجر الجذر
              </Button>
            )}
          </div>
        )}
      </GlassCard>

      {/* Subdomain Guide */}
      <GlassCard>
        <button onClick={() => setShowSubdomainGuide(s => !s)} className="w-full flex items-center justify-between text-right">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">سبدومين على {BASE_DOMAIN} (Vercel)</h2>
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
            <div className="text-white/80 space-y-3">
              <div>
                <p className="font-bold mb-1">1️⃣ في Cloudflare (مرة واحدة لكل السبدومينات):</p>
                <p className="text-white/60 text-xs mb-1">DNS → Add record</p>
                <div className="bg-black/30 p-2 rounded font-mono text-xs space-y-1" dir="ltr">
                  <div>Type: <b>CNAME</b></div>
                  <div>Name: <b>*</b>  (نجمة wildcard لكل السبدومينات)</div>
                  <div>Target: <b>{CNAME_TARGET}</b></div>
                  <div>Proxy: <b>DNS only</b> (الغيمة رمادية)</div>
                  <div>TTL: Auto</div>
                </div>
                <p className="text-white/60 text-xs mt-1">💡 بدلاً من النجمة يمكن إضافة كل سبدومين منفرداً: Name = <code>alshmry</code></p>
              </div>

              <div>
                <p className="font-bold mb-1">2️⃣ في Vercel → Project → Settings → Domains:</p>
                <ul className="list-disc pr-5 space-y-1 text-white/70 text-xs">
                  <li>Add Domain → اكتب: <code>alshmry.{BASE_DOMAIN}</code> → Production.</li>
                  <li>Vercel سيُصدر SSL تلقائياً خلال دقائق.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold mb-1">3️⃣ في صفحة "متجري" (هذه الصفحة):</p>
                <ul className="list-disc pr-5 space-y-1 text-white/70 text-xs">
                  <li>اكتب السلاج في الحقل أعلاه (مثل <code>alshmry</code>) واضغط حفظ.</li>
                  <li>سيفتح متجرك تلقائياً على <b dir="ltr">{`${slug || 'alshmry'}.${BASE_DOMAIN}`}</b></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Custom Domains */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-5 w-5 text-fuchsia-400" />
          <h2 className="font-bold text-lg text-white">دومين مخصص (Custom Domain — Vercel)</h2>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="shop.example.com" className="flex-1" dir="ltr" />
          <Button onClick={addDomain}>إضافة</Button>
        </div>

        <button onClick={() => setShowCustomGuide(s => !s)} className="w-full flex items-center justify-between text-right p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <span className="text-amber-300 text-sm font-bold">📌 تعليمات ربط الدومين (Vercel)</span>
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
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 bg-black/40 p-2 rounded text-xs text-amber-200" dir="ltr">CNAME | www | {CNAME_TARGET}</code>
                <Button variant="ghost" size="sm" onClick={() => copy(CNAME_TARGET, 'cname2')}>
                  {copiedKey === 'cname2' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <ol className="text-white/70 text-xs list-decimal pr-5 space-y-1">
              <li>أضف الدومين في Vercel → Settings → Domains (Add → Production).</li>
              <li>Vercel يضيف سجلات Cloudflare تلقائياً (Authorize)، أو أضفها يدوياً كما بالأعلى.</li>
              <li>عُد هنا واضغط 🔄 إعادة التحقق — سيُربط الدومين بمتجرك تلقائياً.</li>
            </ol>
            <p className="text-white/60 text-xs">قد يستغرق انتشار DNS حتى 24 ساعة. SSL يُصدر تلقائياً من Vercel.</p>
          </div>
        )}

        <div className="space-y-2 mt-4">
          {domains.length === 0 ? (
            <p className="text-center text-white/50 py-6 text-sm">لا توجد دومينات مخصصة بعد</p>
          ) : domains.map((d) => {
            const isPrimary = settings?.custom_domain && settings.custom_domain.toLowerCase() === d.domain.toLowerCase();
            return (
              <div key={d.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold truncate text-white" dir="ltr">{d.domain}</p>
                  <p className="text-xs text-white/50">{new Date(d.created_at).toLocaleDateString('ar-IQ')}</p>
                </div>
                <Badge variant={d.status === 'verified' ? 'default' : d.status === 'failed' ? 'destructive' : 'secondary'}>
                  {d.status === 'verified' ? '✅ موثّق' : d.status === 'failed' ? '❌ فشل' : '⏳ معلّق'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  title={isPrimary ? 'الدومين الافتراضي' : 'اجعله الدومين الافتراضي'}
                  onClick={() => setAsPrimary(d)}
                  disabled={d.status !== 'verified'}
                >
                  <Star className={`h-4 w-4 ${isPrimary ? 'text-emerald-400 fill-emerald-400' : 'text-white/40'}`} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => recheck(d)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteDomain(d)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </StorefrontPageShell>
  );
};

export default StorefrontDomainPage;
