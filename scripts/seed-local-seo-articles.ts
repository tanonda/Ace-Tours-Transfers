import "dotenv/config";
import { db, initializeDatabase } from "../server/db.js";
import { articles } from "../shared/schema.js";

const author = "Ace Tours & Transfers Vanuatu";
const publishedAt = new Date("2026-06-30T08:00:00.000Z");

const guides = [
  {
    slug: "port-vila-airport-transfer-guide",
    title: "Port Vila Airport Transfers: What to Know Before You Land",
    excerpt:
      "A practical arrival guide for Bauerfield Airport, hotel transfers, luggage, timing, and private transport around Port Vila.",
    seoTitle: "Port Vila Airport Transfer Guide",
    seoDescription:
      "Plan your Bauerfield Airport arrival with this Port Vila airport transfer guide: pickup timing, private transfers, luggage tips, resort routes, and booking advice.",
    seoKeywords:
      "Port Vila airport transfers, Bauerfield Airport transfer, Vanuatu airport shuttle, airport taxi Port Vila",
    tags: ["Airport Transfers", "Port Vila", "Travel Tips"],
    relatedProductIds: [],
    bodyHtml: `
      <p>Arriving in Vanuatu should feel easy from the moment you step out of Bauerfield International Airport. A pre-booked Port Vila airport transfer gives you a named driver, fixed pricing, and a direct ride to your hotel, resort, wharf, or private accommodation.</p>
      <h2>Why book before you fly?</h2>
      <p>Flights can arrive late, families often travel with bulky luggage, and first-time visitors may not know how far their resort is from town. Booking ahead removes that guesswork. Your driver can track the arrival time, help with bags, and take you straight to your destination without negotiation at the curb.</p>
      <h2>Common transfer areas</h2>
      <p>Most guests travel from Bauerfield Airport to Port Vila hotels, Mele, Hideaway Island connections, Havannah Harbour, Eratap, or cruise and wharf pickup points. Travel time varies by destination, so share your flight number and accommodation name when booking.</p>
      <h2>Private transfers vs shared transport</h2>
      <p>A private transfer is best when you want a direct route, a vehicle sized to your group, and a driver waiting specifically for you. Shared transport can work for flexible travellers, but it may involve waiting for other passengers or additional stops.</p>
      <p>For a direct quote, see our <a href="/port-vila-airport-transfers">Port Vila airport transfers</a> page or browse all <a href="/transfers">Vanuatu transfer services</a>.</p>
    `,
  },
  {
    slug: "efate-island-day-tours-from-port-vila",
    title: "Best Efate Island Day Tours from Port Vila",
    excerpt:
      "A local guide to planning an Efate day tour with lagoons, waterfalls, cultural stops, viewpoints, and flexible private transport.",
    seoTitle: "Efate Island Day Tours from Port Vila",
    seoDescription:
      "Discover the best Efate Island day tours from Port Vila, including Blue Lagoon, Mele Cascades, cultural villages, markets, and private sightseeing routes.",
    seoKeywords:
      "Efate Island day tours, Port Vila tours, things to do Port Vila, Vanuatu day trips",
    tags: ["Efate Island", "Day Tours", "Port Vila"],
    relatedProductIds: [],
    bodyHtml: `
      <p>Efate is compact enough for a rewarding day tour, but varied enough that planning matters. From Port Vila you can swim in clear lagoons, visit waterfalls, explore local markets, and learn about Ni-Vanuatu culture in one well-paced day.</p>
      <h2>What to include on a first visit</h2>
      <p>First-time visitors often choose a combination of the Blue Lagoon, Mele Cascades, a cultural village experience, island viewpoints, and Port Vila market stops. Families usually prefer a slower route with swimming time. Cruise visitors often need a tighter itinerary that returns to the wharf with plenty of buffer.</p>
      <h2>Private or small-group?</h2>
      <p>Small groups are efficient and sociable. Private tours suit families, couples, and guests who want to choose the pace, photo stops, swim time, and pickup location. Private transport is also helpful when combining attractions on opposite sides of the island.</p>
      <h2>What to bring</h2>
      <p>Pack reef-safe sunscreen, swimwear, a towel, water, comfortable shoes, and cash for small local purchases. If visiting waterfalls, wear footwear with grip because some paths can be wet.</p>
      <p>Start with our <a href="/efate-island-day-tours">Efate Island day tours</a> guide, or compare all available <a href="/tours">Vanuatu tours</a>.</p>
    `,
  },
  {
    slug: "blue-lagoon-vanuatu-tour-tips",
    title: "Blue Lagoon Vanuatu Tour Tips: Timing, Swimming and What to Bring",
    excerpt:
      "How to plan a relaxed Blue Lagoon visit from Port Vila, including swim tips, family advice, and ways to combine nearby stops.",
    seoTitle: "Blue Lagoon Vanuatu Tour Tips",
    seoDescription:
      "Plan your Blue Lagoon Vanuatu tour from Port Vila with tips on timing, swimming, families, what to bring, and nearby Efate stops.",
    seoKeywords:
      "Blue Lagoon Vanuatu, Blue Lagoon Port Vila tour, Vanuatu swimming tour, Efate lagoon",
    tags: ["Blue Lagoon", "Swimming", "Efate Island"],
    relatedProductIds: [],
    bodyHtml: `
      <p>The Blue Lagoon is one of Efate's most memorable swimming spots: bright clear water, shaded edges, and plenty of room to relax. It is an easy day-trip highlight from Port Vila and works well for families, couples, and cruise visitors.</p>
      <h2>Best time to visit</h2>
      <p>Mornings are often calmer and cooler, while afternoons can work well if you are pairing the lagoon with a cultural or sightseeing stop. Your ideal timing depends on the day’s cruise schedule, weather, and whether you want a slower swim-focused visit.</p>
      <h2>Is it family-friendly?</h2>
      <p>Yes. There are calm areas for relaxed swimming, plus deeper spots for confident swimmers. Children should still be supervised closely, especially around rope swings or deeper sections.</p>
      <h2>Combine it with nearby stops</h2>
      <p>The Blue Lagoon pairs well with Turtle Bay, cultural stops, viewpoints, or a wider Efate island route. A private tour helps you adjust swim time and avoid rushing through the day.</p>
      <p>See our dedicated <a href="/blue-lagoon-vanuatu-tour">Blue Lagoon Vanuatu tour</a> page, or browse more <a href="/efate-island-day-tours">Efate day tour ideas</a>.</p>
    `,
  },
  {
    slug: "port-vila-cruise-transfer-and-shore-tour-guide",
    title: "Port Vila Cruise Transfers and Shore Tour Guide",
    excerpt:
      "A cruise passenger guide to wharf pickups, Port Vila transfers, short tours, shopping stops, and getting back to the ship on time.",
    seoTitle: "Port Vila Cruise Transfers and Shore Tours",
    seoDescription:
      "Plan a Port Vila cruise stop with wharf transfer tips, private shore tours, shopping stops, timing buffers, and reliable transport back to the ship.",
    seoKeywords:
      "Port Vila cruise transfer, Vanuatu shore tours, Port Vila wharf transfer, cruise ship transfer Vanuatu",
    tags: ["Cruise Transfers", "Port Vila", "Shore Tours"],
    relatedProductIds: [],
    bodyHtml: `
      <p>Port Vila is a popular cruise stop, and a little planning helps you make the most of limited time ashore. The key is simple: arrange a clear pickup point, choose a realistic route, and leave a comfortable buffer for returning to the wharf.</p>
      <h2>Wharf pickup basics</h2>
      <p>Confirm your ship name, arrival date, preferred pickup time, group size, and whether you want a simple town transfer or a guided shore tour. Cruise days can be busy, so a named pickup and fixed plan are worth arranging in advance.</p>
      <h2>Good short-tour options</h2>
      <p>Depending on ship timing, guests often choose Port Vila markets, local viewpoints, duty-free shopping, nearby beaches, cultural experiences, or a condensed Efate highlights route. Longer waterfall or lagoon visits are possible when the ship schedule allows.</p>
      <h2>Return buffer matters</h2>
      <p>Always plan to return before the final boarding rush. A private transfer lets your group move at its own pace while still keeping ship timing front and centre.</p>
      <p>Explore our <a href="/port-vila-private-transfers">Port Vila private transfers</a> or view all <a href="/transfers">transfer services</a>.</p>
    `,
  },
];

async function main() {
  await initializeDatabase();
  for (const guide of guides) {
    await db
      .insert(articles)
      .values({
        ...guide,
        author,
        status: "published",
        publishedAt,
      })
      .onConflictDoUpdate({
        target: articles.slug,
        set: {
          ...guide,
          author,
          status: "published",
          publishedAt,
          updatedAt: new Date(),
        },
      });
    console.log(`Seeded article: ${guide.slug}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed local SEO articles:", error);
    process.exit(1);
  });
