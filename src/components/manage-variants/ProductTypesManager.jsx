import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const ProductTypesManager = () => {
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  // جلب أنواع المنتجات
  const fetchProductTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setProductTypes(data || []);
    } catch (error) {
      console.error('Error fetching product types:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل أنواع المنتجات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductTypes();
  }, []);

  // فتح نافذة إضافة/تعديل
  const handleAdd = () => {
    setEditingType(null);
    setFormData({ name: '', description: '' });
    setDialogOpen(true);
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setFormData({ name: type.name, description: type.description || '' });
    setDialogOpen(true);
  };

  // حفظ نوع المنتج
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال اسم نوع المنتج',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (editingType) {
        // تعديل
        const { error } = await supabase
          .from('product_types')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null
          })
          .eq('id', editingType.id);
        
        if (error) throw error;
        
        toast({
          title: 'نجاح',
          description: 'تم تحديث نوع المنتج بنجاح',
          variant: 'success'
        });
      } else {
        // إضافة جديد
        const { error } = await supabase
          .from('product_types')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null
          });
        
        if (error) throw error;
        
        toast({
          title: 'نجاح',
          description: 'تم إضافة نوع المنتج بنجاح',
          variant: 'success'
        });
      }
      
      await fetchProductTypes();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving product type:', error);
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // حذف نوع المنتج
  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('product_types')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'نجاح',
        description: 'تم حذف نوع المنتج بنجاح',
        variant: 'success'
      });
      
      await fetchProductTypes();
    } catch (error) {
      console.error('Error deleting product type:', error);
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <h3 className="text-lg font-semibold">أنواع المنتجات</h3>
          <Badge variant="secondary">{productTypes.length}</Badge>
        </div>
        <Button onClick={handleAdd} size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 gap-2">
          <Plus className="h-4 w-4" />
          إضافة نوع جديد
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productTypes.map((type) => (
            <Card key={type.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{type.name}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(type)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(type.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              {type.description && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
          
          {productTypes.length === 0 && (
            <div className="col-span-full text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">لا توجد أنواع منتجات</p>
              <Button onClick={handleAdd} variant="outline" size="sm">
                <Plus className="h-4 w-4 ml-2" />
                إضافة أول نوع منتج
              </Button>
            </div>
          )}
        </div>
      )}

      {/* نافذة إضافة/تعديل */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'تعديل نوع المنتج' : 'إضافة نوع منتج جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">اسم نوع المنتج *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: ملابس رجالية، أحذية، إكسسوارات"
              />
            </div>
            <div>
              <Label htmlFor="description">الوصف (اختياري)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف مختصر لنوع المنتج"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>
              {editingType ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductTypesManager;