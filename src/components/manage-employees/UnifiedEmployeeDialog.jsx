import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Shield, Package, User, Settings, Eye } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import UnifiedRoleManager from './UnifiedRoleManager';
import ProductPermissionsManager from './ProductPermissionsManager';
import { supabase } from '@/lib/customSupabaseClient';

const UnifiedEmployeeDialog = ({ employee, open, onOpenChange }) => {
  const { refetchAdminData } = useAuth();
  const [status, setStatus] = useState(employee?.status || 'pending');
  const [defaultPage, setDefaultPage] = useState(employee?.default_page || '/');
  const [orderCreationMode, setOrderCreationMode] = useState(employee?.order_creation_mode || 'both');
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  const defaultPages = [
    { value: '/', label: 'لوحة التحكم' },
    { value: '/quick-order', label: 'طلب سريع' },
    { value: '/products', label: 'عرض المنتجات' },
    { value: '/manage-products', label: 'إدارة المنتجات' },
    { value: '/inventory', label: 'الجرد' },
    { value: '/my-orders', label: 'طلباتي' },
    { value: '/purchases', label: 'المشتريات' },
    { value: '/settings', label: 'الإعدادات' },
  ];

  const handleBasicSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          status,
          default_page: defaultPage,
          order_creation_mode: orderCreationMode,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', employee.user_id);

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم تحديث الإعدادات الأساسية بنجاح',
      });

      await refetchAdminData();
    } catch (error) {
      console.error('خطأ في تحديث الإعدادات:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحديث الإعدادات',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    await refetchAdminData();
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-5xl h-[88vh] max-h-[88vh] overflow-hidden flex flex-col p-4 sm:p-6 z-[9999]">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            إدارة الموظف: {employee.full_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="basic" className="flex items-center gap-2 text-sm p-3 min-w-0">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">الإعدادات الأساسية</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2 text-sm p-3 min-w-0">
              <Shield className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">الأدوار والصلاحيات</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2 text-sm p-3 min-w-0">
              <Package className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">صلاحيات المنتجات</span>
            </TabsTrigger>
            <TabsTrigger value="view" className="flex items-center gap-2 text-sm p-3 min-w-0">
              <Eye className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">معاينة النظام</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="basic" className="space-y-6 m-0">
              <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-6 rounded-xl border border-border/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">حالة الحساب</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">✅ نشط</SelectItem>
                        <SelectItem value="pending">⏳ قيد المراجعة</SelectItem>
                        <SelectItem value="suspended">❌ معلق</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultPage" className="text-sm font-medium">الصفحة الافتراضية</Label>
                    <Select value={defaultPage} onValueChange={setDefaultPage}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {defaultPages.map(page => (
                          <SelectItem key={page.value} value={page.value}>
                            {page.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="orderMode" className="text-sm font-medium">نمط إنشاء الطلبات</Label>
                    <Select value={orderCreationMode} onValueChange={setOrderCreationMode}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">كلاهما (عادي + سريع)</SelectItem>
                        <SelectItem value="normal">طلبات عادية فقط</SelectItem>
                        <SelectItem value="quick">طلبات سريعة فقط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleBasicSave} disabled={saving} className="px-6 h-9">
                  {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="roles" className="h-full">
              <UnifiedRoleManager 
                user={employee} 
                onUpdate={handleUpdate}
                onClose={() => {}}
              />
            </TabsContent>

            <TabsContent value="products" className="h-full">
              <ProductPermissionsManager 
                user={employee} 
                onUpdate={handleUpdate}
                onClose={() => {}}
              />
            </TabsContent>

            <TabsContent value="view" className="space-y-4 m-0">
              <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-3 sm:p-4 rounded-lg border border-border/50">
                <h3 className="font-semibold mb-3 flex items-center text-sm sm:text-base">
                  <Eye className="ml-2 h-4 w-4 text-primary" />
                  معلومات الموظف
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">الاسم:</span> 
                    <span>{employee.full_name}</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">البريد:</span> 
                    <span className="truncate">{employee.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">اسم المستخدم:</span> 
                    <span>{employee.username}</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">الحالة:</span> 
                    <Badge variant={status === 'active' ? 'default' : 'secondary'}>
                      {status === 'active' ? 'نشط' : status === 'pending' ? 'قيد المراجعة' : 'معلق'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse sm:col-span-2">
                    <Settings className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">تاريخ الإنشاء:</span> 
                    <span>{new Date(employee.created_at).toLocaleDateString('ar-EG')}</span>
                    <span className="mx-2">|</span>
                    <span className="font-medium">آخر تحديث:</span> 
                    <span>{new Date(employee.updated_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">نصائح للنظام:</h3>
                <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                  <li>يمكن للموظف الواحد أن يحمل عدة أدوار</li>
                  <li>صلاحيات المنتجات تتحكم في أي منتجات يستطيع الموظف رؤيتها</li>
                  <li>الأدوار تحدد الصفحات والوظائف المتاحة</li>
                </ul>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedEmployeeDialog;