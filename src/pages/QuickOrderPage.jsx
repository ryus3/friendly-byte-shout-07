import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';

const QuickOrderPage = () => {
    const formRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            />
        </>
    );
};

export default QuickOrderPage;