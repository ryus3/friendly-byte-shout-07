/**
 * ⚡ MemoizedCard - بطاقة محسّنة للأداء
 * تستخدم React.memo لتجنب إعادة الرسم غير الضرورية
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const MemoizedCard = React.memo(({ 
  title, 
  description, 
  children, 
  footer,
  className = '',
  headerClassName = '',
  ...props 
}) => {
  return (
    <Card className={className} {...props}>
      {(title || description) && (
        <CardHeader className={headerClassName}>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        {children}
      </CardContent>
      {footer && (
        <CardFooter>
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}, (prevProps, nextProps) => {
  // تحسين: فقط أعد الرسم إذا تغيرت البيانات الفعلية
  return (
    prevProps.title === nextProps.title &&
    prevProps.description === nextProps.description &&
    prevProps.className === nextProps.className &&
    JSON.stringify(prevProps.children) === JSON.stringify(nextProps.children) &&
    JSON.stringify(prevProps.footer) === JSON.stringify(nextProps.footer)
  );
});

MemoizedCard.displayName = 'MemoizedCard';

export default MemoizedCard;
