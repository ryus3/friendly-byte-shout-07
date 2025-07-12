import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { permissionsMap } from '@/lib/permissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, Trash2, Loader2, Package, Eye, Shirt, Laptop, Watch, Footprints, ShoppingBag } from 'lucide-react';
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

const defaultPages = [
    { value: '/', label: 'لوحة التحكم' },
    { value: '/quick-order', label: 'طلب سريع' },
    { value: '/products', label: 'عرض المنتجات' },
    { value: '/manage-products', label: 'إدارة المنتجات' },
    { value: '/inventory', label: 'الجرد' },
    { value: '/orders', label: 'الطلبات' },
    { value: '/purchases', label: 'المشتريات' },
    { value: '/settings', label: 'الإعدادات' },
    { value: '/my-orders', label: 'طلباتي (خاص بالموظف)' },
    { value: '/my-profits', label: 'أرباحي (خاص بالموظف)' },
];

const EditEmployeeDialog = ({ employee, open, onOpenChange }) => {
  const { updateUser, refetchAdminData } = useAuth();
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [defaultPage, setDefaultPage] = useState('/');
  const [orderCreationMode, setOrderCreationMode] = useState('choice');
  const [categoryPermissions, setCategoryPermissions] = useState([]);
  const [detailedCategoryPermissions, setDetailedCategoryPermissions] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setStatus(employee.status || 'pending');
      setRole(employee.role || 'employee');
      setPermissions(employee.permissions || []);
      setDefaultPage(employee.default_page || '/');
      setOrderCreationMode(employee.order_creation_mode || 'choice');
      setCategoryPermissions(employee.category_permissions || []);
      setDetailedCategoryPermissions(employee.detailed_category_permissions || {});
    }
  }, [employee]);

  if (!employee) return null;

  const handlePermissionChange = (permissionId, checked) => {
    setPermissions(prev => 
      checked ? [...prev, permissionId] : prev.filter(p => p !== permissionId)
    );
  };

  const handleCategoryPermissionChange = (category, checked) => {
    setCategoryPermissions(prev => 
      checked ? [...prev, category] : prev.filter(c => c !== category)
    );
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const finalPermissions = (role === 'admin' || role === 'deputy') ? ['*'] : permissions;
    const finalCategoryPermissions = (role === 'admin' || role === 'deputy') ? ['all'] : categoryPermissions;
    await updateUser(employee.id, { 
        status, 
        role, 
        permissions: finalPermissions, 
        default_page: defaultPage,
        order_creation_mode: orderCreationMode,
        category_permissions: finalCategoryPermissions
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={role} onValueChange={(value) => {
                setRole(value);
                if (value === 'admin' || value === 'deputy') setPermissions(['*']);
                else if (role === 'admin' || role === 'deputy') setPermissions([]);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="deputy">نائب مدير</SelectItem>
                  <SelectItem value="employee">موظف</SelectItem>
                  <SelectItem value="warehouse">مخزن</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الصفحة الافتراضية</Label>
              <Select value={defaultPage} onValueChange={setDefaultPage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {defaultPages.map(page => (
                      <SelectItem key={page.value} value={page.value}>{page.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Package /> نمط إنشاء الطلب</Label>
              <Select value={orderCreationMode} onValueChange={setOrderCreationMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="choice">السماح بالاختيار</SelectItem>
                  <SelectItem value="local_only">إجباري محلي</SelectItem>
                  <SelectItem value="partner_only">إجباري شركة توصيل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label className="flex items-center gap-2 mb-2"><Shield /> الصلاحيات</Label>
            <Accordion type="multiple" className="w-full" defaultValue={permissionsMap.map(p => p.category)} disabled={role === 'admin' || role === 'deputy'}>
              {permissionsMap.map(category => (
                <AccordionItem value={category.category} key={category.category}>
                  <AccordionTrigger>{category.categoryLabel}</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-4 p-4">
                      {category.permissions.map(permission => (
                        <div key={permission.id} className="flex items-center space-x-2 space-x-reverse">
                          <Checkbox
                            id={`perm-${employee.id}-${permission.id}`}
                            checked={permissions.includes('*') || permissions.includes(permission.id)}
                            onCheckedChange={(checked) => handlePermissionChange(permission.id, checked)}
                            disabled={role === 'admin' || role === 'deputy'}
                          />
                          <label htmlFor={`perm-${employee.id}-${permission.id}`} className="text-sm font-medium cursor-pointer">
                            {permission.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* صلاحيات التصنيفات والمتغيرات */}
          <div>
            <Label className="flex items-center gap-2 mb-2"><Eye /> صلاحيات التصنيفات والمتغيرات</Label>
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id={`cat-all-${employee.id}`}
                    checked={categoryPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                    onCheckedChange={(checked) => handleCategoryPermissionChange('all', checked)}
                    disabled={role === 'admin' || role === 'deputy'}
                  />
                  <label htmlFor={`cat-all-${employee.id}`} className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    عرض جميع التصنيفات والمتغيرات
                  </label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCategoryPermissions(['all'])}
                  disabled={role === 'admin' || role === 'deputy'}
                >
                  تحديد الكل
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm">التصنيفات الرئيسية:</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'mens_clothing', label: 'ملابس رجالية', icon: Shirt },
                    { id: 'womens_clothing', label: 'ملابس نسائية', icon: Shirt },
                    { id: 'electronics', label: 'إلكترونيات', icon: Laptop },
                    { id: 'accessories', label: 'اكسسوارات', icon: Watch },
                    { id: 'shoes', label: 'أحذية', icon: Footprints },
                    { id: 'bags', label: 'حقائب', icon: ShoppingBag }
                  ].map(category => {
                    const IconComponent = category.icon;
                    return (
                      <div key={category.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded">
                        <Checkbox
                          id={`cat-${category.id}-${employee.id}`}
                          checked={categoryPermissions.includes(category.id) || categoryPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                          onCheckedChange={(checked) => handleCategoryPermissionChange(category.id, checked)}
                          disabled={role === 'admin' || role === 'deputy' || categoryPermissions.includes('all')}
                        />
                        <label htmlFor={`cat-${category.id}-${employee.id}`} className="text-sm font-medium cursor-pointer flex items-center gap-2">
                          <IconComponent className="w-4 h-4" />
                          {category.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm">المتغيرات الفرعية:</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    'صيفي', 'شتوي', 'ربيعي', 'خريفي',
                    'قطني', 'حريري', 'جلدي', 'صوفي',
                    'صغير', 'متوسط', 'كبير', 'كبير جداً'
                  ].map(variant => (
                    <div key={variant} className="flex items-center space-x-2 space-x-reverse p-1">
                      <Checkbox
                        id={`variant-${variant}-${employee.id}`}
                        checked={categoryPermissions.includes('all') || role === 'admin' || role === 'deputy'}
                        disabled={true}
                      />
                      <label className="text-xs text-muted-foreground">{variant}</label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  * المتغيرات الفرعية تتبع صلاحيات التصنيفات الرئيسية
                </p>
              </div>
            </div>
          </div>
          
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