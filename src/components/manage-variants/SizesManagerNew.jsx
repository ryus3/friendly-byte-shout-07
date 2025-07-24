import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Edit3, Trash2, GripVertical, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const SortableSize = ({ size, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: size.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border">
      <div {...attributes} {...listeners} className="cursor-grab hover:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{size.name}</span>
          <Badge variant="outline" className="text-xs">
            {size.type === 'letter' ? 'حروف' : size.type === 'number' ? 'أرقام' : 'مخصص'}
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(size)}>
            <Edit3 className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-red-600">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  تأكيد الحذف
                </AlertDialogTitle>
                <AlertDialogDescription>
                  هل أنت متأكد من حذف القياس "{size.name}"؟ هذا الإجراء لا يمكن التراجع عنه.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(size.id)} className="bg-red-600 hover:bg-red-700">
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

const SizesManagerNew = () => {
  const [isAddingSize, setIsAddingSize] = useState(false);
  const [editingSize, setEditingSize] = useState(null);
  const [sizeForm, setSizeForm] = useState({ name: '', type: 'letter' });
  const [sizes, setSizes] = useState([]);
  const [sortedSizes, setSortedSizes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSizes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      
      setSizes(data || []);
      setSortedSizes(data || []);
    } catch (error) {
      console.error('خطأ في جلب القياسات:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في جلب القياسات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSizes();
  }, []);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sortedSizes.findIndex((item) => item.id === active.id);
      const newIndex = sortedSizes.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(sortedSizes, oldIndex, newIndex);
      
      setSortedSizes(newOrder);
      
      // تحديث display_order في قاعدة البيانات
      try {
        const updatePromises = newOrder.map((size, index) =>
          supabase.from('sizes').update({ display_order: index }).eq('id', size.id)
        );
        await Promise.all(updatePromises);
        await fetchSizes();
      } catch (error) {
        console.error('خطأ في تحديث ترتيب القياسات:', error);
        toast({
          title: 'خطأ',
          description: 'فشل في حفظ الترتيب الجديد',
          variant: 'destructive'
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingSize) {
        await supabase
          .from('sizes')
          .update(sizeForm)
          .eq('id', editingSize.id);
        toast({ title: 'تم التحديث', description: 'تم تحديث القياس بنجاح' });
      } else {
        await supabase
          .from('sizes')
          .insert({ ...sizeForm, display_order: sizes.length });
        toast({ title: 'تم الإضافة', description: 'تم إضافة القياس بنجاح' });
      }
      
      setSizeForm({ name: '', type: 'letter' });
      setIsAddingSize(false);
      setEditingSize(null);
      await fetchSizes();
    } catch (error) {
      console.error('خطأ في حفظ القياس:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في حفظ القياس',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (size) => {
    setSizeForm({ name: size.name, type: size.type });
    setEditingSize(size);
    setIsAddingSize(true);
  };

  const handleDelete = async (sizeId) => {
    console.log('🗑️ محاولة حذف القياس:', sizeId);
    
    try {
      // التحقق من استخدام القياس في المنتجات
      const { data: variants, error: checkError } = await supabase
        .from('product_variants')
        .select('id')
        .eq('size_id', sizeId)
        .limit(1);

      console.log('🔍 نتيجة البحث عن متغيرات القياس:', { variants, checkError });

      if (checkError) {
        console.error('❌ خطأ في فحص متغيرات القياس:', checkError);
        throw checkError;
      }

      if (variants && variants.length > 0) {
        console.log('⚠️ القياس مستخدم في منتجات:', variants.length);
        toast({
          title: "لا يمكن الحذف",
          description: "هذا القياس مستخدم في منتجات موجودة",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ القياس غير مستخدم، جاري الحذف...');
      
      const { error } = await supabase.from('sizes').delete().eq('id', sizeId);
      
      if (error) {
        console.error('❌ خطأ في حذف القياس:', error);
        throw error;
      }
      
      console.log('🎉 تم حذف القياس بنجاح');
      
      toast({ title: 'تم الحذف', description: 'تم حذف القياس بنجاح' });
      await fetchSizes();
    } catch (error) {
      console.error('💥 خطأ عام في حذف القياس:', error);
      toast({
        title: 'خطأ',
        description: `فشل في حذف القياس: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const handleCancel = () => {
    setSizeForm({ name: '', type: 'letter' });
    setIsAddingSize(false);
    setEditingSize(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            إدارة القياسات
            <Badge variant="secondary">{sizes.length}</Badge>
          </CardTitle>
          <Button onClick={() => setIsAddingSize(true)} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0">
            <Plus className="h-4 w-4 mr-2" />
            إضافة قياس
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {(isAddingSize || editingSize) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">اسم القياس</Label>
                    <Input
                      id="name"
                      value={sizeForm.name}
                      onChange={(e) => setSizeForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="مثال: L, 42, XL"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">نوع القياس</Label>
                    <Select value={sizeForm.type} onValueChange={(value) => setSizeForm(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="letter">حروف (S, M, L, XL)</SelectItem>
                        <SelectItem value="number">أرقام (38, 40, 42)</SelectItem>
                        <SelectItem value="custom">مخصص</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingSize ? 'تحديث' : 'إضافة'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedSizes.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedSizes.map((size) => (
                <SortableSize
                  key={size.id}
                  size={size}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {sizes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            لا توجد قياسات مضافة بعد
          </div>
        )}
        
      </CardContent>
    </Card>
  );
};

export default SizesManagerNew;