import { createClient } from '@/lib/supabase/server';
import { CommissionService } from '@/lib/services/commission-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';

export default async function CommissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not authenticated</div>;
  }

  const commissionService = new CommissionService();
  
  let commission: any = null;
  
  try {
    commission = await commissionService.getCommission(params.id);
  } catch (error) {
    console.error('Error fetching commission:', error);
    notFound();
  }

  if (!commission) {
    notFound();
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
          <h1 className="text-3xl font-bold">Commission Details</h1>
          <p className="text-muted-foreground">View commission information</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/commissions">Back to Commissions</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commission Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Amount</label>
              <p className="text-2xl font-bold">{formatCurrency(commission.amount)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Commission Rate</label>
              <p className="text-lg">{commission.rate}%</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Deal Value</label>
              <p className="text-lg">{formatCurrency(commission.deal_value)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge className={getStatusColor(commission.status)}>
                  {commission.status}
                </Badge>
              </div>
            </div>
            
            {commission.paid_at && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Paid At</label>
                <p className="text-lg">{formatDate(commission.paid_at)}</p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm">{formatDate(commission.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Related Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Sales Rep</label>
              <p className="text-lg font-semibold">{commission.user?.name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{commission.user?.email}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Deal</label>
              <p className="text-lg font-semibold">{commission.deal?.title || 'Unknown Deal'}</p>
              {commission.deal?.company?.name && (
                <p className="text-sm text-muted-foreground">{commission.deal.company.name}</p>
              )}
              {commission.deal?.contact?.name && (
                <p className="text-sm text-muted-foreground">{commission.deal.contact.name}</p>
              )}
            </div>
            
            {commission.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <p className="text-sm mt-1">{commission.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
