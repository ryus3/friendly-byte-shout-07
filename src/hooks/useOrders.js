import React, { useState, useCallback } from 'react';
import { useSuper } from '@/contexts/InventoryContext'; // النظام الموحد
import { supabase } from '@/lib/customSupabaseClient'; // للدوال المساعدة
import { toast } from '@/hooks/use-toast';

export const useOrders = (initialOrders, initialAiOrders, settings, onStockUpdate, addNotification, hasPermission, user) => {
  // استخدام البيانات من النظام الموحد بدلاً من الحالة المحلية
  const { 
    orders: unifiedOrders, 
    aiOrders: unifiedAiOrders, 
    createOrder: superCreateOrder, 
    updateOrder: superUpdateOrder, 
    deleteOrders: superDeleteOrders 
  } = useSuper();
  
  // استخدام البيانات الموحدة مع fallback للبيانات المبدئية
  const orders = unifiedOrders || initialOrders || [];
  const aiOrders = unifiedAiOrders || initialAiOrders || [];

  // إنشاء طلب جديد - التوجيه للنظام الموحد
  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink = null, deliveryPartnerData = null) => {
    try {
      // استخدام النظام الموحد لإنشاء الطلب
      const result = await superCreateOrder(customerInfo, cartItems, trackingNumber, discount, status, qrLink, deliveryPartnerData);
      
      if (result.success) {
        toast({ 
          title: "تم إنشاء الطلب", 
          description: `تم إنشاء الطلب برقم ${result.trackingNumber} بنجاح`,
          variant: "success" 
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Error in createOrder:', error);
      return { success: false, error: error.message || 'حدث خطأ في إنشاء الطلب' };
    }
  }, [superCreateOrder]);

  // تحديث حالة الطلب - التوجيه للنظام الموحد
  const updateOrder = async (orderId, updates, newProducts = null, originalItems = null) => {
    try {
      // استخدام النظام الموحد لتحديث الطلب
      const result = await superUpdateOrder(orderId, updates, newProducts, originalItems);
      
      if (result.success) {
        toast({ 
          title: "تم التحديث", 
          description: "تم تحديث الطلب بنجاح",
          variant: "success" 
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in updateOrder:', error);
      return { success: false, error: error.message };
    }
  };

  // حذف الطلبات - التوجيه للنظام الموحد
  const deleteOrders = async (orderIds, isAiOrder = false) => {
    try {
      // استخدام النظام الموحد لحذف الطلبات
      const result = await superDeleteOrders(orderIds, isAiOrder);
      
      if (result.success) {
        toast({
          title: "تم الحذف",
          description: `تم حذف ${orderIds.length} طلب بنجاح`,
          variant: "success"
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in deleteOrders:', error);
      return { success: false, error: error.message };
    }
  };

  // دالة approveAiOrder للتوافق العكسي
  const approveAiOrder = async (aiOrderId) => {
    try {
      // سيتم تحديثه لاحقاً للعمل مع النظام الموحد
      console.log('Approve AI order:', aiOrderId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return { 
    orders, 
    setOrders: () => {}, // النظام الموحد يتولى التحديث
    aiOrders, 
    setAiOrders: () => {}, // النظام الموحد يتولى التحديث
    createOrder, 
    updateOrder, 
    deleteOrders, 
    approveAiOrder 
  };
};
