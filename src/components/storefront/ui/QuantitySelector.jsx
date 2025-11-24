import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const QuantitySelector = ({ value, onChange, max = 100, min = 1, gradient = "from-blue-500 to-purple-500" }) => {
  const handleDecrease = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrease = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div className="flex items-center border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-purple-300 dark:hover:border-purple-600 transition-all">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDecrease}
        disabled={value <= min}
        className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all"
      >
        <Minus className="h-4 w-4" />
      </Button>
      
      <div className="px-6 py-2 min-w-[80px] text-center">
        <span className={`text-lg font-black text-transparent bg-clip-text bg-gradient-to-r ${gradient}`}>
          {value}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleIncrease}
        disabled={value >= max}
        className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default QuantitySelector;
