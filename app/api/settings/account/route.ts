import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const updates = await request.json();

    // Get user's account_id
    const { data: userData } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('accounts')
      .update({
        name: updates.name,
        company_size: updates.company_size,
        industry: updates.industry,
        website: updates.website,
        phone: updates.phone,
        address: updates.address,
      })
      .eq('id', userData.account_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
