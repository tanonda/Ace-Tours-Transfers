import { storage } from "./storage.js";
import { Product } from "../shared/schema.js";

async function seedBookings() {
  console.log("Seeding sample bookings...");

  // Get the user and tours first
  const userJames = await storage.getUserByEmail("james@example.com");
  const toursList = await storage.getProducts();

  if (!userJames) {
    console.error("User james@example.com not found");
    return;
  }

  const scenicTour = toursList.find((t: Product) => t.title.includes("Scenic"));
  const airportTransfer = toursList.find((t: Product) => t.title.includes("Airport"));
  const rootsTour = toursList.find((t: Product) => t.title.includes("Roots"));

  if (!scenicTour || !airportTransfer || !rootsTour) {
    console.error("Required tours not found");
    return;
  }

  const bookings = [
    {
      userId: userJames.id,
      tourId: scenicTour.id,
      date: "2024-12-15",
      guests: 2,
      amount: "$240",
      status: "confirmed",
      customerName: userJames.name,
      tourName: scenicTour.title,
    },
    {
      userId: userJames.id,
      tourId: airportTransfer.id,
      date: "2024-12-10",
      guests: 3,
      amount: "$45",
      status: "completed",
      customerName: userJames.name,
      tourName: airportTransfer.title,
    },
    {
      userId: userJames.id,
      tourId: rootsTour.id,
      date: "2024-12-20",
      guests: 1,
      amount: "$100",
      status: "pending",
      customerName: userJames.name,
      tourName: rootsTour.title,
    },
  ];

  for (const booking of bookings) {
    try {
      await storage.createBooking(booking);
      console.log(`Created booking for ${booking.tourName}`);
    } catch (error) {
      console.error(`Error creating booking:`, error);
    }
  }

  console.log("Booking seeding completed!");
  process.exit(0);
}

seedBookings().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
