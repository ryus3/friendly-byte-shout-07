import React, { useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';

const QuickOrderPage = () => {
    const formRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleOrderCreated = useCallback(() => {
        console.log('✅ تم إنشاء الطلب بنجاح - الصفحة جاهزة لطلب جديد');
    }, []);
    
    return (
        <>
            <Helmet>
                <title>طلب سريع - نظام RYUS</title>
            </Helmet>
            <QuickOrderContent 
                isDialog={false} 
                formRef={formRef} 
                setIsSubmitting={setIsSubmitting} 
                isSubmittingState={isSubmitting}
                onOrderCreated={handleOrderCreated}
            />
        </>
    );
};

export default QuickOrderPage;