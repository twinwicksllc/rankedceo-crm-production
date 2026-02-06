import { createClient } from '@/lib/supabase/server';
import { CommissionService } from '@/lib/services/commission-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default async function CommissionReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not authenticated</div>;
  }

  const commissionService = new CommissionService();
  
  let userStats: any[] = [];
  let overallStats: any = {
    total_pending: 0,
    total_approved: 0,
    total_paid: 0,
    total_cancelled: 0,
    pending_amount: 0,
    approved_amount: 0,
    paid_amount: 0,
    total_commissions: 0,
  };
  
  try {
    [userStats, overallStats] = await Promise.all([
      commissionService.getUserCommissionStats(),
      commissionService.getCommissionStats(),
    ]);
  } catch (error) {
    console.error('Error fetching commission reports:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commission Reports</h1>
          <p className="text-muted-foreground">View commission performance by team member</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/commissions">Back to Commissions</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overallStats.pending_amount + overallStats.approved_amount + overallStats.paid_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              All time commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overallStats.pending_amount + overallStats.approved_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overallStats.paid_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total paid
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission by Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          {userStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No commission data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userStats.map((stats) => (
                <div
                  key={stats.user_id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{stats.user_name}</h3>
                    <p className="text-sm text-muted-foreground">{stats.user_email}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span>
                        <span className="text-muted-foreground">Avg Rate:</span>{' '}
                        <span className="font-medium">{stats.average_rate.toFixed(1)}%</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">Commissions:</span>{' '}
                        <span className="font-medium">{stats.commission_count}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {formatCurrency(stats.total_amount)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Pending: {formatCurrency(stats.pending_amount)}
                    </div>
                    <div className="text-sm text-green-600">
                      Paid: {formatCurrency(stats.paid_amount)}
                    </div>
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
