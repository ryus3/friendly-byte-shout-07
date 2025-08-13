-- Add strict RLS policies to satisfy linter and secure the table
create policy if not exists "deny all selects" on public.telegram_processed_updates
for select using (false);

create policy if not exists "deny all inserts" on public.telegram_processed_updates
for insert with check (false);

create policy if not exists "deny all updates" on public.telegram_processed_updates
for update using (false) with check (false);

create policy if not exists "deny all deletes" on public.telegram_processed_updates
for delete using (false);
