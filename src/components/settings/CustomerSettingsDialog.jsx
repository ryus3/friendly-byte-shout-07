import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast.js';
import useLocalStorage from '@/hooks/useLocalStorage.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, User, Save, MessageCircle, RefreshCw, CheckCircle, X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const CustomerSettingsDialog = ({ open, onOpenChange }) => {
  const { user, updateUser } = useAuth();
  const [defaultCustomerName, setDefaultCustomerName] = useState(user?.default_customer_name || '');
  const [savedNames, setSavedNames] = useLocalStorage('savedCustomerNames', []);
  const [isLoading, setIsLoading] = useState(false);

  // تحديث الاسم الافتراضي عند تغيير المستخدم
  useEffect(() => {
    if (user?.default_customer_name) {
      setDefaultCustomerName(user.default_customer_name);
    }
  }, [user?.default_customer_name]);

  const handleSave = async () => {
    if (!defaultCustomerName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم الزبون الافتراضي",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateUser(user.user_id, {
        default_customer_name: defaultCustomerName.trim()
      });
      
      if (result.success) {
        // إضافة الاسم إلى قائمة الأسماء المحفوظة
        const trimmedName = defaultCustomerName.trim();
        if (!savedNames.includes(trimmedName)) {
          setSavedNames(prev => [trimmedName, ...prev.slice(0, 4)]); // احتفظ بآخر 5 أسماء
        }
        
        toast({
          title: "تم الحفظ بنجاح",
          description: "تم تحديث اسم الزبون الافتراضي بنجاح"
        });
        
        onOpenChange(false);
      } else {
        throw new Error(result.error?.message || 'فشل في الحفظ');
      }
    } catch (error) {
      console.error('Error saving default customer name:', error);
      toast({
        title: "خطأ في الحفظ",
        description: error.message || "حدث خطأ أثناء حفظ الإعدادات",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSavedName = (name) => {
    setDefaultCustomerName(name);
  };

  const handleRemoveSavedName = (nameToRemove) => {
    setSavedNames(prev => prev.filter(name => name !== nameToRemove));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[95vh] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">إعدادات الزبائن</DialogTitle>
              <DialogDescription>
                إدارة الاسم الافتراضي للزبائن في الطلبات الجديدة
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-emerald-600" />
                <div>
                  <CardTitle className="text-lg text-emerald-700 dark:text-emerald-300">
                    اسم الزبون الافتراضي
                  </CardTitle>
                  <CardDescription className="text-emerald-600 dark:text-emerald-400">
                    هذا الاسم سيظهر تلقائياً في حقل اسم الزبون عند إنشاء طلب جديد
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultCustomerName" className="text-sm font-medium">
                  الاسم الافتراضي
                </Label>
                <Input
                  id="defaultCustomerName"
                  value={defaultCustomerName}
                  onChange={(e) => setDefaultCustomerName(e.target.value)}
                  placeholder="مثال: زبون عام، عميل محترم، إلخ..."
                  className="bg-white dark:bg-gray-900"
                />
                <p className="text-xs text-muted-foreground">
                  يمكنك تعديل هذا الاسم في كل طلب حسب الحاجة
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">قابل للتعديل</span>
                    <p className="text-xs text-blue-500 opacity-70">في كل طلب</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <RefreshCw className="w-4 h-4 text-purple-500" />
                  <div>
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">ملء تلقائي</span>
                    <p className="text-xs text-purple-500 opacity-70">فوري</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <div>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">توفير وقت</span>
                    <p className="text-xs text-green-500 opacity-70">أسرع</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {user?.default_customer_name && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-sm text-blue-700 dark:text-blue-300">
                  الاسم الحالي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  "{user.default_customer_name}"
                </p>
                <p className="text-xs text-blue-500 opacity-70 mt-1">
                  هذا هو الاسم المستخدم حالياً في الطلبات الجديدة
                </p>
              </CardContent>
            </Card>
          )}

          {/* قائمة الأسماء المحفوظة */}
          {savedNames.length > 0 && (
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  الأسماء المحفوظة
                </CardTitle>
                <CardDescription className="text-purple-600 dark:text-purple-400">
                  اختر من الأسماء المستخدمة سابقاً
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {savedNames.map((name, index) => (
                    <Badge 
                      key={index}
                      variant="outline" 
                      className="cursor-pointer group border-purple-200 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-800 flex items-center gap-1"
                    >
                      <span onClick={() => handleSelectSavedName(name)}>{name}</span>
                      <X 
                        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-red-500" 
                        onClick={() => handleRemoveSavedName(name)}
                      />
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                حفظ الإعدادات
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerSettingsDialog;