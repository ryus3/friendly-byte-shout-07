import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { FolderTree, Save, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

const StorefrontCategoriesPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selected, setSelected] = useState({});

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);

    const [{ data: cats }, { data: deps }, { data: mine }] = await Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('employee_storefront_categories').select('*').eq('employee_id', u.id),
    ]);

    setCategories(cats || []);
    setDepartments(deps || []);

    const map = {};
    (mine || []).forEach(m => {
      const key = m.category_id ? `cat_${m.category_id}` : `dep_${m.department_id}`;
      map[key] = { ...m };
    });
    setSelected(map);
    setLoading(false);
  };

  const toggle = (key) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { is_visible: true, display_order: 0 };
      return next;
    });
  };

  const update = (key, field, value) => {
    setSelected(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const uploadImage = async (key, file) => {
    if (!file || !user) return;
    try {
      setUploadingKey(key);
      const ext = file.name.split('.').pop();
      const path = `storefront-categories/${user.id}/${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      update(key, 'custom_image_url', publicUrl);
      toast({ title: '✅ تم رفع الصورة' });
    } catch (err) {
      toast({ title: 'خطأ في الرفع', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingKey(null);
    }
  };

  const save = async () => {
    setSaving(true);
    await supabase.from('employee_storefront_categories').delete().eq('employee_id', user.id);
    const rows = Object.entries(selected).map(([key, v]) => ({
      employee_id: user.id,
      category_id: key.startsWith('cat_') ? key.slice(4) : null,
      department_id: key.startsWith('dep_') ? key.slice(4) : null,
      is_visible: v.is_visible ?? true,
      display_order: Number(v.display_order) || 0,
      custom_label: v.custom_label || null,
      custom_image_url: v.custom_image_url || null,
    }));
    if (rows.length) {
      const { error } = await supabase.from('employee_storefront_categories').insert(rows);
      if (error) {
        toast({ title: 'فشل الحفظ', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast({ title: '✅ تم حفظ الأقسام والفئات' });
  };

  const renderItem = (item, type) => {
    const key = `${type}_${item.id}`;
    const sel = selected[key];
    const accent = type === 'dep' ? 'fuchsia' : 'cyan';
    return (
      <div
        key={item.id}
        className={`relative overflow-hidden rounded-2xl border transition-all backdrop-blur-xl ${
          sel
            ? `border-${accent}-500/50 bg-${accent}-500/10 ring-2 ring-${accent}-500/30`
            : 'border-white/10 bg-white/5 hover:bg-white/10'
        }`}
      >
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={!!sel} onCheckedChange={() => toggle(key)} />
            <span className="font-bold flex-1 truncate text-sm">{item.name}</span>
          </div>

          {sel && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              {/* Image preview + upload */}
              <div className="flex gap-2 items-center">
                <div className="relative w-14 h-14 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                  {sel.custom_image_url ? (
                    <>
                      <img src={sel.custom_image_url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => update(key, 'custom_image_url', null)}
                        className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-bl-lg flex items-center justify-center"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadImage(key, e.target.files[0])}
                  />
                  <div className={`w-full h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-1 text-xs cursor-pointer ${uploadingKey === key ? 'opacity-50' : ''}`}>
                    {uploadingKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    <span>{sel.custom_image_url ? 'تغيير الصورة' : 'رفع صورة'}</span>
                  </div>
                </label>
              </div>

              <Input
                placeholder="تسمية مخصصة (اختياري)"
                value={sel.custom_label || ''}
                onChange={(e) => update(key, 'custom_label', e.target.value)}
                className="h-8 text-xs bg-white/5 border-white/10"
              />
              <Input
                type="number"
                placeholder="الترتيب"
                value={sel.display_order || 0}
                onChange={(e) => update(key, 'display_order', e.target.value)}
                className="h-8 text-xs bg-white/5 border-white/10"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 p-4 sm:p-6 md:p-8">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-fuchsia-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3 sticky top-0 z-20 backdrop-blur-xl bg-slate-950/70 -mx-4 px-4 py-3 rounded-b-2xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
              <FolderTree className="h-7 w-7 text-cyan-400" /> الأقسام والفئات
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">حدد ما يظهر في متجرك مع صور وتسميات مخصصة</p>
          </div>
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30">
            {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
            حفظ الكل
          </Button>
        </div>

        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-fuchsia-500" /> الأقسام (Departments)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departments.map(d => renderItem(d, 'dep'))}
            {departments.length === 0 && <div className="col-span-full text-center text-muted-foreground text-sm py-6">لا توجد أقسام</div>}
          </div>
        </div>

        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500" /> الفئات (Categories)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map(c => renderItem(c, 'cat'))}
            {categories.length === 0 && <div className="col-span-full text-center text-muted-foreground text-sm py-6">لا توجد فئات</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorefrontCategoriesPage;
