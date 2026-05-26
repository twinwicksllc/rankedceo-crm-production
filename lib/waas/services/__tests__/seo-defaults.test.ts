import { describe, it, expect } from 'vitest'
import type { WaasTenant } from '@/lib/waas/types'
import {
  generateMetaTitle,
  generateMetaDescription,
  generateOgImageUrl,
  generateSeoDefaults,
} from '../seo-defaults'

const mockTenant = (overrides?: Partial<WaasTenant>): WaasTenant => ({
  id: 'test-tenant-1',
  domain: null,
  subdomain: null,
  slug: 'test-tenant',
  brand_config: {
    business_name: 'Test Business',
  },
  package_tier: 'standard',
  status: 'onboarding',
  crm_account_id: null,
  vercel_project_id: null,
  domain_verified: false,
  domain_verified_at: null,
  target_industry: null,
  target_location: null,
  legal_name: null,
  physical_address: null,
  city: null,
  state: null,
  zip: null,
  primary_trade: null,
  source_audit_id: null,
  calendly_url: null,
  financing_enabled: false,
  usp: null,
  onboarding_step: 4,
  onboarding_completed: false,
  onboarding_completed_at: null,
  submitted_by_email: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
})

describe('SEO Defaults Service', () => {
  describe('generateMetaTitle', () => {
    it('generates title with all components: business_name | primary_trade in city, state', () => {
      const tenant = mockTenant({
        legal_name: 'Acme Plumbing',
        primary_trade: 'Plumbing',
        city: 'Chicago',
        state: 'IL',
      })
      const title = generateMetaTitle(tenant)
      expect(title).toBe('Acme Plumbing | Plumbing in Chicago, IL')
    })

    it('trims to 60 chars max', () => {
      const tenant = mockTenant({
        legal_name: 'Very Long Business Name LLC',
        primary_trade: 'Professional Advanced Services',
        city: 'San Francisco',
        state: 'California',
      })
      const title = generateMetaTitle(tenant)
      expect(title.length).toBeLessThanOrEqual(60)
      expect(title.endsWith('...')).toBe(true)
    })

    it('ensures minimum length of 20 chars', () => {
      const tenant = mockTenant({
        legal_name: 'Co',
        primary_trade: 'Svc',
      })
      const title = generateMetaTitle(tenant)
      expect(title.length).toBeGreaterThanOrEqual(20)
    })

    it('falls back to business_name when primary_trade missing', () => {
      const tenant = mockTenant({
        legal_name: 'Test Business',
        city: 'Denver',
        state: 'CO',
      })
      const title = generateMetaTitle(tenant)
      expect(title).toContain('Test Business')
      expect(title).toContain('Services') // default
    })

    it('uses brand_config.business_name when legal_name missing', () => {
      const tenant = mockTenant({
        legal_name: null,
        brand_config: { business_name: 'Brand Co' },
        primary_trade: 'Consulting',
        city: 'Austin',
        state: 'TX',
      })
      const title = generateMetaTitle(tenant)
      expect(title).toContain('Brand Co')
    })

    it('handles city without state', () => {
      const tenant = mockTenant({
        legal_name: 'Local Shop',
        primary_trade: 'Retail',
        city: 'Brooklyn',
      })
      const title = generateMetaTitle(tenant)
      expect(title).toContain('Local Shop')
      expect(title).toContain('Brooklyn')
    })

    it('handles state without city', () => {
      const tenant = mockTenant({
        legal_name: 'State Co',
        primary_trade: 'Manufacturing',
        state: 'Ohio',
      })
      const title = generateMetaTitle(tenant)
      expect(title).toContain('State Co')
      expect(title).toContain('Ohio')
    })
  })

  describe('generateMetaDescription', () => {
    it('generates description >= 70 and <= 160 chars', () => {
      const tenant = mockTenant({
        legal_name: 'ABC Company',
        primary_trade: 'Web Design',
        city: 'New York',
        state: 'NY',
        usp: 'We create stunning, responsive websites that convert visitors into customers.',
      })
      const desc = generateMetaDescription(tenant)
      expect(desc.length).toBeGreaterThanOrEqual(70)
      expect(desc.length).toBeLessThanOrEqual(160)
    })

    it('uses USP if available and short enough', () => {
      const usp = 'Best plumbing in town'
      const tenant = mockTenant({
        usp,
        city: 'Chicago',
        state: 'IL',
      })
      const desc = generateMetaDescription(tenant)
      expect(desc).toContain(usp)
    })

    it('falls back to tagline when USP missing', () => {
      const tagline = 'Quality service guaranteed'
      const tenant = mockTenant({
        brand_config: { business_name: 'Test', tagline },
        city: 'Denver',
        state: 'CO',
      })
      const desc = generateMetaDescription(tenant)
      expect(desc).toContain(tagline)
    })

    it('generates fallback when no USP or tagline', () => {
      const tenant = mockTenant({
        legal_name: 'Generic Corp',
        primary_trade: 'Consulting',
        city: 'Austin',
        state: 'TX',
      })
      const desc = generateMetaDescription(tenant)
      expect(desc).toContain('Generic Corp')
      expect(desc).toContain('Consulting')
      expect(desc.length).toBeGreaterThanOrEqual(70)
    })

    it('trims long descriptions intelligently', () => {
      const longUsp = 'This is a very long unique selling proposition that goes on and on and on and definitely exceeds the character limit and should be truncated gracefully.'
      const tenant = mockTenant({
        usp: longUsp,
        city: 'Seattle',
        state: 'WA',
      })
      const desc = generateMetaDescription(tenant)
      expect(desc.length).toBeLessThanOrEqual(160)
      expect(desc.endsWith('.')).toBe(true)
    })

    it('includes location suffix when available', () => {
      const tenant = mockTenant({
        legal_name: 'Local Service',
        primary_trade: 'Cleaning',
        city: 'Portland',
        state: 'OR',
      })
      const desc = generateMetaDescription(tenant)
      expect(desc).toContain('Portland')
      expect(desc).toContain('OR')
    })

    it('handles missing location gracefully', () => {
      const tenant = mockTenant({
        legal_name: 'Online Service',
        primary_trade: 'Tutoring',
      })
      const desc = generateMetaDescription(tenant)
      expect(desc.length).toBeGreaterThanOrEqual(70)
      expect(desc).toContain('Online Service')
    })
  })

  describe('generateOgImageUrl', () => {
    it('returns logo_url when available', () => {
      const logoUrl = 'https://example.com/logo.png'
      const tenant = mockTenant({
        brand_config: { business_name: 'Test', logo_url: logoUrl },
      })
      const url = generateOgImageUrl(tenant)
      expect(url).toBe(logoUrl)
    })

    it('returns null when logo_url missing', () => {
      const tenant = mockTenant()
      const url = generateOgImageUrl(tenant)
      expect(url).toBeNull()
    })

    it('returns null for empty logo_url', () => {
      const tenant = mockTenant({
        brand_config: { business_name: 'Test', logo_url: '' },
      })
      const url = generateOgImageUrl(tenant)
      expect(url).toBeNull()
    })

    it('returns null for whitespace logo_url', () => {
      const tenant = mockTenant({
        brand_config: { business_name: 'Test', logo_url: '   ' },
      })
      const url = generateOgImageUrl(tenant)
      expect(url).toBeNull()
    })
  })

  describe('generateSeoDefaults', () => {
    it('generates all three defaults together', () => {
      const tenant = mockTenant({
        legal_name: 'Full Service Inc',
        primary_trade: 'Marketing',
        city: 'Boston',
        state: 'MA',
        usp: 'Data-driven marketing strategies that work.',
        brand_config: {
          business_name: 'Full Service Inc',
          logo_url: 'https://example.com/logo.png',
        },
      })
      const defaults = generateSeoDefaults(tenant)
      expect(defaults.meta_title).toBeTruthy()
      expect(defaults.meta_title.length).toBeGreaterThanOrEqual(20)
      expect(defaults.meta_description).toBeTruthy()
      expect(defaults.meta_description.length).toBeGreaterThanOrEqual(70)
      expect(defaults.meta_description.length).toBeLessThanOrEqual(160)
      expect(defaults.og_image_url).toBe('https://example.com/logo.png')
    })

    it('generates defaults when tenant data is minimal', () => {
      const tenant = mockTenant()
      const defaults = generateSeoDefaults(tenant)
      expect(defaults.meta_title).toBeTruthy()
      expect(defaults.meta_title.length).toBeGreaterThanOrEqual(20)
      expect(defaults.meta_description).toBeTruthy()
      expect(defaults.meta_description.length).toBeGreaterThanOrEqual(70)
      expect(defaults.og_image_url).toBeNull()
    })
  })
})
