import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import Loader from '@/components/ui/loader';
import { Plus, Pencil, Trash2, Package, Shirt, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AddEditDepartmentDialog from './AddEditDepartmentDialog';

const DepartmentsManager = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);

  const iconMap = {
    'Package': Package,
    'Shirt': Shirt,
    'ShoppingBag': ShoppingBag
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      toast({ 
        title: "خطأ", 
        description: "فشل في تحميل الأقسام", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleAdd = () => {
    setEditingDepartment(null);
    setDialogOpen(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      await fetchDepartments();
      toast({ title: "نجاح", description: "تم حذف القسم بنجاح" });
    } catch (error) {
      toast({ 
        title: "خطأ", 
        description: "فشل في حذف القسم", 
        variant: "destructive" 
      });
    }
  };

  const onDepartmentSaved = () => {
    fetchDepartments();
    setDialogOpen(false);
  };

  if (loading) return <Loader />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">إدارة الأقسام الرئيسية</h3>
        <Button onClick={handleAdd} size="sm">
          <Plus className="w-4 h-4 ml-2" />
          إضافة قسم
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => {
          const IconComponent = iconMap[dept.icon] || Package;
          return (
            <Card key={dept.id} className="relative group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${dept.color}`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{dept.name}</CardTitle>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(dept)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{dept.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddEditDepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={editingDepartment}
        onSave={onDepartmentSaved}
      />
    </div>
  );
};

export default DepartmentsManager;