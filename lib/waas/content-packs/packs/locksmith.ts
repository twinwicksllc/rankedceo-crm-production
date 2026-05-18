import type { IndustryContentPack } from '../types'

const locksmith: IndustryContentPack = {
  trade:       'locksmith',
  displayName: 'Locksmith Services',

  defaultServices: [
    {
      title:       'Lockout Service',
      description: 'Fast response to home, car, and business lockouts — door opened without damage.',
      icon:        '🔓',
    },
    {
      title:       'Lock Replacement & Rekeying',
      description: 'High-security lock upgrades, deadbolt installation, and rekeying for any property change.',
      icon:        '🔑',
    },
    {
      title:       'Commercial Locksmith Services',
      description: 'Master key systems, access control, panic bars, and commercial door hardware installation.',
      icon:        '🏢',
    },
    {
      title:       'Auto Locksmith',
      description: 'Car key replacement, transponder key programming, and vehicle lockout assistance.',
      icon:        '🚗',
    },
    {
      title:       'Safe Opening & Repair',
      description: 'Safe lockouts, combination changes, and safe installation for homes and businesses.',
      icon:        '🔒',
    },
    {
      title:       'High-Security Lock Installation',
      description: 'Medeco, Abloy, Mul-T-Lock, and other high-security lock brands supplied and installed.',
      icon:        '🛡️',
    },
    {
      title:       'Access Control Systems',
      description: 'Keypad, card, fob, and biometric access control systems for homes and commercial properties.',
      icon:        '📱',
    },
    {
      title:       'Security Consultation',
      description: 'Full property security assessments with written recommendations for locks and access control.',
      icon:        '🔍',
    },
  ],

  defaultFaqs: [
    {
      question: 'How quickly can you respond to a lockout?',
      answer:   'We offer 24/7 lockout service with typical response times of 20–45 minutes depending on your location.',
    },
    {
      question: 'Will a lockout cause damage to my lock or door?',
      answer:   'Our non-destructive entry techniques are designed to open locks without any damage in the majority of cases.',
    },
    {
      question: 'Should I rekey or replace my locks after moving into a new home?',
      answer:   'We recommend rekeying at minimum — it ensures no previous key holders have access at a fraction of full replacement cost.',
    },
    {
      question: 'Can you replace a lost or broken car key?',
      answer:   'Yes — we cut and programme replacement keys for most vehicle makes, including laser-cut and transponder keys.',
    },
    {
      question: 'Are you available on weekends and holidays?',
      answer:   'Yes — we operate 24/7, 365 days a year, including weekends and public holidays.',
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow:     '24/7 Emergency Locksmith',
      headline:    'Locked Out? We\'re On Our Way',
      subheadline: 'Fast, non-destructive entry for homes, offices, and vehicles — any hour, any day.',
      ctaLabel:    'Call Now — 24/7 Lockout Help',
    },
    standard: {
      eyebrow:     'Licensed Local Locksmith',
      headline:    'Security Solutions You Can Trust',
      subheadline: 'From lockouts to high-security upgrades, our licensed locksmiths protect homes and businesses.',
      ctaLabel:    'Call or Book Online',
    },
    conversion: {
      eyebrow:     'Locksmith — Upfront Pricing',
      headline:    'Quality Lock Work, No Hidden Fees',
      subheadline: 'Licensed locksmiths with transparent pricing, fast response, and a satisfaction guarantee.',
      ctaLabel:    'Get a Fixed Price Quote',
    },
    consultative: {
      eyebrow:     'Security Consultation & Locksmith Service',
      headline:    'Is Your Home as Secure as You Think?',
      subheadline: 'We assess your property\'s vulnerabilities and recommend the right locks and access control for your needs.',
      ctaLabel:    'Book a Security Assessment',
    },
    portfolio: {
      eyebrow:     'Security Upgrades Portfolio',
      headline:    'Properties We\'ve Secured',
      subheadline: 'Browse our commercial and residential security upgrade projects — access control, master systems, and more.',
      ctaLabel:    'View Our Work',
    },
    informational: {
      eyebrow:     'Locksmith Advice & Service',
      headline:    'Your Guide to Home & Business Security',
      subheadline: 'Lock ratings, security tips, and professional locksmith service from licensed local experts.',
      ctaLabel:    'Learn More',
    },
  },

  seoKeywords: {
    headTerms:      ['locksmith', 'locksmith service', 'locksmith near me'],
    midTail:        ['emergency locksmith', '24 hour locksmith', 'lockout service', 'lock replacement', 'car locksmith near me', 'commercial locksmith'],
    longTail:       ['locked out of house near me', 'locksmith cost for lockout', 'rekey locks after buying house', 'car key replacement locksmith', 'best locksmith near me reviews'],
    localModifiers: ['near me', 'local', 'in [city]', '[city] locksmith', '24/7 locksmith [city]'],
  },

  trustSignals: [
    'Licensed & Bonded',
    '24/7 Emergency Response',
    'Non-Destructive Entry',
    'Upfront Fixed Pricing',
  ],

  heroImageQueries: [
    'locksmith opening door lock',
    'professional locksmith at work',
    'locksmith key cutting service',
    'security lock installation professional',
  ],
}

export default locksmith
