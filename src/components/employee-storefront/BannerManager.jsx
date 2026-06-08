import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Upload, Trash2, GripVertical, Link2, Package, FolderTree, List, ExternalLink } from 'lucide-react';

const BannerManager = ({ banners, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);

  useEffect(() => {
    loadRefs();
  }, []);

  const loadRefs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('id, name, images').eq('is_active', true).order('name').limit(500),
      supabase.from('categories').select('id, name').order('name'),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `storefront-banners/${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('employee_banners').insert({
        employee_id: user.id, banner_image: publicUrl, banner_position: 'hero',
        display_order: banners.length, is_active: true, link_type: 'none',
      });
      if (insertError) throw insertError;
      onUpdate();
      toast({ title: '✅ تم رفع البانر' });
    } catch (err) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    await supabase.from('employee_banners').delete().eq('id', id);
    onUpdate();
    toast({ title: 'تم الحذف' });
  };

  const handleUpdate = async (id, patch) => {
    const { error } = await supabase.from('employee_banners').update(patch).eq('id', id);
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else onUpdate();
  };

  const linkTypeLabel = (t) => ({
    none: 'بدون رابط', product: 'منتج محدد', category: 'قسم كامل',
    custom_list: 'قائمة منتجات مخصصة', url: 'رابط خارجي',
  }[t] || 'بدون رابط');

  const linkTypeIcon = (t) => ({
    product: Package, category: FolderTree, custom_list: List, url: ExternalLink,
  }[t] || Link2);

  return (
    <div className="space-y-4">
      <div>
        <input type="file" id="banner-upload" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        <label htmlFor="banner-upload">
          <Button asChild disabled={uploading}>
            <span><Upload className="ml-2 h-4 w-4" /> {uploading ? 'جاري الرفع...' : 'إضافة بانر جديد'}</span>
          </Button>
        </label>
      </div>

      {banners.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا توجد بانرات حالياً</Card>
      ) : (
        <div className="space-y-3">
          {banners.map(banner => {
            const Icon = linkTypeIcon(banner.link_type);
            return (
              <Card key={banner.id} className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <img src={banner.banner_image} alt="Banner" className="w-full sm:w-40 h-32 sm:h-24 object-cover rounded-lg" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input value={banner.banner_title || ''} onChange={(e) => handleUpdate(banner.id, { banner_title: e.target.value })} placeholder="عنوان البانر" />
                      <Select value={banner.banner_position} onValueChange={(v) => handleUpdate(banner.id, { banner_position: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hero">الرئيسية</SelectItem>
                          <SelectItem value="announcement">شريط إعلانات</SelectItem>
                          <SelectItem value="sidebar">جانبي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{linkTypeLabel(banner.link_type)}</span>
                      </div>
                      <Dialog open={editingBanner === banner.id} onOpenChange={(o) => setEditingBanner(o ? banner.id : null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">إعداد الربط</Button>
                        </DialogTrigger>
                        <LinkEditorDialog banner={banner} products={products} categories={categories} onSave={(patch) => { handleUpdate(banner.id, patch); setEditingBanner(null); }} />
                      </Dialog>
                      <Button variant="outline" size="sm" onClick={() => handleUpdate(banner.id, { is_active: !banner.is_active })}>
                        {banner.is_active ? 'نشط' : 'متوقف'}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => handleDelete(banner.id)} className="self-start"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const LinkEditorDialog = ({ banner, products, categories, onSave }) => {
  const [linkType, setLinkType] = useState(banner.link_type || 'none');
  const [linkTargetId, setLinkTargetId] = useState(banner.link_target_id || '');
  const [linkProducts, setLinkProducts] = useState(banner.link_products || []);
  const [linkUrl, setLinkUrl] = useState(banner.link_url || '');
  const [linkLabel, setLinkLabel] = useState(banner.link_label || '');

  const toggleProduct = (id) => {
    setLinkProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const save = () => {
    onSave({
      link_type: linkType,
      link_target_id: ['product', 'category'].includes(linkType) ? (linkTargetId || null) : null,
      link_products: linkType === 'custom_list' ? linkProducts : [],
      link_url: linkType === 'url' ? linkUrl : null,
      link_label: linkLabel || null,
    });
  };

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>إعداد رابط البانر</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>نوع الربط</Label>
          <Select value={linkType} onValueChange={setLinkType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون رابط</SelectItem>
              <SelectItem value="product">منتج محدد</SelectItem>
              <SelectItem value="category">قسم كامل</SelectItem>
              <SelectItem value="custom_list">قائمة منتجات مخصصة</SelectItem>
              <SelectItem value="url">رابط خارجي</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {linkType === 'product' && (
          <div>
            <Label>اختر منتج</Label>
            <Select value={linkTargetId} onValueChange={setLinkTargetId}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {linkType === 'category' && (
          <div>
            <Label>اختر قسم</Label>
            <Select value={linkTargetId} onValueChange={setLinkTargetId}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {linkType === 'custom_list' && (
          <div>
            <Label>اختر منتجات للقائمة ({linkProducts.length})</Label>
            <div className="max-h-64 overflow-y-auto border rounded-lg p-2 space-y-1 mt-1">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer">
                  <Checkbox checked={linkProducts.includes(p.id)} onCheckedChange={() => toggleProduct(p.id)} />
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover" />}
                  <span className="text-sm flex-1 truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {linkType === 'url' && (
          <div>
            <Label>الرابط الخارجي</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." dir="ltr" />
          </div>
        )}

        {linkType !== 'none' && (
          <div>
            <Label>نص الزر (اختياري)</Label>
            <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="اكتشف المزيد" />
          </div>
        )}

        <Button onClick={save} className="w-full">حفظ</Button>
      </div>
    </DialogContent>
  );
};

export default BannerManager;
