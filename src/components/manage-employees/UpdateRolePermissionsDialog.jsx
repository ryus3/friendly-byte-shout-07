import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
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
      <DialogContent className="w-[92vw] max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            تحديث صلاحيات جماعي
          </DialogTitle>
          <DialogDescription className="text-base">
            تطبيق نفس الصلاحيات على جميع المستخدمين الذين لديهم الدور المحدد.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3 flex-1 overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">الدور المستهدف</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9">
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
            <Label className="flex items-center gap-2 mb-2 text-sm font-medium"><Shield className="h-4 w-4" /> الصلاحيات الجديدة</Label>
            <Accordion type="multiple" className="w-full" defaultValue={["pages"]}>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                        {category.permissions.map(permission => (
                          <div key={permission.id} className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                              id={`bulk-perm-${permission.id}`}
                              checked={permissions.includes(permission.id)}
                              onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                            />
                            <label htmlFor={`bulk-perm-${permission.id}`} className="text-xs sm:text-sm font-medium cursor-pointer">
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
        <DialogFooter className="pt-3 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9">
            إلغاء
          </Button>
          <Button onClick={handleSaveChanges} disabled={isSaving} className="h-9">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ وتطبيق'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateRolePermissionsDialog;