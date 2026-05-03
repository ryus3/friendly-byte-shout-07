import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import devLog from '@/lib/devLogger';

const TopListCard = ({ title, items, titleIcon: TitleIcon, itemIcon: ItemIcon, sortByPhone = false, onViewAll }) => {
  // إزالة التكرار في devLog
  React.useEffect(() => {
    devLog.log(`📊 TopListCard [${title}] - البيانات:`, {
      count: items?.length || 0,
      hasData: !!(items && items.length > 0)
    });
  }, [title, items?.length]); // فقط عند تغيير العدد

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    }
  };

  // إذا كان التصنيف حسب رقم الهاتف، نقوم بتجميع البيانات حسب رقم الهاتف
  const processedItems = React.useMemo(() => {
    if (!items || items.length === 0) return [];
    
    return sortByPhone ? 
      items.map(item => ({
        ...item,
        // إظهار رقم الهاتف بدلاً من الاسم كـ label إذا كان متوفراً
        label: item.phone && item.phone !== 'غير محدد' ? item.phone : item.label,
        phone: item.phone || 'غير محدد'
      }))
      : items;
  }, [items, sortByPhone]); // memo لتجنب إعادة الحساب

  return (
    <Card className="glass-effect h-full border-border/60 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl text-foreground">
          {TitleIcon && <TitleIcon className="w-6 h-6 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0">
        <div className="space-y-4 flex-1">
          {processedItems.length > 0 ? processedItems.slice(0, 5).map((item, index) => (
            <motion.div 
              key={index} 
              className="flex items-center justify-between"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-4">
                {ItemIcon && (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <ItemIcon className="w-5 h-5" />
                  </div>
                )}
                 <div>
                   <p className="font-semibold text-foreground">{item.label}</p>
                   <p className="text-sm text-muted-foreground">
                     {sortByPhone ? (
                       <>
                         <span className="font-medium text-primary">{item.phone}</span>
                         <span className="mx-1">•</span>
                         <span>{item.value}</span>
                       </>
                     ) : item.value}
                   </p>
                 </div>
              </div>
            </motion.div>
          )) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>لا توجد بيانات لعرضها.</p>
            </div>
          )}
        </div>
        <Button variant="link" className="mt-4 w-full text-primary" onClick={handleViewAll}>
          مشاهدة الكل
        </Button>
      </CardContent>
    </Card>
  );
};

export default TopListCard;