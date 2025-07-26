
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// مكون جدول محسن للهواتف
const MobileTable = ({ children, className, ...props }) => (
  <div className={cn("w-full overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const MobileTableHeader = ({ children, className, ...props }) => (
  <div className={cn("hidden md:block", className)} {...props}>
    {children}
  </div>
);

const MobileTableBody = ({ children, className, ...props }) => (
  <div className={cn("space-y-3 px-2 md:px-0", className)} {...props}>
    {children}
  </div>
);

const MobileTableRow = ({ children, className, onClick, ...props }) => (
  <Card 
    className={cn(
      "w-full overflow-hidden transition-all duration-200 shadow-sm border-l-4 border-l-primary/20", 
      onClick && "cursor-pointer hover:shadow-md active:scale-[0.99] touch-manipulation",
      className
    )} 
    onClick={onClick}
    {...props}
  >
    <CardContent className="p-3 md:p-4 space-y-3">
      {children}
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
      <div className={cn("flex items-center justify-end gap-2 pt-2 border-t border-border", className)} {...props}>
        {children}
      </div>
    );
  }

  if (primary) {
    return (
      <div className={cn("", className)} {...props}>
        <div className="font-bold text-foreground text-lg leading-tight">{children}</div>
      </div>
    );
  }

  if (secondary) {
    return (
      <div className={cn("", className)} {...props}>
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-start justify-between gap-2 py-1", className)} {...props}>
      {label && (
        <span className="text-sm font-medium text-muted-foreground shrink-0 min-w-0">
          {label}:
        </span>
      )}
      <span className="text-sm text-foreground text-left min-w-0 flex-1">{children}</span>
    </div>
  );
};

// مكون مخصص لعرض صفوف متعددة الأعمدة
const MobileTableGrid = ({ children, className, ...props }) => (
  <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-2", className)} {...props}>
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
