import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Copy, RefreshCcw, CheckCircle, XCircle, Search, Users } from 'lucide-react';
import { TelegramIcon, TelegramCodeIcon } from '@/components/ui/custom-icons';
import { toast } from '@/components/ui/use-toast';
import { useAuth, usePermissions } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const TelegramCodesManager = () => {
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = hasPermission('manage_employees');

  useEffect(() => {
    fetchTelegramCodes();
  }, [user, isAdmin]);

  const fetchTelegramCodes = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('employee_telegram_codes')
        .select(`
          *,
          profiles!telegram_employee_codes_user_id_fkey(
            full_name,
            username,
            email,
            status,
            is_active
          )
        `);

      // إذا لم يكن المستخدم مديراً، أظهر كوده فقط
      if (!isAdmin) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching telegram codes:', error);
        toast({
          title: "خطأ",
          description: "حدث خطأ في جلب أكواد التليغرام",
          variant: "destructive"
        });
        return;
      }

      setCodes(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewCode = async (userId) => {
    try {
      setRefreshing(true);
      
      const { data, error } = await supabase.rpc('generate_employee_telegram_code', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error generating code:', error);
        toast({
          title: "خطأ",
          description: "حدث خطأ في توليد الكود الجديد",
          variant: "destructive"
        });
        return;
      }

      // تحديث أو إدراج الكود الجديد
      const { error: upsertError } = await supabase
        .from('employee_telegram_codes')
        .upsert({
          user_id: userId,
          telegram_code: data,
          is_active: true
        });

      if (upsertError) {
        console.error('Error updating code:', upsertError);
        toast({
          title: "خطأ",
          description: "حدث خطأ في حفظ الكود الجديد",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "تم بنجاح",
        description: "تم توليد كود جديد بنجاح",
        variant: "default"
      });

      await fetchTelegramCodes();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "تم النسخ",
        description: "تم نسخ الكود إلى الحافظة",
        variant: "default"
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const filteredCodes = codes.filter(code =>
    code.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.telegram_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TelegramIcon className="w-5 h-5" />
            أكواد التليغرام
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TelegramIcon className="w-5 h-5" />
          أكواد التليغرام
        </CardTitle>
        <CardDescription>
          {isAdmin 
            ? "إدارة أكواد التليغرام لجميع الموظفين وربطها بحساباتهم"
            : "كود التليغرام الخاص بك لربط حسابك"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isAdmin && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="font-medium">إجمالي الأكواد: {codes.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="البحث في الموظفين..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchTelegramCodes}
                disabled={refreshing}
              >
                <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {filteredCodes.length === 0 ? (
            <div className="text-center py-8">
              <TelegramCodeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">لا توجد أكواد</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'لم يتم العثور على أكواد مطابقة للبحث' : 'لم يتم إنشاء أي أكواد بعد'}
              </p>
            </div>
          ) : (
            filteredCodes.map((code) => (
              <div
                key={code.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TelegramCodeIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">
                          {code.profiles?.full_name || 'غير محدد'}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          @{code.profiles?.username || 'غير محدد'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <TelegramIcon className="w-4 h-4" />
                          <span className="font-mono font-bold text-primary">
                            {code.telegram_code}
                          </span>
                        </div>
                        {code.telegram_chat_id && (
                          <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">
                            <CheckCircle className="w-3 h-3 ml-1" />
                            مربوط
                          </Badge>
                        )}
                        {!code.telegram_chat_id && (
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                            <XCircle className="w-3 h-3 ml-1" />
                            غير مربوط
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(code.telegram_code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    {(isAdmin || code.user_id === user?.id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateNewCode(code.user_id)}
                        disabled={refreshing}
                      >
                        <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </div>
                </div>
                
                {code.linked_at && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      تم الربط في: {new Date(code.linked_at).toLocaleDateString('ar-SA')} في {new Date(code.linked_at).toLocaleTimeString('ar-SA')}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!isAdmin && codes.length === 0 && (
          <div className="text-center py-8">
            <TelegramCodeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">لا يوجد كود</h3>
            <p className="text-muted-foreground mb-4">لم يتم إنشاء كود التليغرام الخاص بك بعد</p>
            <Button 
              onClick={() => generateNewCode(user?.id)}
              disabled={refreshing}
            >
              <TelegramIcon className="w-4 h-4 ml-1" />
              إنشاء كود جديد
            </Button>
          </div>
        )}

        <Separator />
        
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">كيفية الاستخدام:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>انسخ الكود المخصص لك</li>
            <li>افتح بوت التليغرام الخاص بالنظام</li>
            <li>أرسل الكود للبوت لربط حسابك</li>
            <li>ستتمكن من استقبال الإشعارات والتفاعل مع النظام</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default TelegramCodesManager;