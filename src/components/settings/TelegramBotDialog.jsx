import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { 
  MessageCircle, Copy, Users, Bot, CheckCircle, AlertCircle, Smartphone 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const TelegramBotDialog = ({ open, onOpenChange }) => {
  const { user, allUsers } = useAuth();
  const [employeeCodes, setEmployeeCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // جلب رموز الموظفين من قاعدة البيانات
  const fetchEmployeeCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('telegram_employee_codes')
        .select(`
          *,
          profiles!inner(user_id, full_name, role, username)
        `)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setEmployeeCodes(data || []);
    } catch (error) {
      console.error('Error fetching employee codes:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployeeCodes();
    }
  }, [open]);

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
          {/* معلومات البوت */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700">بوت التليغرام جاهز</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-700 text-sm">
                البوت محفوظ في الخادم ويعمل تلقائياً. الموظفين يحتاجون فقط لإدخال رموزهم الخاصة.
              </p>
            </CardContent>
          </Card>

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

export default TelegramBotDialog;