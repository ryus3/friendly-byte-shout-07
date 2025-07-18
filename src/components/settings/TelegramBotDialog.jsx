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
  Plus, Trash2, Edit, Shield, User, Link, Unlink, RefreshCw, MessageSquare
} from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import Loader from '@/components/ui/loader';

const TelegramBotDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { canViewAllData } = usePermissionBasedData();
  const [telegramCodes, setTelegramCodes] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [editingCode, setEditingCode] = useState(null);
  const [newCodeValue, setNewCodeValue] = useState('');

  // حالة البوت (يمكن جلبها من API لاحقاً)
  const [botStatus] = useState({
    active: true,
    username: 'Ryusiq_bot'
  });

  // جلب رموز الموظفين من قاعدة البيانات
  const fetchTelegramCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('telegram_employee_codes')
        .select(`
          id,
          user_id,
          telegram_code,
          is_active,
          telegram_chat_id,
          linked_at,
          created_at,
          updated_at,
          profiles!telegram_employee_codes_user_id_fkey(user_id, full_name, email, is_active)
        `)
        .eq('profiles.is_active', true)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('خطأ في جلب الرموز:', error);
        return;
      }
      
      // فلترة حسب الصلاحيات
      const filteredCodes = canViewAllData
        ? data || []
        : (data || []).filter(code => code.user_id === user?.user_id);
      
      setTelegramCodes(filteredCodes);
    } catch (error) {
      console.error('Error fetching telegram codes:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: "تعذر جلب رموز التليغرام",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // جلب جميع الموظفين للمديرين
  const fetchAllEmployees = async () => {
    if (!canViewAllData) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
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
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { error } = await supabase
        .from('telegram_employee_codes')
        .insert({
          user_id: userId,
          telegram_code: randomCode,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "تم إنشاء الرمز",
        description: `رمز التليغرام الجديد: ${randomCode}`,
        variant: "success"
      });

      setShowAddDialog(false);
      setSelectedEmployee('');
      fetchTelegramCodes();
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
  const handleEditCode = (code) => {
    setEditingCode(code.id);
    setNewCodeValue(code.telegram_code);
  };

  const updateCode = async (codeId) => {
    try {
      const { error } = await supabase
        .from('telegram_employee_codes')
        .update({ 
          telegram_code: newCodeValue,
          updated_at: new Date().toISOString(),
          telegram_chat_id: null,
          linked_at: null
        })
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "تم تحديث الرمز",
        description: "تم تحديث الرمز بنجاح",
        variant: "success"
      });

      setEditingCode(null);
      setNewCodeValue('');
      fetchTelegramCodes();
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
  const handleDeleteCode = async (codeId) => {
    try {
      const { error } = await supabase
        .from('telegram_employee_codes')
        .delete()
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "تم حذف الرمز",
        description: "تم حذف رمز التليغرام بنجاح",
        variant: "success"
      });

      fetchTelegramCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        title: "خطأ في حذف الرمز",
        description: error.message,
        variant: "destructive"
      });
    }
  };


  useEffect(() => {
    if (open) {
      fetchTelegramCodes();
      fetchAllEmployees();
    }
  }, [open, canViewAllData]);

  const copyToClipboard = (text, message = 'تم النسخ') => {
    navigator.clipboard.writeText(text);
    toast({
      title: message,
      description: "تم نسخ النص إلى الحافظة",
      variant: "success"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden z-50">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-semibold flex items-center">
            <MessageSquare className="ml-2 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            إدارة رموز التليغرام
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            إدارة رموز التليغرام للموظفين وربطها بحساباتهم
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 py-2 sm:py-4 px-1 sm:px-0">
          {/* حالة البوت */}
          <div className="bg-card border rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-lg font-medium flex items-center">
                <Bot className="ml-2 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                حالة البوت
              </h3>
              <Badge 
                variant={botStatus.active ? "default" : "destructive"}
                className="text-xs"
              >
                {botStatus.active ? 'نشط ومتصل' : 'غير متصل'}
              </Badge>
            </div>
            
            <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="font-medium">اسم البوت:</span>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded text-xs">
                    @{botStatus.username || 'Ryusiq_bot'}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(botStatus.username || 'Ryusiq_bot@')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p>البوت نشط ويستقبل الطلبات تلقائياً</p>
            </div>
          </div>

          {/* إدارة رموز الموظفين */}
          <div className="bg-card border rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm sm:text-lg font-medium flex items-center">
                <Users className="ml-2 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                {canViewAllData ? 'رموز جميع الموظفين' : 'الرمز الشخصي'}
              </h3>
              
              {canViewAllData && (
                <Button onClick={() => setShowAddDialog(true)} size="sm" className="text-xs sm:text-sm">
                  <Plus className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                  إضافة رمز
                </Button>
              )}
            </div>
            
            {/* نموذج إضافة رمز جديد */}
            {showAddDialog && (
              <div className="bg-muted rounded-lg p-3 mb-4">
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
                          .filter(emp => !telegramCodes.some(code => code.user_id === emp.user_id))
                          .map(employee => (
                            <SelectItem key={employee.user_id} value={employee.user_id}>
                              {employee.full_name || employee.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => generateNewCode(selectedEmployee)}
                      disabled={!selectedEmployee}
                      size="sm"
                      className="text-xs sm:text-sm"
                    >
                      إنشاء الرمز
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowAddDialog(false);
                        setSelectedEmployee('');
                      }}
                      size="sm"
                      className="text-xs sm:text-sm"
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6" />
                </div>
              ) : telegramCodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-xs sm:text-sm">لا توجد رموز تليغرام متوفرة</p>
                </div>
              ) : (
                telegramCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-3 w-3 sm:h-5 sm:w-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                          {code.profiles?.full_name || code.profiles?.email || 'موظف غير محدد'}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                          {editingCode === code.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={newCodeValue}
                                onChange={(e) => setNewCodeValue(e.target.value)}
                                className="h-6 text-xs px-2"
                                placeholder="رمز جديد"
                              />
                              <Button
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => updateCode(code.id)}
                              >
                                حفظ
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  setEditingCode(null);
                                  setNewCodeValue('');
                                }}
                              >
                                إلغاء
                              </Button>
                            </div>
                          ) : (
                            <>
                              <code className="text-xs px-2 py-1 bg-muted rounded">
                                {code.telegram_code}
                              </code>
                              <Badge 
                                variant={code.telegram_chat_id ? "default" : "secondary"}
                                className="text-xs w-fit"
                              >
                                {code.telegram_chat_id ? 'متصل' : 'غير متصل'}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8"
                        onClick={() => copyToClipboard(code.telegram_code, 'تم نسخ الرمز')}
                        title="نسخ الرمز"
                      >
                        <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      
                      {canViewAllData && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={() => handleEditCode(code)}
                            title="تعديل"
                          >
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCode(code.id)}
                            title="حذف"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* تعليمات الاستخدام */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Smartphone className="w-5 h-5" />
                كيفية الربط
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <p className="text-sm text-blue-700">ابحث عن البوت في التليغرام واضغط <span className="font-semibold">Start</span></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <p className="text-sm text-blue-700">أرسل الرمز الخاص بك إلى البوت</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <p className="text-sm text-blue-700">ستتلقى رسالة تأكيد ربط الحساب</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <p className="text-sm text-blue-700">ستبدأ بتلقي الإشعارات فوراً</p>
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

export default TelegramBotDialog;