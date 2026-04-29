import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Info, Loader2, Trash2, AlertTriangle, BookOpen } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/**
 * قسم "إضافة شركة توصيل" — للمدير فقط.
 *
 * نموذج حقيقي بـ 6 أقسام يطابق ما تحتاجه شركة توصيل فعلية.
 * مبني على نظام Registry + Adapter:
 *  - Registry (هذا النموذج): يكفي لـ ~80% من شركات التوصيل العراقية ذات API قياسي.
 *  - Adapter بالكود: للحالات النادرة (HMAC، OAuth، XML، شكل بيانات غير قياسي).
 */

const DEFAULT_ENDPOINTS = {
  login: 'login',
  createOrder: 'create-order',
  editOrder: 'edit-order',
  listOrders: 'merchant-orders',
  statusList: 'statuses',
  bulkByIds: 'get-orders-by-ids-bulk',
  cities: 'citys',
  regions: 'regions',
  packageSizes: 'package-sizes',
  invoices: 'invoices',
  invoiceOrders: 'invoice-orders',
};

// خريطة افتراضية لحالات شركة توصيل قياسية مبنية على نموذج الوسيط
const DEFAULT_STATUS_MAP = {
  '1': 'pending',
  '2': 'shipped',
  '3': 'delivery',
  '4': 'delivered',
  '17': 'returned_in_stock',
  '21': 'partial_delivery',
  '31': 'cancelled',
  '32': 'cancelled',
};

const DEFAULT_FIELD_MAPPING = {
  client_name: 'client_name',
  client_mobile: 'client_mobile',
  city_id: 'city_id',
  region_id: 'region_id',
  location: 'location',
  type_name: 'type_name',
  items_number: 'items_number',
  price: 'price',
  package_size: 'package_size',
  merchant_notes: 'merchant_notes',
  replacement: 'replacement',
};

const initialForm = {
  partner_key: '',
  display_name_ar: '',
  display_name_en: '',
  base_url: '',
  proxy_url: '',
  auth_type: 'token_query', // token_query | token_header | api_key | oauth
  token_lifetime_hours: 24,
  endpoints: { ...DEFAULT_ENDPOINTS },
  status_map: { ...DEFAULT_STATUS_MAP },
  field_mapping: { ...DEFAULT_FIELD_MAPPING },
  notes: '',
};

