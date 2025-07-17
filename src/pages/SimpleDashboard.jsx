import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { TrendingUp, DollarSign, PackageCheck, ShoppingCart, Users, Package } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import Loader from '@/components/ui/loader';

const SimpleDashboard = () => {
    const { user } = useAuth();
    const { orders, loading: inventoryLoading } = useInventory();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Simple data calculations without complex permissions
    const dashboardData = useMemo(() => {
        if (!orders || !user) return {
            totalOrdersCount: 0,
            totalRevenue: 0,
            deliveredOrders: 0,
            pendingOrders: 0
        };

        // Filter orders for current user if not admin
        const userOrders = orders.filter(order => 
            order.created_by === user.id || order.created_by === user.user_id
        );

        const deliveredOrders = userOrders.filter(o => o.status === 'delivered');
        const pendingOrders = userOrders.filter(o => o.status === 'pending' || o.status === 'shipped');
        
        const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

        return {
            totalOrdersCount: userOrders.length,
            totalRevenue,
            deliveredOrders: deliveredOrders.length,
            pendingOrders: pendingOrders.length
        };
    }, [orders, user?.id, user?.user_id]);

    if (inventoryLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Helmet>
                <title>لوحة التحكم - الوسيط</title>
            </Helmet>

            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">
                        مرحباً، {user?.full_name || user?.username || 'المستخدم'}
                    </h1>
                    <p className="text-muted-foreground">
                        {currentTime.toLocaleString('ar-EG', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <StatCard
                            title="إجمالي الطلبات"
                            value={dashboardData.totalOrdersCount}
                            icon={ShoppingCart}
                            description="إجمالي طلباتك"
                            onClick={() => navigate('/my-orders')}
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <StatCard
                            title="إجمالي المبيعات"
                            value={`${dashboardData.totalRevenue.toLocaleString()} د.ع`}
                            icon={DollarSign}
                            description="المبيعات المكتملة"
                            onClick={() => navigate('/my-orders?status=delivered')}
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <StatCard
                            title="الطلبات المكتملة"
                            value={dashboardData.deliveredOrders}
                            icon={PackageCheck}
                            description="تم التسليم"
                            onClick={() => navigate('/my-orders?status=delivered')}
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <StatCard
                            title="الطلبات المعلقة"
                            value={dashboardData.pendingOrders}
                            icon={Package}
                            description="قيد التنفيذ"
                            onClick={() => navigate('/my-orders?status=pending')}
                        />
                    </motion.div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-card border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => navigate('/products')}
                    >
                        <div className="flex items-center space-x-4">
                            <Package className="h-8 w-8 text-primary" />
                            <div>
                                <h3 className="text-lg font-semibold">المنتجات</h3>
                                <p className="text-muted-foreground">تصفح وإدارة المنتجات</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-card border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => navigate('/create-order')}
                    >
                        <div className="flex items-center space-x-4">
                            <ShoppingCart className="h-8 w-8 text-primary" />
                            <div>
                                <h3 className="text-lg font-semibold">إنشاء طلب</h3>
                                <p className="text-muted-foreground">إضافة طلب جديد</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="bg-card border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => navigate('/inventory')}
                    >
                        <div className="flex items-center space-x-4">
                            <TrendingUp className="h-8 w-8 text-primary" />
                            <div>
                                <h3 className="text-lg font-semibold">المخزون</h3>
                                <p className="text-muted-foreground">متابعة حالة المخزون</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default SimpleDashboard;