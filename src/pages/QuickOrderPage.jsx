import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';

const QuickOrderPage = () => {
    const navigate = useNavigate();
    const formRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleOrderCreated = () => {
        setTimeout(() => {
            navigate('/');
        }, 150);
    };
    
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