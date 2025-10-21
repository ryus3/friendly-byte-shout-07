import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deleteStuckOrders } from '@/utils/deleteStuckOrders';
import { AlertTriangle, Trash2, CheckCircle } from 'lucide-react';

export default function AdminCleanup() {
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setResult(null);

    try {
      const res = await deleteStuckOrders();
      setResult(res);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            حذف الطلبات العالقة
          </CardTitle>
          <CardDescription>
            حذف 16 طلب عالق في حلقة الحذف/الإعادة اللانهائية
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>تحذير:</strong> هذا الإجراء سيحذف الطلبات التالية نهائياً:
              <div className="mt-2 text-sm font-mono bg-muted p-2 rounded">
                108336162, 108335693, 108335671, 108335666, 108335664,
                108335611, 108335568, 108335566, 108335565, 108335543,
                108335499, 108335497, 108335449, 108335445, 108335443,
                108335404
              </div>
            </AlertDescription>
          </Alert>

          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.success
                  ? `✅ تم حذف ${result.deleted} طلب بنجاح!`
                  : `❌ خطأ: ${result.error?.message || result.error}`}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleDelete}
            disabled={deleting || result?.success}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? 'جاري الحذف...' : result?.success ? 'تم الحذف ✓' : 'احذف الطلبات الآن'}
          </Button>

          {result?.success && (
            <Alert>
              <AlertDescription>
                <strong>الخطوة التالية:</strong> ارجع للنسخة من الساعة 20:32:39 من خلال History
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
