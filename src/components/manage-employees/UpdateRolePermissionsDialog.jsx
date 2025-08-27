import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { permissionsMap } from '@/lib/permissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Shield } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const UpdateRolePermissionsDialog = ({ open, onOpenChange }) => {
  const { updatePermissionsByRole } = useAuth();
  const [role, setRole] = useState('employee');
  const [permissions, setPermissions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPermissions([]);
  }, [role]);

  const handlePermissionChange = (permissionId, checked) => {
    setPermissions(prev => 
      checked ? [...prev, permissionId] : prev.filter(p => p !== permissionId)
    );
  };

  const handleSelectAllCategory = (categoryPermissions, checked) => {
    const categoryPermissionIds = categoryPermissions.map(p => p.id);
    setPermissions(prev => {
      const otherPermissions = prev.filter(p => !categoryPermissionIds.includes(p));
      return checked ? [...otherPermissions, ...categoryPermissionIds] : otherPermissions;
    });
  };

  const handleSaveChanges = async () => {
    if (permissions.length === 0) {
      toast({
        title: "خطأ",
        description: "الرجاء تحديد صلاحية واحدة على الأقل.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    await updatePermissionsByRole(role, permissions);
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>تحديث صلاحيات جماعي</DialogTitle>
          <DialogDescription>
            تطبيق نفس الصلاحيات على جميع المستخدمين الذين لديهم الدور المحدد. هذا الإجراء لا رجعة فيه.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label>الدور المستهدف</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deputy">نائب مدير</SelectItem>
                <SelectItem value="employee">موظف</SelectItem>
                <SelectItem value="warehouse">مخزن</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">لا يمكن تعديل صلاحيات دور "مدير" بشكل جماعي.</p>
          </div>
          
          <div>
            <Label className="flex items-center gap-2 mb-2"><Shield /> الصلاحيات الجديدة</Label>
            <Accordion type="multiple" className="w-full"  defaultValue={["pages"]}>
              {permissionsMap.map(category => {
                const categoryPermissionIds = category.permissions.map(p => p.id);
                const allSelected = categoryPermissionIds.every(p => permissions.includes(p));
                const someSelected = categoryPermissionIds.some(p => permissions.includes(p));

                return (
                  <AccordionItem value={category.category} key={category.category}>
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full">
                        <span>{category.categoryLabel}</span>
                        <div className="flex items-center gap-2 mr-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => handleSelectAllCategory(category.permissions, checked)}
                            aria-label={`Select all ${category.categoryLabel}`}
                          />
                          <Label className="text-xs">الكل</Label>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-4 p-4">
                        {category.permissions.map(permission => (
                          <div key={permission.id} className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                              id={`bulk-perm-${permission.id}`}
                              checked={permissions.includes(permission.id)}
                              onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                            />
                            <label htmlFor={`bulk-perm-${permission.id}`} className="text-sm font-medium cursor-pointer">
                              {permission.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            حفظ وتطبيق على الجميع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateRolePermissionsDialog;