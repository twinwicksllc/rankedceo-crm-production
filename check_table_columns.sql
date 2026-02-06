-- Check table structures for lead_sources and qualified_leads_global
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('lead_sources', 'qualified_leads_global')
    AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
