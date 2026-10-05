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
  vilaHarbourDusk: {
    label: "Port Vila Harbour at dusk",
    author: "Graham Crumb",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Port_Vila_Harbour_(Imagicity_816).jpg",
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
  vilaHarbourDay: {
    label: "Port Vila harbour",
    author: "Phillip Capper",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Port_Vila_harbour,_Vanuatu,_June_2009_(3653339680).jpg",
  },
  erakorLagoon: {
    label: "Erakor Lagoon",
    author: "Simon_sees",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Vanuatu_Erakor_Lagoon_(16555872768).jpg",
  },
} satisfies Record<string, ImageCredit>;

/**
 * Product listing photos (real Efate photos replacing AI-generated ones, 2026-10-05).
 * Keyed by the image path stored on the product; the Photo credits page lists
 * whichever of these products currently use.
 */
export const PRODUCT_PHOTO_CREDITS: Record<string, ImageCredit> = {
  "/assets/products/vip-port-vila-seafront.webp": {
    label: "Port Vila seafront park",
    author: "Torbenbrinker",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:PortVilaSeafrontPark.jpg",
  },
  "/assets/products/bus-hire-efate-coast-epau.webp": {
    label: "coast near Epau, Efate",
    author: "Phillip Capper",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Round_Efate_trip_26_Nov._2006_-_coast_near_Epau_-_Flickr_-_PhillipC.jpg",
  },
  "/assets/products/blue-lagoon-rope-swing.webp": {
    label: "Blue Lagoon rope swing, Efate",
    author: "Sheminghui.WU",
    license: "CC BY-SA 4.0",
    href: "https://commons.wikimedia.org/wiki/File:%E8%93%9D%E8%89%B2%E6%B3%BB%E6%B9%96BulueLagoonVanuatu_Flyman.jpg",
  },
  "/assets/products/pele-island-werearu-beach.webp": {
    label: "Werearu beach, Pele Island",
    author: "Nesta Quari",
    license: "CC BY-SA 4.0",
    href: "https://commons.wikimedia.org/wiki/File:Werearu_beach.jpg",
  },
  "/assets/products/hospitality-harbour-hotel-view.webp": {
    label: "Port Vila harbour from the Chantilly hotel",
    author: "Phillip Capper",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Port_Vila_Harbour,_Vanuatu_from_Chantilly_Hotel,_13_April_2008_(2411564950).jpg",
  },
  "/assets/products/port-vila-waterfront.webp": {
    label: "Port Vila waterfront",
    author: "Bahnfrend",
    license: "CC BY-SA 4.0",
    href: "https://commons.wikimedia.org/wiki/File:Waterfront,_Port_Vila,_2007_(7).jpg",
  },
  "/assets/products/port-vila-market.webp": {
    label: "Port Vila market",
    author: "Rob Maccoll / AusAID (DFAT)",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Port_Vila_vegetable_market,_Vanuatu_2007._Photo-_Rob_Maccoll_-_AusAID_(10714205816).jpg",
  },
  "/assets/products/mele-cascades-pools.webp": {
    label: "Mele Cascades pools",
    author: "gérard from Nouméa",
    license: "CC BY-SA 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Un_des_nombreux_bassins_(38689388315).jpg",
  },
  "/assets/products/sunset-vila-harbour.webp": {
    label: "sunset on Vila Harbour",
    author: "Jean Van Jean",
    license: "CC BY 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Sunset_on_Vila_Harbour_-_panoramio.jpg",
  },
  "/assets/products/port-vila-dusk.webp": {
    label: "Port Vila at dusk",
    author: "Graham Crumb",
    license: "CC BY-SA 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Night_Descends_(Imagicity_342).jpg",
  },
  "/assets/products/ekasup-cultural-village.webp": {
    label: "Ekasup Cultural Village",
    author: "Simon_sees",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Ekasup_Cultural_Village_(16742064331).jpg",
  },
  "/assets/products/cruise-ship-port-vila-wharf.webp": {
    label: "Pacific Sun at Port Vila wharf",
    author: "Bahnfrend",
    license: "CC BY-SA 4.0",
    href: "https://commons.wikimedia.org/wiki/File:Pacific_Sun,_Port_Vila,_2007_(1).jpg",
  },
  "/assets/products/havannah-harbour.webp": {
    label: "Port Havannah Harbour",
    author: "Jean Van Jean",
    license: "CC BY 3.0",
    href: "https://commons.wikimedia.org/wiki/File:Port_Havannah_Harbour_-_panoramio.jpg",
  },
  "/assets/products/hideaway-island-kayaks.webp": {
    label: "Hideaway Island",
    author: "Simon_sees",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Hideaway_Island_(16743494485).jpg",
  },
  "/assets/products/port-vila-harbour-town.webp": {
    label: "Port Vila harbour and town",
    author: "eGuide Travel",
    license: "CC BY 2.0",
    href: "https://commons.wikimedia.org/wiki/File:Vanuatu_(5781260094).jpg",
  },
};
