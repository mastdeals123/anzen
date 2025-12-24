-- =====================================================
-- FIX: Delivery Challan Creation Error
-- =====================================================
--
-- ERROR: inventory_transactions_transaction_type_check constraint violation
-- CAUSE: The constraint doesn't include 'delivery_challan' as valid type
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Paste this entire script
-- 4. Click "Run" or press Ctrl+Enter
-- 5. Verify it says "Success. No rows returned"
-- 6. Try creating a DC again - it should work!
-- =====================================================

-- Drop the old constraint
ALTER TABLE inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

-- Add the fixed constraint with all transaction types
ALTER TABLE inventory_transactions
ADD CONSTRAINT inventory_transactions_transaction_type_check
CHECK (transaction_type IN (
  'purchase',          -- Adding new stock from supplier
  'sale',              -- Stock sold via sales invoice
  'adjustment',        -- Manual stock adjustments
  'return',            -- Stock returned (credit notes)
  'delivery_challan'   -- Stock dispatched via DC (THIS WAS MISSING!)
));

-- Verify the fix
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'inventory_transactions_transaction_type_check';
