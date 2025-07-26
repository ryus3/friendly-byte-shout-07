import React from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Users, Star, Phone, User, AlertCircle } from 'lucide-react';

const EnhancedExportDialog = ({ 
  open, 
  onOpenChange, 
  customers, 
  onExport,
  loyaltyTiers = [] 
}) => {
  
  const exportOptions = [
    {
      id: 'all',
      title: 'جميع العملاء',
      description: 'تصدير كامل لقاعدة بيانات العملاء',
      count: customers.length,
      icon: Users,
      gradient: 'from-blue-500 to-purple-500',
      bgGradient: 'from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
    },
    {
      id: 'with_points',
      title: 'العملاء مع نقاط الولاء',
      description: 'العملاء الذين يملكون نقاط ولاء نشطة',
      count: customers.filter(c => c.customer_loyalty?.total_points > 0).length,
      icon: Star,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'
    },
    {
      id: 'no_points',
      title: 'العملاء بدون نقاط',
      description: 'العملاء الجدد أو غير النشطين',
      count: customers.filter(c => !c.customer_loyalty || c.customer_loyalty.total_points === 0).length,
      icon: AlertCircle,
      gradient: 'from-gray-500 to-slate-500',
      bgGradient: 'from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20'
    },
    {
      id: 'with_phone',
      title: 'العملاء مع أرقام هواتف',
      description: 'العملاء المتوفر لديهم أرقام هواتف للتواصل',
      count: customers.filter(c => c.phone && c.phone.trim()).length,
      icon: Phone,
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
    },
    {
      id: 'male',
      title: 'العملاء الرجال',
      description: 'العملاء المصنفون كرجال حسب تحليل المشتريات',
      count: customers.filter(c => 
        c.customer_gender_segments?.gender_type === 'male'
      ).length,
      icon: User,
      gradient: 'from-sky-500 to-blue-500',
      bgGradient: 'from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20'
    },
    {
      id: 'female',
      title: 'العميلات النساء',
      description: 'العميلات المصنفات كنساء حسب تحليل المشتريات',
      count: customers.filter(c => 
        c.customer_gender_segments?.gender_type === 'female'
      ).length,
      icon: User,
      gradient: 'from-pink-500 to-rose-500',
      bgGradient: 'from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20'
    }
  ];

  const handleExport = (option) => {
    onExport(option.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <Download className="h-6 w-6 text-blue-600" />
            تصدير بيانات العملاء - نظام متقدم
          </DialogTitle>
          <p className="text-muted-foreground">
            اختر نوع التصدير المطلوب - سيتم حفظ البيانات بصيغة CSV مع دعم كامل للعربية
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* خيارات التصدير الرئيسية */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exportOptions.map((option, index) => {
              const IconComponent = option.icon;
              
              return (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="relative overflow-hidden"
                >
                  <Button
                    onClick={() => handleExport(option)}
                    variant="outline"
                    className={`
                      w-full h-auto p-6 text-right flex flex-col items-start gap-3
                      bg-gradient-to-br ${option.bgGradient}
                      border border-border/60 hover:border-primary/50
                      shadow-lg hover:shadow-xl
                      transition-all duration-300
                      group relative overflow-hidden
                    `}
                    disabled={option.count === 0}
                  >
                    {/* تأثيرات بصرية */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-white/10 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* المحتوى */}
                    <div className="flex items-center justify-between w-full relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={`
                          p-3 rounded-xl bg-gradient-to-r ${option.gradient}
                          shadow-lg group-hover:shadow-xl transition-all duration-300
                          group-hover:scale-110
                        `}>
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                            {option.title}
                          </h3>
                          <p className="text-sm text-muted-foreground max-w-[200px]">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <Badge 
                          className={`
                            text-lg font-bold px-3 py-1
                            bg-gradient-to-r ${option.gradient} text-white
                            shadow-md group-hover:shadow-lg transition-all duration-300
                            ${option.count === 0 ? 'opacity-50' : ''}
                          `}
                        >
                          {option.count.toLocaleString('ar')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">عميل</span>
                      </div>
                    </div>
                    
                    {option.count === 0 && (
                      <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                        <span className="text-muted-foreground font-medium">لا توجد بيانات</span>
                      </div>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* ملاحظات ومعلومات إضافية */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800/50"
          >
            <h4 className="font-bold text-lg mb-4 text-blue-800 dark:text-blue-300">
              📋 معلومات التصدير
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-semibold mb-2 text-foreground">البيانات المُصدّرة تشمل:</h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• الاسم والهاتف والعنوان</li>
                  <li>• النقاط الحالية وتاريخ الانتهاء</li>
                  <li>• مستوى الولاء والخصومات</li>
                  <li>• عدد الطلبات وإجمالي المشتريات</li>
                  <li>• تصنيف الجنس المتوقع</li>
                  <li>• تواريخ الانضمام والترقيات</li>
                </ul>
              </div>
              
              <div>
                <h5 className="font-semibold mb-2 text-foreground">ملاحظات مهمة:</h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• ✅ تصدير CSV مع دعم كامل للعربية</li>
                  <li>• 🔒 البيانات محمية ومشفرة</li>
                  <li>• 📊 تحليل الجنس بناءً على المشتريات الفعلية</li>
                  <li>• ⭐ النقاط للعملاء ذوي الطلبات المكتملة فقط</li>
                  <li>• 📱 أرقام الهواتف متوفرة للتواصل المباشر</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedExportDialog;