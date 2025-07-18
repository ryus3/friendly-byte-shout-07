import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/UnifiedAuthContext';
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
      <DialogContent className="max-w-4xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl">
            إدارة الموظف: {employee.full_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          {/* تحسين الـ tabs للهاتف */}
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto flex-shrink-0 mb-4">
            <TabsTrigger value="basic" className="flex flex-col lg:flex-row items-center gap-1 lg:gap-2 text-xs lg:text-sm p-2 lg:p-3">
              <User className="h-4 w-4" />
              <span className="hidden sm:block">الإعدادات الأساسية</span>
              <span className="sm:hidden">الأساسية</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex flex-col lg:flex-row items-center gap-1 lg:gap-2 text-xs lg:text-sm p-2 lg:p-3">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:block">الأدوار والصلاحيات</span>
              <span className="sm:hidden">الأدوار</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex flex-col lg:flex-row items-center gap-1 lg:gap-2 text-xs lg:text-sm p-2 lg:p-3">
              <Package className="h-4 w-4" />
              <span className="hidden sm:block">صلاحيات المنتجات</span>
              <span className="sm:hidden">المنتجات</span>
            </TabsTrigger>
            <TabsTrigger value="view" className="flex flex-col lg:flex-row items-center gap-1 lg:gap-2 text-xs lg:text-sm p-2 lg:p-3">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:block">معاينة النظام</span>
              <span className="sm:hidden">معاينة</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="basic" className="space-y-6 mt-0">
              <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-4 rounded-xl border border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">حالة الحساب</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="h-10">
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
                      <SelectTrigger className="h-10">
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

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="orderMode" className="text-sm font-medium">نمط إنشاء الطلبات</Label>
                    <Select value={orderCreationMode} onValueChange={setOrderCreationMode}>
                      <SelectTrigger className="h-10">
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
                <Button onClick={handleBasicSave} disabled={saving} className="px-8">
                  {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات الأساسية'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="roles" className="h-full mt-0">
              <UnifiedRoleManager 
                user={employee} 
                onUpdate={handleUpdate}
                onClose={() => setIsEditModalOpen(false)}
                open={activeTab === 'roles'}
                onOpenChange={() => {}}
              />
            </TabsContent>

            <TabsContent value="products" className="h-full mt-0">
              <ProductPermissionsManager 
                user={employee} 
                onUpdate={handleUpdate}
                onClose={() => {}}
              />
            </TabsContent>

            <TabsContent value="view" className="space-y-4 mt-0">
              <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-6 rounded-xl border border-border/50">
                <h3 className="font-semibold mb-4 flex items-center">
                  <Eye className="ml-2 h-5 w-5 text-primary" />
                  معلومات الموظف
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                  <div className="flex items-center space-x-2 space-x-reverse md:col-span-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">تاريخ الإنشاء:</span> 
                    <span>{new Date(employee.created_at).toLocaleDateString('ar-EG')}</span>
                    <span className="mx-2">|</span>
                    <span className="font-medium">آخر تحديث:</span> 
                    <span>{new Date(employee.updated_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">نصائح للنظام الجديد:</h3>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>يمكن للموظف الواحد أن يحمل عدة أدوار</li>
                  <li>صلاحيات المنتجات المتقدمة تتحكم في أي منتجات يستطيع الموظف رؤيتها</li>
                  <li>الأدوار تحدد الصفحات والوظائف المتاحة</li>
                  <li>يُنصح بعدم حذف الحسابات القديمة - فقط قم بتعيين الأدوار الجديدة</li>
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