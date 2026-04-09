import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  AlertCircle,
  X
} from 'lucide-react';

const UnifiedRoleManager = ({ user: selectedUser, onClose, onUpdate, open, onOpenChange, maxAllowedLevel }) => {
  const [availableRoles, setAvailableRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // جلب البيانات
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

      // فلترة الأدوار حسب مستوى المتصل - مدير القسم لا يرى أدوار أعلى منه
      const filteredRoles = maxAllowedLevel 
        ? (roles || []).filter(r => r.hierarchy_level >= maxAllowedLevel)
        : (roles || []);
      setAvailableRoles(filteredRoles);

      // جلب أدوار المستخدم الحالية
      if (selectedUser) {
        const { data: currentUserRoles, error: userRolesError } = await supabase
          .from('user_roles')
          .select(`
            *,
            roles(*)
          `)
          .eq('user_id', selectedUser.user_id)
          .eq('is_active', true);

        if (userRolesError) throw userRolesError;
        setUserRoles(currentUserRoles || []);
      }
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

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, selectedUser]);

  // دالة للحصول على وصف الدور
  const getRoleDescription = (roleName) => {
    switch(roleName) {
      case 'super_admin':
        return 'صلاحيات كاملة في النظام - إدارة جميع الموظفين والأقسام والمنتجات والطلبات والمالية';
      case 'department_manager':
        return 'إدارة قسم معين - الإشراف على الموظفين والمنتجات ومراجعة الطلبات والأرباح';
      case 'sales_employee':
        return 'موظف مبيعات - إنشاء الطلبات وإدارة العملاء وعرض المنتجات المسموحة';
      case 'warehouse_employee':
        return 'موظف مخزن - إدارة المخزون والجرد وتحديث كميات المنتجات';
      case 'cashier':
        return 'كاشير - معالجة المدفوعات وإصدار الفواتير ومتابعة حالة الطلبات';
      case 'delivery_coordinator':
        return 'منسق توصيل - تنسيق عمليات التوصيل ومتابعة شركات الشحن وتحديث حالة التسليم';
      default:
        return 'دور في النظام مع صلاحيات محددة';
    }
  };

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

  // دالة تعيين دور جديد
  const handleAssignRole = async (roleId) => {
    try {
      setIsProcessing(true);
      
      // أولاً تحقق من وجود دور غير نشط وقم بتفعيله
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', selectedUser.user_id)
        .eq('role_id', roleId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRole) {
        // إذا كان الدور موجود، قم بتفعيله
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ is_active: true })
          .eq('id', existingRole.id);

        if (updateError) throw updateError;
      } else {
        // إذا لم يكن موجود، أنشئ دور جديد
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: selectedUser.user_id,
            role_id: roleId,
            assigned_by: (await supabase.auth.getUser()).data.user?.id,
            is_active: true
          });

        if (insertError) throw insertError;
      }

      toast({
        title: 'نجح',
        description: 'تم تعيين الدور بنجاح',
      });

      // إعادة جلب البيانات
      fetchData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('خطأ في تعيين الدور:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تعيين الدور',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // دالة إزالة دور
  const handleRemoveRole = async (userRoleId) => {
    try {
      setIsProcessing(true);
      
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('id', userRoleId);

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم إزالة الدور بنجاح',
      });

      // إعادة جلب البيانات
      fetchData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('خطأ في إزالة الدور:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في إزالة الدور',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3">جاري التحميل...</span>
        </div>
      ) : (
        <>
          {/* أدوار المستخدم الحالية */}
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-bold">الأدوار الحالية</h3>
                <Badge variant="secondary">
                  {userRoles.length} دور
                </Badge>
              </div>
              
              {userRoles.length > 0 ? (
                <div className="space-y-3">
                  {userRoles.map((userRole) => {
                    const role = userRole.roles;
                    const IconComponent = getRoleIcon(role.name);
                    
                    return (
                      <div 
                        key={userRole.id}
                        className="bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-3 bg-gradient-to-r ${getRoleColor(role.name)} rounded-lg text-white flex-shrink-0 shadow-md`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">
                              {role.display_name}
                            </h4>
                            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                              نشط منذ {new Date(userRole.assigned_at).toLocaleDateString('ar-SA')}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveRole(userRole.id)}
                            disabled={isProcessing}
                            className="text-xs px-4 py-2 h-9 font-medium shadow-sm"
                          >
                            إزالة
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا يوجد أدوار مُعيّنة</p>
                </div>
              )}
            </div>
          )}

          {/* الأدوار المتاحة */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-bold">الأدوار المتاحة</h3>
              <Badge variant="outline">
                {availableRoles.length} دور
              </Badge>
            </div>

            <div className="space-y-3">
              {availableRoles.map((role) => {
                const IconComponent = getRoleIcon(role.name);
                const isAssigned = userRoles.some(ur => ur.role_id === role.id);
                
                return (
                  <div 
                    key={role.id}
                    className={`rounded-lg p-4 transition-all duration-200 border-2 shadow-sm ${
                      isAssigned 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700' 
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-3 bg-gradient-to-r ${getRoleColor(role.name)} rounded-lg text-white flex-shrink-0 shadow-md`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold text-lg mb-1 ${
                          isAssigned 
                            ? 'text-emerald-900 dark:text-emerald-100' 
                            : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {role.display_name}
                        </h4>
                        <p className={`text-sm mb-2 font-medium ${
                          isAssigned 
                            ? 'text-emerald-700 dark:text-emerald-300' 
                            : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          المستوى {role.hierarchy_level}
                        </p>
                        <p className={`text-xs leading-relaxed ${
                          isAssigned 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {getRoleDescription(role.name)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge 
                          variant={isAssigned ? "default" : "secondary"}
                          className={`text-xs font-medium px-3 py-1 ${
                            isAssigned 
                              ? 'bg-emerald-600 text-white dark:bg-emerald-500' 
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isAssigned ? "✓ مُعيّن" : "○ غير مُعيّن"}
                        </Badge>
                        
                        <Button
                          size="sm"
                          variant={isAssigned ? "destructive" : "default"}
                          onClick={() => {
                            if (isAssigned) {
                              const userRole = userRoles.find(ur => ur.role_id === role.id);
                              if (userRole) handleRemoveRole(userRole.id);
                            } else {
                              handleAssignRole(role.id);
                            }
                          }}
                          disabled={isProcessing}
                          className="text-xs px-4 py-2 h-9 font-medium shadow-sm"
                        >
                          {isProcessing ? "..." : (isAssigned ? "إزالة" : "تعيين")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* معلومات مهمة */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-bold text-blue-900 dark:text-blue-100">
                  💡 معلومات مهمة حول الصلاحيات:
                </h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <p><strong>الأدوار:</strong> تحدد الصفحات والوظائف المتاحة للمستخدم</p>
                  <p><strong>الصلاحيات:</strong> تحدد البيانات التي يمكن للمستخدم رؤيتها (منتجات، أقسام، إلخ)</p>
                  <p><strong>موظف مبيعات + كاشير:</strong> يحاسب طلباته فقط - ليس كل النظام</p>
                  <p><strong>مدير القسم:</strong> يحاسب طلبات قسمه فقط</p>
                  <p><strong>المدير العام:</strong> يحاسب كل شيء في النظام</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UnifiedRoleManager;