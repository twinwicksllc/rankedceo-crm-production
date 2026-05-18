import type { IndustryContentPack } from '../types'

const applianceRepair: IndustryContentPack = {
  trade:       'appliance-repair',
  displayName: 'Appliance Repair Services',

  defaultServices: [
    {
      title:       'Washing Machine Repair',
      description: 'Fast diagnosis and repair of all washing machine faults — any brand, top or front loader.',
      icon:        '👕',
    },
    {
      title:       'Refrigerator & Freezer Repair',
      description: 'Fridge not cooling, freezer icing up, or compressor failure — we fix all brands on-site.',
      icon:        '🥶',
    },
    {
      title:       'Dishwasher Repair',
      description: 'Dishwasher not draining, leaking, or failing to clean properly — diagnosed and fixed fast.',
      icon:        '🍽️',
    },
    {
      title:       'Oven, Stove & Cooktop Repair',
      description: 'Gas and electric oven repair, igniter replacement, element faults, and control board issues.',
      icon:        '🔥',
    },
    {
      title:       'Dryer Repair',
      description: 'Tumble dryer not heating, noisy, or failing to spin — parts in stock for fast repair.',
      icon:        '🌀',
    },
    {
      title:       'Air Conditioner Repair',
      description: 'Split system and window AC fault diagnosis, gas recharge, fan motor, and PCB repair.',
      icon:        '❄️',
    },
    {
      title:       'Microwave Repair',
      description: 'Microwave not heating, turntable faults, and door switch replacement.',
      icon:        '📦',
    },
    {
      title:       'Commercial Appliance Repair',
      description: 'Commercial washers, dryers, refrigeration, and kitchen equipment repair for hospitality and retail.',
      icon:        '🏢',
    },
  ],

  defaultFaqs: [
    {
      question: 'Is it worth repairing my appliance or should I replace it?',
      answer:   'As a general guide, if the repair cost is less than 50% of the replacement value and the appliance is under 8–10 years old, repair is usually the better choice. We give you an honest assessment.',
    },
    {
      question: 'Do you carry spare parts?',
      answer:   'We carry a wide range of parts on our vehicles for common brands and faults. If a part needs ordering, we provide a clear timeline and confirm before proceeding.',
    },
    {
      question: 'What brands do you service?',
      answer:   'We service all major brands including Samsung, LG, Bosch, Fisher & Paykel, Miele, Whirlpool, Electrolux, and more.',
    },
    {
      question: 'Is there a call-out fee?',
      answer:   'Yes — there is a flat call-out and diagnostic fee. If you proceed with the repair, this is applied toward the total cost.',
    },
    {
      question: 'Do you offer a warranty on repairs?',
      answer:   'Yes — all parts and labour are warranted. If the same fault returns within the warranty period, we return to fix it at no charge.',
    },
  ],

  heroCopyPatterns: {
    emergency: {
      eyebrow:     'Same-Day Appliance Repair',
      headline:    'Broken Appliance? We\'re On Our Way',
      subheadline: 'Same-day repair for fridges, washers, ovens, and more — parts on board for fast first-visit fixes.',
      ctaLabel:    'Book Same-Day Repair',
    },
    standard: {
      eyebrow:     'Certified Appliance Technicians',
      headline:    'Fast, Reliable Appliance Repair',
      subheadline: 'Expert repairs for all major home appliances — with a first-visit fix rate you can count on.',
      ctaLabel:    'Book a Repair',
    },
    conversion: {
      eyebrow:     'Appliance Repair — Upfront Pricing',
      headline:    'Fix It Fast, Fix It Right',
      subheadline: 'Transparent diagnostic fees, no hidden charges, and a parts and labour warranty on every repair.',
      ctaLabel:    'Get a Price Estimate',
    },
    consultative: {
      eyebrow:     'Repair vs. Replace Advice',
      headline:    'An Honest Assessment, Not Just a Bill',
      subheadline: 'We diagnose your appliance and give you a clear repair-vs-replace recommendation so you make the right call.',
      ctaLabel:    'Book a Diagnostic',
    },
    portfolio: {
      eyebrow:     'Appliance Repair Results',
      headline:    'Appliances We\'ve Brought Back to Life',
      subheadline: 'Browse our repair case studies — from complex fault diagnosis to tricky parts sourcing.',
      ctaLabel:    'View Case Studies',
    },
    informational: {
      eyebrow:     'Appliance Repair Guides',
      headline:    'Diagnose Appliance Faults Before You Call',
      subheadline: 'Common fault guides, maintenance tips, and professional appliance repair from certified local technicians.',
      ctaLabel:    'Learn More',
    },
  },

  seoKeywords: {
    headTerms:      ['appliance repair', 'appliance technician', 'appliance repair service'],
    midTail:        ['washing machine repair near me', 'fridge repair service', 'dishwasher repair near me', 'oven repair service', 'dryer repair near me', 'same day appliance repair'],
    longTail:       ['appliance repair cost estimate', 'washing machine not spinning repair', 'fridge not cooling repair near me', 'best appliance repair company reviews', 'is it worth repairing appliance'],
    localModifiers: ['near me', 'local', 'in [city]', '[city] appliance repair', 'best appliance technician [city]'],
  },

  trustSignals: [
    'Certified Technicians',
    'All Major Brands Serviced',
    'Parts & Labour Warranty',
    'First-Visit Fix Guarantee',
  ],

  heroImageQueries: [
    'appliance repair technician fixing washing machine',
    'refrigerator repair service professional',
    'appliance technician diagnosing dishwasher',
    'home appliance repair service',
  ],
}

export default applianceRepair
