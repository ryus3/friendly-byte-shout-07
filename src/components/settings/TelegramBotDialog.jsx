import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { 
  MessageCircle, Copy, Users, Bot, CheckCircle, AlertCircle, Smartphone, Settings 
} from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import TelegramBotSetup from './TelegramBotSetup';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';

const TelegramBotDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { getUserSpecificTelegramCode, canViewAllData } = usePermissionBasedData();
  const [employeeCodes, setEmployeeCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);

  // جلب رموز الموظفين من قاعدة البيانات
  const fetchEmployeeCodes = async () => {
    try {
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
        
        // تطبيق الفلترة بناءً على الصلاحيات - إظهار رمز المستخدم الحالي فقط إذا لم يكن مدير
        const filteredCodes = getUserSpecificTelegramCode(mergedData);
        setEmployeeCodes(filteredCodes);
        return;
      }
      
      // تطبيق الفلترة بناءً على الصلاحيات - إظهار رمز المستخدم الحالي فقط إذا لم يكن مدير
      const filteredCodes = getUserSpecificTelegramCode(data || []);
      setEmployeeCodes(filteredCodes);
    } catch (error) {
      console.error('Error fetching employee codes:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: "تعذر جلب رموز الموظفين",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployeeCodes();
      checkBotConfiguration();
    }
  }, [open]);

  const checkBotConfiguration = async () => {
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'telegram_bot_config')
        .single();

      setBotConfigured(!!settings?.value?.bot_token && !!settings?.value?.auto_configured);
    } catch (error) {
      console.error('Error checking bot configuration:', error);
      setBotConfigured(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ الرمز إلى الحافظة",
      variant: "success"
    });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">بوت التليغرام الذكي</h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-normal">رمزك الشخصي للاتصال مع بوت التليغرام</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Top Section - Bot Info */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-green-800">البوت نشط ويستقبل الطلبات تلقائياً من الموظفين</h3>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <span>🤖</span>
                    <span className="font-semibold">@Ryusiq_bot</span>
                  </div>
                    <div className="text-xs sm:text-sm text-green-600 space-y-1">
                      <p>✨ <strong>كل شيء تلقائي:</strong></p>
                      <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2">لا حاجة لإعداد يدوي</Badge>
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2">الموظفين يحتاجون فقط لرموزهم</Badge>
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2">التوجيه الذكي داخل البوت</Badge>
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2">دعم متقدم حسب الصلاحيات</Badge>
                      </div>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Codes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                رموز الموظفين
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {canViewAllData ? 'كل موظف له رمز للاتصال بالبوت' : 'رمزك الشخصي للاتصال بالبوت'}
              </p>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-2 sm:space-y-3">
                {employeeCodes.map((employeeCode) => {
                  const profile = employeeCode.profiles;
                  const isCurrentUser = user?.user_id === employeeCode.user_id;
                  const isLinked = !!employeeCode.telegram_chat_id;
                  
                  return (
                    <div key={employeeCode.id} className={`p-2 sm:p-3 rounded-lg border transition-colors ${
                      isCurrentUser ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            isCurrentUser 
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                              : 'bg-gradient-to-r from-green-500 to-teal-500'
                          }`}>
                            {profile?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm sm:text-base truncate">{profile?.full_name || 'مستخدم غير معروف'}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {isCurrentUser && (
                                <Badge variant="default" className="text-[10px] sm:text-xs bg-blue-100 text-blue-700 px-1 sm:px-2">
                                  المدير العام
                                </Badge>
                              )}
                              <Badge variant={isLinked ? "default" : "outline"} className="text-[10px] sm:text-xs px-1 sm:px-2">
                                {isLinked ? 'متصل' : 'غير متصل'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <div className="text-center">
                            <Badge 
                              variant="outline" 
                              className={`font-mono text-xs sm:text-sm px-2 py-1 ${
                                isCurrentUser 
                                  ? 'bg-blue-100 text-blue-700 border-blue-300' 
                                  : 'bg-green-100 text-green-700 border-green-300'
                              }`}
                            >
                              {employeeCode.employee_code}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(employeeCode.employee_code)}
                            className="h-8 w-8 p-0 bg-background border-border hover:bg-accent hover:text-accent-foreground"
                          >
                            <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {employeeCodes.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    {canViewAllData ? (
                      <>
                        <p className="text-lg font-semibold">لا يوجد موظفين مضافين بعد</p>
                        <p className="text-sm">أضف موظفين من إدارة الموظفين</p>
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

          {/* Instructions */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="flex items-center gap-2 text-blue-700 text-sm sm:text-base">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
                كيفية الربط
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">1</div>
                    <p className="text-xs sm:text-sm text-blue-700">ابحث عن البوت في التليغرام واضغط <span className="font-semibold">Start</span></p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">2</div>
                    <p className="text-xs sm:text-sm text-blue-700">أرسل الرمز الخاص بك إلى البوت</p>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">3</div>
                    <p className="text-xs sm:text-sm text-blue-700">ستتلقى رسالة تأكيد ربط الحساب</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">4</div>
                    <p className="text-xs sm:text-sm text-blue-700">ستبدأ بتلقي الإشعارات فوراً</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramBotDialog;