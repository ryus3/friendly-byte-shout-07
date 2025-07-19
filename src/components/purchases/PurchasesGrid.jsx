import React from 'react';
import Loader from '@/components/ui/loader';
import PurchaseCard from './PurchaseCard';
import { motion } from 'framer-motion';

const PurchasesGrid = ({ purchases, isLoading, onViewDetails, onDelete }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <div className="max-w-md mx-auto">
          <div className="p-6 rounded-xl bg-muted/30 border-2 border-dashed border-muted-foreground/20">
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              لا توجد فواتير مشتريات
            </h3>
            <p className="text-sm text-muted-foreground">
              ابدأ بإضافة فاتورة شراء جديدة لعرضها هنا
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
    >
      {purchases.map((purchase, index) => (
        <PurchaseCard
          key={purchase.id}
          purchase={purchase}
          onViewDetails={onViewDetails}
          onDelete={onDelete}
          index={index}
        />
      ))}
    </motion.div>
  );
};

export default PurchasesGrid;