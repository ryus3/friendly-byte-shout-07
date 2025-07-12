import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Package, Shirt, ShoppingBag, Settings } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import AddEditDepartmentDialog from './AddEditDepartmentDialog';

const DepartmentsManager = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const { toast } = useToast();

  // أيقونات الأقسام المتاحة
  const iconOptions = {
    'Shirt': Shirt,
    'ShoppingBag': ShoppingBag,
    'Package': Package,
    'Settings': Settings
  };

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الأقسام",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف القسم بنجاح",
      });
      
      fetchDepartments();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حذف القسم",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingDepartment(null);
    fetchDepartments();
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
          <h2 className="text-2xl font-bold text-foreground">إدارة الأقسام الرئيسية</h2>
          <p className="text-muted-foreground">إضافة وتعديل وحذف الأقسام الرئيسية للمنتجات</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة قسم جديد
        </Button>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => {
          const IconComponent = iconOptions[dept.icon] || Package;
          
          return (
            <Card key={dept.id} className="group hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${dept.color} shadow-lg`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">{dept.name}</CardTitle>
                      <CardDescription className="text-sm">{dept.description}</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(dept)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(dept.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">حالة القسم:</span>
                    <Badge variant={dept.is_active ? "default" : "secondary"}>
                      {dept.is_active ? "نشط" : "غير نشط"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ترتيب العرض:</span>
                    <Badge variant="outline">{dept.display_order}</Badge>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      تم الإنشاء: {new Date(dept.created_at).toLocaleDateString('en-US')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {departments.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">لا توجد أقسام</h3>
          <p className="text-muted-foreground mb-4">ابدأ بإضافة أول قسم رئيسي</p>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة قسم جديد
          </Button>
        </div>
      )}

      {/* Dialog */}
      <AddEditDepartmentDialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        department={editingDepartment}
      />
    </div>
  );
};

export default DepartmentsManager;