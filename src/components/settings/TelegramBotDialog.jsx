import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { 
  MessageCircle, Copy, Users, Bot, QrCode, 
  CheckCircle, AlertCircle, Smartphone 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const TelegramBotDialog = ({ open, onOpenChange }) => {
  const { user, allUsers } = useAuth();
  const [botToken, setBotToken] = useState('');
  const [isBotConnected, setIsBotConnected] = useState(false);

  // توليد رمز مختصر لكل موظف
  const generateEmployeeCode = (employeeId, username) => {
    const shortId = employeeId.slice(-4);
    const shortUsername = username.slice(0, 3).toUpperCase();
    return `${shortUsername}${shortId}`;
  };

  const employees = allUsers?.filter(u => u.role !== 'owner') || [];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ الرمز إلى الحافظة",
      variant: "success"
    });
  };

  const connectBot = async () => {
    if (!botToken.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رمز البوت",
        variant: "destructive"
      });
      return;
    }

    // محاكاة ربط البوت
    setIsBotConnected(true);
    toast({
      title: "تم الربط!",
      description: "تم ربط بوت التليغرام بنجاح",
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
          {/* حالة البوت */}
          <Card className={isBotConnected ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {isBotConnected ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-700">البوت متصل</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <span className="text-orange-700">البوت غير متصل</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isBotConnected ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bot-token">رمز البوت (Bot Token)</Label>
                    <Input
                      id="bot-token"
                      type="password"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      احصل على الرمز من @BotFather في التليغرام
                    </p>
                  </div>
                  <Button onClick={connectBot} className="w-full">
                    <Bot className="w-4 h-4 ml-2" />
                    ربط البوت
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-green-700 text-sm">
                    البوت متصل ويعمل بنجاح. يمكن للموظفين الآن استخدام رموزهم الخاصة.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsBotConnected(false)}
                    className="w-full"
                  >
                    قطع الاتصال
                  </Button>
                </div>
              )}
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
                كل موظف له رمز مختصر خاص به لربط حسابه بالبوت
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* رمز المالك */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{user?.full_name?.charAt(0) || 'M'}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{user?.full_name || 'المالك'}</p>
                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                        مالك
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-mono text-lg px-3 py-1">
                      {generateEmployeeCode(user?.user_id || '0000', user?.username || 'OWNER')}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(generateEmployeeCode(user?.user_id || '0000', user?.username || 'OWNER'))}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* رموز الموظفين */}
                {employees.map((employee) => (
                  <div key={employee.user_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">{employee.full_name?.charAt(0) || 'E'}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{employee.full_name}</p>
                        <Badge variant="secondary" className="text-xs">
                          {employee.role === 'manager' ? 'مدير' : 'موظف'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-lg px-3 py-1 bg-green-50 text-green-700 border-green-300">
                        {generateEmployeeCode(employee.user_id, employee.username)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generateEmployeeCode(employee.user_id, employee.username))}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {employees.length === 0 && (
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