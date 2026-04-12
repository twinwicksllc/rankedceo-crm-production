// =============================================================================
// AdvantagePoint - SVG Textmark Generator
// Auto-generates a high-end SVG logo from business name + primary color
// =============================================================================

export function generateTextmarkSvg(businessName: string, primaryColor: string): string {
  // Get initials (up to 2 characters)
  const words    = businessName.trim().split(/\s+/)
  const initials = words.length === 1
    ? words[0].substring(0, 2).toUpperCase()
    : (words[0][0] + words[words.length - 1][0]).toUpperCase()

  // Derive a darker shade for gradient
  const hex     = primaryColor.replace('#', '')
  const r       = parseInt(hex.substring(0, 2), 16)
  const g       = parseInt(hex.substring(2, 4), 16)
  const b       = parseInt(hex.substring(4, 6), 16)
  const darker  = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`
  const lighter = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`

  // Truncate business name for display
  const displayName = businessName.length > 20
    ? businessName.substring(0, 18) + '…'
    : businessName

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${lighter};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${darker};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.85" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${primaryColor}" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background pill -->
  <rect x="2" y="8" width="76" height="64" rx="16" fill="url(#bgGrad)" filter="url(#shadow)"/>

  <!-- Initials -->
  <text
    x="40"
    y="52"
    font-family="'Inter', 'Helvetica Neue', Arial, sans-serif"
    font-size="28"
    font-weight="800"
    fill="url(#textGrad)"
    text-anchor="middle"
    letter-spacing="-1"
  >${initials}</text>

  <!-- Business name wordmark -->
  <text
    x="100"
    y="38"
    font-family="'Inter', 'Helvetica Neue', Arial, sans-serif"
    font-size="22"
    font-weight="700"
    fill="#111827"
    letter-spacing="-0.5"
  >${displayName}</text>

  <!-- Tagline underline accent -->
  <rect x="100" y="44" width="48" height="2.5" rx="1.25" fill="${primaryColor}" opacity="0.7"/>
  <text
    x="100"
    y="62"
    font-family="'Inter', 'Helvetica Neue', Arial, sans-serif"
    font-size="11"
    font-weight="500"
    fill="#6B7280"
    letter-spacing="0.5"
  >POWERED BY ADVANTAGEPOINT</text>
</svg>`

  return svg
}

export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
  return `data:image/svg+xml,${encoded}`
}