import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * نظام pagination احترافي responsive
 * - 3 أزرار على الموبايل
 * - 5 أزرار على التابلت
 * - 7 أزرار على الكمبيوتر
 * - يتحرك ذكياً مع الصفحة الحالية
 */
const SmartPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems = 0,
  itemsPerPage = 20,
  className = ''
}) => {
  // حساب عدد الأزرار حسب حجم الشاشة
  const visiblePages = useMemo(() => {
    if (typeof window === 'undefined') return 5;
    const width = window.innerWidth;
    if (width < 640) return 3; // موبايل
    if (width < 1024) return 5; // تابلت
    return 7; // كمبيوتر
  }, []);

  // حساب نطاق الصفحات المعروضة
  const pageRange = useMemo(() => {
    if (totalPages <= visiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(visiblePages / 2);
    let startPage = Math.max(1, currentPage - half);
    let endPage = Math.min(totalPages, startPage + visiblePages - 1);

    if (endPage - startPage + 1 < visiblePages) {
      startPage = Math.max(1, endPage - visiblePages + 1);
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  }, [currentPage, totalPages, visiblePages]);

  // حساب نطاق العناصر المعروضة
  const itemsRange = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);
    return { start, end };
  }, [currentPage, itemsPerPage, totalItems]);

  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex flex-col items-center gap-4 mt-6", className)}>
      {/* أزرار التنقل */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* الصفحة الأولى */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-9 w-9 hover:scale-105 transition-transform"
          aria-label="الصفحة الأولى"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        {/* السابق */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-9 w-9 hover:scale-105 transition-transform"
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* أزرار الصفحات */}
        <div className="flex items-center gap-1">
          {pageRange.map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="icon"
              onClick={() => onPageChange(page)}
              className={cn(
                "h-9 w-9 transition-all duration-200",
                currentPage === page
                  ? "scale-110 shadow-lg"
                  : "hover:scale-105 hover:shadow-md"
              )}
              aria-label={`الصفحة ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </Button>
          ))}
        </div>

        {/* التالي */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-9 w-9 hover:scale-105 transition-transform"
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* الصفحة الأخيرة */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-9 w-9 hover:scale-105 transition-transform"
          aria-label="الصفحة الأخيرة"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* معلومات الصفحة */}
      <div className="text-sm text-muted-foreground text-center">
        <span className="hidden sm:inline">
          صفحة <span className="font-semibold text-foreground">{currentPage}</span> من{' '}
          <span className="font-semibold text-foreground">{totalPages}</span>
        </span>
        {totalItems > 0 && (
          <>
            <span className="hidden sm:inline mx-2">•</span>
            <span>
              عرض{' '}
              <span className="font-semibold text-foreground">{itemsRange.start}</span>
              {' '}-{' '}
              <span className="font-semibold text-foreground">{itemsRange.end}</span>
              {' '}من{' '}
              <span className="font-semibold text-foreground">{totalItems}</span>
              {' '}
              <span className="hidden sm:inline">عنصر</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default SmartPagination;
