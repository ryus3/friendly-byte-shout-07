import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import QuickOrderMobileOptimized from '@/components/quick-order/QuickOrderMobileOptimized';

const QuickOrderPage = () => {
    const formRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    return (
        <>
            <Helmet>
                <title>طلب سريع - نظام RYUS</title>
            </Helmet>
            <QuickOrderMobileOptimized 
                isDialog={false} 
                formRef={formRef} 
                setIsSubmitting={setIsSubmitting} 
                isSubmittingState={isSubmitting}
            />
        </>
    );
};

export default QuickOrderPage;