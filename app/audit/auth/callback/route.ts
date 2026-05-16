// =============================================================================
// Audit OAuth Callback — handles Google OAuth redirects for audit.rankedceo.com
// This route exists so Supabase can use /audit/auth/callback as the redirect URI
// without conflicting with the CRM callback at /api/auth/callback
// =============================================================================

export { GET } from '@/app/api/auth/callback/route'
