import type { IndustryContentPack } from '../types'

const handyman: IndustryContentPack = {
  trade:       'handyman',
  displayName: 'Handyman Services',

  defaultServices: [
    {
      title:       'General Repairs & Maintenance',
      description: 'Leaking taps, squeaky doors, broken fixtures, and all the small jobs that pile up.',
      icon:        '🔧',
    },
    {
      title:       'TV & Picture Mounting',
      description: 'Wall-mounted TV installation, picture hanging, and shelving installation done properly.',
      icon:        '📺',
    },
    {
      title:       'Flat-Pack Assembly',
      description: 'IKEA, Freedom, and all flat-pack furniture assembled quickly and correctly.',
      icon:        '🪑',
    },
    {
      title:       'Door & Window Repairs',
      description: 'Sticking doors, broken latches, window locks, and screen door repair and replacement.',
      icon:        '🚪',
    },
    {
      title:       'Caulking & Grouting',
      description: 'Kitchen, bathroom, and laundry caulking and tile grout resealing for a clean finish.',
      icon:        '🛁',
    },
    {
      title:       'Gutter Cleaning',
      description: 'Safe gutter clearing, downpipe flushing, and minor gutter repair.',
      icon:        '🏠',
    },
    {
      title:       'Painting & Patching',
      description: 'Small interior paint touch-ups, wall patching, and hole repair for a seamless finish.',
      icon:        '🖌️',
    },
    {
      title:       'Garden & Outdoor Tasks',
      description: 'Fence repair, deck maintenance, outdoor light installation, and general garden handyman work.',
      icon:        '🌿',
    },
  ],

  defaultFaqs: [
    {
      question: 'How much do you charge and is there a minimum call-out fee?',
      answer:   'We charge a flat hourly rate with a minimum call-out. You receive a clear estimate before any work begins, and you only pay for time on-site.',
    },
    {
      question: 'Can you handle multiple small jobs in one visit?',
      answer:   'Absolutely — most clients give us a list of tasks and we work through as many as possible in one efficient visit to save you time and money.',
    },
    {
      question: 'Do you bring your own tools and materials?',
      answer:   'Yes — we arrive with a full toolkit. For materials, we can supply them at cost or use what you have on hand.',
    },
    {
      question: 'Are you insured for working in my home?',
      answer:   'Yes — we carry public liability insurance for all work carried out in residential and commercial properties.',
    },
    {
      question: 'How far in advance do I need to book?',
      answer:   'We can often accommodate bookings within 24–48 hours. For large task lists, a week\'s notice is ideal.',
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow:     'Fast-Response Handyman',
      headline:    'That Urgent Fix — Done Today',
      subheadline: 'Broken door, leaking tap, or urgent repair — we respond fast and get it sorted properly.',
      ctaLabel:    'Book a Same-Day Handyman',
    },
    standard: {
      eyebrow:     'Trusted Local Handyman',
      headline:    'All the Jobs You\'ve Been Putting Off',
      subheadline: 'Reliable, insured handyman service for homes and businesses — no job too small.',
      ctaLabel:    'Book a Handyman',
    },
    conversion: {
      eyebrow:     'Handyman — Flat-Rate Pricing',
      headline:    'Quality Repairs, No Hassle',
      subheadline: 'Trusted handyman with upfront pricing, full insurance, and a guarantee on all work.',
      ctaLabel:    'Get a Free Quote',
    },
    consultative: {
      eyebrow:     'Home Maintenance Consultation',
      headline:    'Stop the Backlog — Start Fresh',
      subheadline: 'We assess your maintenance list, prioritise tasks, and deliver a clear plan to get your home in top shape.',
      ctaLabel:    'Book a Home Assessment',
    },
    portfolio: {
      eyebrow:     'Handyman Work Gallery',
      headline:    'Jobs Done Right — Before & After',
      subheadline: 'See the quality of our handyman work across TV mounts, furniture assembly, repairs, and maintenance.',
      ctaLabel:    'View Our Work',
    },
    informational: {
      eyebrow:     'Home Maintenance Advice',
      headline:    'DIY or Hire a Handyman?',
      subheadline: 'Honest guides, maintenance checklists, and reliable handyman service from your local trusted tradesperson.',
      ctaLabel:    'Learn More',
    },
  },

  seoKeywords: {
    headTerms:      ['handyman', 'handyman service', 'home repairs', 'handyman near me'],
    midTail:        ['local handyman service', 'TV mounting service', 'flat pack assembly near me', 'home maintenance service', 'handyman for small jobs', 'same day handyman'],
    longTail:       ['handyman hourly rate near me', 'best handyman service reviews', 'IKEA assembly service cost', 'home repair handyman same day', 'how to find a reliable handyman'],
    localModifiers: ['near me', 'local', 'in [city]', '[city] handyman', 'best handyman [city]'],
  },

  trustSignals: [
    'Fully Insured',
    'All Tasks & Trades',
    'Fixed Hourly Rate',
    '5-Star Rated',
  ],

  heroImageQueries: [
    'handyman fixing home repairs',
    'professional handyman with tools',
    'home maintenance service worker',
    'handyman mounting TV on wall',
  ],
}

export default handyman
