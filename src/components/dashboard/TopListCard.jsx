import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const TopListCard = ({ title, items, titleIcon: TitleIcon, itemIcon: ItemIcon }) => {
  const handleViewAll = () => {
    toast({
      title: "🚧 هذه الميزة غير مطبقة بعد",
      description: "لكن لا تقلق! يمكنك طلبها في الرسالة التالية! 🚀"
    });
  };

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
          {items.length > 0 ? items.map((item, index) => (
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
                  <p className="text-sm text-muted-foreground">{item.value}</p>
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