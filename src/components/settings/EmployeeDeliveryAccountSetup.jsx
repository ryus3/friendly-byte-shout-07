import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Truck, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Key,
  User,
  Save,
  TestTube
} from 'lucide-react';
import { useEmployeeDeliveryAccounts } from '@/hooks/useEmployeeDeliveryAccounts';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useToast } from '@/hooks/use-toast';
import * as AlWaseetAPI from '@/lib/alwaseet-api';

const EmployeeDeliveryAccountSetup = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    currentUserAccount, 
    saveDeliveryAccount, 
    hasActiveAccount,
    getCurrentUserToken,
    loading 
  } = useEmployeeDeliveryAccounts();
  
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    token: ''
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // تحميل البيانات الحالية
  useEffect(() => {
    if (currentUserAccount) {
      setFormData({
        account_code: currentUserAccount.account_code || '',
        account_name: currentUserAccount.account_name || '',
        token: currentUserAccount.partner_data?.token || ''
      });
    }
  }, [currentUserAccount]);

  // اختبار الاتصال
  const testConnection = async () => {
    if (!formData.token) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رمز الوصول أولاً",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // اختبار الاتصال بجلب المدن
      const cities = await AlWaseetAPI.getCities(formData.token);
      
      if (cities && cities.length > 0) {
        setTestResult({ success: true, message: 'تم الاتصال بنجاح' });
        toast({
          title: "نجح الاختبار",
          description: "تم التحقق من صحة رمز الوصول"
        });
      } else {
        setTestResult({ success: false, message: 'فشل في جلب البيانات' });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error.message || 'فشل في الاتصال' 
      });
      toast({
        title: "فشل الاختبار",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  // حفظ الحساب
  const handleSave = async () => {
    if (!formData.account_code || !formData.token) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    const result = await saveDeliveryAccount(formData);
    
    if (result.success) {
      onOpenChange(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // إعادة تعيين نتيجة الاختبار عند تغيير البيانات
    setTestResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            إعداد حساب التوصيل
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* حالة الاتصال الحالية */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="w-4 h-4" />
                حالة الاتصال
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {hasActiveAccount() ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">متصل</span>
                    <Badge variant="success" className="mr-auto">
                      {currentUserAccount?.account_code}
                    </Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-600">غير متصل</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* نموذج الإعداد */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="account_code" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                رمز الحساب *
              </Label>
              <Input
                id="account_code"
                value={formData.account_code}
                onChange={(e) => handleInputChange('account_code', e.target.value)}
                placeholder="مثال: Ryusiq"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="account_name">اسم الحساب</Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => handleInputChange('account_name', e.target.value)}
                placeholder="اسم اختياري للحساب"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="token" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                رمز الوصول *
              </Label>
              <Input
                id="token"
                type="password"
                value={formData.token}
                onChange={(e) => handleInputChange('token', e.target.value)}
                placeholder="رمز الوصول من شركة التوصيل"
                className="mt-1"
              />
            </div>
          </div>

          {/* نتيجة الاختبار */}
          {testResult && (
            <Card className={testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardContent className="pt-3">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.message}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* الأزرار */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={testing || !formData.token}
              className="flex-1"
            >
              <TestTube className="w-4 h-4 mr-2" />
              {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={loading || !formData.account_code || !formData.token}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              حفظ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeDeliveryAccountSetup;