import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Tag, Percent, Calendar, Package, FolderTree, ArrowRight } from 'lucide-react';

/**
 * Builder حقيقي للعروض - يربط مع المنتجات والفئات والأقسام.
 * Schema الفعلي: promotion_name, promotion_type, discount_value,
 * applicable_products[], applicable_categories[], promotion_code,
 * start_date, end_date, is_active
 */
const PromotionBuilder = ({ promotion, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    promotion_name: promotion?.promotion_name || '',
    promotion_type: promotion?.promotion_type || 'percentage',
    discount_value: promotion?.discount_value || 10,
    promotion_code: promotion?.promotion_code || '',
    start_date: promotion?.start_date ? promotion.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
    end_date: promotion?.end_date ? promotion.end_date.split('T')[0] : '',
    is_active: promotion?.is_active ?? true,
    applicable_products: promotion?.applicable_products || [],
    applicable_categories: promotion?.applicable_categories || [],
  });
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // المنتجات المسموحة للموظف
    const { data: allowed } = await supabase
      .from('employee_allowed_products')
      .select('product_id, products:product_id(id, name, base_price, images)')
      .eq('employee_id', user.id)
      .eq('is_active', true);

    const prods = (allowed || [])
      .map(a => a.products)
      .filter(Boolean);
    setProducts(prods);

    // الفئات
    const { data: cats } = await supabase.from('categories').select('id, name').order('name');
    setCategories(cats || []);
  };

  const toggleProduct = (id) => {
    setFormData(d => ({
      ...d,
      applicable_products: d.applicable_products.includes(id)
        ? d.applicable_products.filter(p => p !== id)
        : [...d.applicable_products, id],
    }));
  };
  const toggleCategory = (id) => {
    setFormData(d => ({
      ...d,
      applicable_categories: d.applicable_categories.includes(id)
        ? d.applicable_categories.filter(c => c !== id)
        : [...d.applicable_categories, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.promotion_name.trim()) {
      return toast({ title: 'الاسم مطلوب', variant: 'destructive' });
    }
    if (formData.applicable_products.length === 0 && formData.applicable_categories.length === 0) {
      return toast({ title: 'اختر منتجات أو فئات', description: 'يجب ربط العرض بمنتج أو فئة واحدة على الأقل', variant: 'destructive' });
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        promotion_name: formData.promotion_name,
        promotion_type: formData.promotion_type,
        discount_value: Number(formData.discount_value) || 0,
        promotion_code: formData.promotion_code || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        is_active: formData.is_active,
        applicable_products: formData.applicable_products,
        applicable_categories: formData.applicable_categories,
      };

      if (promotion) {
        const { error } = await supabase
          .from('employee_promotions')
          .update(payload)
          .eq('id', promotion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employee_promotions')
          .insert({ ...payload, employee_id: user.id });
        if (error) throw error;
      }

      toast({ title: '✅ تم الحفظ', description: `تم ${promotion ? 'تحديث' : 'إنشاء'} العرض بنجاح` });
      onSave();
    } catch (err) {
      console.error('Error saving promotion:', err);
      toast({ title: 'خطأ', description: err.message || 'فشل حفظ العرض', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
              <Tag className="h-7 w-7 text-pink-400" />
              {promotion ? 'تعديل العرض' : 'إنشاء عرض جديد'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">اربط العرض بمنتجات أو فئات محددة</p>
          </div>
          <Button variant="outline" onClick={onCancel} className="backdrop-blur-xl bg-white/5 border-white/10">
            <ArrowRight className="h-4 w-4 ml-2" /> رجوع
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* تفاصيل العرض */}
          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold flex items-center gap-2"><Percent className="h-5 w-5 text-fuchsia-400" /> تفاصيل العرض</h2>

            <div>
              <Label>اسم العرض *</Label>
              <Input
                value={formData.promotion_name}
                onChange={(e) => setFormData({ ...formData, promotion_name: e.target.value })}
                placeholder="مثال: خصم نهاية الموسم 30%"
                required
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>نوع الخصم *</Label>
                <Select value={formData.promotion_type} onValueChange={(v) => setFormData({ ...formData, promotion_type: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية %</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت IQD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>قيمة الخصم *</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  required
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> تاريخ البداية *</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required className="bg-white/5 border-white/10" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> تاريخ الانتهاء</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
            </div>

            <div>
              <Label>كود الكوبون (اختياري)</Label>
              <Input
                value={formData.promotion_code}
                onChange={(e) => setFormData({ ...formData, promotion_code: e.target.value.toUpperCase() })}
                placeholder="SAVE30"
                dir="ltr"
                className="bg-white/5 border-white/10 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="active" checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: !!v })} />
              <Label htmlFor="active" className="cursor-pointer">العرض مفعّل</Label>
            </div>
          </div>

          {/* الربط بالفئات */}
          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-cyan-400" /> الفئات المشمولة
              {formData.applicable_categories.length > 0 && (
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">{formData.applicable_categories.length}</Badge>
              )}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {categories.map(c => {
                const selected = formData.applicable_categories.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleCategory(c.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                      selected
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-lg'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* الربط بالمنتجات */}
          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-fuchsia-400" /> المنتجات المشمولة
                {formData.applicable_products.length > 0 && (
                  <Badge className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30">{formData.applicable_products.length}</Badge>
                )}
              </h2>
              <Input placeholder="ابحث عن منتج..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs bg-white/5 border-white/10" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {filteredProducts.map(p => {
                const selected = formData.applicable_products.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={`group relative p-2 rounded-xl border transition-all text-right ${
                      selected
                        ? 'border-fuchsia-500/60 bg-fuchsia-500/10 ring-2 ring-fuchsia-500/40'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <img
                      src={(p.images && p.images[0]) || '/placeholder.png'}
                      alt={p.name}
                      className="w-full aspect-square object-cover rounded-lg mb-2"
                    />
                    <div className="text-xs font-bold truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{Number(p.base_price || 0).toLocaleString('ar-IQ')} IQD</div>
                    {selected && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-fuchsia-500 flex items-center justify-center text-white text-xs">✓</div>
                    )}
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8 text-sm">
                  لا توجد منتجات مسموحة. أضف منتجات أولاً من قسم المنتجات.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 sticky bottom-4">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 hover:opacity-90 shadow-2xl shadow-fuchsia-500/30 h-12 text-base font-bold"
            >
              {saving && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
              {promotion ? 'تحديث العرض' : '✨ إنشاء العرض'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="bg-white/5 border-white/10 h-12">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromotionBuilder;
