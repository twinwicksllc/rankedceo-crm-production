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
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    patient_name TEXT NOT NULL,
    patient_email TEXT NOT NULL,
    patient_phone TEXT,
    patient_dob DATE,
    medical_conditions TEXT[],
    dental_concerns TEXT,
    smile_goals TEXT,
    status TEXT DEFAULT 'pending'
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.smile_assessments ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policies (Authenticated Users only see their own data)
CREATE POLICY "Users can manage their own assessments" 
ON public.smile_assessments
FOR ALL 
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- 5. Set up the auto-update trigger
DROP TRIGGER IF EXISTS on_smile_assessments_updated ON public.smile_assessments;
CREATE TRIGGER on_smile_assessments_updated
    BEFORE UPDATE ON public.smile_assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Add Documentation
COMMENT ON TABLE public.smile_assessments IS 'Stores patient assessment intake forms. Protected by RLS for HIPAA compliance.';