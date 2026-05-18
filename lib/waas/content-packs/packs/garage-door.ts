import type { IndustryContentPack } from '../types'

const garageDoor: IndustryContentPack = {
  trade:       'garage-door',
  displayName: 'Garage Door Services',

  defaultServices: [
    {
      title:       'Garage Door Repair',
      description: 'Fast repair of broken springs, cables, rollers, tracks, and all garage door components.',
      icon:        '🔧',
    },
    {
      title:       'Garage Door Installation',
      description: 'New garage door supply and installation — panel lift, roller, tilt, and sectional doors.',
      icon:        '🏠',
    },
    {
      title:       'Garage Door Opener Installation & Repair',
      description: 'Belt, chain, and direct-drive opener installation and repair — all major brands.',
      icon:        '📱',
    },
    {
      title:       'Spring Replacement',
      description: 'Torsion and extension spring replacement — same-day service for broken springs.',
      icon:        '🔩',
    },
    {
      title:       'Roller & Bearing Replacement',
      description: 'Worn roller and bearing replacement to restore quiet, smooth door operation.',
      icon:        '⚙️',
    },
    {
      title:       'Cable Repair & Replacement',
      description: 'Frayed or snapped garage door cable repair and replacement, including safety cables.',
      icon:        '🔗',
    },
    {
      title:       'Garage Door Tune-Up & Service',
      description: 'Full mechanical inspection, lubrication, adjustment, and safety system test.',
      icon:        '🛠️',
    },
    {
      title:       'Smart Garage Door Systems',
      description: 'MyQ and smart home integration for app-controlled garage access from anywhere.',
      icon:        '📲',
    },
  ],

  defaultFaqs: [
    {
      question: 'How quickly can you fix a broken garage door spring?',
      answer:   'We carry most spring sizes on our trucks for same-day replacement. Most spring jobs are completed within 1–2 hours of arrival.',
    },
    {
      question: 'Is it safe to try and repair a garage door spring myself?',
      answer:   'No — garage door springs are under extreme tension and are dangerous to replace without proper training and tools. Always use a professional.',
    },
    {
      question: 'How long do garage doors last?',
      answer:   'With proper maintenance, most garage doors last 15–30 years. Regular tune-ups and spring replacements extend service life significantly.',
    },
    {
      question: 'Can you repair any brand of garage door opener?',
      answer:   'We service and repair all major brands including Merlin, Grifco, B&D, ATA, Chamberlain, and LiftMaster.',
    },
    {
      question: 'How often should I service my garage door?',
      answer:   'We recommend an annual service and safety inspection to catch wear before it becomes a costly repair.',
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow:     'Same-Day Garage Door Repair',
      headline:    'Garage Door Stuck or Broken? We\'re Coming',
      subheadline: 'Broken springs, jammed doors, or opener failures — fast same-day repair to get you moving again.',
      ctaLabel:    'Call for Same-Day Repair',
    },
    standard: {
      eyebrow:     'Garage Door Specialists',
      headline:    'Reliable Garage Door Service You Can Trust',
      subheadline: 'Repair, installation, and maintenance for all garage door types and opener brands.',
      ctaLabel:    'Book a Service',
    },
    conversion: {
      eyebrow:     'Garage Door — Upfront Pricing',
      headline:    'Quality Garage Door Work, No Surprises',
      subheadline: 'Transparent quotes, same-day service, and guaranteed repairs on all garage door makes and models.',
      ctaLabel:    'Get a Free Quote',
    },
    consultative: {
      eyebrow:     'Garage Door Advice & Installation',
      headline:    'Choose the Right Garage Door with Confidence',
      subheadline: 'We help you select the right door style, material, and opener system for your home and budget.',
      ctaLabel:    'Book a Free Consultation',
    },
    portfolio: {
      eyebrow:     'Garage Door Projects',
      headline:    'Installs & Upgrades We\'ve Completed',
      subheadline: 'Browse garage door installations and upgrades — new panel lifts, smart systems, and custom designs.',
      ctaLabel:    'View Our Work',
    },
    informational: {
      eyebrow:     'Garage Door Guides & Service',
      headline:    'Everything You Need to Know About Garage Doors',
      subheadline: 'Spring types, opener comparisons, maintenance tips, and professional garage door service near you.',
      ctaLabel:    'Learn More',
    },
  },

  seoKeywords: {
    headTerms:      ['garage door repair', 'garage door service', 'garage door company'],
    midTail:        ['broken garage door spring repair', 'garage door opener installation', 'same day garage door repair', 'garage door replacement', 'garage door tune up service'],
    longTail:       ['garage door spring replacement cost', 'garage door repair same day near me', 'best garage door company near me', 'how much to replace garage door opener', 'garage door won\'t open repair'],
    localModifiers: ['near me', 'local', 'in [city]', '[city] garage door repair', 'best garage door service [city]'],
  },

  trustSignals: [
    'Same-Day Service Available',
    'All Brands Serviced',
    'Upfront Flat-Rate Pricing',
    'Parts & Labour Warranty',
  ],

  heroImageQueries: [
    'garage door technician repairing spring',
    'garage door installation residential',
    'professional garage door service',
    'new garage door home exterior',
  ],
}

export default garageDoor