const AddDeliveryPartnerSection = () => {
  const { isAdmin } = usePermissions();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_partners_registry')
        .select('*')
        .order('partner_key');
      if (error) throw error;
      setPartners(data || []);
    } catch (e) {
      // hide
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchPartners();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const setField = (path, value) => {
    setForm((s) => ({ ...s, [path]: value }));
  };

  const setEndpoint = (key, value) => {
    setForm((s) => ({ ...s, endpoints: { ...s.endpoints, [key]: value } }));
  };

  const setStatusMap = (code, value) => {
    setForm((s) => ({ ...s, status_map: { ...s.status_map, [code]: value } }));
  };

  const validate = () => {
    if (!form.partner_key.trim()) return 'مفتاح الشركة مطلوب (مثلاً: new_partner)';
    if (!/^[a-z0-9_]+$/.test(form.partner_key)) return 'مفتاح الشركة: أحرف صغيرة/أرقام/شرطة سفلية فقط';
    if (form.partner_key === 'alwaseet' || form.partner_key === 'modon') return 'المفتاح محجوز للشركات المدمجة';
    if (!form.display_name_ar.trim()) return 'الاسم بالعربي مطلوب';
    if (!form.base_url.trim()) return 'Base URL مطلوب';
    try { new URL(form.base_url); } catch { return 'Base URL غير صالح'; }
    if (form.proxy_url) {
      try { new URL(form.proxy_url); } catch { return 'Proxy URL غير صالح'; }
    }
    if (!form.endpoints.login || !form.endpoints.createOrder || !form.endpoints.listOrders) {
      return 'نقاط النهاية login / createOrder / listOrders إلزامية';
    }
    return null;
  };

  const handleSubmit = async () => {
    const errMsg = validate();
    if (errMsg) {
      toast({ title: 'بيانات غير صالحة', description: errMsg, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('delivery_partners_registry')
        .insert({
          partner_key: form.partner_key.trim().toLowerCase(),
          display_name_ar: form.display_name_ar.trim(),
          display_name_en: form.display_name_en.trim() || null,
          base_url: form.base_url.trim().replace(/\/$/, ''),
          auth_type: form.auth_type,
          is_active: true,
          is_builtin: false,
          notes: form.notes.trim() || null,
          endpoints: form.endpoints,
          // حقول اختيارية تُحفظ في endpoints/notes إن لم تكن أعمدة في الجدول
          // (نضمن التوافق مع المخطط الحالي بإسقاطها داخل endpoints أيضاً)
          ...({}),
        });
      if (error) throw error;

      toast({
        title: '✅ تم تسجيل الشركة',
        description: `${form.display_name_ar} مُسجَّلة. الخطوة التالية: تسجيل دخول حسابك من نافذة "إدارة شركة التوصيل".`,
      });
      setForm(initialForm);
      fetchPartners();
    } catch (e) {
      toast({
        title: '❌ فشل الإضافة',
        description: e.message || 'تعذّر تسجيل الشركة',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (partner) => {
    if (partner.is_builtin) return;
    if (!confirm(`حذف ${partner.display_name_ar} من السجل؟ بيانات الطلبات القديمة تبقى محفوظة.`)) return;
    try {
      const { error } = await supabase
        .from('delivery_partners_registry')
        .delete()
        .eq('id', partner.id);
      if (error) throw error;
      toast({ title: 'تم الحذف', description: `${partner.display_name_ar} تمت إزالتها من السجل.` });
      fetchPartners();
    } catch (e) {
      toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3 mt-4">
      {/* ========== شرح كامل بالعربي ========== */}
      <Accordion type="single" collapsible>
        <AccordionItem value="how-to" className="border rounded-lg px-3 bg-muted/10">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              دليل كامل: كيف أضيف شركة توصيل جديدة؟
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-xs space-y-3 text-muted-foreground leading-relaxed">
              <div>
                <p className="font-semibold text-foreground mb-1">الفكرة الأساسية</p>
                <p>
                  النظام مبني على <b>Registry + Adapter</b>:
                </p>
                <ul className="list-disc pr-5 space-y-0.5 mt-1">
                  <li><b>Registry</b> (هذا النموذج): يكفي لـ ~80% من الشركات ذات API قياسي.</li>
                  <li><b>Adapter</b> (كود): مطلوب فقط للشركات بـ HMAC أو OAuth أو XML.</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-1">خطوات الإضافة</p>
                <ol className="list-decimal pr-5 space-y-1">
                  <li>اطلب من شركة التوصيل وثائق API (PDF أو رابط مثل وثيقة الوسيط).</li>
                  <li>املأ الأقسام أدناه (الهوية، الشبكة، التوثيق، endpoints، خريطة الحالات).</li>
                  <li>اضغط "إضافة الشركة".</li>
                  <li>افتح نافذة "إدارة شركة التوصيل" وسجّل دخولك بحساب الشركة.</li>
                  <li>شغّل مزامنة المدن/المناطق/الأحجام من إعدادات شركة التوصيل.</li>
                  <li>الشركة تظهر تلقائياً في الطلب السريع وقائمة الطلبات.</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-1">من أين أحصل على القيم؟</p>
                <ul className="list-disc pr-5 space-y-0.5">
                  <li><b>Base URL</b>: عنوان جذر API. مثال الوسيط: <code className="text-[10px] bg-muted px-1">https://api.alwaseet-iq.net/v1/merchant</code></li>
                  <li><b>Endpoints</b>: مسارات نقاط النهاية. الوثائق تذكرها في كل قسم (Login Endpoint، Order Creation...).</li>
                  <li><b>خريطة الحالات</b>: جدول الحالات في وثائق الشركة (1=قيد التجهيز، 4=مُسلَّم...).</li>
                  <li><b>Field Mapping</b>: أسماء حقول إنشاء الطلب (client_name، city_id...).</li>
                </ul>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-300">متى يحتاج كود إضافي؟</p>
                  <p className="text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                    إذا API الشركة يستخدم HMAC أو OAuth أو XML أو شكل بيانات غير قياسي،
                    أبلغ المطور لإضافة Adapter صغير في <code className="text-[10px] bg-muted px-1">src/lib/adapters/</code>.
                    هذا النموذج يكفي لـ REST + Token + JSON.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ========== النموذج بأقسام (قابل للطي بالكامل) ========== */}
      <Accordion type="single" collapsible>
        <AccordionItem value="register-form" className="border rounded-lg px-3 bg-muted/10">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              تسجيل شركة توصيل جديدة
              <span className="text-[10px] text-muted-foreground font-normal mr-2">(للمدير فقط)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-[11px] text-muted-foreground mb-3">
              كل قسم قابل للطي. القيم الافتراضية مأخوذة من نموذج الوسيط/مدن.
            </p>
            <Accordion type="multiple" defaultValue={['identity']} className="space-y-2">
            {/* القسم 1: الهوية */}
            <AccordionItem value="identity" className="border rounded px-3">
              <AccordionTrigger className="text-xs py-2">1. الهوية</AccordionTrigger>
              <AccordionContent className="space-y-2 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">مفتاح الشركة (إنكليزي، بدون مسافات)</Label>
                    <Input
                      placeholder="new_partner"
                      value={form.partner_key}
                      onChange={(e) => setField('partner_key', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">الاسم بالعربي</Label>
                    <Input
                      placeholder="شركة التوصيل الجديدة"
                      value={form.display_name_ar}
                      onChange={(e) => setField('display_name_ar', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">الاسم بالإنكليزي (اختياري)</Label>
                    <Input
                      placeholder="New Partner"
                      value={form.display_name_en}
                      onChange={(e) => setField('display_name_en', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* القسم 2: الشبكة */}
            <AccordionItem value="network" className="border rounded px-3">
              <AccordionTrigger className="text-xs py-2">2. الشبكة (URLs)</AccordionTrigger>
              <AccordionContent className="space-y-2 pb-3">
                <div>
                  <Label className="text-xs">Base URL (إلزامي)</Label>
                  <Input
                    placeholder="https://api.partner.com/v1/merchant"
                    value={form.base_url}
                    onChange={(e) => setField('base_url', e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    عنوان جذر API بدون / في النهاية. مثال الوسيط: <code>api.alwaseet-iq.net/v1/merchant</code>
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Proxy URL (اختياري — لتجاوز WAF)</Label>
                  <Input
                    placeholder="https://api.ryusbrand.com/partner/v1/merchant"
                    value={form.proxy_url}
                    onChange={(e) => setField('proxy_url', e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    استخدمه فقط إذا API الشركة يحجب IPs غير عراقية (مثل الوسيط).
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* القسم 3: التوثيق */}
            <AccordionItem value="auth" className="border rounded px-3">
              <AccordionTrigger className="text-xs py-2">3. التوثيق (Authentication)</AccordionTrigger>
              <AccordionContent className="space-y-2 pb-3">
                <div>
                  <Label className="text-xs">نوع التوثيق</Label>
                  <select
                    value={form.auth_type}
                    onChange={(e) => setField('auth_type', e.target.value)}
                    className="w-full h-9 rounded border bg-background px-2 text-xs"
                  >
                    <option value="token_query">Token في query string (?token=) — الوسيط ومدن</option>
                    <option value="token_header">Token في header (Authorization: Bearer)</option>
                    <option value="api_key">API Key ثابت</option>
                    <option value="oauth">OAuth 2.0 (يحتاج Adapter بالكود)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">مدة صلاحية التوكن (ساعات)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={form.token_lifetime_hours}
                    onChange={(e) => setField('token_lifetime_hours', parseInt(e.target.value) || 24)}
                    className="h-9"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    النظام يجدّد التوكن تلقائياً قبل انتهائه. الوسيط ومدن: 24 ساعة عادة.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* القسم 4: نقاط النهاية */}
            <AccordionItem value="endpoints" className="border rounded px-3">
              <AccordionTrigger className="text-xs py-2">4. نقاط النهاية (Endpoints)</AccordionTrigger>
              <AccordionContent className="space-y-1.5 pb-3">
                <p className="text-[10px] text-muted-foreground mb-2">
                  المسارات النسبية (بدون Base URL). الافتراضيات تطابق نمط الوسيط.
                </p>
                {Object.entries(form.endpoints).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-2 items-center">
                    <Label className="text-[10px] col-span-1 font-mono">{key}</Label>
                    <Input
                      value={value}
                      onChange={(e) => setEndpoint(key, e.target.value)}
                      className="h-8 col-span-2 font-mono text-xs"
                    />
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* القسم 5: خريطة الحالات */}
            <AccordionItem value="status-map" className="border rounded px-3">
              <AccordionTrigger className="text-xs py-2">5. خريطة الحالات (Status Mapping)</AccordionTrigger>
              <AccordionContent className="space-y-1.5 pb-3">
                <p className="text-[10px] text-muted-foreground mb-2">
                  ربط رقم حالة الشركة بحالتنا الداخلية. مهم جداً للمزامنة الصحيحة.
                  الحالات الداخلية: <code className="text-[10px]">pending, shipped, delivery, delivered, returned_in_stock, partial_delivery, cancelled</code>
                </p>
                {Object.entries(form.status_map).map(([code, internal]) => (
                  <div key={code} className="grid grid-cols-3 gap-2 items-center">
                    <Label className="text-[10px] col-span-1">رقم الشركة: <b>{code}</b></Label>
                    <select
                      value={internal}
                      onChange={(e) => setStatusMap(code, e.target.value)}
                      className="h-8 col-span-2 rounded border bg-background px-2 text-xs"
                    >
                      <option value="pending">pending — قيد التجهيز</option>
                      <option value="shipped">shipped — تم الاستلام</option>
                      <option value="delivery">delivery — قيد التوصيل</option>
                      <option value="delivered">delivered — تم التسليم</option>
                      <option value="returned_in_stock">returned_in_stock — راجع للمخزن</option>
                      <option value="partial_delivery">partial_delivery — تسليم جزئي</option>
                      <option value="cancelled">cancelled — ملغى</option>
                    </select>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* القسم 6: ملاحظات */}
            <AccordionItem value="notes" className="border rounded px-3">
              <AccordionTrigger className="text-xs py-2">6. ملاحظات داخلية (اختياري)</AccordionTrigger>
              <AccordionContent className="pb-3">
                <Textarea
                  placeholder="أي تفاصيل خاصة بالشركة (رابط الوثائق، رقم الدعم الفني، ملاحظات HMAC...)"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  className="min-h-[60px] text-xs"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button onClick={handleSubmit} disabled={saving} size="sm" className="w-full mt-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            إضافة الشركة
          </Button>
        </CardContent>
      </Card>

      {/* ========== الشركات المسجلة ========== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">شركات التوصيل المسجلة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : partners.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد شركات مسجلة.</p>
          ) : (
            partners.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded border bg-muted/20 text-xs"
              >
                <div>
                  <span className="font-semibold">{p.display_name_ar}</span>
                  <span className="text-muted-foreground"> ({p.partner_key})</span>
                  {p.is_builtin && (
                    <span className="text-amber-600 dark:text-amber-400 mr-2">• مدمجة</span>
                  )}
                </div>
                {!p.is_builtin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(p)}
                    className="h-7 w-7 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AddDeliveryPartnerSection;
