import { db } from "./server/db";
import { products } from "./shared/schema";

async function main() {
  console.log("Seeding comprehensive new Port Vila packages...");

  const newProducts = [
    // --- TOURS ---
    {
      title: "Mele Cascades Waterfall Tour",
      description: [
        '<p>Escape to the lush, tropical rainforest of Vanuatu and witness the breathtaking beauty of the Mele Cascades. This guided tour takes you through spectacular jungle scenery, ending at the magnificent 35-meter waterfall.</p>',
        '<h3>Tour Highlights</h3>',
        '<ul>',
        '<li>Guided walk through vibrant tropical gardens & rainforests.</li>',
        '<li>Swim in the pristine, terraced natural pools cascading down the hillside.</li>',
        '<li>Refreshing stop at the main waterfall viewing platform.</li>',
        '<li>Relaxed tropical fruit platter served riverside.</li>',
        '</ul>',
      ],
      category: "tour",
      image: "",
      duration: "3-4 Hours",
      seoTitle: "Mele Cascades Waterfall Tour Port Vila | Ace Tours",
      seoDescription: "Join a guided tour of the famous Mele Cascades in Port Vila, Vanuatu. Swim in crystal clear natural pools and enjoy a tropical fruit platter in the rainforest ecosystem.",
      seoKeywords: "mele cascades tour, port vila waterfalls, vanuatu rainforest tour",
      geoTargeting: "Mele Village, Port Vila, Efate, Vanuatu",
      price: "6500",
      adultPriceCents: 6500,
      childPriceCents: 4500,
      isActive: true,
      listingOrder: 2
    },
    {
      title: "Ekasup Cultural Village Tour",
      description: [
        '<p>Step back in time and experience the authentic, ancient Melanesian way of life. The Ekasup Cultural Village is an immersive journey into the heart and soul of traditional Vanuatu culture.</p>',
        '<h3>What You Will Experience</h3>',
        '<ul>',
        '<li>Welcome by the Chief with a traditional warrior dance.</li>',
        '<li>Demonstrations of traditional hunting, trapping, and fishing methods.</li>',
        '<li>Learn the secrets of food preservation and natural medicines.</li>',
        '<li>Experience custom magic and hear ancient legends passed down natively.</li>',
        '</ul>',
      ],
      category: "tour",
      image: "",
      duration: "Half Day",
      seoTitle: "Ekasup Cultural Village Authentic Tour | Vanuatu Culture",
      seoDescription: "Experience authentic Melanesian culture at Ekasup Village. Learn traditional hunting, natural medicines, and witness custom warrior dances.",
      seoKeywords: "ekasup cultural village, vanuatu cultural tour, traditional melanesian culture port vila",
      geoTargeting: "Port Vila, Efate, Vanuatu",
      price: "8500",
      adultPriceCents: 8500,
      childPriceCents: 4500,
      isActive: true,
      listingOrder: 4
    },
    {
      title: "Port Vila City & Market Tour",
      description: [
        '<p>Get your bearings and discover the vibrant heart of Vanuatu’s capital city. This comprehensive orientation tour takes you through the bustling local markets, historical landmarks, and scenic viewpoints of Port Vila.</p>',
        '<ul>',
        '<li>Explore the colorful 24/7 Port Vila Market (Mama’s Market) for fresh organic produce and local handicrafts.</li>',
        '<li>Visit Parliament House and the National Museum of Vanuatu.</li>',
        '<li>Enjoy panoramic views of the harbor from the Port Vila lookout.</li>',
        '<li>Duty-free shopping stops available upon request.</li>',
        '</ul>',
      ],
      category: "tour",
      image: "",
      duration: "2-3 Hours",
      seoTitle: "Port Vila City & Market Sightseeing Tour | Ace Tours",
      seoDescription: "Discover Port Vila's vibrant culture, history, and markets. Perfect orientation tour for newly arrived guests in Vanuatu.",
      seoKeywords: "port vila city tour, port vila markets, vanuatu sightseeing, mamas market port vila",
      geoTargeting: "Port Vila City Centre, Vanuatu",
      price: "4500",
      adultPriceCents: 4500,
      childPriceCents: 2500,
      isActive: true,
      listingOrder: 5
    },
    {
      title: "Havannah Harbour Sunset Cruise & Dinner",
      description: [
        '<p>Experience the ultimate tropical romance with a serene sunset cruise along the pristine waters of Havannah Harbour, followed by a beachside dinner under the stars.</p>',
        '<ul>',
        '<li>2-hour scenic cruise as the sun dips below the Pacific horizon.</li>',
        '<li>Complimentary sparkling wine or local Tusker beer upon boarding.</li>',
        '<li>Spot marine life in the calm, sheltered waters of the harbour.</li>',
        '<li>Gourmet 3-course dinner featuring fresh local seafood and organic island beef.</li>',
        '</ul>',
      ],
      category: "tour",
      image: "",
      duration: "Evening (4-5 Hours)",
      seoTitle: "Sunset Cruise & Dinner Havannah Harbour | Vanuatu",
      seoDescription: "Romantic sunset cruise in Havannah Harbour followed by a premium beachside dining experience. The perfect evening out in Vanuatu.",
      seoKeywords: "havannah harbour sunset cruise, port vila dinner cruise, romantic things to do vanuatu",
      geoTargeting: "Havannah Harbour, North Efate, Vanuatu",
      price: "15500",
      adultPriceCents: 15500,
      childPriceCents: 8500,
      isActive: true,
      listingOrder: 6
    },
    {
      title: "Hideaway Island Resort Transfer",
      description: [
        '<p>Direct, comfortable shuttle service from Port Vila International Airport or your city hotel to the Mele Beach ferry point for Hideaway Island Resort.</p>',
        '<p>Our air-conditioned vehicles ensure a relaxing start to your island getaway. We coordinate directly with the Hideaway Island ferry schedule so you never have to wait.</p>'
      ],
      category: "transfer",
      image: "",
      duration: "30 Mins",
      seoTitle: "Hideaway Island Resort Shuttle & Transfer | Ace Tours",
      seoDescription: "Reliable, air-conditioned transfers from Port Vila Airport (VLI) to the Hideaway Island ferry point at Mele Beach.",
      seoKeywords: "hideaway island transfer, port vila airport to hideaway island, mele beach taxi",
      geoTargeting: "Port Vila Airport (VLI) to Mele Beach, Vanuatu",
      price: "2500",
      adultPriceCents: 2500,
      childPriceCents: 1500,
      isActive: true,
      listingOrder: 3
    },
    {
      title: "Havannah Harbour Resort Area Transfer",
      description: [
        '<p>Premium long-distance transfer service covering the scenic drive from Port Vila to the exclusive North Efate resort region (The Havannah, Trees and Fishes, Gideon’s Landing).</p>',
        '<p>Enjoy a comfortable, air-conditioned 45-minute drive featuring spectacular coastal views along the way. Bottled water included.</p>'
      ],
      category: "transfer",
      image: "",
      duration: "45 Mins",
      seoTitle: "Havannah Harbour & North Efate Transfers | Port Vila",
      seoDescription: "Pre-book your smooth, comfortable transfer from Port Vila Airport to The Havannah Resort and North Efate luxury accommodations.",
      seoKeywords: "havannah resort transfer, north efate taxi, port vila to havannah harbour transport",
      geoTargeting: "Port Vila to Havannah Harbour, North Efate, Vanuatu",
      price: "4500",
      adultPriceCents: 4500,
      childPriceCents: 2500,
      isActive: true,
      listingOrder: 4
    },
    {
      title: "Toyota Prado SUV (7-Seater)",
      description: [
        '<p>The ultimate family exploration vehicle. Experience Vanuatu’s rugged coastal roads in absolute comfort with the premium, air-conditioned Toyota Prado SUV.</p>',
        '<ul>',
        '<li>Features: Automatic transmission, 4WD capability, Air Conditioning, Bluetooth Audio.</li>',
        '<li>Seating: Comfortable seating for up to 7 passengers (or 5 passengers with extensive luggage).</li>',
        '<li>Perfect for navigating the Round Island road or accessing remote secluded beaches in safety and style.</li>',
        '</ul>'
      ],
      category: "vehicle",
      image: "",
      duration: "Per Day",
      seoTitle: "Toyota Prado SUV Car Hire Port Vila | 7-Seater Rental",
      seoDescription: "Rent a premium 7-seater Toyota Prado SUV in Port Vila, Vanuatu. Perfect for family road trips and safe round-island exploration with 4WD capabilities.",
      seoKeywords: "toyota prado rental vanuatu, 7 seater car hire port vila, suv rental efate",
      geoTargeting: "Port Vila, Efate, Vanuatu",
      price: "16500",
      adultPriceCents: 16500,
      childPriceCents: 0,
      isActive: true,
      listingOrder: 4
      // removing vehicleDetails JSONB object to avoid casting issues in this manual script
    },
    {
      title: "15-Seater Minibus",
      description: [
        '<p>Traveling with a large family group or wedding party? Our 15-seater Minibus offers reliable, spacious group transport so everyone can travel together.</p>',
        '<ul>',
        '<li>Features: Manual/Automatic options dependent on availability, high-capacity dual Air Conditioning, spacious cabin.</li>',
        '<li>Seating: Up to 15 passengers. Large luggage trailer available upon request for airport runs.</li>',
        '<li>Note: Requires an appropriate heavy vehicle endorsement or can be hired with a dedicated local Ace Tours driver.</li>',
        '</ul>'
      ],
      category: "vehicle",
      image: "",
      duration: "Per Day",
      seoTitle: "15-Seater Minibus Rental Port Vila | Group Vehicle Hire",
      seoDescription: "Hire a 15-seater minibus in Port Vila for your large group, family vacation, or wedding party. Spacious and fully air-conditioned.",
      seoKeywords: "minibus rental vanuatu, 15 seater van hire port vila, group transport efate",
      geoTargeting: "Port Vila, Efate, Vanuatu",
      price: "22500",
      adultPriceCents: 22500,
      childPriceCents: 0,
      isActive: true,
      listingOrder: 5
    }
  ];

  console.log(`Inserting ${newProducts.length} new products...`);
  
  for (const p of newProducts) {
      const result = await db.insert(products).values(p).returning({ id: products.id, title: products.title });
      console.log(`Inserted: ${result[0].title}`);
  }

  console.log("Catalog expansion complete!");
  process.exit(0);
}

main().catch(console.error);
