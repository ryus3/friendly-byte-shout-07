import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Calendar, Sun, Gift } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const SeasonsOccasionsManager = () => {
  const [seasonsOccasions, setSeasonsOccasions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', type: 'season' });

  // جلب المواسم والمناسبات
  const fetchSeasonsOccasions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seasons_occasions')
        .select('*')
        .order('type')
        .order('name');
      
      if (error) throw error;
      setSeasonsOccasions(data || []);
    } catch (error) {
      console.error('Error fetching seasons/occasions:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل المواسم والمناسبات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasonsOccasions();
  }, []);

  // فتح نافذة إضافة/تعديل
  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', description: '', type: 'season' });
    setDialogOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ 
      name: item.name, 
      description: item.description || '', 
      type: item.type 
    });
    setDialogOpen(true);
  };

  // حفظ الموسم/المناسبة
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال اسم الموسم أو المناسبة',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (editingItem) {
        // تعديل
        const { error } = await supabase
          .from('seasons_occasions')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            type: formData.type
          })
          .eq('id', editingItem.id);
        
        if (error) throw error;
        
        toast({
          title: 'نجاح',
          description: 'تم تحديث العنصر بنجاح',
          variant: 'success'
        });
      } else {
        // إضافة جديد
        const { error } = await supabase
          .from('seasons_occasions')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            type: formData.type
          });
        
        if (error) throw error;
        
        toast({
          title: 'نجاح',
          description: 'تم إضافة العنصر بنجاح',
          variant: 'success'
        });
      }
      
      await fetchSeasonsOccasions();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving season/occasion:', error);
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // حذف الموسم/المناسبة
  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('seasons_occasions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'نجاح',
        description: 'تم حذف العنصر بنجاح',
        variant: 'success'
      });
      
      await fetchSeasonsOccasions();
    } catch (error) {
      console.error('Error deleting season/occasion:', error);
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // تجميع البيانات حسب النوع
  const seasons = seasonsOccasions.filter(item => item.type === 'season');
  const occasions = seasonsOccasions.filter(item => item.type === 'occasion');

  const renderItems = (items, title, icon, emptyText) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {React.createElement(icon, { className: "h-4 w-4" })}
          {title}
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">{emptyText}</p>
            <Button onClick={handleAdd} variant="outline" size="sm">
              <Plus className="h-4 w-4 ml-2" />
              إضافة أول عنصر
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <span className="font-medium">{item.name}</span>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <h3 className="text-lg font-semibold">المواسم والمناسبات</h3>
          <Badge variant="secondary">{seasonsOccasions.length}</Badge>
        </div>
        <Button onClick={handleAdd} size="sm" className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 gap-2">
          <Plus className="h-4 w-4" />
          إضافة عنصر جديد
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderItems(seasons, 'المواسم', Sun, 'لا توجد مواسم')}
          {renderItems(occasions, 'المناسبات', Gift, 'لا توجد مناسبات')}
        </div>
      )}

      {/* نافذة إضافة/تعديل */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'تعديل العنصر' : 'إضافة عنصر جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="type">النوع *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="season">موسم</SelectItem>
                  <SelectItem value="occasion">مناسبة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="name">الاسم *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.type === 'season' ? 'مثال: صيف، شتاء، ربيع' : 'مثال: عيد الفطر، رمضان، الزفاف'}
              />
            </div>
            <div>
              <Label htmlFor="description">الوصف (اختياري)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف مختصر للموسم أو المناسبة"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeasonsOccasionsManager;