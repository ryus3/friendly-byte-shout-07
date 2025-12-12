-- السماح للمديرين بتحديث الإشعارات العامة (user_id IS NULL)
CREATE POLICY "Admins can update general notifications"
  ON notifications FOR UPDATE
  USING (is_admin_or_deputy() AND user_id IS NULL)
  WITH CHECK (is_admin_or_deputy() AND user_id IS NULL);