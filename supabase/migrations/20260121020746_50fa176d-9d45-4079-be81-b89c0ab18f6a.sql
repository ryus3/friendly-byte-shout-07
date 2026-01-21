-- ============================================
-- Part 1: Normalize invoice status + Add notification system
-- ============================================

-- Add raw_status column to preserve original Arabic status
ALTER TABLE public.delivery_invoices 
ADD COLUMN IF NOT EXISTS raw_status TEXT;

-- Backfill: Copy current status to raw_status before normalization
UPDATE public.delivery_invoices 
SET raw_status = status 
WHERE raw_status IS NULL AND status IS NOT NULL;

-- Normalize existing statuses to standard keys
UPDATE public.delivery_invoices
SET status = CASE 
  WHEN status ILIKE '%تم الاستلام%' OR status ILIKE '%received%' THEN 'received'
  WHEN status ILIKE '%معلق%' OR status ILIKE '%pending%' OR status ILIKE '%انتظار%' THEN 'pending'
  WHEN status ILIKE '%ملغ%' OR status ILIKE '%cancel%' THEN 'cancelled'
  WHEN status ILIKE '%مرسل%' OR status ILIKE '%sent%' THEN 'sent'
  ELSE 'pending' -- Default to pending for unknown statuses
END
WHERE status NOT IN ('pending', 'received', 'cancelled', 'sent');

-- ============================================
-- Part 2: Create invoice notifications table
-- ============================================

CREATE TABLE IF NOT EXISTS public.invoice_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.delivery_invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('invoice_pending', 'invoice_received')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invoice_id, user_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.invoice_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own invoice notifications"
ON public.invoice_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoice notifications"
ON public.invoice_notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert invoice notifications"
ON public.invoice_notifications FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoice_notifications_user_unread 
ON public.invoice_notifications(user_id, is_read) 
WHERE is_read = FALSE;

-- ============================================
-- Part 3: Function to create invoice notification
-- ============================================

CREATE OR REPLACE FUNCTION public.create_invoice_notification(
  p_invoice_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_user_id UUID;
  v_admin_user_ids UUID[];
  v_user_id UUID;
BEGIN
  -- Get employee user_id from invoice
  SELECT dpt.user_id INTO v_employee_user_id
  FROM public.delivery_invoices di
  JOIN public.delivery_partner_tokens dpt ON di.owner_user_id = dpt.user_id
  WHERE di.id = p_invoice_id;

  -- Get all admin user_ids
  SELECT ARRAY_AGG(user_id) INTO v_admin_user_ids
  FROM public.profiles
  WHERE role IN ('super_admin', 'admin');

  -- Create notification for employee
  IF v_employee_user_id IS NOT NULL THEN
    INSERT INTO public.invoice_notifications (invoice_id, user_id, notification_type, title, message, data)
    VALUES (p_invoice_id, v_employee_user_id, p_notification_type, p_title, p_message, p_data)
    ON CONFLICT (invoice_id, user_id, notification_type) DO NOTHING;
  END IF;

  -- Create notifications for all admins
  IF v_admin_user_ids IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY v_admin_user_ids
    LOOP
      IF v_user_id != v_employee_user_id OR v_employee_user_id IS NULL THEN
        INSERT INTO public.invoice_notifications (invoice_id, user_id, notification_type, title, message, data)
        VALUES (p_invoice_id, v_user_id, p_notification_type, p_title, p_message, p_data)
        ON CONFLICT (invoice_id, user_id, notification_type) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- ============================================
-- Part 4: Trigger function for new pending invoices
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_pending_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_number TEXT;
  v_amount NUMERIC;
BEGIN
  -- Only notify for pending status
  IF NEW.status = 'pending' THEN
    v_invoice_number := COALESCE(NEW.invoice_number, NEW.external_invoice_id::TEXT, 'غير معروف');
    v_amount := COALESCE(NEW.total_amount, 0);
    
    PERFORM public.create_invoice_notification(
      NEW.id,
      'invoice_pending',
      'فاتورة معلقة جديدة',
      'فاتورة رقم ' || v_invoice_number || ' بمبلغ ' || v_amount || ' بانتظار الاستلام',
      jsonb_build_object(
        'invoice_id', NEW.id,
        'invoice_number', v_invoice_number,
        'amount', v_amount,
        'employee_id', NEW.owner_user_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- Part 5: Trigger function for received invoices
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_received_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_number TEXT;
  v_amount NUMERIC;
BEGIN
  -- Only notify when status changes from pending to received
  IF OLD.status = 'pending' AND NEW.status = 'received' THEN
    v_invoice_number := COALESCE(NEW.invoice_number, NEW.external_invoice_id::TEXT, 'غير معروف');
    v_amount := COALESCE(NEW.total_amount, 0);
    
    PERFORM public.create_invoice_notification(
      NEW.id,
      'invoice_received',
      'تم استلام فاتورة',
      'تم استلام فاتورة رقم ' || v_invoice_number || ' بمبلغ ' || v_amount,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'invoice_number', v_invoice_number,
        'amount', v_amount,
        'employee_id', NEW.owner_user_id,
        'received_at', NEW.received_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- Part 6: Create triggers
-- ============================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS trigger_notify_pending_invoice ON public.delivery_invoices;
DROP TRIGGER IF EXISTS trigger_notify_received_invoice ON public.delivery_invoices;

-- Create trigger for new pending invoices
CREATE TRIGGER trigger_notify_pending_invoice
AFTER INSERT ON public.delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION public.notify_pending_invoice();

-- Create trigger for status change to received
CREATE TRIGGER trigger_notify_received_invoice
AFTER UPDATE OF status ON public.delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION public.notify_received_invoice();

-- ============================================
-- Part 7: Enable realtime for invoice_notifications
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_notifications;

-- ============================================
-- Part 8: Reschedule cron jobs with correct times
-- ============================================

-- Apply the current settings with proper Baghdad to UTC conversion
SELECT public.admin_manage_invoice_cron('09:00', '21:00', true);