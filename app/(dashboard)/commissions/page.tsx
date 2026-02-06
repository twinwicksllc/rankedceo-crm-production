import { createClient } from '@/lib/supabase/server';
import { CommissionService } from '@/lib/services/commission-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default async function CommissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not authenticated</div>;
  }

  const commissionService = new CommissionService();
  
  let commissions: any[] = [];
  let stats: any = {
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
    [commissions, stats] = await Promise.all([
      commissionService.getCommissions(),
      commissionService.getCommissionStats(),
    ]);
  } catch (error) {
    console.error('Error fetching commissions:', error);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commissions</h1>
          <p className="text-muted-foreground">Track and manage sales commissions</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/commissions/rates">Commission Rates</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/commissions/reports">Reports</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pending_amount)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_pending} commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.approved_amount)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_approved} commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.paid_amount)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_paid} commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.pending_amount + stats.approved_amount + stats.paid_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total_commissions} total
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Commissions</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No commissions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {commissions.map((commission) => (
                <Link
                  key={commission.id}
                  href={`/commissions/${commission.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {commission.deal?.title || 'Unknown Deal'}
                        </h3>
                        <Badge className={getStatusColor(commission.status)}>
                          {commission.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {commission.user?.name || 'Unknown User'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {formatCurrency(commission.amount)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
