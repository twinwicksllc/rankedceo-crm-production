import type { IndustryContentPack } from '../types'

const flooring: IndustryContentPack = {
  trade:       'flooring',
  displayName: 'Flooring Services',

  defaultServices: [
    {
      title:       'Hardwood Floor Installation',
      description: 'Solid and engineered hardwood supply and installation — nailed, glued, or floating methods.',
      icon:        '🌳',
    },
    {
      title:       'Laminate Flooring Installation',
      description: 'Waterproof and standard laminate floor installation with underlay and finishing trim.',
      icon:        '🏠',
    },
    {
      title:       'Vinyl & LVP Flooring Installation',
      description: 'Luxury vinyl plank and sheet vinyl installation for kitchens, bathrooms, and commercial spaces.',
      icon:        '💧',
    },
    {
      title:       'Tile Installation',
      description: 'Ceramic, porcelain, and natural stone tile installation for floors, walls, and wet areas.',
      icon:        '🔲',
    },
    {
      title:       'Carpet Supply & Installation',
      description: 'Carpet selection, supply, and professional installation for bedrooms and living areas.',
      icon:        '🛋️',
    },
    {
      title:       'Hardwood Floor Sanding & Refinishing',
      description: 'Restore dull or damaged hardwood floors with dustless sanding, staining, and finishing.',
      icon:        '✨',
    },
    {
      title:       'Subfloor Repair & Preparation',
      description: 'Subfloor levelling, squeaky floor repair, and moisture barrier installation before any new floor.',
      icon:        '🔧',
    },
    {
      title:       'Floor Removal & Disposal',
      description: 'Old flooring tear-out and responsible disposal before your new floor goes in.',
      icon:        '🗑️',
    },
  ],

  defaultFaqs: [
    {
      question: 'What is the best flooring for a wet area like a bathroom?',
      answer:   'Porcelain tile and luxury vinyl plank (LVP) are the top choices for wet areas due to their waterproof properties and durability.',
    },
    {
      question: 'How long does floor installation take?',
      answer:   'A standard room takes 1–2 days. Whole-home flooring projects typically take 3–7 days depending on size and material.',
    },
    {
      question: 'Do I need to move my furniture?',
      answer:   'We ask clients to clear the room before installation. We can assist with moving larger items for an additional fee.',
    },
    {
      question: 'How long should I stay off a newly refinished hardwood floor?',
      answer:   'We recommend 24 hours before light foot traffic and 72 hours before placing furniture or rugs on a freshly refinished floor.',
    },
    {
      question: 'Do you offer supply-and-install packages?',
      answer:   'Yes — we supply materials at trade prices and include installation, saving you the hassle of sourcing flooring separately.',
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow:     'Urgent Flooring Repair',
      headline:    'Water Damage or Urgent Floor Repair — We Respond Fast',
      subheadline: 'Flood damage, cracked tiles, or a subfloor emergency — our flooring team responds quickly.',
      ctaLabel:    'Call for Urgent Floor Repair',
    },
    standard: {
      eyebrow:     'Professional Flooring Installation',
      headline:    'Beautiful Floors, Flawlessly Installed',
      subheadline: 'Hardwood, vinyl, tile, laminate, and carpet — expert supply and installation by certified flooring specialists.',
      ctaLabel:    'Get a Free Flooring Quote',
    },
    conversion: {
      eyebrow:     'Flooring — Supply & Install Packages',
      headline:    'New Floors at the Best Price',
      subheadline: 'Trade-price materials, expert installation, and a clean finish — all at a price that works for your budget.',
      ctaLabel:    'Get a Free Quote',
    },
    consultative: {
      eyebrow:     'Flooring Advice & Design',
      headline:    'Choose the Right Floor for Your Home',
      subheadline: 'We bring samples to you, explain the pros and cons of each option, and help you choose with confidence.',
      ctaLabel:    'Book a Free In-Home Consult',
    },
    portfolio: {
      eyebrow:     'Flooring Portfolio',
      headline:    'Floors We\'ve Installed & Restored',
      subheadline: 'Browse hardwood, tile, vinyl, and carpet projects across residential and commercial properties.',
      ctaLabel:    'View Our Portfolio',
    },
    informational: {
      eyebrow:     'Flooring Buyer\'s Guide',
      headline:    'How to Choose the Right Flooring',
      subheadline: 'Material comparisons, cost guides, and maintenance tips from professional flooring installers.',
      ctaLabel:    'Read Our Guide',
    },
  },

  seoKeywords: {
    headTerms:      ['flooring', 'flooring installation', 'flooring contractor', 'floor installer'],
    midTail:        ['hardwood floor installation near me', 'vinyl plank flooring installer', 'tile installation service', 'carpet installation near me', 'floor sanding and refinishing', 'laminate flooring installation'],
    longTail:       ['hardwood floor installation cost per square foot', 'best flooring for kitchen and bathroom', 'vinyl plank vs laminate flooring', 'floor refinishing cost near me', 'cheapest flooring options for home'],
    localModifiers: ['near me', 'local', 'in [city]', '[city] flooring company', 'best floor installer [city]'],
  },

  trustSignals: [
    'Certified Floor Installers',
    'Supply & Install Available',
    'Dustless Sanding Technology',
    'All Flooring Types',
  ],

  heroImageQueries: [
    'flooring installer laying hardwood floor',
    'luxury vinyl plank flooring installation',
    'beautiful hardwood floor newly installed',
    'tile floor installation professional',
  ],
}

export default flooring
