import "dotenv/config";
import { db, initializeDatabase } from "../server/db.js";
import { articles } from "../shared/schema.js";

const author = "Ace Tours & Transfers Vanuatu";
const publishedAt = new Date("2026-07-21T08:00:00.000Z");
const siteUrl = "https://acetoursvanuatu.com";

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
    coverImage: `${siteUrl}/assets/guides/port-vila-airport-welcome.webp`,
    imageAlt: "Ace Tours airport transfer vehicle in Port Vila, Vanuatu",
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
    coverImage: `${siteUrl}/assets/guides/efate-coastal-road.webp`,
    imageAlt: "Scenic coastline on an Efate Island day tour from Port Vila",
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
    coverImage: `${siteUrl}/assets/guides/blue-lagoon-efate.webp`,
    imageAlt: "Clear turquoise water at Blue Lagoon on Efate, Vanuatu",
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
    coverImage: `${siteUrl}/assets/guides/port-vila-cruise-day.webp`,
    imageAlt: "Private cruise wharf transfer in Port Vila, Vanuatu",
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
  {
    slug: "best-things-to-do-in-vanuatu",
    title: "18 Best Things to Do in Vanuatu: Attractions by Island",
    excerpt:
      "Plan your Vanuatu holiday with a practical island-by-island guide to volcanoes, blue holes, waterfalls, beaches, culture, diving, and the best Efate day trips.",
    seoTitle: "18 Best Things to Do in Vanuatu",
    seoDescription:
      "Discover 18 of the best things to do in Vanuatu, from Efate's Blue Lagoon and Mele Cascades to Mount Yasur, Santo blue holes, Champagne Beach, and cultural sites.",
    seoKeywords:
      "things to do in Vanuatu, Vanuatu tourist attractions, best places to visit Vanuatu, Vanuatu attractions, what to do in Vanuatu",
    tags: ["Vanuatu Attractions", "Things to Do", "Travel Guide"],
    coverImage: `${siteUrl}/assets/guides/vanuatu-coast-field-guide.webp`,
    imageAlt: "Tropical coast and clear blue water among Vanuatu's tourist attractions",
    relatedProductIds: [],
    bodyHtml: `
      <p>Vanuatu is not one single resort island. It is an island nation where each major destination offers a different kind of trip: Efate combines easy day tours with Port Vila restaurants and markets; Tanna is known for volcanic landscapes; and Espiritu Santo is the place for blue holes, beaches, caves, and world-famous diving.</p>
      <p>This guide groups the best things to do in Vanuatu by island so you can decide what fits your time, interests, and travel style. Ace Tours operates on Efate, so our local expertise and bookable services focus there. For outer-island experiences, arrange flights, accommodation, and a qualified local operator before travelling.</p>

      <h2>Top attractions on Efate and around Port Vila</h2>
      <h3>1. Swim at the Blue Lagoon</h3>
      <p>Efate's Blue Lagoon is a vivid natural swimming hole near Eton Village, around a 45-minute drive from central Port Vila. The water, shaded banks, and rope swings make it popular with families and groups. Entry is normally paid in cash, and weekdays can be quieter than weekends. Read our <a href="/blog/blue-lagoon-vanuatu-tour-tips">Blue Lagoon planning tips</a> or explore a <a href="/blue-lagoon-vanuatu-tour">guided Blue Lagoon tour</a>.</p>

      <h3>2. Walk and swim at Mele Cascades</h3>
      <p>Mele Cascades combines a tropical forest walk with freshwater pools and a waterfall. Paths can be wet, so shoes with grip are more useful than smooth sandals. It is close enough to Port Vila for a half-day outing and can be paired with other stops. See our <a href="/mele-cascades-tour">Mele Cascades tour guide</a>.</p>

      <h3>3. Tour Efate's east coast</h3>
      <p>A day on the east side of Efate can combine the Blue Lagoon, Eton Beach, local food stops, viewpoints, and community-run attractions. Because opening conditions and entry arrangements can change, travelling with a local driver removes much of the guesswork. Compare our <a href="/efate-island-day-tours">Efate Island day tours</a>.</p>

      <h3>4. Explore Port Vila Market</h3>
      <p>The central market is one of the best places to see everyday island produce and buy fruit, vegetables, flowers, and prepared food. Bring vatu, ask before photographing vendors, and visit with time to look rather than treating it as a quick photo stop.</p>

      <h3>5. Learn at the Vanuatu Cultural Centre</h3>
      <p>The national museum and cultural centre in Port Vila introduce Vanuatu's archaeology, art, music, and kastom. It provides valuable context before a village experience and helps visitors understand why traditions differ between islands.</p>

      <h3>6. Visit a cultural village</h3>
      <p>A community-led cultural experience can include storytelling, food, dance, traditional skills, and an introduction to kastom. Choose respectful experiences where local hosts control how their culture is shared. Our <a href="/vanuatu-cultural-tours">Vanuatu cultural tours</a> page explains what to expect.</p>

      <h3>7. Snorkel near Hideaway Island</h3>
      <p>Hideaway Island is known for its marine reserve and underwater post office. It is reached from the Mele area by a short boat connection. Confirm the current day-pass, boat, and site arrangements directly before setting out.</p>

      <h3>8. Discover Chief Roi Mata's Domain</h3>
      <p>Chief Roi Mata's Domain is Vanuatu's UNESCO World Heritage cultural landscape. The associated places on Efate, Lelepa, and Eretoka tell the story of a powerful chief and a living oral tradition. Visits to sensitive community and island sites should be organised with an authorised local guide.</p>

      <h3>9. Take a day trip to Pele, Nguna, Lelepa, or Moso</h3>
      <p>Efate's nearby islands offer beaches, snorkelling, village stays, hiking, caves, and marine areas. Transport commonly involves a road transfer followed by a small boat, and some visits require advance guide arrangements. Build weather flexibility into the plan.</p>

      <h2>Highlights on Tanna</h2>
      <h3>10. See Mount Yasur</h3>
      <p>Mount Yasur is Vanuatu's best-known volcano experience. Access is controlled and depends on official volcanic alert levels and local conditions. Use a licensed Tanna operator, follow every safety instruction, and never assume access is guaranteed on a particular day.</p>

      <h3>11. Experience Tanna's landscapes and culture</h3>
      <p>Beyond the volcano, Tanna offers ash plains, hot springs, waterfalls, coastal scenery, and village-based cultural experiences. Allow more than a rushed single day if you want the island to feel like a destination rather than a flight connection.</p>

      <h2>Highlights on Espiritu Santo</h2>
      <h3>12. Swim or paddle at Santo's blue holes</h3>
      <p>Matevulu, Nanda, and other blue holes are known for remarkably clear freshwater. Some are approached by road and others can be reached by river. Entry fees and access arrangements vary, so confirm locally and bring cash.</p>

      <h3>13. Relax at Champagne Beach</h3>
      <p>Champagne Beach is one of Santo's best-known beaches, with pale sand and clear water. Cruise schedules can change how busy it feels, making timing an important part of the visit.</p>

      <h3>14. Dive the SS President Coolidge</h3>
      <p>The SS President Coolidge is a major wreck-diving site near Luganville. It is an advanced environment with different routes for different certification and experience levels. Book with a reputable dive operator and be honest about your training.</p>

      <h3>15. Take on Millennium Cave</h3>
      <p>Millennium Cave is a demanding guided adventure involving jungle walking, rock scrambling, water, and canyon terrain. It is not a casual sightseeing stop. Check fitness requirements, weather, equipment, and current operating conditions with the tour provider.</p>

      <h2>Experiences found across Vanuatu</h2>
      <h3>16. Snorkel and dive responsibly</h3>
      <p>Vanuatu's reefs, marine protected areas, and wrecks reward both beginners and experienced divers. Avoid touching coral or wildlife, use established access points, and follow community rules.</p>

      <h3>17. Taste local food and kava</h3>
      <p>Try seasonal fruit, market food, laplap, tuluk, local seafood, and other island specialities. Kava is culturally important; ask a local host how it is served and approach the experience respectfully.</p>

      <h3>18. Attend an event or festival</h3>
      <p>Festivals can be the most memorable way to experience local music, dance, food, and traditions. Dates are not fixed forever, so use the current Vanuatu Tourism Office events calendar when planning flights.</p>

      <h2>How many days do you need?</h2>
      <p>Three or four days work well for Port Vila and selected Efate highlights. A week allows a relaxed Efate stay or time to add one outer island. Ten days or more gives you room for Efate plus Tanna or Santo without making every day a transit day. Domestic travel can be weather-dependent, so avoid tight same-day international connections.</p>

      <h2>Plan your Efate attractions</h2>
      <p>If Port Vila is your base, start with our guide to the <a href="/blog/things-to-do-in-port-vila-vanuatu">best things to do in Port Vila</a> and our <a href="/blog/efate-vanuatu-3-day-itinerary">three-day Efate itinerary</a>. Browse all <a href="/tours">Vanuatu tours on Efate</a>, or <a href="/contact">ask our local team</a> to help connect the stops into a realistic day.</p>
      <p><em>Planning note: attraction access, fees, roads, flights, and volcanic conditions can change. Confirm time-sensitive details with the Vanuatu Tourism Office and the relevant operator before travel.</em></p>
    `,
  },
  {
    slug: "things-to-do-in-port-vila-vanuatu",
    title: "12 Best Things to Do in Port Vila and Nearby Efate",
    excerpt:
      "A local guide to Port Vila markets, culture, waterfront stops, Blue Lagoon, Mele Cascades, island day trips, and practical ways to get around Efate.",
    seoTitle: "12 Best Things to Do in Port Vila",
    seoDescription:
      "Find the best things to do in Port Vila, Vanuatu: markets, culture, Blue Lagoon, Mele Cascades, snorkelling, island day trips, food, and Efate tour tips.",
    seoKeywords:
      "things to do in Port Vila, Port Vila attractions, what to do Port Vila Vanuatu, places to visit Port Vila, Efate attractions",
    tags: ["Port Vila", "Things to Do", "Efate Island"],
    coverImage: `${siteUrl}/assets/guides/port-vila-culture.webp`,
    imageAlt: "Local cultural experience near Port Vila on Efate Island, Vanuatu",
    relatedProductIds: [],
    bodyHtml: `
      <p>Port Vila is the practical base for most first-time visitors to Efate. The town gives you markets, museums, restaurants, and harbour views, while waterfalls, swimming holes, beaches, cultural experiences, and small islands are within day-trip range.</p>
      <p>The best plan mixes time in town with one or two trips beyond it. Here are twelve worthwhile things to do in Port Vila and nearby Efate, with honest notes on how to organise them.</p>

      <h2>1. Browse Port Vila Market</h2>
      <p>Start with the central produce market for fruit, vegetables, flowers, snacks, and a glimpse of daily life. Carry small notes in vatu and ask before photographing people. Market activity varies by day and time, so treat it as a living local space rather than a staged attraction.</p>

      <h2>2. Visit the Vanuatu Cultural Centre</h2>
      <p>The cultural centre and national museum help explain the country's extraordinary cultural diversity. Exhibits cover archaeology, ceremonial objects, art, music, and kastom. Visiting early in your holiday makes later village and island experiences more meaningful.</p>

      <h2>3. Walk the waterfront and harbour area</h2>
      <p>A relaxed waterfront walk is an easy way to orient yourself, find cafés, and enjoy harbour views. Port Vila changed after the December 2024 earthquake, so use a current local map and follow any signs around relocated businesses or restricted areas.</p>

      <h2>4. Join a respectful cultural experience</h2>
      <p>Community-led cultural visits introduce traditional knowledge, food, dance, storytelling, and kava. Listen to the host's guidance, dress respectfully, and ask permission before photos. Learn more about our approach to <a href="/vanuatu-cultural-tours">cultural tours near Port Vila</a>.</p>

      <h2>5. Swim at the Blue Lagoon</h2>
      <p>The Blue Lagoon sits on Efate's east side, outside Port Vila. Its clear water and rope swings make it a favourite attraction, but it deserves enough time for a proper swim. Bring cash for entry, drinking water, swimwear, a towel, and reef-safe sun protection. Our <a href="/blog/blue-lagoon-vanuatu-tour-tips">Blue Lagoon guide</a> covers timing and what to pack.</p>

      <h2>6. Walk to Mele Cascades</h2>
      <p>Mele Cascades is a convenient nature trip from town. Expect wet ground, pools, and a walk through tropical vegetation. Water shoes or trainers with grip are a better choice than smooth flip-flops. See the <a href="/mele-cascades-tour">Mele Cascades tour page</a> for planning details.</p>

      <h2>7. Snorkel near Hideaway Island</h2>
      <p>The Mele Bay area provides access to Hideaway Island's marine environment and underwater post office. Check the current day-pass and boat arrangements directly, especially when weather or cruise traffic could affect the day.</p>

      <h2>8. Make an east-coast day of it</h2>
      <p>Blue Lagoon, Eton-area coastline, village stops, and local food experiences can fit naturally into an east-coast route. A private or small-group <a href="/efate-island-day-tours">Efate day tour</a> is useful because attractions are spread out and public buses are not designed as a hop-on sightseeing network.</p>

      <h2>9. Take a boat trip to a nearby island</h2>
      <p>Pele, Nguna, Lelepa, Moso, and Eretoka offer very different experiences, including beaches, snorkelling, hiking, history, and village stays. Some require a community guide and advance boat coordination. Do not assume you can arrive unannounced and access cultural or customary land.</p>

      <h2>10. Try Vanuatu food</h2>
      <p>Look beyond resort menus for laplap, tuluk, seasonal island produce, seafood, and Vanuatu-grown beef. Ask your guide or accommodation team what is available that week. Port Vila also has a broad mix of Pacific, French, Asian, and international dining.</p>

      <h2>11. Experience kava appropriately</h2>
      <p>Kava is much more than a novelty drink. If you visit a nakamal or taste kava during a hosted experience, ask about local etiquette and follow the lead of your hosts. Effects and preparation differ, and it should not be mixed casually with alcohol or driving.</p>

      <h2>12. Book a scenic island circuit</h2>
      <p>An Efate circuit connects coast, countryside, swimming stops, villages, and viewpoints into one day. The right route depends on your group's pace and the stops that are operating. It is especially useful for first-time visitors who want an overview before choosing where to return.</p>

      <h2>Port Vila ideas by traveller type</h2>
      <h3>For families</h3>
      <p>Choose one main swimming attraction, allow snack and rest breaks, and avoid filling every hour. Blue Lagoon and a short cultural stop can work better than an ambitious circuit for young children.</p>
      <h3>For couples</h3>
      <p>Mix one active day with unstructured waterfront, dining, or beach time. A private tour lets you spend longer at the places you enjoy instead of following a fixed group timetable.</p>
      <h3>For cruise passengers</h3>
      <p>Confirm the exact pickup point, use ship time, and keep a generous return buffer. Choose two or three priority stops rather than trying to cross off the whole island. Read our <a href="/blog/port-vila-cruise-transfer-and-shore-tour-guide">Port Vila shore-day guide</a>.</p>

      <h2>Getting around Port Vila and Efate</h2>
      <p>Local buses are useful for simple trips in and around town, while taxis and pre-booked transfers suit luggage, timed pickups, and places farther around Efate. Agree on the destination and fare before leaving. For a day with several attractions, a driver or organised tour prevents repeated transport negotiations and makes return timing clearer.</p>

      <h2>Build your Port Vila plan</h2>
      <p>Browse our <a href="/tours">Efate tours</a>, arrange <a href="/port-vila-private-transfers">private transport around Port Vila</a>, or follow our <a href="/blog/efate-vanuatu-3-day-itinerary">three-day Efate itinerary</a>. For island-wide inspiration, see the <a href="/blog/best-things-to-do-in-vanuatu">best things to do across Vanuatu</a>.</p>
    `,
  },
  {
    slug: "efate-vanuatu-3-day-itinerary",
    title: "Efate, Vanuatu: A Relaxed 3-Day Itinerary from Port Vila",
    excerpt:
      "A practical three-day Efate itinerary balancing Port Vila culture, Blue Lagoon swimming, waterfalls, island scenery, local food, and flexible transport.",
    seoTitle: "Efate Vanuatu 3-Day Itinerary",
    seoDescription:
      "Plan three days on Efate, Vanuatu, with this Port Vila itinerary covering markets, culture, Blue Lagoon, Mele Cascades, beaches, food, and day tours.",
    seoKeywords:
      "Efate itinerary, Vanuatu 3 day itinerary, Port Vila itinerary, 3 days in Vanuatu, Efate things to do",
    tags: ["Efate Itinerary", "Port Vila", "Travel Planning"],
    coverImage: `${siteUrl}/assets/guides/efate-itinerary-planning.webp`,
    imageAlt: "Blue Lagoon swimming stop on a three-day Efate itinerary",
    relatedProductIds: [],
    bodyHtml: `
      <p>Three days on Efate is enough to experience Port Vila, swim at a signature natural attraction, learn something about Ni-Vanuatu culture, and see more of the island beyond your resort. The secret is to group nearby stops and leave room for weather, island time, and the places you unexpectedly want to enjoy longer.</p>
      <p>This itinerary assumes you are staying in or near Port Vila. It is deliberately flexible: confirm current opening and access arrangements, then swap days to match the forecast and your energy.</p>

      <h2>Before day one: make arrival easy</h2>
      <p>Share your flight number and accommodation details when arranging transport from Bauerfield International Airport. A pre-booked <a href="/port-vila-airport-transfers">Port Vila airport transfer</a> is particularly useful for late arrivals, families, groups, and resorts outside central Vila. Keep your first evening simple: settle in, get vatu, and confirm the next day's pickup.</p>

      <h2>Day 1: Port Vila, food, and cultural context</h2>
      <h3>Morning: market and town orientation</h3>
      <p>Start at Port Vila Market when it is active and the day is cooler. Browse seasonal produce, buy fruit or a snack, and take time to engage politely. Continue through the accessible waterfront and central areas using an up-to-date local map, as business locations and access can change.</p>

      <h3>Late morning: Vanuatu Cultural Centre</h3>
      <p>Visit the national museum and cultural centre to understand Vanuatu's archaeology, music, art, and kastom. This context helps prevent the common mistake of treating the country's many island cultures as one generic tradition.</p>

      <h3>Afternoon: choose your pace</h3>
      <p>Families may prefer resort or pool time. Curious travellers can add a community-led cultural experience. Food-focused visitors can explore cafés, local products, and a relaxed lunch rather than rushing into another long drive.</p>

      <h3>Evening: dinner and kava</h3>
      <p>Try a restaurant featuring island produce or ask where local dishes are available. If you want to experience kava, go with someone who can explain the etiquette, do not drive afterwards, and avoid treating it as a drinking challenge.</p>

      <h2>Day 2: Blue Lagoon and east Efate</h2>
      <h3>Morning: travel east</h3>
      <p>Leave after breakfast for the Blue Lagoon near Eton Village. The drive from Port Vila is part of the experience, moving from urban Efate into village and coastal landscapes. Bring vatu for locally managed entry points and small purchases.</p>

      <h3>Mid-morning: swim at Blue Lagoon</h3>
      <p>Give the lagoon real time rather than squeezing it into a photo stop. Weekdays may be quieter; weekends can have a lively local atmosphere. Supervise children near deep water and rope swings. Pack water, a towel, swimwear, and sun protection. See our complete <a href="/blog/blue-lagoon-vanuatu-tour-tips">Blue Lagoon tips</a>.</p>

      <h3>Lunch and afternoon: east-coast choices</h3>
      <p>Depending on current access, weather, and your tour, continue to a beach, cultural stop, viewpoint, or locally run attraction. Avoid promising yourself too many named stops—the east coast is better when lunch and swimming are not rushed.</p>

      <h3>Why organised transport helps</h3>
      <p>The attractions are spread along the island road, and transport is not a formal hop-on tourist service. A guided <a href="/blue-lagoon-vanuatu-tour">Blue Lagoon tour</a> or broader <a href="/efate-island-day-tours">Efate day tour</a> provides a planned route, hotel pickup, and a clear return.</p>

      <h2>Day 3: waterfall, marine trip, or island circuit</h2>
      <p>Use your final full day for the experience that best fits your group. These three options should not all be forced into one day.</p>

      <h3>Option A: Mele Cascades and Mele Bay</h3>
      <p>Choose this for a shorter active day near Port Vila. Walk and swim at Mele Cascades, wearing footwear suitable for wet paths. Depending on current operations, continue toward Mele Bay or a marine experience. Review our <a href="/mele-cascades-tour">Mele Cascades planning page</a>.</p>

      <h3>Option B: a nearby island</h3>
      <p>Pele, Nguna, Lelepa, Moso, and Eretoka each require different road, boat, guide, and community arrangements. Book ahead with an appropriate operator. Weather can affect small-boat travel, so keep the day flexible and do not schedule it immediately before a tight flight connection.</p>

      <h3>Option C: scenic Efate circuit</h3>
      <p>A round-island or custom circuit suits travellers who want a broad view of the coast, villages, countryside, and local stops. It is a longer vehicle day, so discuss swim time and breaks before departure.</p>

      <h2>If you have a fourth day</h2>
      <p>Add whichever day-three option you skipped, take a slow resort day, or return to your favourite place. If you plan to continue to Tanna or Espiritu Santo, use the extra day as a travel buffer rather than building a connection that fails if domestic transport changes.</p>

      <h2>What to pack for three days on Efate</h2>
      <ul>
        <li>Vatu in small denominations for markets, entry fees, and community stops</li>
        <li>Refillable water bottle and reef-conscious sun protection</li>
        <li>Swimwear, towel, and a dry bag or waterproof pouch</li>
        <li>Walking shoes with grip for waterfalls and wet paths</li>
        <li>Light rain layer and a change of clothes</li>
        <li>Offline copies of bookings, flight information, and accommodation contacts</li>
      </ul>

      <h2>Book the practical pieces</h2>
      <p>Start with our <a href="/tours">Efate tours</a> and <a href="/transfers">Port Vila transfer services</a>. If your group wants to change the pace or combine specific stops, <a href="/contact">contact Ace Tours</a> with your dates, accommodation, ages, and priorities.</p>
    `,
  },
  {
    slug: "vanuatu-attractions-which-island-to-visit",
    title: "Efate, Tanna or Santo? Choosing the Best Vanuatu Island for Your Trip",
    excerpt:
      "Compare Efate, Tanna, and Espiritu Santo by attractions, trip style, transport, and ideal stay length before building your Vanuatu itinerary.",
    seoTitle: "Efate vs Tanna vs Santo: Vanuatu Guide",
    seoDescription:
      "Compare Efate, Tanna, and Espiritu Santo for your Vanuatu holiday: Port Vila attractions, Mount Yasur, blue holes, beaches, diving, and suggested trip lengths.",
    seoKeywords:
      "best island in Vanuatu, Efate vs Tanna vs Santo, where to go in Vanuatu, Vanuatu islands to visit, Vanuatu attractions by island",
    tags: ["Vanuatu Islands", "Trip Planning", "Travel Guide"],
    coverImage: `${siteUrl}/assets/guides/vanuatu-island-comparison.webp`,
    imageAlt: "Tropical island and reef near Efate, Vanuatu",
    relatedProductIds: [],
    bodyHtml: `
      <p>Choosing where to stay is the most important Vanuatu itinerary decision. Efate, Tanna, and Espiritu Santo are not interchangeable: each has signature attractions, different transport needs, and a distinct pace.</p>
      <p>For many first visits, Efate is the easiest base because international arrivals, Port Vila accommodation, restaurants, transfers, and a wide range of day trips come together in one place. Tanna is the volcanic choice. Santo is strongest for beaches, freshwater blue holes, caves, and diving.</p>

      <h2>Quick comparison</h2>
      <h3>Choose Efate for variety and convenience</h3>
      <p>Best for first-time visitors, families, short stays, cruise passengers, groups, and travellers who want culture, swimming, waterfalls, markets, and food without taking another domestic flight.</p>
      <h3>Choose Tanna for volcano and kastom experiences</h3>
      <p>Best for travellers whose priority is Mount Yasur and who are comfortable building a trip around local conditions, guided transport, and a more focused island stay.</p>
      <h3>Choose Espiritu Santo for water and adventure</h3>
      <p>Best for beaches, blue holes, snorkelling, wreck diving, and demanding guided adventures such as Millennium Cave.</p>

      <h2>Efate: Port Vila plus accessible day trips</h2>
      <p>Efate is home to the capital, Port Vila, and Bauerfield International Airport. It offers the broadest mix for travellers with limited time: the Blue Lagoon, Mele Cascades, Port Vila Market, the Vanuatu Cultural Centre, cultural villages, Eton-area coastline, snorkelling, and access to small neighbouring islands.</p>
      <p>Port Vila also makes logistics easier. There are more choices for accommodation and dining, and road transfers can connect most Efate highlights without repacking or flying. This makes it especially practical for families and mixed-interest groups.</p>
      <h3>How long to stay on Efate</h3>
      <p>Allow at least three full days: one for Port Vila and culture, one for east Efate and the Blue Lagoon, and one for Mele, a nearby island, or a scenic circuit. Five to seven days gives you genuine rest time. Use our <a href="/blog/efate-vanuatu-3-day-itinerary">three-day Efate itinerary</a> as a starting point.</p>

      <h2>Tanna: a trip built around volcanic landscapes</h2>
      <p>Mount Yasur is the main reason many visitors choose Tanna. The experience is powerful, but volcano access is never something to assume. Official alert levels, ash, weather, roads, and operator decisions can change plans. Always travel with a qualified local operator and follow safety instructions.</p>
      <p>Tanna also rewards travellers who stay longer for village-based cultural experiences, waterfalls, hot-spring areas, ash plains, and a slower view of the island. A rushed out-and-back visit leaves little resilience when transport or conditions shift.</p>
      <h3>How long to stay on Tanna</h3>
      <p>Two or three nights is a more realistic minimum than trying to force the volcano into a tight same-day connection. Add buffer time before your international departure.</p>

      <h2>Espiritu Santo: blue holes, beaches, diving, and caves</h2>
      <p>Santo is the largest island in Vanuatu and a strong destination in its own right. Visitors come for clear freshwater blue holes, Champagne Beach and other north-coast scenery, snorkelling, the SS President Coolidge wreck, and Millennium Cave.</p>
      <p>The experiences range from gentle swimming to serious adventure. Wreck routes depend on diving qualifications. Millennium Cave requires fitness and a guided operator. Distances also mean it is worth planning transport rather than assuming everything is close to Luganville.</p>
      <h3>How long to stay on Santo</h3>
      <p>Four to six days gives you time for blue holes and beaches plus a diving or adventure day. Divers may want longer.</p>

      <h2>Can you visit all three islands?</h2>
      <p>Yes, but the trip length matters. With seven days, choose Efate plus either Tanna or Santo. With ten to fourteen days, all three can work if domestic schedules align and you keep buffer time. Every island change consumes more than the flight duration once transfers, check-in, and possible disruption are included.</p>

      <h2>What about Vanuatu's other islands?</h2>
      <p>Vanuatu extends far beyond these three visitor hubs. Pentecost is associated with seasonal land-diving traditions; Ambrym with volcanic terrain and distinctive cultural traditions; Malekula with diverse communities and trekking; and the Banks and Torres islands with remote marine and cultural experiences. These trips require more research, time, and local coordination. Festival dates and transport should always be verified for the specific year.</p>

      <h2>A responsible way to plan</h2>
      <ul>
        <li>Use current official tourism and volcanic information rather than relying on an old itinerary.</li>
        <li>Book community and cultural visits through appropriate local hosts.</li>
        <li>Ask before photographing people, ceremonies, or village spaces.</li>
        <li>Carry cash outside main towns and respect locally managed entry fees.</li>
        <li>Leave buffer days around domestic travel and weather-dependent boats.</li>
      </ul>

      <h2>Start on Efate</h2>
      <p>If you are arriving in Port Vila, see our full guide to the <a href="/blog/things-to-do-in-port-vila-vanuatu">best things to do in Port Vila</a> and the broader list of <a href="/blog/best-things-to-do-in-vanuatu">Vanuatu's top attractions</a>. Ace Tours can organise <a href="/port-vila-airport-transfers">airport transfers</a>, <a href="/efate-island-day-tours">Efate day tours</a>, and private transport for the Efate portion of your holiday.</p>
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
