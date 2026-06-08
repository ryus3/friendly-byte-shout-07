import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import PromotionBuilder from '@/components/employee-storefront/PromotionBuilder';
import { Plus, Pencil, Trash2, Tag, Percent, Calendar, Package, FolderTree, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import devLog from '@/lib/devLogger';

const StorefrontPromotionsPage = () => {
  const [promotions, setPromotions] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPromotions(); }, []);

  const fetchPromotions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('employee_promotions')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPromotions(data || []);
    } catch (err) {
      devLog.error('Error fetching promotions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
      const { error } = await supabase.from('employee_promotions').delete().eq('id', id);
      if (error) throw error;
      setPromotions(p => p.filter(x => x.id !== id));
      toast({ title: '✅ تم الحذف' });
    } catch (err) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      const { error } = await supabase
        .from('employee_promotions')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);
      if (error) throw error;
      fetchPromotions();
      toast({ title: promo.is_active ? '⏸ تم التعطيل' : '▶ تم التفعيل' });
    } catch (err) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  if (showBuilder) {
    return (
      <PromotionBuilder
        promotion={editingPromotion}
        onSave={() => { setShowBuilder(false); setEditingPromotion(null); fetchPromotions(); }}
        onCancel={() => { setShowBuilder(false); setEditingPromotion(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 p-4 sm:p-6 md:p-8">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-pink-400" />
              العروض والخصومات
            </h1>
            <p className="text-muted-foreground text-sm mt-1">اربط الخصومات بمنتجات أو فئات محددة</p>
          </div>
          <Button
            onClick={() => { setEditingPromotion(null); setShowBuilder(true); }}
            className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 hover:opacity-90 shadow-lg shadow-fuchsia-500/30"
          >
            <Plus className="h-4 w-4 ml-2" /> عرض جديد
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">جاري التحميل...</div>
        ) : promotions.length === 0 ? (
          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-16 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
              <Tag className="h-10 w-10 text-pink-400" />
            </div>
            <h3 className="text-xl font-bold">لا توجد عروض حالياً</h3>
            <p className="text-muted-foreground text-sm">أنشئ عرضاً جديداً واربطه بمنتجاتك لزيادة المبيعات</p>
            <Button onClick={() => setShowBuilder(true)} className="bg-gradient-to-r from-pink-500 to-purple-600">
              <Plus className="h-4 w-4 ml-2" /> إنشاء أول عرض
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promotions.map(promo => {
              const isPct = promo.promotion_type === 'percentage';
              return (
                <div
                  key={promo.id}
                  className="group relative overflow-hidden backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-5 shadow-2xl hover:border-fuchsia-500/40 transition-all"
                >
                  {/* Glow */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-fuchsia-500/20 rounded-full blur-3xl group-hover:bg-fuchsia-500/30 transition-all" />

                  <div className="relative space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base truncate">{promo.promotion_name}</h3>
                        {promo.promotion_code && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 font-mono text-xs">
                            <Tag className="h-3 w-3" /> {promo.promotion_code}
                          </div>
                        )}
                      </div>
                      <Badge className={promo.is_active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}>
                        {promo.is_active ? 'نشط' : 'معطّل'}
                      </Badge>
                    </div>

                    {/* قيمة الخصم */}
                    <div className="flex items-baseline gap-1">
                      <Percent className="h-4 w-4 text-fuchsia-400" />
                      <span className="text-3xl font-black bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">
                        {isPct ? `${promo.discount_value}%` : `${Number(promo.discount_value).toLocaleString('ar-IQ')}`}
                      </span>
                      <span className="text-xs text-muted-foreground">{isPct ? 'خصم' : 'IQD خصم'}</span>
                    </div>

                    {/* روابط */}
                    <div className="flex gap-2 flex-wrap text-xs">
                      {promo.applicable_products?.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">
                          <Package className="h-3 w-3" /> {promo.applicable_products.length} منتج
                        </div>
                      )}
                      {promo.applicable_categories?.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                          <FolderTree className="h-3 w-3" /> {promo.applicable_categories.length} فئة
                        </div>
                      )}
                    </div>

                    {/* التواريخ */}
                    <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> من: {new Date(promo.start_date).toLocaleDateString('ar-IQ')}</div>
                      {promo.end_date && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> إلى: {new Date(promo.end_date).toLocaleDateString('ar-IQ')}</div>}
                    </div>

                    {/* أزرار */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1 bg-white/5 border-white/10" onClick={() => handleToggleActive(promo)}>
                        {promo.is_active ? 'تعطيل' : 'تفعيل'}
                      </Button>
                      <Button variant="outline" size="icon" className="bg-white/5 border-white/10" onClick={() => { setEditingPromotion(promo); setShowBuilder(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400" onClick={() => handleDelete(promo.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StorefrontPromotionsPage;
