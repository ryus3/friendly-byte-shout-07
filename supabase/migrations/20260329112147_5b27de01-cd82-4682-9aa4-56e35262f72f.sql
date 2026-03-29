-- Allow cash source owners to view their own cash movements
CREATE POLICY "cash_source_owner_can_view_movements"
ON public.cash_movements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cash_sources cs
    WHERE cs.id = cash_movements.cash_source_id
    AND cs.owner_user_id = auth.uid()
  )
);