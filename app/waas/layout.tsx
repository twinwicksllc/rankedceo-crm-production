// =============================================================================
// WaaS Platform Admin Layout
// Accessible at: crm.rankedceo.com/waas (CRM auth required)
// Phase 1: Shell only. Full admin UI comes in Phase 2.
// =============================================================================

export default function WaasAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
          W
        </div>
        <div>
          <h1 className="font-semibold text-gray-900 leading-none">WaaS Admin</h1>
          <p className="text-xs text-gray-500 mt-0.5">Website-as-a-Service Platform</p>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}