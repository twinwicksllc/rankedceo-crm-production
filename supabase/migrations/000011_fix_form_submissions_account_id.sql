-- ============================================================================
-- Fix: Add account_id to form_submissions table
-- ============================================================================
-- The form_submissions table needs account_id for RLS policies

ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS account_id UUID;

-- If there are existing submissions without account_id, try to populate from the form
UPDATE form_submissions
SET account_id = (SELECT account_id FROM forms WHERE id = form_submissions.form_id)
WHERE account_id IS NULL;

-- Add foreign key constraint
ALTER TABLE form_submissions 
ADD CONSTRAINT form_submissions_account_id_fkey 
FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_form_submissions_account_id ON form_submissions(account_id);