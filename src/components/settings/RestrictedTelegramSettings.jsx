import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Shield, User, Plus, Trash2, Copy } from 'lucide-react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useState, useEffect } from 'react';

const RestrictedTelegramSettings = () => {
  const { canViewAllData, isAdmin, isEmployee, user } = usePermissionBasedData();
  const { user: authUser } = useAuth();
  const [employeeCodes, setEmployeeCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEmployeeCodes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('employee_telegram_codes')
        .select(`
          id,
          user_id,
          telegram_code,
          is_active,
          telegram_chat_id,
          linked_at,
          created_at,
          profiles!employee_telegram_codes_user_id_fkey(user_id, full_name, username, is_active)
        `)
        .eq('profiles.is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // فلترة الرموز حسب الصلاحيات
      const filteredCodes = canViewAllData 
        ? data || []
        : (data || []).filter(code => code.user_id === user?.id || code.user_id === user?.user_id);
      
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

  const generateCodeForEmployee = async (userId) => {
    try {
      const { data, error } = await supabase.rpc('generate_employee_telegram_code', {
        p_user_id: userId
      });

      if (error) throw error;

      toast({
        title: "تم إنشاء الرمز",
        description: `رمز التليجرام: ${data}`,
        variant: "success"
      });

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

  const deleteEmployeeCode = async (codeId) => {
    try {
      const { error } = await supabase
        .from('employee_telegram_codes')
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ الرمز إلى الحافظة"
    });
  };

  useEffect(() => {
    fetchEmployeeCodes();
  }, []);

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800">
      <CardHeader className="relative">
        <div className="absolute top-4 right-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          بوت التليجرام الذكي
        </CardTitle>
        <p className="text-muted-foreground">
          {canViewAllData 
            ? 'إدارة بوت التليجرام ورموز الموظفين' 
            : 'رمزك الشخصي للاتصال بالبوت'
          }
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* معلومات البوت */}
        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">@Ryusiq_bot</h3>
              <Badge variant="success" className="text-xs">نشط</Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            البوت جاهز لاستقبال الطلبات والإشعارات
          </p>
        </div>

        {/* حالة الاتصال */}
        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">حالة الاتصال</h3>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? (
                <>
                  <Shield className="w-3 h-3 ml-1" />
                  إدارة كاملة
                </>
              ) : (
                <>
                  <User className="w-3 h-3 ml-1" />
                  رمزي الشخصي
                </>
              )}
            </Badge>
          </div>

          {/* عرض الرموز */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : employeeCodes.length > 0 ? (
              employeeCodes.map((code) => {
                const profile = code.profiles;
                const isCurrentUser = authUser?.id === code.user_id;
                
                return (
                  <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        isCurrentUser 
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500' 
                          : 'bg-gradient-to-r from-green-500 to-teal-500'
                      }`}>
                        {profile?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="font-medium">{profile?.full_name || 'مستخدم'}</p>
                        <div className="flex gap-1">
                          <Badge variant={isCurrentUser ? "outline" : "secondary"} className="text-xs">
                            {isCurrentUser ? 'أنت' : 'موظف'}
                          </Badge>
                          {code.telegram_chat_id && (
                            <Badge variant="success" className="text-xs">متصل</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`font-mono text-sm px-3 py-1 ${
                          isCurrentUser ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-green-50 text-green-700 border-green-300'
                        }`}
                      >
                        {code.telegram_code}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(code.telegram_code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {canViewAllData && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteEmployeeCode(code.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                {canViewAllData ? (
                  <>
                    <p>لا يوجد رموز مضافة بعد</p>
                    <p className="text-sm">أضف رموز للموظفين</p>
                  </>
                ) : (
                  <>
                    <p>لم يتم إنشاء رمز تليجرام بعد</p>
                    <p className="text-sm">يرجى مراجعة المدير لإنشاء رمزك</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* زر إضافة رمز للمديرين */}
          {canViewAllData && (
            <div className="mt-4 pt-4 border-t">
              <Button 
                onClick={() => generateCodeForEmployee(authUser?.id)}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 ml-2" />
                إنشاء رمز جديد
              </Button>
            </div>
          )}
        </div>

        {/* تعليمات الاستخدام */}
        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <h3 className="font-semibold mb-3">كيفية الربط</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <p>ابحث عن البوت في التليجرام: @Ryusiq_bot</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <p>اضغط على Start وأرسل رمزك الشخصي</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <p>ستتلقى رسالة تأكيد ربط الحساب</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <p>ستبدأ بتلقي الإشعارات فوراً</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RestrictedTelegramSettings;