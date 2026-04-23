import { extractDomain } from '@/lib/waas/services/serper'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function pickAuditLabel(options: {
  requestorCompany?: string | null
  requestorName?: string | null
  targetUrl?: string | null
}): string {
  const company = options.requestorCompany?.trim()
  if (company) return company

  const name = options.requestorName?.trim()
  if (name) return name

  const target = options.targetUrl?.trim()
  if (target) return extractDomain(target)

  return 'audit-report'
}

export function buildAuditReportPath(
  auditId: string,
  options: {
    requestorCompany?: string | null
    requestorName?: string | null
    targetUrl?: string | null
  } = {}
): string {
  const label = slugify(pickAuditLabel(options))
  if (!label) return `/audit/${auditId}`
  return `/audit/${label}-${auditId}`
}

export function extractAuditIdFromRouteParam(param: string): string | null {
  const match = param.match(UUID_RE)
  return match?.[0] ?? null
}
