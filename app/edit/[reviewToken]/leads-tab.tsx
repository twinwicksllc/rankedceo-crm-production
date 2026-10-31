"use client";

// =============================================================================
// app/edit/[reviewToken]/leads-tab.tsx
// B5 — Tenant Portal: Leads Tab
//
// Messages visitors sent through the contact form on the tenant's website,
// newest first. Data is pre-loaded server-side in page.tsx and passed as props.
// Read-only: the owner replies by email or phone.
// =============================================================================

import type { TenantLeadItem } from "@/lib/waas/client-edit/tenant-leads";

interface LeadsTabProps {
  items: TenantLeadItem[];
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="text-5xl mb-4" aria-hidden="true">
        📬
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        No messages yet
      </h3>
      <p className="text-sm text-slate-400 max-w-xs">
        When a visitor sends a message from the contact form on your website,
        it shows up here and is emailed to you.
      </p>
    </div>
  );
}

function LeadRow({ item }: { item: TenantLeadItem }) {
  return (
    <li className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 break-words">
            {item.name || "Website visitor"}
          </p>
          <p className="text-sm text-slate-500 break-all">
            <a className="underline" href={`mailto:${item.email}`}>
              {item.email}
            </a>
            {item.phone ? (
              <>
                {" · "}
                <a
                  className="underline"
                  href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                >
                  {item.phone}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <time
          dateTime={item.createdAt}
          className="text-xs text-slate-400 shrink-0"
        >
          {formatWhen(item.createdAt)}
        </time>
      </div>

      {item.service ? (
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Wants: <span className="text-slate-600 normal-case">{item.service}</span>
        </p>
      ) : null}

      {item.message ? (
        <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap break-words">
          {item.message}
        </p>
      ) : null}
    </li>
  );
}

export function LeadsTab({ items }: LeadsTabProps) {
  return (
    <div className="flex-1 overflow-y-auto" data-testid="leads-tab">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800">Website Leads</h2>
          <p className="text-sm text-slate-400">
            Messages sent through the contact form on your website.
          </p>
        </div>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <LeadRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
