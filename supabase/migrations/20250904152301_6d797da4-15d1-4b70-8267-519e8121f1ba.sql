-- Clean up conflicting/duplicate triggers on orders to resolve tuple update conflicts
DROP TRIGGER IF EXISTS loyalty_points_on_order_completion ON public.orders;
DROP TRIGGER IF EXISTS trg_handle_receipt_received_order ON public.orders;