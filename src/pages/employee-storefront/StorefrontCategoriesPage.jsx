import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { FolderTree, Save } from 'lucide-react';

const StorefrontCategoriesPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selected, setSelected] = useState({}); // {category_<id>: {is_visible, display_order, custom_label, custom_image_url}}

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

  const toggle = (key, base) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { ...base, is_visible: true, display_order: 0 };
      return next;
    });
  };

  const update = (key, field, value) => {
    setSelected(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    // wipe then insert (simple sync)
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

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
              <FolderTree className="h-7 w-7" /> الأقسام والفئات
            </h1>
            <p className="text-muted-foreground text-sm mt-1">حدد ما يظهر في متجرك وأضف صور وتسميات مخصصة</p>
          </div>
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-fuchsia-500 to-purple-600">
            <Save className="h-4 w-4 ml-2" /> {saving ? 'حفظ...' : 'حفظ الكل'}
          </Button>
        </div>

        <Card className="backdrop-blur-xl bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="p-6">
            <h2 className="font-bold text-lg mb-4">الأقسام (Departments)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {departments.map(d => {
                const key = `dep_${d.id}`;
                const sel = selected[key];
                return (
                  <div key={d.id} className={`p-3 rounded-xl border ${sel ? 'border-fuchsia-500/50 bg-fuchsia-500/10' : 'border-white/10'}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!sel} onCheckedChange={() => toggle(key, {})} />
                      <span className="font-bold flex-1">{d.name}</span>
                    </div>
                    {sel && (
                      <div className="mt-3 space-y-2">
                        <Input placeholder="تسمية مخصصة (اختياري)" value={sel.custom_label || ''} onChange={(e) => update(key, 'custom_label', e.target.value)} />
                        <Input placeholder="رابط صورة دائرية (URL)" value={sel.custom_image_url || ''} onChange={(e) => update(key, 'custom_image_url', e.target.value)} />
                        <Input type="number" placeholder="الترتيب" value={sel.display_order || 0} onChange={(e) => update(key, 'display_order', e.target.value)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/5 border-white/10 rounded-3xl">
          <CardContent className="p-6">
            <h2 className="font-bold text-lg mb-4">الفئات (Categories)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map(c => {
                const key = `cat_${c.id}`;
                const sel = selected[key];
                return (
                  <div key={c.id} className={`p-3 rounded-xl border ${sel ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10'}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!sel} onCheckedChange={() => toggle(key, {})} />
                      <span className="font-bold flex-1">{c.name}</span>
                    </div>
                    {sel && (
                      <div className="mt-3 space-y-2">
                        <Input placeholder="تسمية مخصصة (اختياري)" value={sel.custom_label || ''} onChange={(e) => update(key, 'custom_label', e.target.value)} />
                        <Input placeholder="رابط صورة دائرية (URL)" value={sel.custom_image_url || ''} onChange={(e) => update(key, 'custom_image_url', e.target.value)} />
                        <Input type="number" placeholder="الترتيب" value={sel.display_order || 0} onChange={(e) => update(key, 'display_order', e.target.value)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StorefrontCategoriesPage;
