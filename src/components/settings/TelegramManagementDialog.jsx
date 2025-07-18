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
      <DialogContent className="w-[95vw] max-w-none md:max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 border-indigo-600/20">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-lg sm:text-xl">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
              <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="text-right">
              <h3 className="font-bold text-white">إدارة بوت التليغرام الذكي</h3>
              <p className="text-xs sm:text-sm text-indigo-200 font-normal">
                {canViewAllData ? 'إدارة كاملة لرموز جميع الموظفين' : 'عرض رمزك الشخصي'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* معلومات البوت */}
          <Card className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border-indigo-600/30 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center space-y-2 sm:space-y-3">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">البوت نشط ويستقبل الطلبات تلقائياً</h3>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-white">
                    <span>🤖</span>
                    <span className="font-semibold text-sm sm:text-base">@Ryusiq_bot</span>
                  </div>
                  <Badge className="bg-gradient-to-r from-indigo-500/90 to-purple-600/90 text-white border-0 text-xs">
                    نشط ومتصل
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* إدارة الرموز */}
          <Card className="bg-gradient-to-r from-slate-800/80 to-indigo-800/80 border-indigo-600/30 backdrop-blur-sm">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-white">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                    رموز الموظفين
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-indigo-200 mt-1">
                    {canViewAllData ? 'إدارة رموز جميع الموظفين' : 'رمزك الشخصي للاتصال بالبوت'}
                  </p>
                </div>
                {canViewAllData && (
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchEmployeeCodes()}
                      className="flex-1 sm:flex-none bg-slate-700/50 border-indigo-500/50 text-white hover:bg-slate-600/60"
                    >
                      <RefreshCw className="w-4 h-4 ml-2" />
                      تحديث
                    </Button>
                    <Button 
                      onClick={() => setShowAddForm(true)}
                      size="sm"
                      className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
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
                        isCurrentUser ? 'bg-gradient-to-r from-indigo-800/60 to-purple-800/60 border-indigo-500/40' : 'bg-slate-800/60 border-slate-600/40'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-lg ${
                              isCurrentUser 
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600' 
                                : 'bg-gradient-to-r from-slate-600 to-slate-700'
                            }`}>
                              {profile?.full_name?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm sm:text-lg text-white truncate">{profile?.full_name || 'مستخدم غير معروف'}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {isCurrentUser && (
                                  <Badge className="bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white border-0 text-xs">
                                    {canViewAllData ? 'أنت (مدير)' : 'أنت'}
                                  </Badge>
                                )}
                                <Badge 
                                  className={`text-xs ${
                                    isLinked 
                                      ? 'bg-green-600/80 text-white border-0' 
                                      : 'bg-slate-600/60 text-gray-200 border-slate-500/50'
                                  }`}
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
                                    className={`font-mono text-sm sm:text-lg px-3 sm:px-4 py-2 w-full sm:w-auto justify-center border-0 shadow-lg ${
                                      isCurrentUser
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' 
                                        : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white'
                                    }`}
                                  >
                                    {employeeCode.employee_code}
                                  </Badge>
                                  <p className="text-xs text-indigo-200 mt-1">الرمز</p>
                                </div>
                                <div className="flex gap-2 justify-center sm:justify-start">
                                  <Button
                                    size="sm"
                                    className="bg-slate-700/60 border-slate-600/50 text-white hover:bg-slate-600/70"
                                    onClick={() => copyToClipboard(employeeCode.employee_code)}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  {canViewAllData && (
                                    <>
                                      <Button
                                        size="sm"
                                        className="bg-slate-700/60 border-slate-600/50 text-white hover:bg-slate-600/70"
                                        onClick={() => {
                                          setEditingCode(employeeCode.id);
                                          setNewCodeValue(employeeCode.employee_code);
                                        }}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => deleteEmployeeCode(employeeCode.id)}
                                        className="bg-red-600/60 border-red-500/50 text-white hover:bg-red-600/80"
                                      >
                                        <Trash2 className="w-4 h-4" />
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
          <Card className="bg-gradient-to-r from-slate-800/60 to-indigo-800/60 border-indigo-600/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                كيفية الربط والاستخدام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">1</div>
                    <p className="text-sm text-indigo-200">ابحث عن البوت في التليغرام: <span className="font-mono text-white">@Ryusiq_bot</span></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">2</div>
                    <p className="text-sm text-indigo-200">اضغط على <span className="font-semibold text-white">Start</span> وأرسل رمزك الشخصي</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">3</div>
                    <p className="text-sm text-indigo-200">ستتلقى رسالة تأكيد ربط الحساب</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">4</div>
                    <p className="text-sm text-indigo-200">يمكنك الآن إنشاء طلبات وتلقي إشعارات</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t border-indigo-600/30">
          <Button 
            className="bg-slate-700/60 border-slate-600/50 text-white hover:bg-slate-600/70"
            onClick={() => onOpenChange(false)}
          >
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramManagementDialog;