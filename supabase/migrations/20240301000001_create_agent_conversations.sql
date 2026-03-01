-- ============================================================
-- Agent Conversations Table
-- Stores AI chat conversations for persistent chat history
-- ============================================================

-- Create agent_conversations table
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Account association (optional - for anonymous conversations)
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  
  -- Session identifier (required - for tracking conversation across page reloads)
  session_id TEXT NOT NULL,
  
  -- Source of the conversation (hvac, plumbing, electrical, smile, crm, etc.)
  source TEXT NOT NULL CHECK (source IN ('hvac', 'plumbing', 'electrical', 'smile', 'crm', 'manual', 'ai_agent')),
  
  -- Lead information extracted from conversation
  lead_name TEXT,
  lead_email TEXT,
  lead_phone TEXT,
  
  -- Conversation messages (JSONB array of AgentMessage objects)
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Associated appointment (if booked)
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  -- Conversation status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'booked', 'abandoned', 'completed')),
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_conversations_account_id ON public.agent_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_session_id ON public.agent_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_source ON public.agent_conversations(source);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_status ON public.agent_conversations(status);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_appointment_id ON public.agent_conversations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at ON public.agent_conversations(created_at DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_agent_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_conversations_updated_at();

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view conversations from their account
CREATE POLICY "Users can view account conversations"
  ON public.agent_conversations
  FOR SELECT
  TO authenticated
  USING (
    account_id = (
      SELECT account_id 
      FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Policy: Users can insert conversations for their account
CREATE POLICY "Users can insert account conversations"
  ON public.agent_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = (
      SELECT account_id 
      FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
    OR account_id IS NULL -- Allow anonymous conversations
  );

-- Policy: Users can update conversations from their account
CREATE POLICY "Users can update account conversations"
  ON public.agent_conversations
  FOR UPDATE
  TO authenticated
  USING (
    account_id = (
      SELECT account_id 
      FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    account_id = (
      SELECT account_id 
      FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Policy: Service role can manage all conversations
CREATE POLICY "Service role can manage all conversations"
  ON public.agent_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Helper Functions
-- ============================================================

-- Function to get or create a conversation by session_id
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_session_id TEXT,
  p_source TEXT,
  p_account_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.agent_conversations
  WHERE session_id = p_session_id
    AND source = p_source
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If not found, create new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.agent_conversations (
      session_id,
      source,
      account_id,
      messages,
      status
    )
    VALUES (
      p_session_id,
      p_source,
      p_account_id,
      '[]'::jsonb,
      'active'
    )
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$;

-- Function to add a message to a conversation
CREATE OR REPLACE FUNCTION add_conversation_message(
  p_conversation_id UUID,
  p_role TEXT,
  p_content TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET messages = messages || jsonb_build_object(
    'role', p_role,
    'content', p_content,
    'timestamp', NOW()::text,
    'metadata', COALESCE(p_metadata, '{}'::jsonb)
  )
  WHERE id = p_conversation_id;
END;
$$;

-- Function to update conversation status
CREATE OR REPLACE FUNCTION update_conversation_status(
  p_conversation_id UUID,
  p_status TEXT,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET 
    status = p_status,
    appointment_id = COALESCE(p_appointment_id, appointment_id)
  WHERE id = p_conversation_id;
END;
$$;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE public.agent_conversations IS 'Stores AI chat conversations for persistent chat history across sessions';
COMMENT ON COLUMN public.agent_conversations.session_id IS 'Unique session identifier for tracking conversations across page reloads';
COMMENT ON COLUMN public.agent_conversations.messages IS 'JSONB array of conversation messages with role, content, timestamp, and metadata';
COMMENT ON COLUMN public.agent_conversations.status IS 'Conversation status: active, booked, abandoned, or completed';