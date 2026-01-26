-- Diagnostic: Check which tables have account_id column
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'account_id'
ORDER BY table_name;