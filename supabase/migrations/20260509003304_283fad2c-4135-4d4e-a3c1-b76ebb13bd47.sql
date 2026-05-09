DO $$
DECLARE
  v_inv uuid;
  v_msg text;
BEGIN
  SELECT id INTO v_inv FROM delivery_invoices WHERE external_id='3319023' AND partner='alwaseet';
  BEGIN
    INSERT INTO delivery_invoice_orders (invoice_id, external_order_id, raw, status, amount, owner_user_id)
    VALUES (v_inv, '140872240', '{"id":"140872240"}'::jsonb, 'تم التسليم للزبون', 24000,
            'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid)
    ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET raw=EXCLUDED.raw;
    RAISE NOTICE 'INSERT OK';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'INSERT FAILED: % %', SQLSTATE, SQLERRM;
  END;
END $$;