import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';

const FloatingCartButton = ({ onOpenCart }) => {
  const { cart } = useInventory();
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setItemCount(cart.reduce((sum, item) => sum + item.quantity, 0));
  }, [cart]);

  if (itemCount === 0) return null;

  return (
    <motion.div
      initial={{ scale: 0, y: 100 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0, y: 100 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="fixed bottom-6 left-6 z-50"
    >
      <Button
        onClick={onOpenCart}
        size="lg"
        className="rounded-full shadow-lg bg-gradient-to-r from-primary to-blue-600 text-white h-14 w-14 p-0"
      >
        <ShoppingCart className="w-6 h-6" />
        <motion.span
          key={itemCount}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-background"
        >
          {itemCount}
        </motion.span>
      </Button>
    </motion.div>
  );
};

export default FloatingCartButton;