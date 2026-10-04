// Attribution for openly licensed photos used as decorative section backdrops.
// CC BY / BY-SA require crediting the author and licence; adapted (cut-out,
// washed-out) versions of BY-SA images stay under the same licence.

export interface ImageCredit {
  label: string;
  author: string;
  license: string;
  href: string;
}

export const IMAGE_CREDITS = {
  // CC0, no attribution required; recorded for provenance (not rendered on the trust strip).
  pentecostMat: {
    label: "sese mat, Pentecost Island",
    author: "Honolulu Museum of Art",
    license: "CC0",
    href: "https://commons.wikimedia.org/wiki/File:Red_mat_from_Pentecost_Island,_Vanuatu,_Honolulu_Museum_of_Art_accession_(detail).jpg",
  },
  toniliu: {
    label: "Toniliu village, Efate",
    author: "Phillip Capper",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Toniliu_village,_Efate,_Vanuatu,_November_2006_-_Flickr_-_PhillipC.jpg",
  },
  tamtam: {
    label: "tamtam",
    author: "Graham Crumb",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Tamtam_(Imagicity_58).jpg",
  },
  blueLagoon: {
    label: "Blue Lagoon, Efate",
    author: "DB Thats-Me",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Blue_Lagoon_swimming_spot_-_panoramio.jpg",
  },
  pandanusBag: {
    label: "pandanus bag",
    author: "Simon Pierre Barrette, Université Laval",
    license: "CC BY-SA 4.0",
    href: "https://commons.wikimedia.org/wiki/File:Sac_-_vue_d%27ensemble_11-o.lau-F001.LA1058-01.jpg",
  },
  snorkelGear: {
    label: "snorkel gear",
    author: "Smart Destinations",
    license: "CC BY-SA 2.0",
    href: "https://www.flickr.com/photos/87242149@N00/3820542741",
  },
  iririki: {
    label: "Iririki Island, Port Vila",
    author: "Simon_sees",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Iririki_Island_Resort_(16742307981).jpg",
  },
  strawHat: {
    label: "straw hat",
    author: "Vietnamese Women's Museum",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Straw_hat,_Vietnamese_Women%27s_Museum.jpg",
  },
  islandBasket: {
    label: "island basket, Port Vila handicraft market",
    author: "Cindy Wiryakusuma/AusAID",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Handicraft_market,_Port_Vila,_Vanuatu_2009._Photo-_Cindy_Wiryakusuma,_AusAID_(10699826965).jpg",
  },
  erakorSunset: {
    label: "Erakor Bridge at sunset",
    author: "Graham Crumb",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Erakor_Bridge_At_Sunset_(96007123).jpeg",
  },
  frangipani: {
    label: "frangipani",
    author: "Jeremy Bishop",
    license: "CC0",
    href: "https://commons.wikimedia.org/wiki/File:Star-shaped_plumeria_(Unsplash).jpg",
  },
  // Postcard redesign (2026-10-05): Efate photos standing in for the mockup's stock images.
  meleSunset: {
    label: "sunset at Mele",
    author: "DB Thats-Me",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Mele_Sunset_-_panoramio.jpg",
  },
  meleBeachSunset: {
    label: "sunset on Mele Beach",
    author: "DB Thats-Me",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Sunset_Mele_Beach_-_panoramio.jpg",
  },
  vilaBayShip: {
    label: "ship leaving Vila Bay at sunset",
    author: "Graham Crumb",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Ship_Leaving_Port_at_Sunset_(Imagicity_141).jpg",
  },
  meleCascades: {
    label: "Mele Cascades",
    author: "gérard from Nouméa",
    license: "CC BY-SA 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Cascade_de_M%C3%A9l%C3%A9_(38876748484).jpg",
  },
  eratap: {
    label: "Eratap beach, Efate",
    author: "Phillip Capper",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Eratap,_Efate,_Vanuatu,_13_April_2008.jpg",
  },
  cocoaPods: {
    label: "cocoa pods, Port Vila market",
    author: "Jean Van Jean",
    license: "CC BY 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Cocoa_Fruits_-_panoramio.jpg",
  },
  vilaMarket: {
    label: "Port Vila market",
    author: "Phillip Capper",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Port_Vila_market,_Vanuatu,_1_June_2006_-_Flickr_-_PhillipC_(1).jpg",
  },
  leLagonJetty: {
    label: "jetty at Le Lagon, Port Vila",
    author: "Simon_sees",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:The_jetty_(16556252640).jpg",
  },
} satisfies Record<string, ImageCredit>;
