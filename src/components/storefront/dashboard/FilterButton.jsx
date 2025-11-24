import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const FilterButton = ({ active, onClick, gradient, count, children }) => {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className={`relative ${active ? `bg-gradient-to-r ${gradient} text-white border-0 shadow-lg` : ''}`}
    >
      {children}
      {count > 0 && (
        <Badge className={`mr-2 ${active ? 'bg-white/20' : 'bg-primary'}`}>
          {count}
        </Badge>
      )}
    </Button>
  );
};

export default FilterButton;
