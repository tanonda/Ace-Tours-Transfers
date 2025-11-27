
import scenicImg from "@assets/stock_images/vanuatu_blue_lagoon__7251a31e.jpg";
import culturalImg from "@assets/stock_images/vanuatu_cultural_vil_dc131252.jpg";
import busImg from "@assets/stock_images/modern_tourist_shutt_9102d81d.jpg";
import airportImg from "@assets/stock_images/modern_tourist_shutt_9102d81d.jpg"; // Reuse bus for airport for now

export const tours = [
  {
    id: "scenic",
    title: "Efate Scenic Tour",
    price: "$120 / adult",
    childPrice: "$60 / child (<12)",
    duration: "8am to 3pm",
    minPax: "Min 10-14 pax",
    image: scenicImg,
    description: [
      "Round island trip (8am to 3pm)",
      "Local chocolate factory visit",
      "Raru Waterfall for a cool dip",
      "Blue Lagoon for rope swinging",
      "Lunch at Banana Bay Beach Club",
      "Duty Free Shopping",
      "Includes entrance fees & refreshments"
    ]
  },
  {
    id: "roots",
    title: "Roots & Routes Tour",
    price: "$100 / person",
    duration: "4-5 Hours",
    minPax: "10-14 pax",
    image: culturalImg,
    description: [
      "A taste for custom & tradition",
      "Cultural Village Tour & Experience",
      "Kava Tasting & Endemic Plant Tour (El Manaro Nakamal)",
      "Cultural Centre Visit",
      "Light refreshments provided",
      "Price includes entrance fees"
    ]
  },
  {
    id: "bus",
    title: "Bus Hire for the Day",
    price: "A$400 / day",
    duration: "5-8 Hours",
    image: busImg,
    description: [
      "Hire the bus for the day",
      "Choose your own stops",
      "Light refreshments provided",
      "You take care of your entrance fees",
      "Ideal for large groups"
    ]
  }
];

export const transfers = [
  {
    id: "airport",
    title: "Airport Transfer Package",
    price: "A$15 per adult",
    details: "Min 5 pax. Babies FOC.",
    description: "Airport pickups and drop-offs, flight tracking, and meet-and-greet services. VIP transfers available.",
    image: airportImg
  },
  {
    id: "event",
    title: "Event Transfer Package",
    price: "VT 25,000 (5 hours)",
    details: "+ VT1000/hr up to 8 hours",
    description: "Group transportation, coordination with event planners, and on-site support. Ideal for corporate events.",
    image: busImg
  },
  {
    id: "hospitality",
    title: "Hospitality Package",
    price: "VT 25,000 bus hire",
    details: "Up to 10 hours max",
    description: "Customized itineraries, pick up and drop off for all meetings. Ideal for hosting out-of-town clients.",
    image: scenicImg
  }
];
