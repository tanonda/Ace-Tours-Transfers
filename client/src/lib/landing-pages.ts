/**
 * SEO category landing pages. Each entry renders through the shared
 * client/src/pages/landing-page.tsx template. Pages target high-intent Vanuatu
 * searches and funnel to existing product pages via TourCard.
 *
 * featuredMatch is tested (case-insensitive, non-global) against product.title
 * to pick which live products to feature — resilient to UUID/id changes.
 */
export interface LandingFaq { question: string; answer: string; }
export interface LandingSection { heading: string; paragraphs: string[]; }

export interface LandingPageConfig {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  h1: string;
  subhead: string;
  heroImage: string;
  intro: string[];
  sections: LandingSection[];
  faqs: LandingFaq[];
  category: 'tour' | 'transfer';
  featuredMatch: RegExp;
  ctaListingPath: '/tours' | '/transfers';
}

const HERO = 'https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063929/ace-tours-assets/ace_tours_hero_beach.jpg';

export const LANDING_PAGES: LandingPageConfig[] = [
  {
    slug: 'port-vila-airport-transfers',
    seoTitle: 'Port Vila Airport Transfers',
    seoDescription: 'Reliable Port Vila airport transfers from Bauerfield (VLI) to your hotel or resort. Meet-and-greet, fixed fares, day or night. Book your Vanuatu transfer with Ace Tours.',
    keywords: ['Port Vila airport transfers', 'Bauerfield airport taxi', 'Vanuatu airport shuttle', 'airport transfer Port Vila', 'Efate airport transport'],
    h1: 'Port Vila Airport Transfers',
    subhead: 'Stress-free arrivals and departures at Bauerfield International Airport (VLI).',
    heroImage: HERO,
    intro: [
      'Touch down in paradise without the hassle. Ace Tours & Transfers provides reliable, comfortable airport transfers between Bauerfield International Airport (VLI) and hotels, resorts, and private accommodation across Port Vila and Efate Island.',
      'Our local drivers meet every flight — day or night — with a warm Ni-Vanuatu welcome, help with your luggage, and a direct, air-conditioned ride to your door. Fares are agreed up front, so there are no surprises after a long journey.',
    ],
    sections: [
      { heading: 'Why book your airport transfer with us', paragraphs: [
        'Punctual meet-and-greet at arrivals for every international and domestic flight.',
        'Fixed, transparent pricing — no metered surprises or late-night surcharges.',
        'Clean, air-conditioned vehicles sized for couples, families, and groups.',
      ]},
      { heading: 'Where we go', paragraphs: [
        'We cover all Port Vila hotels and the wider Efate Island, including resort areas such as Havannah Harbour, Hideaway Island, and the Mele district. Travelling for a cruise or event? We also handle wharf and group logistics.',
      ]},
    ],
    faqs: [
      { question: 'Do you meet late-night and early-morning flights?', answer: 'Yes. We schedule transfers around your flight time, including late arrivals and pre-dawn departures.' },
      { question: 'How much is an airport transfer in Port Vila?', answer: 'Fares are fixed and agreed when you book, based on your destination and group size. Contact us for a quote.' },
      { question: 'Will the driver be waiting when I land?', answer: 'Yes — our driver meets you in the arrivals area with a name sign and helps with your luggage to the vehicle.' },
    ],
    category: 'transfer',
    featuredMatch: /airport|VIP executive|hospitality/i,
    ctaListingPath: '/transfers',
  },
  {
    slug: 'efate-island-day-tours',
    seoTitle: 'Efate Island Day Tours',
    seoDescription: 'Discover the best Efate Island day tours from Port Vila — Blue Lagoon, Mele Cascades, the round-island drive and more. Small groups, local guides. Book with Ace Tours.',
    keywords: ['Efate Island day tours', 'things to do Port Vila', 'Vanuatu day trips', 'Port Vila tours', 'Efate sightseeing'],
    h1: 'Efate Island Day Tours',
    subhead: 'See the very best of Efate in a day — waterfalls, lagoons, villages and viewpoints.',
    heroImage: HERO,
    intro: [
      'There is far more to Efate than the beach outside your resort. Ace Tours & Transfers runs friendly, small-group day tours that take you to the island\'s most loved spots — the famous Blue Lagoon, the cascading Mele waterfalls, hilltop viewpoints, and authentic village experiences.',
      'Every tour is guided by locals who know the stories behind the scenery, with comfortable air-conditioned transport and flexible pickups from your Port Vila accommodation.',
    ],
    sections: [
      { heading: 'Popular Efate day trips', paragraphs: [
        'From the turquoise Blue Lagoon and Mele Cascades to a full scenic circuit of the island, our day tours suit families, couples, and cruise visitors with limited time ashore.',
      ]},
      { heading: 'Tailored to you', paragraphs: [
        'Prefer a private tour at your own pace? We arrange custom itineraries and combine attractions so you see what matters most to you.',
      ]},
    ],
    faqs: [
      { question: 'Which Efate day tour is best for a first visit?', answer: 'The Blue Lagoon and Mele Cascades combination, or our scenic round-island tour, are the most popular for first-time visitors.' },
      { question: 'Do you pick up from my hotel?', answer: 'Yes — we offer pickups and drop-offs from accommodation across Port Vila and Efate.' },
      { question: 'Are the tours suitable for children?', answer: 'Absolutely. Our day tours are family-friendly and we use comfortable, air-conditioned vehicles.' },
    ],
    category: 'tour',
    featuredMatch: /blue lagoon|mele cascades|round island|pele island|city & market|city and market|scenic/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'blue-lagoon-vanuatu-tour',
    seoTitle: 'Blue Lagoon Vanuatu Tour',
    seoDescription: 'Swim in the famous Blue Lagoon near Port Vila and visit Turtle Bay on a guided Vanuatu day tour. Crystal-clear water, rope swings and local guides. Book with Ace Tours.',
    keywords: ['Blue Lagoon Vanuatu', 'Blue Lagoon Port Vila tour', 'Turtle Bay Vanuatu', 'Blue Lagoon Efate', 'Vanuatu swimming tour'],
    h1: 'Blue Lagoon Vanuatu Tour',
    subhead: 'Swim in the iconic turquoise Blue Lagoon — one of Efate\'s most photographed spots.',
    heroImage: HERO,
    intro: [
      'The Blue Lagoon is exactly as the photos promise: impossibly clear, warm turquoise water fringed by jungle, with rope swings and easy spots to float the afternoon away. It is one of the most beautiful and family-friendly places on Efate.',
      'Ace Tours & Transfers takes you there in comfort, often combined with nearby Turtle Bay, with a local guide and relaxed time to swim, snap photos, and soak it all in.',
    ],
    sections: [
      { heading: 'What to expect', paragraphs: [
        'Calm, shallow areas for younger swimmers and deeper water with rope swings for the adventurous. Bring swimwear, a towel, and a camera.',
      ]},
      { heading: 'Combine and save', paragraphs: [
        'The Blue Lagoon pairs perfectly with Turtle Bay and other Efate highlights — ask us about combining stops into one easy day.',
      ]},
    ],
    faqs: [
      { question: 'Where is the Blue Lagoon in Vanuatu?', answer: 'It is on the east side of Efate Island, roughly a 30–40 minute drive from Port Vila.' },
      { question: 'Is the Blue Lagoon good for children?', answer: 'Yes — there are calm, shallow areas as well as deeper water with rope swings, so it suits all ages.' },
      { question: 'What should I bring?', answer: 'Swimwear, a towel, sunscreen, water, and a camera. We handle the transport and guiding.' },
    ],
    category: 'tour',
    featuredMatch: /blue lagoon|turtle bay/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'mele-cascades-tour',
    seoTitle: 'Mele Cascades Waterfall Tour',
    seoDescription: 'Visit the stunning Mele Cascades waterfalls near Port Vila on a guided tour. Climb tiered pools to the spectacular top falls. Book your Vanuatu waterfall tour with Ace Tours.',
    keywords: ['Mele Cascades', 'Mele Cascades waterfall', 'Port Vila waterfall tour', 'Vanuatu waterfalls', 'Mele Cascades tour'],
    h1: 'Mele Cascades Waterfall Tour',
    subhead: 'Climb the tiered turquoise pools to Efate\'s spectacular Mele Cascades.',
    heroImage: HERO,
    intro: [
      'Just outside Port Vila, the Mele Cascades tumble down the hillside in a series of turquoise pools to a dramatic 35-metre top waterfall. A guided walk up through the cascades — with plenty of places to swim along the way — is one of Efate\'s most rewarding half-day adventures.',
      'Ace Tours & Transfers handles your return transport and guiding so you can focus on the climb, the views, and a refreshing swim under the falls.',
    ],
    sections: [
      { heading: 'What to expect', paragraphs: [
        'A guided walk up natural rock pools to the main falls, with swimming spots throughout. Wear sturdy footwear that can get wet and bring swimwear.',
      ]},
      { heading: 'Pair it with the Blue Lagoon', paragraphs: [
        'Mele Cascades sits close to other Efate highlights and combines well with a Blue Lagoon visit for a full day out — just ask us.',
      ]},
    ],
    faqs: [
      { question: 'How hard is the Mele Cascades walk?', answer: 'It is a moderate uphill walk over wet rocks with handrails in steeper sections. Reasonable fitness and grippy footwear are recommended.' },
      { question: 'Can I swim at Mele Cascades?', answer: 'Yes — there are swimming pools at several levels, including beneath the top falls.' },
      { question: 'How far is it from Port Vila?', answer: 'About 15 minutes by road, making it an easy half-day trip.' },
    ],
    category: 'tour',
    featuredMatch: /mele cascades/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'vanuatu-cultural-tours',
    seoTitle: 'Vanuatu Cultural Tours',
    seoDescription: 'Experience authentic Ni-Vanuatu culture near Port Vila — village visits, kava tasting and traditional custom at Ekasup and beyond. Book a Vanuatu cultural tour with Ace Tours.',
    keywords: ['Vanuatu cultural tours', 'Ekasup village tour', 'kava tasting Vanuatu', 'Port Vila cultural experience', 'Ni-Vanuatu village tour'],
    h1: 'Vanuatu Cultural Tours',
    subhead: 'Meet the people behind the islands — custom, kava, and village life on Efate.',
    heroImage: HERO,
    intro: [
      'Vanuatu\'s greatest treasure is its living culture. On our cultural tours you are welcomed into village life to see traditional custom, hear ancestral stories, taste fresh local kava, and understand the Ni-Vanuatu way of life that has thrived here for thousands of years.',
      'Led by community guides, these experiences are respectful, authentic, and genuinely memorable — a highlight for travellers who want more than a beach.',
    ],
    sections: [
      { heading: 'What you\'ll experience', paragraphs: [
        'Traditional welcomes and custom demonstrations, storytelling, local food and kava, and the chance to connect with village hosts.',
      ]},
      { heading: 'Respectful, community-based tourism', paragraphs: [
        'Our cultural tours are run with local communities so your visit supports the people who share their home and heritage with you.',
      ]},
    ],
    faqs: [
      { question: 'What is kava?', answer: 'Kava is Vanuatu\'s traditional drink, made from the root of the kava plant. Tasting it is a central part of the cultural experience.' },
      { question: 'Are cultural tours suitable for families?', answer: 'Yes — they are welcoming and educational for all ages, with activities children enjoy.' },
      { question: 'Where do the cultural tours take place?', answer: 'At cultural villages on Efate near Port Vila, including the well-known Ekasup village.' },
    ],
    category: 'tour',
    featuredMatch: /cultural|ekasup|roots & routes|roots and routes|kava|village/i,
    ctaListingPath: '/tours',
  },
  {
    slug: 'port-vila-private-transfers',
    seoTitle: 'Port Vila Private Transfers',
    seoDescription: 'Private transfers and chauffeur services around Port Vila and Efate — resort transfers, VIP executive cars, dinner and cruise transfers. Book private transport with Ace Tours.',
    keywords: ['Port Vila private transfers', 'VIP transfer Vanuatu', 'resort transfer Port Vila', 'private car Port Vila', 'Efate private transport'],
    h1: 'Port Vila Private Transfers',
    subhead: 'Private, door-to-door transport around Port Vila and Efate, on your schedule.',
    heroImage: HERO,
    intro: [
      'Travel on your own terms. Ace Tours & Transfers offers private, point-to-point transfers across Port Vila and Efate Island — from resort and hotel transfers to VIP executive cars, dinner outings, and cruise-ship logistics.',
      'You get a clean, air-conditioned vehicle, a professional local driver, and a fixed price agreed in advance — ideal for couples, families, executives, and groups who want comfort and privacy.',
    ],
    sections: [
      { heading: 'Private transfer options', paragraphs: [
        'Resort and hotel transfers across Efate, VIP executive vehicles, round-trip dinner transfers, and wharf or cruise-ship pickups for groups.',
      ]},
      { heading: 'Comfort and reliability', paragraphs: [
        'Every transfer is private to your party, punctual, and fixed-price — no sharing, no metered surprises.',
      ]},
    ],
    faqs: [
      { question: 'What areas do your private transfers cover?', answer: 'All of Port Vila and Efate Island, including resort areas like Havannah Harbour and Hideaway Island, and the wharf for cruise arrivals.' },
      { question: 'Can I book a private car for the whole day?', answer: 'Yes — we arrange private transport by the trip or for extended periods. Contact us with your plans for a quote.' },
      { question: 'Are your private transfers fixed price?', answer: 'Yes. We agree the fare before your trip so there are no surprises.' },
    ],
    category: 'transfer',
    featuredMatch: /VIP|private|resort|hideaway|havannah|dinner|cruise|wharf/i,
    ctaListingPath: '/transfers',
  },
];

export const LANDING_SLUGS: string[] = LANDING_PAGES.map((p) => p.slug);

export function findLandingPage(slug: string): LandingPageConfig | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
