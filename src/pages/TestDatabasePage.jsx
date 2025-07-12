import React, { useState, useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, Database } from 'lucide-react';

const TestDatabasePage = () => {
  const { db } = useSupabase();
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [running, setRunning] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const runTests = async () => {
    setRunning(true);
    const testResults = [];

    // Test 1: Database connection
    try {
      await db.categories.getAll();
      testResults.push({ name: 'اتصال قاعدة البيانات', status: 'success', message: 'نجح الاتصال' });
    } catch (error) {
      testResults.push({ name: 'اتصال قاعدة البيانات', status: 'error', message: error.message });
    }

    // Test 2: Authentication
    if (user) {
      testResults.push({ name: 'تسجيل الدخول', status: 'success', message: `مسجل باسم: ${user.full_name}` });
    } else {
      testResults.push({ name: 'تسجيل الدخول', status: 'error', message: 'غير مسجل دخول' });
    }

    // Test 3: Create category
    try {
      const testCategory = await db.categories.create({
        name: `اختبار-${Date.now()}`,
        description: 'فئة اختبار'
      });
      testResults.push({ name: 'إنشاء فئة', status: 'success', message: `تم إنشاء: ${testCategory.name}` });
    } catch (error) {
      testResults.push({ name: 'إنشاء فئة', status: 'error', message: error.message });
    }

    // Test 4: Read categories
    try {
      const categories = await db.categories.getAll();
      testResults.push({ name: 'قراءة الفئات', status: 'success', message: `عدد الفئات: ${categories.length}` });
    } catch (error) {
      testResults.push({ name: 'قراءة الفئات', status: 'error', message: error.message });
    }

    // Test 5: Create color
    try {
      const testColor = await db.colors.create({
        name: `لون-اختبار-${Date.now()}`,
        hex_code: '#FF0000'
      });
      testResults.push({ name: 'إنشاء لون', status: 'success', message: `تم إنشاء: ${testColor.name}` });
    } catch (error) {
      testResults.push({ name: 'إنشاء لون', status: 'error', message: error.message });
    }

    // Test 6: Create size
    try {
      const testSize = await db.sizes.create({
        name: `مقاس-اختبار-${Date.now()}`
      });
      testResults.push({ name: 'إنشاء مقاس', status: 'success', message: `تم إنشاء: ${testSize.name}` });
    } catch (error) {
      testResults.push({ name: 'إنشاء مقاس', status: 'error', message: error.message });
    }

    // Test 7: Storage test
    try {
      // Create a simple blob and upload it
      const testBlob = new Blob(['test content'], { type: 'text/plain' });
      const testFile = new File([testBlob], 'test.txt', { type: 'text/plain' });
      const url = await db.storage?.uploadProductImage?.(testFile, `test-${Date.now()}`);
      if (url) {
        testResults.push({ name: 'رفع ملف', status: 'success', message: 'تم رفع ملف اختبار' });
      } else {
        testResults.push({ name: 'رفع ملف', status: 'warning', message: 'لم يتم تكوين التخزين' });
      }
    } catch (error) {
      testResults.push({ name: 'رفع ملف', status: 'error', message: error.message });
    }

    setTests(testResults);
    setRunning(false);
  };

  const createTestCategory = async () => {
    if (!newCategory.trim()) return;
    
    try {
      const category = await db.categories.create({
        name: newCategory,
        description: 'فئة منشأة من صفحة الاختبار'
      });
      toast({
        title: 'تم إنشاء الفئة',
        description: `تم إنشاء فئة "${category.name}" بنجاح`
      });
      setNewCategory('');
    } catch (error) {
      toast({
        title: 'خطأ في إنشاء الفئة',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <Database className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold">اختبار قاعدة البيانات</h1>
        <p className="text-muted-foreground">تحقق من حالة الاتصال والوظائف</p>
      </div>

      <div className="flex justify-center">
        <Button onClick={runTests} disabled={running} className="flex items-center gap-2">
          {running ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              جاري التشغيل...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              تشغيل الاختبارات
            </>
          )}
        </Button>
      </div>

      {tests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج الاختبار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tests.map((test, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {test.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {test.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                    {test.status === 'warning' && <XCircle className="h-5 w-5 text-yellow-500" />}
                    <span className="font-medium">{test.name}</span>
                  </div>
                  <div className="text-right">
                    <Badge variant={test.status === 'success' ? 'default' : test.status === 'error' ? 'destructive' : 'secondary'}>
                      {test.status === 'success' ? 'نجح' : test.status === 'error' ? 'فشل' : 'تحذير'}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">{test.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>اختبار إنشاء فئة جديدة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="اسم الفئة الجديدة"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1"
            />
            <Button onClick={createTestCategory} disabled={!newCategory.trim()}>
              إنشاء
            </Button>
          </div>
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>معلومات المستخدم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>الاسم:</strong> {user.full_name}</div>
              <div><strong>اسم المستخدم:</strong> {user.username}</div>
              <div><strong>البريد:</strong> {user.email}</div>
              <div><strong>الدور:</strong> {user.role}</div>
              <div><strong>الحالة:</strong> {user.status}</div>
              <div><strong>النشط:</strong> {user.is_active ? 'نعم' : 'لا'}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TestDatabasePage;