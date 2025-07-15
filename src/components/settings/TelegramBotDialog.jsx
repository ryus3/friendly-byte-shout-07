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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import TelegramBotSetup from './TelegramBotSetup';

const TelegramBotDialog = ({ open, onOpenChange }) => {
  const { user, allUsers } = useAuth();
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
          profiles!telegram_employee_codes_user_id_fkey(user_id, full_name, role, username, is_active)
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
          .select('user_id, full_name, role, username, is_active')
          .in('user_id', userIds)
          .eq('is_active', true);
        
        if (profilesError) throw profilesError;
        
        // دمج البيانات
        const mergedData = altData.map(code => ({
          ...code,
          profiles: profilesData.find(profile => profile.user_id === code.user_id)
        })).filter(code => code.profiles);
        
        setEmployeeCodes(mergedData);
        return;
      }
      
      setEmployeeCodes(data || []);
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

      setBotConfigured(!!settings?.value?.bot_token);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            بوت التليغرام
          </DialogTitle>
          <DialogDescription>
            إعداد وإدارة بوت التليغرام لتلقي الإشعارات وإدارة الطلبات
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bot Status */}
          <Card className={`${botConfigured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  {botConfigured ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className={botConfigured ? 'text-green-700' : 'text-red-700'}>
                    {botConfigured ? 'البوت مُعدّ ويعمل' : 'البوت غير مُعدّ'}
                  </span>
                </div>
                <Button
                  variant={botConfigured ? "outline" : "default"}
                  size="sm"
                  onClick={() => setShowSetup(true)}
                  className={botConfigured ? "" : "bg-blue-600 hover:bg-blue-700"}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {botConfigured ? 'إعادة الإعداد' : 'إعداد البوت'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-sm ${botConfigured ? 'text-green-700' : 'text-red-700'}`}>
                {botConfigured 
                  ? 'البوت جاهز لاستقبال الطلبات من الموظفين عبر التليغرام'
                  : 'يجب إعداد البوت أولاً قبل أن يتمكن الموظفون من استخدامه'
                }
              </p>
            </CardContent>
          </Card>

          {!botConfigured && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Bot className="w-5 h-5" />
                  إعداد مطلوب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-blue-700">
                  <p>لتفعيل بوت التليغرام، تحتاج إلى:</p>
                  <ul className="list-disc list-inside space-y-1 mr-4">
                    <li>إنشاء بوت جديد عبر @BotFather</li>
                    <li>الحصول على مفتاح البوت (Bot Token)</li>
                    <li>إعداد البوت في النظام</li>
                  </ul>
                  <Button 
                    onClick={() => setShowSetup(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 mt-3"
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    إعداد البوت الآن
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* معلومات البوت */}
          {botConfigured && (

          {/* رموز الموظفين */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                رموز الموظفين
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                كل موظف له رمز بسيط مرتبط بحسابه في قاعدة البيانات
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* عرض جميع رموز الموظفين */}
                {employeeCodes.map((employeeCode) => {
                  const profile = employeeCode.profiles;
                  const isOwner = profile?.role === 'admin';
                  
                  return (
                    <div key={employeeCode.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isOwner 
                            ? 'bg-gradient-to-r from-purple-500 to-blue-500' 
                            : 'bg-gradient-to-r from-green-500 to-teal-500'
                        }`}>
                          <span className="text-white font-bold text-sm">
                            {profile?.full_name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{profile?.full_name || 'مستخدم'}</p>
                          <Badge variant={isOwner ? "outline" : "secondary"} className="text-xs">
                            {isOwner ? 'مالك' : profile?.role === 'manager' ? 'مدير' : 'موظف'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`font-mono text-sm px-3 py-1 ${
                            isOwner ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-green-50 text-green-700 border-green-300'
                          }`}
                        >
                          {employeeCode.employee_code}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(employeeCode.employee_code)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {employeeCodes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا يوجد موظفين مضافين بعد</p>
                    <p className="text-sm">أضف موظفين من إدارة الموظفين</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* تعليمات الاستخدام */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Smartphone className="w-5 h-5" />
                كيفية الربط
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-blue-700">
                <div className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <p>ابحث عن البوت في التليغرام واضغط Start</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <p>أرسل الرمز الخاص بك إلى البوت</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <p>ستتلقى رسالة تأكيد ربط الحساب</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <p>ستبدأ بتلقي الإشعارات فوراً</p>
                </div>
              </div>
            </CardContent>
          </Card>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>

        <TelegramBotSetup 
          open={showSetup} 
          onOpenChange={(open) => {
            setShowSetup(open);
            if (!open) {
              checkBotConfiguration();
            }
          }} 
        />
      </DialogContent>
    </Dialog>
  );
};

export default TelegramBotDialog;