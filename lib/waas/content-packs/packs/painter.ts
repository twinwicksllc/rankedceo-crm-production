import type { IndustryContentPack } from '../types'

const painter: IndustryContentPack = {
  trade:       'painter',
  displayName: 'Painting Services',

  defaultServices: [
    {
      title:       'Interior House Painting',
      description: 'Full interior painting — walls, ceilings, trim, and doors — with thorough surface prep.',
      icon:        '🖌️',
    },
    {
      title:       'Exterior House Painting',
      description: 'Weather-resistant exterior painting and staining that protects and beautifies your home.',
      icon:        '🏠',
    },
    {
      title:       'Commercial Painting',
      description: 'Office, retail, and commercial space painting — scheduled around your business hours.',
      icon:        '🏢',
    },
    {
      title:       'Cabinet Painting & Refinishing',
      description: 'Kitchen and bathroom cabinet painting with factory-smooth factory finishes at a fraction of replacement cost.',
      icon:        '🚪',
    },
    {
      title:       'Deck & Fence Staining',
      description: 'Pressure washing, prep, and staining or painting for decks, fences, and wood structures.',
      icon:        '🌳',
    },
    {
      title:       'Wallpaper Removal & Installation',
      description: 'Professional wallpaper stripping and new wallpaper installation for any room.',
      icon:        '📋',
    },
    {
      title:       'Colour Consultation',
      description: 'Free colour consultation with digital mockups to help you choose the perfect palette.',
      icon:        '🎨',
    },
    {
      title:       'Drywall Repair & Patch',
      description: 'Seamless drywall repairs, skim coating, and surface preparation before painting.',
      icon:        '🔧',
    },
  ],

  defaultFaqs: [
    {
      question: 'How long does interior painting take?',
      answer:   'Most single-room projects take 1 day. Whole-home interior painting typically takes 3–7 days depending on size and the number of coats required.',
    },
    {
      question: 'What type of paint do you use?',
      answer:   'We use premium brands including Sherwin-Williams and Benjamin Moore. We\'ll recommend the best sheen and formula for each surface.',
    },
    {
      question: 'Do I need to move my furniture?',
      answer:   'We move and protect all furniture and cover floors before we start. You don\'t need to clear the room — we handle it.',
    },
    {
      question: 'How do I choose the right colour?',
      answer:   'We offer free colour consultations and can provide digital room mockups so you can see the colour before we apply a single brushstroke.',
    },
    {
      question: 'Do you offer a warranty on your work?',
      answer:   'Yes — we back all painting work with a workmanship warranty. If the paint peels or fails due to application within the warranty period, we repaint at no charge.',
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow:     'Fast Turnaround Painting',
      headline:    'Fresh Paint, Fast — For Move-Ins & Urgent Needs',
      subheadline: 'Tight deadline? We accommodate urgent interior and exterior painting with a fast, professional crew.',
      ctaLabel:    'Call for a Fast Quote',
    },
    standard: {
      eyebrow:     'Professional Painting Services',
      headline:    'Beautiful Results That Last',
      subheadline: 'Expert interior and exterior painting with meticulous prep work and premium paint products.',
      ctaLabel:    'Get a Free Estimate',
    },
    conversion: {
      eyebrow:     'Painting — Free Colour Consultation',
      headline:    'Transform Your Space for Less',
      subheadline: 'Professional painters, premium materials, and competitive prices — with a satisfaction guarantee.',
      ctaLabel:    'Get a Free Quote',
    },
    consultative: {
      eyebrow:     'Painting Advice & Design Support',
      headline:    'The Perfect Colour, Applied Perfectly',
      subheadline: 'We collaborate with you on colour selection, surface prep, and finish options to achieve exactly the look you want.',
      ctaLabel:    'Book a Colour Consultation',
    },
    portfolio: {
      eyebrow:     'Painting Portfolio',
      headline:    'Transformations We\'re Proud Of',
      subheadline: 'Browse our interior, exterior, and cabinet painting projects — see the quality before you commit.',
      ctaLabel:    'View Our Work',
    },
    informational: {
      eyebrow:     'Painting Tips & Professional Service',
      headline:    'Everything You Need to Know About House Painting',
      subheadline: 'Colour trends, prep tips, and paint selection guides from professional painters who do this every day.',
      ctaLabel:    'Learn More',
    },
  },

  seoKeywords: {
    headTerms:      ['painter', 'painting services', 'house painter', 'painting contractor'],
    midTail:        ['interior house painting', 'exterior painting service', 'cabinet painting near me', 'commercial painting contractor', 'deck staining service', 'residential painter'],
    longTail:       ['interior painting cost estimate', 'best house painter near me', 'cabinet painting vs replacement cost', 'exterior painting company reviews', 'how to choose paint colours for home'],
    localModifiers: ['near me', 'local', 'in [city]', '[city] painting company', 'best painter [city]'],
  },

  trustSignals: [
    'Licensed & Fully Insured',
    'Premium Paint Products',
    'No Mess Guarantee',
    'Free Colour Consultation',
  ],

  heroImageQueries: [
    'professional painter rolling interior wall',
    'house painter exterior painting',
    'painting contractor with roller',
    'freshly painted bright interior room',
  ],
}

export default painter
