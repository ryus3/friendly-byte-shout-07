import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// مكون جدول محسن للهواتف
const MobileTable = ({ children, className, ...props }) => (
  <div className={cn("space-y-3", className)} {...props}>
    {children}
  </div>
);

const MobileTableHeader = ({ children, className, ...props }) => (
  <div className={cn("hidden", className)} {...props}>
    {children}
  </div>
);

const MobileTableBody = ({ children, className, ...props }) => (
  <div className={cn("space-y-3", className)} {...props}>
    {children}
  </div>
);

const MobileTableRow = ({ children, className, onClick, ...props }) => (
  <Card 
    className={cn(
      "overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-md", 
      onClick && "hover:bg-accent/50",
      className
    )} 
    onClick={onClick}
    {...props}
  >
    <CardContent className="p-4">
      <div className="space-y-3">
        {children}
      </div>
    </CardContent>
  </Card>
);

const MobileTableCell = ({ 
  children, 
  className, 
  label, 
  primary = false, 
  secondary = false,
  actions = false,
  ...props 
}) => {
  if (actions) {
    return (
      <div className={cn("flex items-center justify-end gap-2", className)} {...props}>
        {children}
      </div>
    );
  }

  if (primary) {
    return (
      <div className={cn("space-y-1", className)} {...props}>
        <div className="font-semibold text-foreground text-base">{children}</div>
      </div>
    );
  }

  if (secondary) {
    return (
      <div className={cn("space-y-1", className)} {...props}>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      {label && <span className="text-sm text-muted-foreground font-medium">{label}:</span>}
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
};

// مكون مخصص لعرض صفوف متعددة الأعمدة
const MobileTableGrid = ({ children, className, ...props }) => (
  <div className={cn("grid grid-cols-2 gap-2", className)} {...props}>
    {children}
  </div>
);

export {
  MobileTable,
  MobileTableHeader,
  MobileTableBody,
  MobileTableRow,
  MobileTableCell,
  MobileTableGrid,
};