import { storage } from "./storage";

async function seed() {
  console.log("Seeding database...");

  // Seed tours
  const tours = [
    {
      title: "Efate Scenic Tour",
      price: "$120 / adult",
      childPrice: "$60 / child (<12)",
      duration: "8am to 3pm",
      minPax: "Min 10-14 pax",
      image: "/attached_assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg",
      description: [
        "Round island trip (8am to 3pm)",
        "Local chocolate factory visit",
        "Raru Waterfall for a cool dip",
        "Blue Lagoon for rope swinging",
        "Lunch at Banana Bay Beach Club",
        "Duty Free Shopping",
        "Includes entrance fees & refreshments"
      ],
      category: "tour"
    },
    {
      title: "Roots & Routes Tour",
      price: "$100 / person",
      childPrice: null,
      duration: "4-5 Hours",
      minPax: "10-14 pax",
      image: "/attached_assets/stock_images/vanuatu_cultural_v_49e2db39.jpg",
      description: [
        "A taste for custom & tradition",
        "Cultural Village Tour & Experience",
        "Kava Tasting & Endemic Plant Tour (El Manaro Nakamal)",
        "Cultural Centre Visit",
        "Light refreshments provided",
        "Price includes entrance fees"
      ],
      category: "tour"
    },
    {
      title: "Bus Hire for the Day",
      price: "A$400 / day",
      childPrice: null,
      duration: "5-8 Hours",
      minPax: null,
      image: "/attached_assets/stock_images/comfortable_tour_bus_ac9e66db.jpg",
      description: [
        "Hire the bus for the day",
        "Choose your own stops",
        "Light refreshments provided",
        "You take care of your entrance fees",
        "Ideal for large groups"
      ],
      category: "tour"
    },
    {
      title: "Airport Transfer",
      price: "$15 / person one-way",
      childPrice: null,
      duration: "30 minutes",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg",
      description: [
        "Reliable airport pickup and drop-off",
        "Professional drivers",
        "Air-conditioned vehicles",
        "Door-to-door service"
      ],
      category: "transfer"
    },
    {
      title: "Event Transfer",
      price: "$50 / hour",
      childPrice: null,
      duration: "Flexible",
      minPax: null,
      image: "/attached_assets/stock_images/comfortable_tour_bus_ac9e66db.jpg",
      description: [
        "Private transport for special events",
        "Wedding and corporate events",
        "Flexible scheduling",
        "Professional service"
      ],
      category: "transfer"
    }
  ];

  for (const tour of tours) {
    try {
      await storage.createTour(tour);
      console.log(`Created tour: ${tour.title}`);
    } catch (error) {
      console.error(`Error creating tour ${tour.title}:`, error);
    }
  }

  // Create demo users
  const users = [
    {
      username: "admin",
      password: "admin123",
      email: "admin@acetours.vu",
      role: "admin",
      name: "Admin User",
      phone: "+678 123 4567"
    },
    {
      username: "james",
      password: "user123",
      email: "james@example.com",
      role: "customer",
      name: "James Doe",
      phone: "+678 987 6543"
    }
  ];

  for (const user of users) {
    try {
      const existing = await storage.getUserByEmail(user.email);
      if (!existing) {
        await storage.createUser(user);
        console.log(`Created user: ${user.name}`);
      }
    } catch (error) {
      console.error(`Error creating user ${user.name}:`, error);
    }
  }

  console.log("Database seeding completed!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
