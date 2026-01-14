import "dotenv/config";
import { db } from "./db.js";
import { users as usersTable, tours as toursTable } from "../shared/schema.js";
import { storage } from "./storage.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding database...");

  // 1. Seed Admin User
  const adminEmail = "admin@acetours.vu";
  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail)).limit(1);
  
  if (existingAdmin.length === 0) {
    const hashedPassword = await bcrypt.hash("adminpassword", 12);
    await db.insert(usersTable).values({
      username: adminEmail,
      email: adminEmail,
      name: "Admin User",
      password: hashedPassword,
      role: "admin",
    });
    console.log("Admin user created.");
  } else {
    console.log("Admin user already exists.");
  }

  // 2. Seed Tours, Transfers, and Vehicles
  const demoServices = [
    // Tours
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
      category: "tour",
      defaultCapacity: 20
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
      category: "tour",
      defaultCapacity: 15
    },
    {
      title: "Blue Lagoon & Turtle Bay Combo",
      price: "$95 / adult",
      childPrice: "$50 / child",
      duration: "Half Day",
      minPax: "Min 4 pax",
      image: "/attached_assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg",
      description: [
        "Swim in crystal clear blue waters",
        "Visit Turtle sanctuary",
        "Great for families",
        "Snack included"
      ],
      category: "tour",
      defaultCapacity: 12
    },
    {
      title: "Pele Island Beach Day",
      price: "$110 / person",
      childPrice: "$55 / child",
      duration: "Full Day",
      minPax: "Min 6 pax",
      image: "/attached_assets/stock_images/vanuatu_cultural_v_49e2db39.jpg",
      description: [
        "Boat transfer to Pele Island",
        "Snorkeling on pristine reefs",
        "BBQ Lunch included",
        "Relax on white sandy beaches"
      ],
      category: "tour",
      defaultCapacity: 10
    },

    // Transfers
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
      category: "transfer",
      defaultCapacity: 50
    },
    {
      title: "Wharf / Cruise Ship Transfer",
      price: "$10 / person",
      childPrice: null,
      duration: "20 minutes",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg",
      description: [
        "Pickup from Main Wharf",
        "Transfer to Port Vila Town",
        "Air-conditioned buses"
      ],
      category: "transfer",
      defaultCapacity: 100
    },
    {
      title: "Dinner Transfer (Round Trip)",
      price: "$20 / person",
      childPrice: null,
      duration: "Variable",
      minPax: "2 pax",
      image: "/attached_assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg",
      description: [
        "Safe transport to local restaurants",
        "Driver waits or returns for pickup",
        "Enjoy your evening worry-free"
      ],
      category: "transfer",
      defaultCapacity: 20
    },
    {
      title: "VIP Executive Transfer",
      price: "$50 / trip",
      childPrice: null,
      duration: "30 minutes",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
      description: [
        "Private luxury vehicle",
        "Meet and greet service",
        "Cold towels and water provided"
      ],
      category: "transfer",
      defaultCapacity: 3
    },

    // Vehicles
    {
      title: "Toyota Hilux 4WD",
      price: "$120 / day",
      childPrice: null,
      duration: "24 hours",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
      description: [
        "Reliable 4WD pickup truck",
        "Perfect for island exploration",
        "Full insurance included"
      ],
      category: "vehicle",
      defaultCapacity: 1,
      vehicleDetails: {
        make: "Toyota",
        model: "Hilux",
        seats: 5,
        transmission: "Automatic",
        features: ["4WD", "Air Conditioning", "Bluetooth"]
      }
    },
    {
      title: "Hyundai Grand i10",
      price: "$70 / day",
      childPrice: null,
      duration: "24 hours",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
      description: [
        "Compact and fuel efficient",
        "Easy to park in town",
        "Great for couples"
      ],
      category: "vehicle",
      defaultCapacity: 1,
      vehicleDetails: {
        make: "Hyundai",
        model: "Grand i10",
        seats: 4,
        transmission: "Automatic",
        features: ["Air Conditioning", "Bluetooth", "Compact"]
      }
    },
    {
      title: "Suzuki Jimny",
      price: "$100 / day",
      childPrice: null,
      duration: "24 hours",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
      description: [
        "Fun compact 4WD",
        "Iconic island style",
        "Go anywhere vehicle"
      ],
      category: "vehicle",
      defaultCapacity: 1,
      vehicleDetails: {
        make: "Suzuki",
        model: "Jimny",
        seats: 4,
        transmission: "Manual",
        features: ["4WD", "Convertible Top", "Rugged"]
      }
    },
    {
      title: "Toyota Hiace Bus",
      price: "$150 / day",
      childPrice: null,
      duration: "24 hours",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
      description: [
        "12-seater mini bus",
        "Perfect for large groups",
        "Spacious and comfortable"
      ],
      category: "vehicle",
      defaultCapacity: 1,
      vehicleDetails: {
        make: "Toyota",
        model: "Hiace",
        seats: 12,
        transmission: "Automatic",
        features: ["Air Conditioning", "High Roof", "Group Travel"]
      }
    },
    {
      title: "Kia Cerato Sedan",
      price: "$90 / day",
      childPrice: null,
      duration: "24 hours",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
      description: [
        "Comfortable family sedan",
        "Smooth ride for round island trips",
        "Large boot space"
      ],
      category: "vehicle",
      defaultCapacity: 1,
      vehicleDetails: {
        make: "Kia",
        model: "Cerato",
        seats: 5,
        transmission: "Automatic",
        features: ["Cruise Control", "Apple CarPlay", "Spacious"]
      }
    },
    {
      title: "Ford Ranger Wildtrak",
      price: "$140 / day",
      childPrice: null,
      duration: "24 hours",
      minPax: null,
      image: "/attached_assets/stock_images/vanuatu_4wd_vehicle.jpg",
      description: [
        "Premium 4WD experience",
        "Leather interior",
        "Top of the line features"
      ],
      category: "vehicle",
      defaultCapacity: 1,
      vehicleDetails: {
        make: "Ford",
        model: "Ranger",
        seats: 5,
        transmission: "Automatic",
        features: ["GPS Navigation", "Leather Seats", "Tow Bar"]
      }
    }
  ];

  for (const service of demoServices) {
    const existing = await db.select().from(toursTable).where(eq(toursTable.title, service.title)).limit(1);
    if (existing.length === 0) {
      await storage.createTour(service as any);
      console.log(`Created service: ${service.title}`);
    } else {
      console.log(`Service already exists: ${service.title}`);
    }
  }

  console.log("Database seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});