// Auto-sync service for Al-Waseet invoices
import { supabase } from '@/lib/customSupabaseClient';

export class AutoSyncInvoiceService {
  static async syncOrderManually(orderId, trackingNumber, invoiceId) {
    try {
      // Update the specific order
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({
          receipt_received: true,
          receipt_received_at: new Date().toISOString(),
          receipt_received_by: null, // Let RLS handle user identification
          delivery_partner_invoice_id: invoiceId,
          status: 'completed', // Manager orders become completed automatically
          updated_at: new Date().toISOString()
        })
        .eq('tracking_number', trackingNumber)
        // Remove hardcoded admin filter - let RLS handle access
        .select();

      if (error) {
        console.error('Error updating order:', error);
        return { success: false, error: error.message };
      }

      console.log('Order updated successfully:', updatedOrder);
      return { success: true, data: updatedOrder };
    } catch (error) {
      console.error('Manual sync error:', error);
      return { success: false, error: error.message };
    }
  }

  static async syncReceivedInvoicesAutomatically() {
    try {
      // Call the sync function for recent received invoices
      const { data, error } = await supabase.rpc('sync_recent_received_invoices');
      
      if (error) {
        console.warn('Auto-sync failed:', error.message);
        return { success: false, error: error.message };
      }

      console.log('Auto-sync completed:', data);
      return { success: true, data };
    } catch (error) {
      console.warn('Auto-sync error:', error);
      return { success: false, error: error.message };
    }
  }
}