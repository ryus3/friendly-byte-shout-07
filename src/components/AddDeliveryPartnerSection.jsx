import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Info, Loader2, Trash2 } from 'lucide-react';
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
 * الفكرة العالمية:
 *  - النظام عنده جدول delivery_partners_registry يحفظ بيانات أي شركة توصيل (الوسيط، مدن، أو شركة جديدة).
 *  - أي شركة لها API مشابه (login + create-order + merchant-orders + cities + regions + sizes)
 *    تستطيع تسجيلها هنا، ثم تسجل دخول حسابك فيها وتعمل مزامنة المدن والمناطق والأحجام.
 *  - الشركات المسجلة تظهر تلقائياً في نافذة إدارة شركة التوصيل وفي صفحة الطلب السريع
 *    بمجرد توفر أول حساب فعّال لها (بعد تسجيل الدخول).
 *
 * ملاحظة عملية:
 *  - إذا API للشركة الجديدة مختلف جذرياً (HMAC، OAuth، شكل طلب مختلف)، نحتاج إضافة adapter بالكود.
 *  - لكن لشركات التوصيل العراقية المعتادة (نفس نمط الوسيط/مدن)، الإضافة من هنا كافية.
 */
const AddDeliveryPartnerSection = () => {
  const { isAdmin } = usePermissions();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    partner_key: '',
    display_name_ar: '',
    display_name_en: '',
    base_url: '',
    notes: '',
  });

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

  const validate = () => {
    if (!form.partner_key.trim()) return 'مفتاح الشركة مطلوب (مثلاً: new_partner)';
    if (!/^[a-z0-9_]+$/.test(form.partner_key)) return 'مفتاح الشركة يجب أن يكون أحرفاً صغيرة/أرقام/شرطة سفلية فقط';
    if (!form.display_name_ar.trim()) return 'اسم الشركة بالعربي مطلوب';
    if (!form.base_url.trim()) return 'Base URL للشركة مطلوب';
    try { new URL(form.base_url); } catch { return 'Base URL غير صالح'; }
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
          auth_type: 'login',
          is_active: true,
          is_builtin: false,
          notes: form.notes.trim() || null,
          endpoints: {
            login: 'login',
            createOrder: 'create-order',
            editOrder: 'edit-order',
            listOrders: 'merchant-orders',
            cities: 'citys',
            regions: 'regions',
            packageSizes: 'package-sizes',
          },
        });
      if (error) throw error;
      toast({
        title: '✅ تمت إضافة الشركة',
        description: `تم تسجيل ${form.display_name_ar} في النظام. سجّل الدخول إليها من أعلى الصفحة لتفعيلها.`,
      });
      setForm({ partner_key: '', display_name_ar: '', display_name_en: '', base_url: '', notes: '' });
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
    if (!confirm(`حذف ${partner.display_name_ar}؟ سيُلغى تفعيلها فقط؛ بيانات الطلبات القديمة تبقى.`)) return;
    try {
      const { error } = await supabase
        .from('delivery_partners_registry')
        .delete()
        .eq('id', partner.id);
      if (error) throw error;
      toast({ title: 'تم الحذف', description: `تم حذف ${partner.display_name_ar} من السجل.` });
      fetchPartners();
    } catch (e) {
      toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3 mt-4">
      <Accordion type="single" collapsible>
        <AccordionItem value="how-to" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              كيف أضيف شركة توصيل جديدة؟
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-xs space-y-2 text-muted-foreground leading-relaxed">
              <p>النظام مبني على <b>Registry + Adapter</b>:</p>
              <ol className="list-decimal pr-5 space-y-1">
                <li>أضف الشركة هنا (الاسم + Base URL + endpoints افتراضية).</li>
                <li>سجّل دخول حسابك في الشركة من نافذة "إدارة شركة التوصيل".</li>
                <li>شغّل مزامنة المدن/المناطق/الأحجام من إعدادات شركة التوصيل.</li>
                <li>الشركة ستظهر تلقائياً في الطلب السريع وفي قائمة شركات التوصيل.</li>
              </ol>
              <p className="pt-1">
                <b>تنبيه مهم:</b> إذا API الشركة الجديدة يختلف جذرياً عن الوسيط/مدن
                (HMAC، OAuth، شكل بيانات مختلف)، يجب إضافة <i>Adapter</i> صغير في الكود مرة واحدة.
                للأنماط المشابهة للوسيط/مدن، الإضافة من هنا كافية بدون كود.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            تسجيل شركة توصيل جديدة
          </CardTitle>
          <CardDescription className="text-xs">
            للمدير فقط. هذا لا ينشئ حساباً، فقط يُعرّف الشركة في النظام.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">مفتاح الشركة (إنكليزي)</Label>
              <Input
                placeholder="new_partner"
                value={form.partner_key}
                onChange={(e) => setForm((s) => ({ ...s, partner_key: e.target.value }))}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">الاسم بالعربي</Label>
              <Input
                placeholder="شركة جديدة"
                value={form.display_name_ar}
                onChange={(e) => setForm((s) => ({ ...s, display_name_ar: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Base URL</Label>
              <Input
                placeholder="https://api.partner.com/v1/merchant"
                value={form.base_url}
                onChange={(e) => setForm((s) => ({ ...s, base_url: e.target.value }))}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">الاسم بالإنكليزي (اختياري)</Label>
              <Input
                placeholder="New Partner"
                value={form.display_name_en}
                onChange={(e) => setForm((s) => ({ ...s, display_name_en: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={saving} size="sm" className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            إضافة الشركة
          </Button>
        </CardContent>
      </Card>

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
