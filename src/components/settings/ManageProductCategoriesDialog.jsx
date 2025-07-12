import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { ShoppingBag, Shirt, Smartphone, Watch, Footprints, Briefcase } from 'lucide-react';

const categoryIcons = {
  clothes: Shirt,
  electronics: Smartphone,
  accessories: Watch,
  shoes: Footprints,
  bags: Briefcase,
  all: ShoppingBag
};

const categoryLabels = {
  clothes: 'الملابس',
  electronics: 'الإلكترونيات',
  accessories: 'الاكسسوارات',
  shoes: 'الأحذية',
  bags: 'الحقائب',
  all: 'جميع التصنيفات'
};

const ManageProductCategoriesDialog = ({ open, onOpenChange }) => {
  const { allUsers, updateUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState('');
  const [userCategories, setUserCategories] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleUserSelect = (userId) => {
    setSelectedUser(userId);
    const user = allUsers.find(u => u.id === userId);
    if (user && user.permissions) {
      const categories = {};
      Object.keys(categoryLabels).forEach(category => {
        categories[category] = user.permissions.includes(`view_category_${category}`);
      });
      setUserCategories(categories);
    } else {
      setUserCategories({});
    }
  };

  const handleCategoryChange = (category, checked) => {
    setUserCategories(prev => ({
      ...prev,
      [category]: checked
    }));
  };

  const handleSave = async () => {
    if (!selectedUser) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار موظف أولاً",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const user = allUsers.find(u => u.id === selectedUser);
      const currentPermissions = user.permissions || [];
      
      // إزالة جميع صلاحيات التصنيفات الحالية
      const filteredPermissions = currentPermissions.filter(p => 
        !p.startsWith('view_category_')
      );

      // إضافة الصلاحيات الجديدة
      const newCategoryPermissions = Object.entries(userCategories)
        .filter(([_, checked]) => checked)
        .map(([category, _]) => `view_category_${category}`);

      const updatedPermissions = [...filteredPermissions, ...newCategoryPermissions];

      await updateUser(selectedUser, { permissions: updatedPermissions });

      toast({
        title: "تم بنجاح",
        description: "تم تحديث صلاحيات التصنيفات بنجاح"
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating category permissions:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التحديث",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedUserData = allUsers.find(u => u.id === selectedUser);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إدارة صلاحيات تصنيفات المنتجات</DialogTitle>
          <DialogDescription>
            يمكنك تحديد التصنيفات التي يمكن لكل موظف عرضها
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* اختيار الموظف */}
          <div className="space-y-2">
            <Label>اختر الموظف</Label>
            <Select value={selectedUser} onValueChange={handleUserSelect}>
              <SelectTrigger>
                <SelectValue placeholder="اختر موظف..." />
              </SelectTrigger>
              <SelectContent>
                {allUsers?.filter(user => user.role !== 'admin').map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} - {user.role === 'employee' ? 'موظف' : 'مخزن'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && selectedUserData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  صلاحيات التصنيفات للموظف: {selectedUserData.full_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(categoryLabels).map(([category, label]) => {
                    const Icon = categoryIcons[category];
                    return (
                      <div key={category} className="flex items-center space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id={`category-${category}`}
                          checked={userCategories[category] || false}
                          onCheckedChange={(checked) => handleCategoryChange(category, checked)}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <Icon className="w-4 h-4 text-primary" />
                          <Label 
                            htmlFor={`category-${category}`}
                            className="cursor-pointer flex-1"
                          >
                            {label}
                          </Label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ملخص الصلاحيات الحالية */}
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">الصلاحيات المحددة:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(userCategories)
                      .filter(([_, checked]) => checked)
                      .map(([category, _]) => (
                        <Badge key={category} variant="secondary">
                          {categoryLabels[category]}
                        </Badge>
                      ))}
                    {Object.values(userCategories).every(v => !v) && (
                      <Badge variant="destructive">لا توجد صلاحيات محددة</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* أزرار الحفظ والإلغاء */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={isLoading || !selectedUser}>
              {isLoading ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageProductCategoriesDialog;