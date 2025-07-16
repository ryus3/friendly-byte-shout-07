import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Shield, UserPlus, Eye, Settings, Trash2 } from 'lucide-react';

const UnifiedRoleManager = ({ user: selectedUser, onClose, onUpdate, open, onOpenChange }) => {
  const [userRoles, setUserRoles] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');

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
          .order('hierarchy_level', { ascending: false });

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

  // إذا لم يكن هناك مستخدم محدد، فهذا Dialog مستقل
  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            إدارة الأدوار والصلاحيات
            {selectedUser && ` - ${selectedUser.full_name || selectedUser.username}`}
          </DialogTitle>
          <DialogDescription>
            إدارة أدوار المستخدمين وتعيين الصلاحيات والوصول للنظام
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  الأدوار المتاحة
                </h3>
                
                <div className="space-y-2">
                  {availableRoles.map(role => (
                    <Card key={role.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{role.display_name}</h4>
                          <p className="text-sm text-muted-foreground">{role.description}</p>
                        </div>
                        <Badge variant="outline">
                          مستوى {role.hierarchy_level}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                  
                  {availableRoles.length === 0 && (
                    <Card className="p-4">
                      <div className="text-center text-muted-foreground">
                        <Shield className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>لا توجد أدوار متاحة</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  إدارة سريعة
                </h3>
                
                <div className="space-y-3">
                  <Card className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
                    <div className="flex items-center gap-3">
                      <Shield className="h-8 w-8 text-blue-600" />
                      <div>
                        <h4 className="font-semibold text-blue-700 dark:text-blue-300">صلاحيات النظام</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-400">إدارة وصول المستخدمين للنظام</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30">
                    <div className="flex items-center gap-3">
                      <UserPlus className="h-8 w-8 text-green-600" />
                      <div>
                        <h4 className="font-semibold text-green-700 dark:text-green-300">أدوار المستخدمين</h4>
                        <p className="text-sm text-green-600 dark:text-green-400">تعيين وإدارة أدوار الموظفين</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* دليل الأدوار */}
          <Card className="border-2 border-dashed border-muted-foreground/25">
            <CardHeader>
              <CardTitle className="flex items-center text-base text-muted-foreground">
                <Eye className="ml-2 h-5 w-5" />
                دليل الأدوار والصلاحيات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <Badge variant="default" className="bg-red-600">مدير عام</Badge>
                  <span className="text-muted-foreground text-xs">جميع الصلاحيات</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <Badge variant="default" className="bg-blue-600">مدير قسم</Badge>
                  <span className="text-muted-foreground text-xs">إدارة قسم محدد</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                  <Badge variant="default" className="bg-purple-600">موظف مبيعات</Badge>
                  <span className="text-muted-foreground text-xs">طلبات + أرباح</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                  <Badge variant="default" className="bg-orange-600">موظف مخزن</Badge>
                  <span className="text-muted-foreground text-xs">مخزون + جرد</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedRoleManager;