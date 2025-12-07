import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Users, UserPlus, Loader2, Check, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const TeamManagementDialog = ({ open, onOpenChange, supervisor, onUpdate }) => {
  const { user } = useAuth();
  const { allUsers } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTeam, setCurrentTeam] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  // جلب الفريق الحالي للمشرف
  useEffect(() => {
    const fetchCurrentTeam = async () => {
      if (!open || !supervisor?.user_id) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('employee_supervisors')
          .select('employee_id')
          .eq('supervisor_id', supervisor.user_id)
          .eq('is_active', true);
        
        if (error) throw error;
        
        const teamIds = data?.map(d => d.employee_id) || [];
        setCurrentTeam(teamIds);
        setSelectedEmployees(teamIds);
      } catch (err) {
        console.error('خطأ في جلب الفريق:', err);
        toast({
          title: "خطأ",
          description: "فشل في جلب بيانات الفريق",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchCurrentTeam();
  }, [open, supervisor?.user_id]);

  // الموظفين المتاحين للإضافة (استبعاد المشرف نفسه والمدراء)
  const availableEmployees = useMemo(() => {
    if (!allUsers) return [];
    
    return allUsers.filter(u => 
      u.user_id !== supervisor?.user_id &&
      u.status === 'active' &&
      !u.roles?.some(r => ['admin', 'super_admin'].includes(r))
    );
  }, [allUsers, supervisor?.user_id]);

  // فلترة حسب البحث
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return availableEmployees;
    
    const term = searchTerm.toLowerCase();
    return availableEmployees.filter(emp => 
      (emp.full_name || '').toLowerCase().includes(term) ||
      (emp.email || '').toLowerCase().includes(term) ||
      (emp.employee_code || '').toLowerCase().includes(term)
    );
  }, [availableEmployees, searchTerm]);

  const toggleEmployee = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSave = async () => {
    if (!supervisor?.user_id || !user?.user_id) return;
    
    setSaving(true);
    try {
      // حذف العلاقات القديمة
      const { error: deleteError } = await supabase
        .from('employee_supervisors')
        .delete()
        .eq('supervisor_id', supervisor.user_id);
      
      if (deleteError) throw deleteError;
      
      // إضافة العلاقات الجديدة
      if (selectedEmployees.length > 0) {
        const newRelations = selectedEmployees.map(empId => ({
          employee_id: empId,
          supervisor_id: supervisor.user_id,
          assigned_by: user.user_id,
          is_active: true
        }));
        
        const { error: insertError } = await supabase
          .from('employee_supervisors')
          .insert(newRelations);
        
        if (insertError) throw insertError;
      }
      
      toast({
        title: "تم الحفظ",
        description: `تم تعيين ${selectedEmployees.length} موظف تحت إشراف ${supervisor.full_name}`,
      });
      
      onUpdate?.();
      onOpenChange(false);
    } catch (err) {
      console.error('خطأ في حفظ الفريق:', err);
      toast({
        title: "خطأ",
        description: "فشل في حفظ تغييرات الفريق",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '؟';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2);
  };

  const addedCount = selectedEmployees.filter(id => !currentTeam.includes(id)).length;
  const removedCount = currentTeam.filter(id => !selectedEmployees.includes(id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            إدارة فريق {supervisor?.full_name}
          </DialogTitle>
          <DialogDescription>
            اختر الموظفين الذين سيكونون تحت إشراف مدير القسم
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* البحث */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن موظف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* ملخص التغييرات */}
          {(addedCount > 0 || removedCount > 0) && (
            <div className="flex gap-2 text-sm">
              {addedCount > 0 && (
                <Badge variant="default" className="bg-green-500">
                  <UserPlus className="h-3 w-3 ml-1" />
                  {addedCount} سيُضاف
                </Badge>
              )}
              {removedCount > 0 && (
                <Badge variant="destructive">
                  <X className="h-3 w-3 ml-1" />
                  {removedCount} سيُزال
                </Badge>
              )}
            </div>
          )}

          {/* قائمة الموظفين */}
          <ScrollArea className="h-[300px] border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Users className="h-10 w-10 mb-2" />
                <p>لا يوجد موظفين</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredEmployees.map(emp => {
                  const isSelected = selectedEmployees.includes(emp.user_id);
                  const wasInTeam = currentTeam.includes(emp.user_id);
                  
                  return (
                    <div
                      key={emp.user_id}
                      onClick={() => toggleEmployee(emp.user_id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'hover:bg-secondary/50 border border-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEmployee(emp.user_id)}
                      />
                      
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={emp.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {getInitials(emp.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.email || emp.employee_code || 'بدون بريد'}
                        </p>
                      </div>
                      
                      {isSelected && !wasInTeam && (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                          جديد
                        </Badge>
                      )}
                      {!isSelected && wasInTeam && (
                        <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
                          سيُزال
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جارٍ الحفظ...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 ml-2" />
                حفظ ({selectedEmployees.length} موظف)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamManagementDialog;
