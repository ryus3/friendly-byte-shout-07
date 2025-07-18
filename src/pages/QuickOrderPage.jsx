import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';

const QuickOrderPage = () => {
  const formRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <Helmet>
        <title>طلب سريع - نظام RYUS</title>
      </Helmet>
      <div className="min-h-screen overflow-auto bg-background">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto p-4 pb-20 space-y-6"
        >
          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold gradient-text text-center">
                طلب سريع
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <QuickOrderContent 
                isDialog={false}
                formRef={formRef}
                setIsSubmitting={setIsSubmitting}
                isSubmittingState={isSubmitting}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default QuickOrderPage;