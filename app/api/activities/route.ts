import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createActivitySchema } from '@/lib/validations/activity';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's account
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountData) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedInput = createActivitySchema.parse(body);

    // Create activity
    const { data, error } = await supabase
      .from('activities')
      .insert({
        account_id: accountData.id,
        user_id: user.id,
        ...validatedInput,
        completed_at: validatedInput.status === 'completed' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const contact_id = searchParams.get('contact_id');
    const company_id = searchParams.get('company_id');
    const deal_id = searchParams.get('deal_id');
    const search = searchParams.get('search');

    let query = supabase
      .from('activities')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email),
        company:companies(id, name),
        deal:deals(id, title)
      `)
      .order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (contact_id) query = query.eq('contact_id', contact_id);
    if (company_id) query = query.eq('company_id', company_id);
    if (deal_id) query = query.eq('deal_id', deal_id);
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}