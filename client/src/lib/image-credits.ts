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
} satisfies Record<string, ImageCredit>;
