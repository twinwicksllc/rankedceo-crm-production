"use client";

import { useEffect, useMemo, useState } from "react";
import { EmailService } from "@/lib/services/email-service";
import {
  EmailMessageWithThread,
  EmailStats,
  EmailFilters,
} from "@/lib/types/email";
import { EmailCard } from "@/components/email/email-card";
import { EmailFilters as EmailFiltersComponent } from "@/components/email/email-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Inbox, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function EmailsPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<EmailMessageWithThread[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [filters, setFilters] = useState<EmailFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const emailService = useMemo(() => new EmailService(), []);
  // Bumped to re-run the fetch effects (Refresh button, mark-as-read).
  const [emailsKey, setEmailsKey] = useState(0);
  const [statsKey, setStatsKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    emailService
      .getEmails(filters)
      .then((data) => {
        if (!cancelled) setEmails(data);
      })
      .catch((err) => {
        console.error("Error loading emails:", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load emails",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [emailService, filters, emailsKey]);

  useEffect(() => {
    let cancelled = false;
    emailService
      .getEmailStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        console.error("Error loading stats:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [emailService, statsKey]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    setEmailsKey((k) => k + 1);
  };

  const handleFiltersChange = (next: EmailFilters) => {
    setLoading(true);
    setError(null);
    setFilters(next);
  };

  const handleEmailView = (emailId: string) => {
    router.push(`/emails/${emailId}`);
  };

  const handleMarkAsRead = async (emailId: string) => {
    try {
      await emailService.markAsOpened(emailId);
      setEmails((prev) =>
        prev.map((email) =>
          email.id === emailId ? { ...email, opened: true } : email,
        ),
      );
      setStatsKey((k) => k + 1);
    } catch (err) {
      console.error("Error marking email as read:", err);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Emails</h1>
          <p className="text-muted-foreground">
            Manage your email communications
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Emails
              </CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_messages}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inbound</CardTitle>
              <Inbox className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inbound_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outbound</CardTitle>
              <ArrowRight className="h-4 w-4 text-green-500 rotate-180" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.outbound_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unread</CardTitle>
              {stats.unread_count > 0 ? (
                <Badge variant="default">{stats.unread_count}</Badge>
              ) : (
                <Mail className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unread_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <EmailFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading emails...</p>
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Error loading emails</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : emails.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No emails yet</h3>
                <p className="text-muted-foreground">
                  Emails will appear here when you BCC your account&apos;s
                  unique email address.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {emails.map((email) => (
              <EmailCard
                key={email.id}
                email={email}
                onView={handleEmailView}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
