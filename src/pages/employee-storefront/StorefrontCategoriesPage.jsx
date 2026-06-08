import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  FolderTree, Save, Upload, X, Loader2, Image as ImageIcon, Plus, Trash2, Edit3, GripVertical, Eye, EyeOff,
} from 'lucide-react';

/**
 * صفحة الأقسام والفئات — تصميم زجاجي عالمي، edge-to-edge على الموبايل
 * تدعم: تخصيص الموجود (صورة + اسم + ترتيب) + إنشاء أقسام/فئات مخصصة بالكامل
 */
const StorefrontCategoriesPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [user, setUser] = useState(null);

  // System
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selected, setSelected] = useState({});

  // Custom
  const [customItems, setCustomItems] = useState([]);
  const [editingCustom, setEditingCustom] = useState(null);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return setLoading(false);
    setUser(u);

    const [{ data: cats }, { data: deps }, { data: mine }, { data: custom }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('employee_storefront_categories').select('*').eq('employee_id', u.id),
      supabase.from('storefront_custom_categories').select('*').eq('employee_id', u.id).order('display_order'),
      supabase.from('products').select('id, name, images').eq('is_active', true).limit(200),
    ]);

    setCategories(cats || []);
    setDepartments(deps || []);
    setCustomItems(custom || []);
    setAllProducts(prods || []);

    const map = {};
    (mine || []).forEach(m => {
      const key = m.category_id ? `cat_${m.category_id}` : `dep_${m.department_id}`;
      map[key] = { ...m };
    });
    setSelected(map);
    setLoading(false);
  };

  // ===== System category handlers =====
  const toggle = (key) =>
    setSelected(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { is_visible: true, display_order: 0 };
      return next;
    });

  const updateSel = (key, field, value) =>
    setSelected(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const uploadSysImage = async (key, file) => {
    if (!file || !user) return;
    try {
      setUploadingKey(key);
      const ext = file.name.split('.').pop();
      const path = `storefront-categories/${user.id}/${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      updateSel(key, 'custom_image_url', publicUrl);
      toast({ title: '✅ تم رفع الصورة' });
    } catch (err) {
      toast({ title: 'خطأ في الرفع', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingKey(null);
    }
  };

  const saveSystem = async () => {
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
    toast({ title: '✅ تم حفظ التخصيصات' });
  };

  // ===== Custom handlers =====
  const openCreateCustom = (type) => setEditingCustom({
    id: null, type, name: '', image_url: '', display_order: customItems.length,
    is_visible: true, linked_product_ids: [], linked_category_ids: [], linked_department_ids: [],
  });

  const saveCustom = async () => {
    if (!editingCustom?.name?.trim()) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      employee_id: user.id,
      type: editingCustom.type,
      name: editingCustom.name.trim(),
      image_url: editingCustom.image_url || null,
      display_order: Number(editingCustom.display_order) || 0,
      is_visible: editingCustom.is_visible,
      linked_product_ids: editingCustom.linked_product_ids || [],
      linked_category_ids: editingCustom.linked_category_ids || [],
      linked_department_ids: editingCustom.linked_department_ids || [],
    };
    let error;
    if (editingCustom.id) {
      ({ error } = await supabase.from('storefront_custom_categories').update(payload).eq('id', editingCustom.id));
    } else {
      ({ error } = await supabase.from('storefront_custom_categories').insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: 'فشل الحفظ', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ تم الحفظ' });
    setEditingCustom(null);
    init();
  };

  const deleteCustom = async (id) => {
    if (!confirm('حذف هذا العنصر نهائياً؟')) return;
    await supabase.from('storefront_custom_categories').delete().eq('id', id);
    init();
  };

  const toggleCustomVisible = async (item) => {
    await supabase.from('storefront_custom_categories').update({ is_visible: !item.is_visible }).eq('id', item.id);
    init();
  };

  const uploadCustomImage = async (file) => {
    if (!file || !user) return;
    try {
      setUploadingKey('custom');
      const ext = file.name.split('.').pop();
      const path = `storefront-categories/${user.id}/custom-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      setEditingCustom(prev => ({ ...prev, image_url: publicUrl }));
      toast({ title: '✅ تم رفع الصورة' });
    } catch (err) {
      toast({ title: 'خطأ في الرفع', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingKey(null);
    }
  };

  // ===== Render system item =====
  const renderSysItem = (item, type) => {
    const key = `${type}_${item.id}`;
    const sel = selected[key];
    const accent = type === 'dep' ? 'fuchsia' : 'cyan';
    return (
      <div
        key={item.id}
        className={`relative overflow-hidden rounded-2xl border transition-all backdrop-blur-xl ${
          sel ? `border-${accent}-500/50 bg-${accent}-500/10 ring-1 ring-${accent}-500/30` : 'border-white/10 bg-white/5 hover:bg-white/10'
        }`}
      >
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={!!sel} onCheckedChange={() => toggle(key)} />
            <span className="font-bold flex-1 truncate text-sm">{item.name}</span>
          </div>
          {sel && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex gap-2 items-center">
                <div className="relative w-14 h-14 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                  {sel.custom_image_url ? (
                    <>
                      <img src={sel.custom_image_url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => updateSel(key, 'custom_image_url', null)} className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-bl-lg flex items-center justify-center">
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>
                  )}
                </div>
                <label className="flex-1">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSysImage(key, e.target.files[0])} />
                  <div className={`w-full h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-1 text-xs cursor-pointer ${uploadingKey === key ? 'opacity-50' : ''}`}>
                    {uploadingKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    <span>{sel.custom_image_url ? 'تغيير' : 'رفع صورة'}</span>
                  </div>
                </label>
              </div>
              <Input placeholder="تسمية مخصصة (اختياري)" value={sel.custom_label || ''} onChange={(e) => updateSel(key, 'custom_label', e.target.value)} className="h-8 text-xs bg-white/5 border-white/10" />
              <Input type="number" placeholder="الترتيب" value={sel.display_order || 0} onChange={(e) => updateSel(key, 'display_order', e.target.value)} className="h-8 text-xs bg-white/5 border-white/10" />
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/60">جاري التحميل...</div>;

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 relative" dir="rtl">
      {/* Aurora bg */}
      <div className="fixed inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[60vw] max-w-[500px] h-[60vw] max-h-[500px] bg-cyan-500/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[60vw] max-w-[500px] h-[60vw] max-h-[500px] bg-fuchsia-500/15 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 px-3 sm:px-6 py-4 sm:py-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30">
              <FolderTree className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
                الأقسام والفئات
              </h1>
              <p className="text-[11px] sm:text-xs text-white/50">خصّص الموجود أو أنشئ أقسامك الخاصة</p>
            </div>
          </div>
          <Button onClick={saveSystem} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30 text-white">
            {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
            حفظ التخصيصات
          </Button>
        </div>

        <Tabs defaultValue="custom" className="w-full">
          <TabsList className="w-full grid grid-cols-2 backdrop-blur-xl bg-white/5 border border-white/10 h-11">
            <TabsTrigger value="custom" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-fuchsia-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              مخصصة بالكامل
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
              تخصيص الموجود
            </TabsTrigger>
          </TabsList>

          {/* === Custom Tab === */}
          <TabsContent value="custom" className="mt-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => openCreateCustom('department')} size="sm" className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white">
                <Plus className="h-4 w-4 ml-1" /> قسم جديد
              </Button>
              <Button onClick={() => openCreateCustom('category')} size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                <Plus className="h-4 w-4 ml-1" /> فئة جديدة
              </Button>
            </div>

            {customItems.length === 0 ? (
              <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 text-center text-white/60">
                لم تنشئ أي أقسام أو فئات مخصصة بعد. اضغط الأزرار أعلاه للبدء.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {customItems.map((it) => (
                  <div key={it.id} className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="aspect-video w-full bg-gradient-to-br from-slate-800 to-slate-900 relative">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30"><ImageIcon className="h-10 w-10" /></div>
                      )}
                      <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${it.type === 'department' ? 'bg-fuchsia-500/80 text-white' : 'bg-cyan-500/80 text-white'}`}>
                        {it.type === 'department' ? 'قسم' : 'فئة'}
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate flex-1 text-white">{it.name}</p>
                        <span className="text-[10px] text-white/40">#{it.display_order}</span>
                      </div>
                      <div className="text-[11px] text-white/50">
                        {(it.linked_product_ids?.length || 0)} منتج • {(it.linked_category_ids?.length || 0)} فئة • {(it.linked_department_ids?.length || 0)} قسم
                      </div>
                      <div className="flex gap-1 pt-2 border-t border-white/10">
                        <Button size="sm" variant="ghost" className="flex-1 h-8 text-white/70 hover:text-white" onClick={() => toggleCustomVisible(it)}>
                          {it.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1 h-8 text-white/70 hover:text-white" onClick={() => setEditingCustom({ ...it })}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1 h-8 text-red-400 hover:text-red-300" onClick={() => deleteCustom(it.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === System Tab === */}
          <TabsContent value="system" className="mt-4 space-y-5">
            <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl">
              <h2 className="font-bold text-base mb-3 flex items-center gap-2 text-white">
                <span className="w-2 h-2 rounded-full bg-fuchsia-500" /> الأقسام
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {departments.map(d => renderSysItem(d, 'dep'))}
                {departments.length === 0 && <div className="col-span-full text-center text-white/40 text-sm py-6">لا توجد أقسام</div>}
              </div>
            </div>
            <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl">
              <h2 className="font-bold text-base mb-3 flex items-center gap-2 text-white">
                <span className="w-2 h-2 rounded-full bg-cyan-500" /> الفئات
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map(c => renderSysItem(c, 'cat'))}
                {categories.length === 0 && <div className="col-span-full text-center text-white/40 text-sm py-6">لا توجد فئات</div>}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* === Create/Edit Custom Dialog === */}
      <Dialog open={!!editingCustom} onOpenChange={(o) => !o && setEditingCustom(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingCustom?.id ? 'تعديل' : 'إنشاء'} {editingCustom?.type === 'department' ? 'قسم' : 'فئة'} مخصصة
            </DialogTitle>
          </DialogHeader>
          {editingCustom && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium block mb-1">الاسم *</label>
                <Input value={editingCustom.name} onChange={(e) => setEditingCustom({ ...editingCustom, name: e.target.value })} placeholder="مثال: مجموعة الصيف" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">الصورة</label>
                <div className="flex gap-3 items-center">
                  <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative">
                    {editingCustom.image_url ? (
                      <img src={editingCustom.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
                    )}
                  </div>
                  <label className="flex-1">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCustomImage(e.target.files[0])} />
                    <div className="border rounded-lg h-10 flex items-center justify-center gap-2 text-sm cursor-pointer hover:bg-muted">
                      {uploadingKey === 'custom' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      رفع صورة
                    </div>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">الترتيب</label>
                  <Input type="number" value={editingCustom.display_order} onChange={(e) => setEditingCustom({ ...editingCustom, display_order: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">الحالة</label>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setEditingCustom({ ...editingCustom, is_visible: !editingCustom.is_visible })}>
                    {editingCustom.is_visible ? <><Eye className="h-4 w-4 ml-1" /> ظاهر</> : <><EyeOff className="h-4 w-4 ml-1" /> مخفي</>}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  ربط منتجات ({editingCustom.linked_product_ids?.length || 0})
                </label>
                <div className="border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 bg-muted/30">
                  {allProducts.map(p => {
                    const checked = editingCustom.linked_product_ids?.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const ids = new Set(editingCustom.linked_product_ids || []);
                            if (v) ids.add(p.id); else ids.delete(p.id);
                            setEditingCustom({ ...editingCustom, linked_product_ids: Array.from(ids) });
                          }}
                        />
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover" />}
                        <span className="text-xs flex-1 truncate">{p.name}</span>
                      </label>
                    );
                  })}
                  {allProducts.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">لا توجد منتجات</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">ربط أقسام نظام</label>
                  <div className="border rounded-lg p-2 max-h-28 overflow-y-auto space-y-1 bg-muted/30 text-xs">
                    {departments.map(d => {
                      const checked = editingCustom.linked_department_ids?.includes(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={(v) => {
                            const ids = new Set(editingCustom.linked_department_ids || []);
                            if (v) ids.add(d.id); else ids.delete(d.id);
                            setEditingCustom({ ...editingCustom, linked_department_ids: Array.from(ids) });
                          }} />
                          <span className="truncate">{d.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">ربط فئات نظام</label>
                  <div className="border rounded-lg p-2 max-h-28 overflow-y-auto space-y-1 bg-muted/30 text-xs">
                    {categories.map(c => {
                      const checked = editingCustom.linked_category_ids?.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={(v) => {
                            const ids = new Set(editingCustom.linked_category_ids || []);
                            if (v) ids.add(c.id); else ids.delete(c.id);
                            setEditingCustom({ ...editingCustom, linked_category_ids: Array.from(ids) });
                          }} />
                          <span className="truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustom(null)}>إلغاء</Button>
            <Button onClick={saveCustom} disabled={saving} className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white">
              {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorefrontCategoriesPage;
