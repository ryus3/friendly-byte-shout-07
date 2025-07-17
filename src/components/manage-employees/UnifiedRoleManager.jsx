import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Shield, 
  Crown, 
  Building2, 
  Briefcase, 
  Package, 
  CreditCard, 
  Truck,
  Users,
  Settings,
  Star,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const UnifiedRoleManager = ({ user: selectedUser, onClose, onUpdate, open, onOpenChange }) => {
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // جلب الأدوار المتاحة
        const { data: roles, error: rolesError } = await supabase
          .from('roles')
          .select('*')
          .eq('is_active', true)
          .order('hierarchy_level', { ascending: true });

        if (rolesError) throw rolesError;

        setAvailableRoles(roles || []);
      } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ في جلب البيانات',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  // دالة للحصول على لون الدور
  const getRoleColor = (roleName) => {
    switch(roleName) {
      case 'super_admin':
        return 'from-purple-500 to-pink-500';
      case 'department_manager':
        return 'from-blue-500 to-indigo-500';
      case 'sales_employee':
        return 'from-green-500 to-emerald-500';
      case 'warehouse_employee':
        return 'from-orange-500 to-amber-500';
      case 'cashier':
        return 'from-teal-500 to-cyan-500';
      case 'delivery_coordinator':
        return 'from-red-500 to-rose-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  // دالة للحصول على أيقونة الدور
  const getRoleIcon = (roleName) => {
    switch(roleName) {
      case 'super_admin': return Crown;
      case 'department_manager': return Building2;
      case 'sales_employee': return Briefcase;
      case 'warehouse_employee': return Package;
      case 'cashier': return CreditCard;
      case 'delivery_coordinator': return Truck;
      default: return Shield;
    }
  };

  // دالة للحصول على وصف الصلاحيات
  const getRolePermissions = (roleName) => {
    switch(roleName) {
      case 'super_admin':
        return [
          'إدارة جميع أجزاء النظام',
          'إضافة وحذف الموظفين',
          'الوصول لجميع التقارير المالية',
          'إدارة الإعدادات العامة',
          'صلاحيات كاملة على البيانات'
        ];
      case 'department_manager':
        return [
          'إدارة قسمه وموظفيه',
          'مراجعة الطلبات والمبيعات',
          'تقارير القسم المالية',
          'إدارة صلاحيات الموظفين',
          'متابعة أداء الفريق'
        ];
      case 'sales_employee':
        return [
          'إنشاء وإدارة الطلبات',
          'عرض المنتجات والعملاء',
          'متابعة أرباحه الشخصية',
          'استخدام نظام الطلب السريع',
          'إدارة علاقات العملاء'
        ];
      case 'warehouse_employee':
        return [
          'إدارة المخزون والجرد',
          'استقبال البضائع الجديدة',
          'تحديث كميات المنتجات',
          'استخدام ماسح الباركود',
          'تقارير حركة المخزون'
        ];
      case 'cashier':
        return [
          'معالجة المدفوعات',
          'إصدار الفواتير',
          'إدارة الصندوق اليومي',
          'تسجيل المعاملات المالية',
          'إنشاء تقارير المبيعات'
        ];
      case 'delivery_coordinator':
        return [
          'تنسيق عمليات التوصيل',
          'متابعة شركات الشحن',
          'تحديث حالة الطلبات',
          'إدارة جداول التوصيل',
          'تتبع الشحنات'
        ];
      default:
        return ['صلاحيات محدودة'];
    }
  };

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            نظام الأدوار والصلاحيات
            {selectedUser && (
              <Badge variant="outline" className="ml-2">
                {selectedUser.full_name || selectedUser.username}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            إدارة أدوار المستخدمين وتعيين الصلاحيات. كل دور له مجموعة محددة من الصلاحيات التي تحكم ما يمكن للمستخدم الوصول إليه في النظام.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <span className="ml-3 text-lg">جاري تحميل الأدوار...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {/* الأدوار المتاحة */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold">الأدوار المتاحة في النظام</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {availableRoles.length} دور متاح
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {availableRoles.map((role) => {
                    const IconComponent = getRoleIcon(role.name);
                    const permissions = getRolePermissions(role.name);
                    
                    return (
                      <div 
                        key={role.id}
                        className="group relative"
                      >
                        {/* الخلفية المضيئة */}
                        <div className={`absolute -inset-0.5 bg-gradient-to-r ${getRoleColor(role.name)} rounded-2xl opacity-20 group-hover:opacity-30 blur transition duration-300`}></div>
                        
                        <div className="relative bg-card border border-border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                          {/* رأس البطاقة */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-3 bg-gradient-to-r ${getRoleColor(role.name)} rounded-xl text-white shadow-lg`}>
                                <IconComponent className="h-6 w-6" />
                              </div>
                              <div>
                                <h4 className="font-bold text-lg text-foreground">
                                  {role.display_name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {role.name}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant="outline" className="text-xs">
                                مستوى {role.hierarchy_level}
                              </Badge>
                              {role.hierarchy_level === 1 && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-yellow-500" />
                                  <span className="text-xs text-yellow-600">أعلى مستوى</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* وصف الدور */}
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            {role.description}
                          </p>

                          {/* الصلاحيات */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">الصلاحيات الرئيسية:</span>
                            </div>
                            
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {permissions.map((permission, index) => (
                                <div key={index} className="flex items-start gap-2 text-xs">
                                  <div className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                                  <span className="text-muted-foreground leading-relaxed">
                                    {permission}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* شريط التدرج السفلي */}
                          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${getRoleColor(role.name)} rounded-b-2xl`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* نصائح مهمة */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <h4 className="font-bold text-blue-900 dark:text-blue-100 text-lg">
                      💡 نصائح مهمة لإدارة الأدوار والصلاحيات
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800 dark:text-blue-200">
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                          <span>يمكن للمستخدم الواحد أن يحمل عدة أدوار معاً</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                          <span>الصلاحيات تُجمع من جميع الأدوار المعيّنة للمستخدم</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                          <span>الأدوار ذات المستوى الأعلى لها صلاحيات أوسع</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <Settings className="h-4 w-4 mt-0.5 text-blue-600" />
                          <span>تأكد من تعيين الدور المناسب لكل موظف حسب مهامه</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Settings className="h-4 w-4 mt-0.5 text-blue-600" />
                          <span>راجع الصلاحيات بانتظام لضمان أمان النظام</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Settings className="h-4 w-4 mt-0.5 text-blue-600" />
                          <span>استخدم مبدأ "أقل صلاحية ضرورية" لكل موظف</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 text-center">
                  <Crown className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <div className="text-lg font-bold text-purple-600">1</div>
                  <div className="text-xs text-muted-foreground">مدير عام</div>
                </div>
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl p-4 text-center">
                  <Building2 className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <div className="text-lg font-bold text-blue-600">0</div>
                  <div className="text-xs text-muted-foreground">مدير قسم</div>
                </div>
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 text-center">
                  <Briefcase className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <div className="text-lg font-bold text-green-600">1</div>
                  <div className="text-xs text-muted-foreground">موظف مبيعات</div>
                </div>
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl p-4 text-center">
                  <Users className="h-8 w-8 mx-auto text-orange-600 mb-2" />
                  <div className="text-lg font-bold text-orange-600">2</div>
                  <div className="text-xs text-muted-foreground">إجمالي المستخدمين</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-6 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              آخر تحديث: {new Date().toLocaleDateString('ar-SA')}
            </div>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="px-8"
            >
              إغلاق
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedRoleManager;