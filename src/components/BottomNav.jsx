import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Bot, Home } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import CartDialog from '@/components/orders/CartDialog';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAiChat } from '@/contexts/AiChatContext';
import { cn } from '@/lib/utils';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';

const NavButton = ({ onClick, icon: Icon, label, className, badgeCount }) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.9 }}
    className={cn(
      "relative flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors duration-200 flex-1 h-14",
      className
    )}
  >
    <div className="relative">
      <Icon className="w-6 h-6" />
      {badgeCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background"
        >
          {badgeCount}
        </motion.span>
      )}
    </div>
    <span className="text-xs font-medium">{label}</span>
  </motion.button>
);

const BottomNav = () => {
  const { cart } = useInventory();
  const { user } = useAuth();
  const { setAiChatOpen, canUseAiChat } = useAiChat();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleHomeClick = () => {
    navigate(user?.default_page || '/');
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsQuickOrderOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-0 right-0 left-0 bg-card/80 backdrop-blur-lg border-t border-border z-40 md:hidden"
      >
        <div className="flex justify-around items-center h-16 px-2">
           <NavButton onClick={() => setIsCartOpen(true)} icon={ShoppingCart} label="السلة" badgeCount={itemCount} />
          
          {canUseAiChat && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 -mt-8 rounded-full bg-gradient-to-tr from-primary to-blue-500 text-primary-foreground shadow-lg flex items-center justify-center"
              onClick={() => setAiChatOpen(true)}
            >
              <Bot className="w-8 h-8" />
            </motion.button>
          )}
          
          <NavButton onClick={handleHomeClick} icon={Home} label="الرئيسية" />
        </div>
      </motion.div>
      <CartDialog open={isCartOpen} onOpenChange={setIsCartOpen} onCheckout={handleCheckout} />
      <QuickOrderDialog open={isQuickOrderOpen} onOpenChange={setIsQuickOrderOpen} />
    </>
  );
};

export default BottomNav;