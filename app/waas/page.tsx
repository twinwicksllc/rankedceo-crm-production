// =============================================================================
// WaaS Platform Admin - Dashboard
// Phase 1: Placeholder. Full tenant management UI in Phase 2.
// =============================================================================

export default function WaasAdminPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">WaaS Platform</h2>
        <p className="text-gray-500 mt-1">Manage tenant websites, domains, and SEO audits.</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active Tenants',    value: '—', icon: '🌐', color: 'blue'   },
          { label: 'Pending Audits',    value: '—', icon: '🔍', color: 'yellow' },
          { label: 'Custom Domains',    value: '—', icon: '🔗', color: 'green'  },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Phase 1 notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">🏗️ Phase 1 Foundation Complete</h3>
        <p className="text-blue-700 text-sm mb-4">
          The multi-tenant routing engine, database schema, and WaaS infrastructure are in place.
          The following features are coming in Phase 2:
        </p>
        <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
          <li>Tenant creation & management UI</li>
          <li>Domain verification & SSL management</li>
          <li>Brand config editor (colors, logo, contact info)</li>
          <li>SEO audit tool integration (Serper.dev / DataForSEO)</li>
          <li>Page builder / template system</li>
          <li>Billing & package tier management</li>
        </ul>
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/waas/tenants"
          className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="font-semibold text-gray-900 group-hover:text-blue-600">🌐 Tenants →</div>
          <div className="text-sm text-gray-500 mt-1">View and manage client websites</div>
        </a>
        <a
          href="/waas/audits"
          className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="font-semibold text-gray-900 group-hover:text-blue-600">🔍 Audits →</div>
          <div className="text-sm text-gray-500 mt-1">View SEO audit reports</div>
        </a>
      </div>
    </div>
  )
}