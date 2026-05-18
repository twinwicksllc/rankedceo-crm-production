import type { IndustryContentPack } from '../types'

const hvac: IndustryContentPack = {
  trade:       'hvac',
  displayName: 'HVAC Services',

  defaultServices: [
    {
      title:       'AC Installation & Replacement',
      description: 'Energy-efficient central air, ductless mini-split, and heat pump system installations.',
      icon:        '❄️',
    },
    {
      title:       'Heating System Installation',
      description: 'Gas furnace, heat pump, and boiler installations sized and configured for your space.',
      icon:        '🔥',
    },
    {
      title:       'AC Repair & Tune-Up',
      description: 'Fast diagnosis and repair of all cooling system failures — any brand, any age.',
      icon:        '🔧',
    },
    {
      title:       'Furnace Repair & Service',
      description: 'Emergency furnace repair and annual safety inspections to keep you warm all winter.',
      icon:        '🏠',
    },
    {
      title:       'HVAC Maintenance Plans',
      description: 'Spring and fall bi-annual tune-ups that extend equipment life and cut energy costs.',
      icon:        '📋',
    },
    {
      title:       'Indoor Air Quality Solutions',
      description: 'Air purifiers, humidifiers, UV light systems, and duct cleaning for healthier air.',
      icon:        '💨',
    },
    {
      title:       'Ductwork Installation & Repair',
      description: 'New duct system design, flex duct replacement, and air-seal testing for peak efficiency.',
      icon:        '🔩',
    },
    {
      title:       'Smart Thermostat Installation',
      description: 'Ecobee, Nest, and Honeywell smart thermostat supply and configuration.',
      icon:        '📱',
    },
  ],

  defaultFaqs: [
    {
      question: 'How often should I service my HVAC system?',
      answer:   'Twice a year — once in spring before cooling season and once in autumn before heating season. Regular maintenance prevents costly breakdowns.',
    },
    {
      question: 'How do I know if I need a new AC unit or just a repair?',
      answer:   'If your system is over 12–15 years old, needs frequent repairs, or your energy bills are climbing, replacement is usually more cost-effective. We provide an honest assessment.',
    },
    {
      question: 'What HVAC brands do you service?',
      answer:   'We service all major brands including Carrier, Trane, Lennox, Goodman, American Standard, Daikin, and more.',
    },
    {
      question: 'Do you offer financing for new HVAC systems?',
      answer:   'Yes — we partner with financing providers to offer flexible payment options on new installations. Ask us for details.',
    },
    {
      question: 'Why is my AC blowing warm air?',
      answer:   'Common causes include low refrigerant, a dirty filter, a faulty compressor, or a tripped breaker. Our technicians diagnose and fix it fast.',
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow:     '24/7 HVAC Emergency Service',
      headline:    'No Heat or AC? We\'re On Our Way',
      subheadline: 'Heating and cooling emergencies handled fast — same-day response, licensed technicians.',
      ctaLabel:    'Call Now — Emergency HVAC',
    },
    standard: {
      eyebrow:     'Certified HVAC Contractors',
      headline:    'Comfort You Can Count On, Year-Round',
      subheadline: 'Expert heating, cooling, and air quality services delivered by licensed HVAC technicians.',
      ctaLabel:    'Book a Free Estimate',
    },
    conversion: {
      eyebrow:     'HVAC Services — Upfront Pricing',
      headline:    'Better Comfort, Lower Energy Bills',
      subheadline: 'Licensed HVAC contractors with transparent quotes and guaranteed installations.',
      ctaLabel:    'Get a Free Quote',
    },
    consultative: {
      eyebrow:     'HVAC Advice You Can Trust',
      headline:    'The Right HVAC System for Your Home',
      subheadline: 'We size, specify, and explain your options — so you invest in the right system, not just the cheapest one.',
      ctaLabel:    'Schedule a Free Consultation',
    },
    portfolio: {
      eyebrow:     'HVAC Project Portfolio',
      headline:    'Installations & Upgrades — Our Work',
      subheadline: 'Browse completed HVAC projects from ductless mini-splits to full commercial HVAC system replacements.',
      ctaLabel:    'View Our Projects',
    },
    informational: {
      eyebrow:     'Your Local HVAC Experts',
      headline:    'Everything You Need to Know About HVAC',
      subheadline: 'Buying guides, energy-saving tips, and maintenance advice from certified HVAC professionals.',
      ctaLabel:    'Learn More',
    },
  },

  seoKeywords: {
    headTerms:      ['HVAC', 'HVAC services', 'heating and cooling', 'HVAC contractor'],
    midTail:        ['AC repair near me', 'furnace repair service', 'HVAC installation', 'air conditioning replacement', 'heating repair service', 'HVAC maintenance plan'],
    longTail:       ['central air conditioner installation cost', 'emergency furnace repair near me', 'HVAC tune up special', 'best HVAC company near me', 'ductless mini split installation price'],
    localModifiers: ['near me', 'local', 'in [city]', '[city] HVAC', 'best HVAC [city]'],
  },

  trustSignals: [
    'NATE Certified Technicians',
    '24/7 Emergency Service',
    'All Major Brands Serviced',
    'Satisfaction Guaranteed',
  ],

  heroImageQueries: [
    'HVAC technician servicing air conditioner',
    'heating cooling system installation',
    'air conditioner repair professional',
    'HVAC unit outdoor residential',
  ],
}

export default hvac
