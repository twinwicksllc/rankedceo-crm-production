-- 1. Create the helper function for timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the table with the required HIPAA security column
CREATE TABLE IF NOT EXISTS public.smile_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    patient_name TEXT NOT NULL,
    patient_email TEXT NOT NULL,
    patient_phone TEXT,
    patient_dob DATE,
    dentist_name TEXT,
    last_dental_visit TEXT,
    dental_insurance BOOLEAN DEFAULT false,
    insurance_provider TEXT,
    current_concerns TEXT,
    pain_sensitivity TEXT,
    smile_goals TEXT[],
    desired_outcome TEXT,
    medical_conditions TEXT[],
    medications TEXT,
    allergies TEXT,
    status TEXT DEFAULT 'pending'
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.smile_assessments ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policies
-- Allow authenticated dentists to view their own assessments
CREATE POLICY "Dentists can view their own assessments" 
ON public.smile_assessments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated dentists to update/delete their own assessments
CREATE POLICY "Dentists can update their own assessments" 
ON public.smile_assessments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Dentists can delete their own assessments" 
ON public.smile_assessments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow public (unauthenticated) insert for patient submissions
CREATE POLICY "Allow public insert for patient assessments"
ON public.smile_assessments
FOR INSERT
TO public
WITH CHECK (true);

-- 5. Set up the auto-update trigger
DROP TRIGGER IF EXISTS on_smile_assessments_updated ON public.smile_assessments;
CREATE TRIGGER on_smile_assessments_updated
    BEFORE UPDATE ON public.smile_assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Add Documentation
COMMENT ON TABLE public.smile_assessments IS 'Stores patient assessment intake forms. Protected by RLS for HIPAA compliance.';