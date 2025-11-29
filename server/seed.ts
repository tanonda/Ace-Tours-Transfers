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

  // Seed content blocks (CMS)
  const contentBlocksData = [
    {
      slug: "hero",
      label: "Hero Section",
      description: "Main hero banner on the home page",
      enabled: true,
      config: { showCta: true, showScrollIndicator: true }
    },
    {
      slug: "featured-tours",
      label: "Featured Tours",
      description: "Tour cards section on home page",
      enabled: true,
      config: { maxItems: 6 }
    },
    {
      slug: "featured-transfers",
      label: "Featured Transfers",
      description: "Transfer cards section on home page",
      enabled: true,
      config: { maxItems: 3 }
    },
    {
      slug: "about-section",
      label: "About Us Section",
      description: "About section on home page",
      enabled: true,
      config: {}
    },
    {
      slug: "testimonials",
      label: "Testimonials",
      description: "Customer testimonials section",
      enabled: true,
      config: { maxItems: 3 }
    },
    {
      slug: "contact-form",
      label: "Contact Form",
      description: "Contact form on contact page",
      enabled: true,
      config: {}
    },
    {
      slug: "promotions-banner",
      label: "Promotions Banner",
      description: "Promotional banner across the site",
      enabled: false,
      config: { message: "", bgColor: "#f2800d" }
    },
    {
      slug: "whatsapp-widget",
      label: "WhatsApp Chat Widget",
      description: "Floating WhatsApp chat button",
      enabled: true,
      config: {}
    }
  ];

  for (const block of contentBlocksData) {
    try {
      await storage.upsertContentBlock(block);
      console.log(`Created content block: ${block.label}`);
    } catch (error) {
      console.error(`Error creating content block ${block.label}:`, error);
    }
  }

  // Seed site settings
  const siteSettingsData = [
    {
      key: "whatsapp",
      value: {
        enabled: true,
        phoneNumber: "+678 5551234",
        greeting: "Hello! How can we help you with your Vanuatu adventure?",
        position: "bottom-right"
      }
    },
    {
      key: "business_info",
      value: {
        name: "Ace Tours & Transfers Vanuatu",
        email: "info@acetours.vu",
        phone: "+678 5551234",
        address: "Port Vila, Vanuatu"
      }
    }
  ];

  for (const setting of siteSettingsData) {
    try {
      await storage.upsertSiteSetting(setting);
      console.log(`Created site setting: ${setting.key}`);
    } catch (error) {
      console.error(`Error creating site setting ${setting.key}:`, error);
    }
  }

  // Seed payment gateways
  const paymentGatewaysData = [
    {
      slug: "anz-egate",
      displayName: "ANZ eGate",
      description: "ANZ Bank Vanuatu online payment gateway",
      active: true,
      isDefault: true,
      credentials: {
        merchantId: "",
        apiKey: "",
        secretKey: "",
        environment: "sandbox"
      },
      supportedCurrencies: ["VUV", "AUD", "USD"],
      config: {
        returnUrl: "/payment/success",
        cancelUrl: "/payment/cancel",
        notifyUrl: "/api/payments/callback"
      }
    },
    {
      slug: "bred",
      displayName: "BRED Bank",
      description: "BRED Bank Vanuatu payment gateway",
      active: false,
      isDefault: false,
      credentials: {
        merchantId: "",
        apiKey: "",
        secretKey: "",
        environment: "sandbox"
      },
      supportedCurrencies: ["VUV", "EUR", "USD"],
      config: {
        returnUrl: "/payment/success",
        cancelUrl: "/payment/cancel",
        notifyUrl: "/api/payments/callback"
      }
    },
    {
      slug: "bsp",
      displayName: "BSP (Bank of South Pacific)",
      description: "Bank of South Pacific online payment gateway",
      active: false,
      isDefault: false,
      credentials: {
        merchantId: "",
        apiKey: "",
        secretKey: "",
        environment: "sandbox"
      },
      supportedCurrencies: ["VUV", "PGK", "FJD", "SBD"],
      config: {
        returnUrl: "/payment/success",
        cancelUrl: "/payment/cancel",
        notifyUrl: "/api/payments/callback"
      }
    }
  ];

  for (const gateway of paymentGatewaysData) {
    try {
      await storage.upsertPaymentGateway(gateway);
      console.log(`Created payment gateway: ${gateway.displayName}`);
    } catch (error) {
      console.error(`Error creating payment gateway ${gateway.displayName}:`, error);
    }
  }

  console.log("Database seeding completed!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
