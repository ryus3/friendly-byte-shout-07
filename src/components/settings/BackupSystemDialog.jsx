import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Download, 
  Upload, 
  Database, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  HardDrive,
  FileText,
  RefreshCw,
  Shield,
  Calendar,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const BackupSystemDialog = ({ open, onOpenChange }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreOptions, setRestoreOptions] = useState({
    clearExisting: false,
    confirmRestore: false
  });
  const [activeTab, setActiveTab] = useState('list');

  // جلب قائمة النسخ الاحتياطية
  const fetchBackups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-system', {
        body: { action: 'list_backups' }
      });

      if (error) throw error;

      if (data.success) {
        setBackups(data.backups);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('خطأ في جلب النسخ الاحتياطية:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب قائمة النسخ الاحتياطية",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // إنشاء نسخة احتياطية جديدة
  const createBackup = async () => {
    setCreating(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      const { data, error } = await supabase.functions.invoke('backup-system', {
        body: { 
          action: 'create_backup',
          data: { userId: user?.id }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "تم بنجاح ✅",
          description: `تم إنشاء النسخة الاحتياطية بنجاح\n${data.total_records} سجل من ${data.tables_count} جدول`
        });
        fetchBackups();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
      toast({
        title: "خطأ",
        description: "فشل في إنشاء النسخة الاحتياطية",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  // استعادة نسخة احتياطية
  const restoreBackup = async () => {
    if (!selectedBackup || !restoreOptions.confirmRestore) {
      toast({
        title: "تحذير",
        description: "يرجى تأكيد الاستعادة أولاً",
        variant: "destructive"
      });
      return;
    }

    setRestoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-system', {
        body: { 
          action: 'restore_backup',
          data: { 
            backupId: selectedBackup.id,
            options: restoreOptions
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "تم بنجاح ✅",
          description: `تم استعادة النسخة الاحتياطية بنجاح\n${data.total_records} سجل تم استعادتها`
        });
        setActiveTab('list');
        setSelectedBackup(null);
        setRestoreOptions({ clearExisting: false, confirmRestore: false });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('خطأ في استعادة النسخة الاحتياطية:', error);
      toast({
        title: "خطأ",
        description: "فشل في استعادة النسخة الاحتياطية",
        variant: "destructive"
      });
    } finally {
      setRestoring(false);
    }
  };

  // تحميل نسخة احتياطية
  const downloadBackup = async (backup) => {
    try {
      const { data, error } = await supabase.functions.invoke('backup-system', {
        body: { 
          action: 'download_backup',
          data: { backupId: backup.id }
        }
      });

      if (error) throw error;

      // إنشاء ملف للتحميل
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "تم التحميل ✅",
        description: "تم تحميل النسخة الاحتياطية بنجاح"
      });
    } catch (error) {
      console.error('خطأ في تحميل النسخة الاحتياطية:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل النسخة الاحتياطية",
        variant: "destructive"
      });
    }
  };

  // حذف نسخة احتياطية
  const deleteBackup = async (backupId) => {
    try {
      const { data, error } = await supabase.functions.invoke('backup-system', {
        body: { 
          action: 'delete_backup',
          data: { backupId }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "تم الحذف ✅",
          description: "تم حذف النسخة الاحتياطية بنجاح"
        });
        fetchBackups();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('خطأ في حذف النسخة الاحتياطية:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف النسخة الاحتياطية",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchBackups();
    }
  }, [open]);

  const formatFileSize = (sizeMb) => {
    if (sizeMb < 1) return `${(sizeMb * 1024).toFixed(1)} KB`;
    return `${sizeMb.toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ar });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">نظام النسخ الاحتياطي والاستعادة</h2>
              <p className="text-sm text-muted-foreground">إدارة شاملة وآمنة لبيانات النظام</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* التبويبات */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={activeTab === 'list' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('list')}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              النسخ الاحتياطية
            </Button>
            <Button
              variant={activeTab === 'create' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('create')}
              className="flex-1"
            >
              <Database className="w-4 h-4 mr-2" />
              إنشاء نسخة
            </Button>
            <Button
              variant={activeTab === 'restore' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('restore')}
              className="flex-1"
              disabled={!selectedBackup}
            >
              <Upload className="w-4 h-4 mr-2" />
              استعادة البيانات
            </Button>
          </div>

          <ScrollArea className="h-[500px]">
            <AnimatePresence mode="wait">
              {/* قائمة النسخ الاحتياطية */}
              {activeTab === 'list' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">النسخ الاحتياطية المتاحة</h3>
                    <Button onClick={fetchBackups} variant="outline" size="sm" disabled={loading}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      تحديث
                    </Button>
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                      <p>جاري تحميل النسخ الاحتياطية...</p>
                    </div>
                  ) : backups.length === 0 ? (
                    <div className="text-center py-8">
                      <Database className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">لا توجد نسخ احتياطية</h3>
                      <p className="text-muted-foreground">ابدأ بإنشاء أول نسخة احتياطية لحماية بياناتك</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {backups.map((backup) => (
                        <motion.div
                          key={backup.id}
                          whileHover={{ scale: 1.02 }}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedBackup?.id === backup.id ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                          onClick={() => setSelectedBackup(backup)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <HardDrive className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold">{backup.filename}</h4>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(backup.created_at)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <HardDrive className="w-3 h-3" />
                                    {formatFileSize(backup.size_mb)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {backup.profiles?.full_name || 'مجهول'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={backup.backup_type === 'full' ? 'default' : 'secondary'}>
                                {backup.backup_type === 'full' ? 'نسخة كاملة' : 'نسخة جزئية'}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadBackup(backup);
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من حذف هذه النسخة الاحتياطية؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteBackup(backup.id)}>
                                      حذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* إنشاء نسخة احتياطية */}
              {activeTab === 'create' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        إنشاء نسخة احتياطية جديدة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">+18</div>
                          <div className="text-sm text-muted-foreground">جدول قاعدة بيانات</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">100%</div>
                          <div className="text-sm text-muted-foreground">نسخ آمن ومشفر</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">JSON</div>
                          <div className="text-sm text-muted-foreground">تنسيق قابل للقراءة</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">∞</div>
                          <div className="text-sm text-muted-foreground">استعادة لا محدودة</div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm">سيتم نسخ جميع البيانات الأساسية للنظام</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <Shield className="w-5 h-5 text-blue-600" />
                          <span className="text-sm">النسخة محمية بصلاحيات المديرين فقط</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <Clock className="w-5 h-5 text-purple-600" />
                          <span className="text-sm">الاحتفاظ بآخر 10 نسخ احتياطية تلقائياً</span>
                        </div>
                      </div>

                      <Button 
                        onClick={createBackup} 
                        disabled={creating}
                        className="w-full"
                        size="lg"
                      >
                        {creating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            جاري إنشاء النسخة الاحتياطية...
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4 mr-2" />
                            إنشاء نسخة احتياطية الآن
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* استعادة البيانات */}
              {activeTab === 'restore' && selectedBackup && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        استعادة البيانات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* معلومات النسخة المحددة */}
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">النسخة المحددة للاستعادة:</h4>
                        <div className="text-sm space-y-1">
                          <p><strong>الملف:</strong> {selectedBackup.filename}</p>
                          <p><strong>التاريخ:</strong> {formatDate(selectedBackup.created_at)}</p>
                          <p><strong>الحجم:</strong> {formatFileSize(selectedBackup.size_mb)}</p>
                          <p><strong>المنشئ:</strong> {selectedBackup.profiles?.full_name || 'مجهول'}</p>
                        </div>
                      </div>

                      {/* خيارات الاستعادة */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="clearExisting"
                            checked={restoreOptions.clearExisting}
                            onCheckedChange={(checked) => 
                              setRestoreOptions(prev => ({ ...prev, clearExisting: checked }))
                            }
                          />
                          <Label htmlFor="clearExisting" className="text-sm">
                            مسح البيانات الموجودة قبل الاستعادة (موصى به)
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="confirmRestore"
                            checked={restoreOptions.confirmRestore}
                            onCheckedChange={(checked) => 
                              setRestoreOptions(prev => ({ ...prev, confirmRestore: checked }))
                            }
                          />
                          <Label htmlFor="confirmRestore" className="text-sm font-semibold text-red-600">
                            أؤكد أنني أفهم أن هذا الإجراء سيؤثر على البيانات الحالية
                          </Label>
                        </div>
                      </div>

                      {/* تحذيرات مهمة */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                          <div className="text-sm">
                            <strong>تحذير مهم:</strong> ستؤثر عملية الاستعادة على جميع البيانات الحالية في النظام.
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                          <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div className="text-sm">
                            يُنصح بإنشاء نسخة احتياطية من البيانات الحالية قبل الاستعادة.
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <Button 
                        onClick={restoreBackup} 
                        disabled={restoring || !restoreOptions.confirmRestore}
                        variant="destructive"
                        className="w-full"
                        size="lg"
                      >
                        {restoring ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            جاري استعادة البيانات...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            بدء عملية الاستعادة
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BackupSystemDialog;