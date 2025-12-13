import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton موحد للصفحات
export const PageSkeleton = ({ variant = "default" }) => {
  if (variant === "dashboard") {
    return (
      <div className="p-4 space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border bg-card">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        
        {/* Content */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border bg-card space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="p-4 rounded-xl border bg-card space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="p-4 space-y-4 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
        
        {/* List Items */}
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border bg-card flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="p-4 space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        
        <div className="space-y-4 max-w-xl">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-full mt-6" />
        </div>
      </div>
    );
  }

  // Default skeleton
  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
};

// Skeleton للبطاقات
export const CardSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="p-4 rounded-xl border bg-card animate-pulse">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-8 w-16" />
      </div>
    ))}
  </div>
);

// Skeleton للجداول
export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="rounded-xl border overflow-hidden">
    <div className="bg-muted/50 p-3 flex gap-4">
      {[...Array(cols)].map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="p-3 flex gap-4 border-t">
        {[...Array(cols)].map((_, j) => (
          <Skeleton key={j} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export default PageSkeleton;
