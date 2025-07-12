import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const Loader = ({ className }) => {
  return (
    <div className={cn("flex items-center justify-center w-full h-full", className)}>
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
};

export default Loader;