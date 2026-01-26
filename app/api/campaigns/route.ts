import { NextRequest, NextResponse } from 'next/server';
import { CampaignService } from '@/lib/services/campaign-service';
import { createCampaignSchema } from '@/lib/validations/campaign';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userData = await supabase.auth.getUser();
    
    if (!userData.data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const campaignService = new CampaignService();
    const campaigns = await campaignService.getCampaigns({
      type: type as any,
      status: status as any,
      search: search || undefined,
    });

    return NextResponse.json({ campaigns });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userData = await supabase.auth.getUser();
    
    if (!userData.data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validatedData = createCampaignSchema.parse(body);

    const campaignService = new CampaignService();
    const campaign = await campaignService.createCampaign(validatedData);

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
