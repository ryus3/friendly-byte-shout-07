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

const UnifiedRoleManager = ({ user: selectedUser, onClose, onUpdate, open, onOpenChange }) => {
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

      setAvailableRoles(roles || []);

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
      
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: roleId,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          is_active: true
        });

      if (error) throw error;

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

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <span>إدارة أدوار المستخدم</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          {selectedUser && (
            <DialogDescription>
              إدارة أدوار وصلاحيات المستخدم: <strong>{selectedUser.full_name}</strong>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
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
                            className="bg-card border border-green-200 rounded-lg p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 bg-gradient-to-r ${getRoleColor(role.name)} rounded-lg text-white flex-shrink-0`}>
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-foreground">
                                  {role.display_name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  منذ {new Date(userRole.assigned_at).toLocaleDateString('ar-SA')}
                                </p>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveRole(userRole.id)}
                                disabled={isProcessing}
                                className="text-xs px-3 py-1 h-8"
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
                        className={`bg-card border rounded-lg p-4 transition-all duration-200 ${
                          isAssigned ? 'border-green-200 bg-green-50/50' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 bg-gradient-to-r ${getRoleColor(role.name)} rounded-lg text-white flex-shrink-0`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground">
                              {role.display_name}
                            </h4>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">
                                المستوى {role.hierarchy_level}
                              </p>
                              {role.description && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {role.description}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge 
                              variant={isAssigned ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {isAssigned ? "مُعيّن" : "غير مُعيّن"}
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
                              className="text-xs px-3 py-1 h-8"
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
                      💡 كيفية تعديل أدوار الموظفين:
                    </h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <p>• اضغط على زر "تعيين" لإضافة دور جديد للموظف</p>
                      <p>• اضغط على زر "إزالة" لحذف دور من الموظف</p>
                      <p>• يمكن للموظف الواحد أن يحمل عدة أدوار معاً</p>
                      <p>• تأكد من تعيين الأدوار المناسبة حسب مهام كل موظف</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedRoleManager;