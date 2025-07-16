import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Trash2, Loader2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import EmployeePermissionsForm from './EmployeePermissionsForm';

const EditEmployeeDialog = ({ employee, open, onOpenChange }) => {
  const { updateUser, refetchAdminData } = useAuth();
  const [status, setStatus] = useState('');
  const [permissionsData, setPermissionsData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setStatus(employee.status || 'pending');
    }
  }, [employee]);

  if (!employee) return null;

  const handlePermissionsUpdate = (data) => {
    setPermissionsData(data);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    await updateUser(employee.id, { 
        status, 
        ...permissionsData
    });
    await refetchAdminData();
    setIsSaving(false);
    onOpenChange(false);
  };

  const handleDisableUser = async () => {
    setIsSaving(true);
    await updateUser(employee.id, { status: 'suspended' });
    await refetchAdminData();
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>تعديل الموظف: {employee.full_name}</DialogTitle>
          <DialogDescription>تغيير حالة الحساب، الدور، والصلاحيات.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label>حالة الحساب</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="suspended">معلق</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <EmployeePermissionsForm 
            employee={employee} 
            onUpdate={handlePermissionsUpdate}
          />
          
          <div className="space-y-2">
            <Label className="text-destructive">منطقة الخطر</Label>
            <Alert variant="destructive">
              <AlertTitle>تعطيل الحساب</AlertTitle>
              <AlertDescription className="flex justify-between items-center">
                <p>سيؤدي هذا إلى منع الموظف من تسجيل الدخول. يمكن إعادة تفعيله لاحقًا.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 ml-2" /> تعطيل الحساب
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>هل أنت متأكد تماماً؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم تعطيل حساب الموظف {employee.full_name} ومنعه من الوصول للنظام.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisableUser} className="bg-destructive hover:bg-destructive/90">
                        نعم، قم بالتعطيل
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </AlertDescription>
            </Alert>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditEmployeeDialog;