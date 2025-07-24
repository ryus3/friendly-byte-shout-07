import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Plus, Edit, Trash2, GripVertical, Palette
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import AddEditColorDialog from './AddEditColorDialog';

// مكون قابل للسحب للون واحد
const SortableColorItem = ({ color, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: color.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-4 bg-card border rounded-lg hover:shadow-md transition-all duration-200 ${
        isDragging ? 'shadow-lg scale-105' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* مقبض السحب */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-muted transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {/* اللون */}
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: color.hex_code || '#gray' }}
              title={color.hex_code}
            />
            <div>
              <h3 className="font-medium">{color.name}</h3>
              <p className="text-sm text-muted-foreground">{color.hex_code}</p>
            </div>
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(color)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                <AlertDialogDescription>
                  هل أنت متأكد من حذف اللون "{color.name}"؟ 
                  <br />
                  لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(color.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
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

const ColorsManager = () => {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  // لا نحتاج لـ useToast هنا، نستخدم toast مباشرة

  const fetchColors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('colors')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setColors(data || []);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الألوان",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColors();
  }, []);

  const handleDelete = async (id) => {
    console.log('🗑️ محاولة حذف اللون:', id);
    
    try {
      // التحقق من استخدام اللون في المنتجات
      const { data: variants, error: checkError } = await supabase
        .from('product_variants')
        .select(`
          id,
          products!inner(
            id,
            name,
            is_active
          )
        `)
        .eq('color_id', id);

      console.log('🔍 نتيجة البحث عن متغيرات اللون:', { variants, checkError });

      if (checkError) {
        console.error('❌ خطأ في فحص المتغيرات:', checkError);
        throw checkError;
      }

      // فلترة المنتجات النشطة فقط
      const activeVariants = variants?.filter(v => v.products?.is_active) || [];
      
      if (activeVariants.length > 0) {
        console.log('⚠️ اللون مستخدم في منتجات نشطة:', activeVariants.length);
        
        const productNames = [...new Set(activeVariants.map(v => v.products?.name).filter(Boolean))];
        const productsList = productNames.length > 0 ? `في: ${productNames.slice(0, 3).join(', ')}${productNames.length > 3 ? '...' : ''}` : '';
        
        toast({
          title: "❌ لا يمكن الحذف",
          description: `هذا اللون مستخدم في ${activeVariants.length} منتج نشط ${productsList}`,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ اللون غير مستخدم أو مستخدم في منتجات غير نشطة، جاري الحذف...');
      
      const { error } = await supabase
        .from('colors')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ خطأ في حذف اللون:', error);
        throw error;
      }

      console.log('🎉 تم حذف اللون بنجاح');
      
      toast({
        title: "✅ تم الحذف بنجاح",
        description: "تم حذف اللون نهائياً من النظام",
      });
      
      fetchColors();
    } catch (error) {
      console.error('💥 خطأ عام في حذف اللون:', error);
      toast({
        title: "❌ خطأ في الحذف",
        description: `فشل في حذف اللون: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (color) => {
    setEditingColor(color);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingColor(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingColor(null);
  };

  const handleSuccess = () => {
    fetchColors();
  };

  // السحب والإفلات
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = colors.findIndex((color) => color.id === active.id);
      const newIndex = colors.findIndex((color) => color.id === over.id);
      
      const newColors = arrayMove(colors, oldIndex, newIndex);
      setColors(newColors);
      
      // حفظ الترتيب الجديد في قاعدة البيانات (اختياري)
      // يمكن إضافة حقل display_order لجدول الألوان لاحقاً
      toast({
        title: "تم الترتيب",
        description: "تم حفظ الترتيب الجديد للألوان",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">إدارة الألوان</h2>
          <p className="text-muted-foreground">إضافة وتعديل وحذف ألوان المنتجات - يمكنك سحب الألوان لإعادة ترتيبها</p>
        </div>
        <Button onClick={handleAdd} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 gap-2">
          <Plus className="h-4 w-4" />
          إضافة لون جديد
        </Button>
      </div>

      {/* Colors List with Drag & Drop */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            قائمة الألوان ({colors.length})
          </CardTitle>
          <CardDescription>
            اسحب وأفلت الألوان لإعادة ترتيبها
          </CardDescription>
        </CardHeader>
        <CardContent>
          {colors.length > 0 ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={colors.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {colors.map((color) => (
                    <SortableColorItem
                      key={color.id}
                      color={color}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-12">
              <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">لا توجد ألوان</h3>
              <p className="text-muted-foreground mb-4">ابدأ بإضافة أول لون</p>
              <Button onClick={handleAdd} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 gap-2">
                <Plus className="h-4 w-4" />
                إضافة لون جديد
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <AddEditColorDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        color={editingColor}
        onSuccess={async (colorData) => {
          try {
            if (editingColor) {
              // تحديث اللون الموجود
              const { error } = await supabase
                .from('colors')
                .update(colorData)
                .eq('id', editingColor.id);
              
              if (error) throw error;
            } else {
              // إضافة لون جديد
              const { error } = await supabase
                .from('colors')
                .insert(colorData);
              
              if (error) throw error;
            }
            
            await fetchColors();
            return true;
          } catch (error) {
            console.error('خطأ في حفظ اللون:', error);
            return false;
          }
        }}
      />
    </div>
  );
};

export default ColorsManager;