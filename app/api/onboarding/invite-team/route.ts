import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { emails } = await request.json();

    // Get user's account_id
    const { data: userData } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // TODO: Implement team invitation logic
    // For now, just log the emails
    console.log('Team invitations to send:', emails);

    return NextResponse.json({ success: true, invited: emails.length });
  } catch (error) {
    console.error('Error inviting team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
