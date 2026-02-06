import { createClient } from '@/lib/supabase/server';
import { CommissionService } from '@/lib/services/commission-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default async function CommissionRatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not authenticated</div>;
  }

  const commissionService = new CommissionService();
  
  let rates: any[] = [];
  
  try {
    rates = await commissionService.getCommissionRates();
  } catch (error) {
    console.error('Error fetching commission rates:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commission Rates</h1>
          <p className="text-muted-foreground">Manage commission rates for your team</p>
        </div>
        <Button asChild>
          <Link href="/commissions">Back to Commissions</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Commission Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {rates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No commission rates configured</p>
              <p className="text-sm mt-2">Set up commission rates for your sales team</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rates.map((rate) => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">User ID: {rate.user_id.substring(0, 8)}...</h3>
                      {rate.is_active && (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Effective from {formatDate(rate.effective_from)}
                      {rate.effective_to && ` to ${formatDate(rate.effective_to)}`}
                    </div>
                    {rate.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{rate.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{rate.rate}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
