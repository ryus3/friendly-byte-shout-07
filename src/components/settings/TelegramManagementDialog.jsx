import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageCircle, Copy, Users, Bot, CheckCircle, AlertCircle, Smartphone, Settings,
  Plus, Trash2, Edit, Shield, User, Link, Unlink, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';

const TelegramManagementDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { canViewAllData } = usePermissionBasedData();
  const [employeeCodes, setEmployeeCodes] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [editingCode, setEditingCode] = useState(null);
  const [newCodeValue, setNewCodeValue] = useState('');

  // جلب رموز الموظفين من قاعدة البيانات
  const fetchEmployeeCodes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('telegram_employee_codes')
        .select(`
          id,
          user_id,
          employee_code,
          is_active,
          telegram_chat_id,
          linked_at,
          created_at,
          updated_at,
          profiles!telegram_employee_codes_user_id_fkey(user_id, full_name, username, is_active)
        `)
        .eq('profiles.is_active', true)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('خطأ في جلب الرموز:', error);
        // جربالاستعلام البديل
        const { data: altData, error: altError } = await supabase
          .from('telegram_employee_codes')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (altError) throw altError;
        
        // جلب بيانات الملفات الشخصية بشكل منفصل
        const userIds = altData.map(code => code.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, username, is_active')
          .in('user_id', userIds)
          .eq('is_active', true);
        
        if (profilesError) throw profilesError;
        
        // دمج البيانات
        const mergedData = altData.map(code => ({
          ...code,
          profiles: profilesData.find(profile => profile.user_id === code.user_id)
        })).filter(code => code.profiles);
        
        // فلترة حسب الصلاحيات
        const filteredCodes = canViewAllData
          ? mergedData
          : mergedData.filter(code => code.user_id === user?.user_id);
        
        setEmployeeCodes(filteredCodes);
        return;
      }
      
      // فلترة حسب الصلاحيات
      const filteredCodes = canViewAllData
        ? data || []
        : (data || []).filter(code => code.user_id === user?.user_id);
      
      setEmployeeCodes(filteredCodes);
    } catch (error) {
      console.error('Error fetching employee codes:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: "تعذر جلب رموز الموظفين",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // جلب جميع الموظفين للمديرين
  const fetchAllEmployees = async () => {
    if (!canViewAllData) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, username')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      
      setAllEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // إنشاء رمز جديد
  const generateNewCode = async (userId) => {
    try {
      const { data, error } = await supabase.rpc('generate_telegram_code', {
        user_id_input: userId,
        username_input: allEmployees.find(emp => emp.user_id === userId)?.username || 'USER'
      });

      if (error) throw error;

      toast({
        title: "تم إنشاء الرمز",
        description: `رمز التليجرام الجديد: ${data}`,
        variant: "success"
      });

      setShowAddForm(false);
      setSelectedEmployee('');
      fetchEmployeeCodes();
    } catch (error) {
      console.error('Error generating code:', error);
      toast({
        title: "خطأ في إنشاء الرمز",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // تحديث رمز موجود
  const updateEmployeeCode = async (codeId, newCode) => {
    try {
      const { error } = await supabase
        .from('telegram_employee_codes')
        .update({ 
          employee_code: newCode,
          updated_at: new Date().toISOString(),
          telegram_chat_id: null, // إلغاء الربط عند تغيير الرمز
          linked_at: null
        })
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "تم تحديث الرمز",
        description: "تم تحديث الرمز بنجاح - يجب إعادة ربط البوت",
        variant: "success"
      });

      setEditingCode(null);
      setNewCodeValue('');
      fetchEmployeeCodes();
    } catch (error) {
      console.error('Error updating code:', error);
      toast({
        title: "خطأ في تحديث الرمز",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // حذف رمز
  const deleteEmployeeCode = async (codeId) => {
    try {
      const { error } = await supabase
        .from('telegram_employee_codes')
        .delete()
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "تم حذف الرمز",
        description: "تم حذف رمز التليجرام بنجاح",
        variant: "success"
      });

      fetchEmployeeCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        title: "خطأ في حذف الرمز",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // نسخ إلى الحافظة
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ الرمز إلى الحافظة",
      variant: "success"
    });
  };

  useEffect(() => {
    if (open) {
      fetchEmployeeCodes();
      fetchAllEmployees();
    }
  }, [open, canViewAllData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-none md:max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-lg sm:text-xl">
            <div className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground fill-current">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.02 0 2-.15 2.93-.43.3-.09.49-.36.49-.68v-1.65c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.73c-.63.11-1.29.18-1.98.18-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8c0 1.01-.19 1.97-.53 2.86-.34.89-.82 1.71-1.42 2.43-.6.72-1.3 1.35-2.08 1.87-.78.52-1.63.93-2.53 1.22-.3.1-.49.37-.49.68v1.65c0 .32.19.59.49.68.93.28 1.91.43 2.93.43 5.52 0 10-4.48 10-10S17.52 2 12 2zM9 8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S9 9.33 9 8.5zm6 0c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S15 9.33 15 8.5zm-3 8c-1.66 0-3-1.34-3-3h6c0 1.66-1.34 3-3 3z"/>
                </svg>
              </div>
              <div className="text-right flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">إدارة بوت التليغرام الذكي</h3>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary fill-current">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-normal">
                  {canViewAllData ? 'إدارة كاملة لرموز جميع الموظفين' : 'عرض رمزك الشخصي'}
                </p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* معلومات البوت */}
          <Card className="bg-accent/50 border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center space-y-2 sm:space-y-3">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center mx-auto">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground fill-current">
                    <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785L24 5.855c.265-1.133-.4-1.621-1.335-1.138"/>
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">البوت نشط ويستقبل الطلبات تلقائياً</h3>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-foreground">
                    <span>🤖</span>
                    <span className="font-semibold text-sm sm:text-base">@Ryusiq_bot</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    نشط ومتصل
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* إدارة الرموز */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    رموز الموظفين
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {canViewAllData ? 'إدارة رموز جميع الموظفين' : 'رمزك الشخصي للاتصال بالبوت'}
                  </p>
                </div>
                {canViewAllData && (
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchEmployeeCodes()}
                      className="flex-1 sm:flex-none"
                    >
                      <RefreshCw className="w-4 h-4 ml-2" />
                      تحديث
                    </Button>
                    <Button 
                      onClick={() => setShowAddForm(true)}
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة رمز
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* نموذج إضافة رمز جديد */}
              {showAddForm && canViewAllData && (
                <Card className="bg-accent/30 border-border mb-4 sm:mb-6">
                  <CardContent className="p-3 sm:p-4">
                    <h4 className="font-semibold mb-3 text-sm sm:text-base">إنشاء رمز جديد</h4>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs sm:text-sm">اختر الموظف</Label>
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                          <SelectTrigger className="text-xs sm:text-sm">
                            <SelectValue placeholder="اختر موظف..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allEmployees
                              .filter(emp => !employeeCodes.some(code => code.user_id === emp.user_id))
                              .map(employee => (
                                <SelectItem key={employee.user_id} value={employee.user_id}>
                                  {employee.full_name} ({employee.username})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 flex-col sm:flex-row">
                        <Button 
                          onClick={() => generateNewCode(selectedEmployee)}
                          disabled={!selectedEmployee}
                          size="sm"
                          className="flex-1"
                        >
                          إنشاء الرمز
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowAddForm(false);
                            setSelectedEmployee('');
                          }}
                          size="sm"
                          className="flex-1"
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* قائمة الرموز */}
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-muted-foreground mt-2">جاري تحميل الرموز...</p>
                  </div>
                ) : employeeCodes.length > 0 ? (
                  employeeCodes.map((employeeCode) => {
                    const profile = employeeCode.profiles;
                    const isCurrentUser = user?.user_id === employeeCode.user_id;
                    const isLinked = !!employeeCode.telegram_chat_id;
                    const isEditing = editingCode === employeeCode.id;
                    
                    return (
                      <div key={employeeCode.id} className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                        isCurrentUser ? 'bg-accent/50 border-primary/20' : 'bg-card border-border'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-primary-foreground font-bold shrink-0 ${
                              isCurrentUser 
                                ? 'bg-gradient-to-r from-primary to-primary/80' 
                                : 'bg-gradient-to-r from-secondary to-secondary/80'
                            }`}>
                              {profile?.full_name?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm sm:text-lg text-foreground truncate">{profile?.full_name || 'مستخدم غير معروف'}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {isCurrentUser && (
                                  <Badge variant="secondary" className="text-xs">
                                    {canViewAllData ? 'أنت (مدير)' : 'أنت'}
                                  </Badge>
                                )}
                                <Badge 
                                  variant={isLinked ? "default" : "outline"} 
                                  className="text-xs"
                                >
                                  {isLinked ? (
                                    <>
                                      <Link className="w-3 h-3 ml-1" />
                                      متصل
                                    </>
                                  ) : (
                                    <>
                                      <Unlink className="w-3 h-3 ml-1" />
                                      غير متصل
                                    </>
                                  )}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            {isEditing ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                                <Input 
                                  value={newCodeValue}
                                  onChange={(e) => setNewCodeValue(e.target.value)}
                                  placeholder="الرمز الجديد"
                                  className="w-full sm:w-32 text-xs sm:text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateEmployeeCode(employeeCode.id, newCodeValue)}
                                    disabled={!newCodeValue.trim()}
                                    className="flex-1 sm:flex-none"
                                  >
                                    حفظ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingCode(null);
                                      setNewCodeValue('');
                                    }}
                                    className="flex-1 sm:flex-none"
                                  >
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-center w-full sm:w-auto">
                                  <Badge 
                                    variant="outline" 
                                    className="font-mono text-sm sm:text-lg px-3 sm:px-4 py-2 w-full sm:w-auto justify-center"
                                  >
                                    {employeeCode.employee_code}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">الرمز</p>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(employeeCode.employee_code)}
                                    className="h-8 w-8 p-0 hover:bg-accent"
                                  >
                                    <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4 fill-current">
                                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                    </svg>
                                  </Button>
                                  {(canViewAllData || isCurrentUser) && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingCode(employeeCode.id);
                                          setNewCodeValue(employeeCode.employee_code);
                                        }}
                                        className="h-8 w-8 p-0 hover:bg-accent"
                                      >
                                        <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4 fill-current">
                                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                        </svg>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteEmployeeCode(employeeCode.id)}
                                        className="h-8 w-8 p-0 hover:bg-destructive/10 text-destructive"
                                      >
                                        <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4 fill-current">
                                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                        </svg>
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    {canViewAllData ? (
                      <>
                        <p className="text-lg font-semibold">لا يوجد رموز مضافة بعد</p>
                        <p className="text-sm">أضف رموز للموظفين من الزر أعلاه</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold">لم يتم إنشاء رمز تليجرام بعد</p>
                        <p className="text-sm">يرجى مراجعة المدير لإنشاء رمزك</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* تعليمات الاستخدام */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Smartphone className="w-5 h-5" />
                كيفية الربط والاستخدام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <p className="text-sm text-blue-700">ابحث عن البوت في التليغرام: <span className="font-mono">@Ryusiq_bot</span></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <p className="text-sm text-blue-700">اضغط على <span className="font-semibold">Start</span> وأرسل رمزك الشخصي</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <p className="text-sm text-blue-700">ستتلقى رسالة تأكيد ربط الحساب</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <p className="text-sm text-blue-700">يمكنك الآن إنشاء طلبات وتلقي إشعارات</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramManagementDialog;