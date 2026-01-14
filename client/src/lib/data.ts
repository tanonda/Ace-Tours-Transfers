


export const tours = [
  {
    id: "scenic",
    title: "Efate Scenic Tour",
    price: "$120 / adult",
    childPrice: "$60 / child (<12)",
    duration: "8am to 3pm",
    minPax: "Min 10-14 pax",
    image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064618/ace-tours-assets/tour_scenic_efate.jpg",
    description: [
      "Round island trip (8am to 3pm)",
      "Local chocolate factory visit",
      "Raru Waterfall for a cool dip",
      "Blue Lagoon for rope swinging",
      "Lunch at Banana Bay Beach Club",
      "Duty Free Shopping",
      "Includes entrance fees & refreshments"
    ],
    capacity: 20 // Default capacity for tours
  },
  {
    id: "roots",
    title: "Roots & Routes Tour",
    price: "$100 / person",
    duration: "4-5 Hours",
    minPax: "10-14 pax",
    image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064621/ace-tours-assets/tour_cultural_roots.jpg",
    description: [
      "A taste for custom & tradition",
      "Cultural Village Tour & Experience",
      "Kava Tasting & Endemic Plant Tour (El Manaro Nakamal)",
      "Cultural Centre Visit",
      "Light refreshments provided",
      "Price includes entrance fees"
    ],
    capacity: 20 // Default capacity for tours
  },
  {
    id: "bus",
    title: "Bus Hire for the Day",
    price: "A$400 / day",
    duration: "5-8 Hours",
    minPax: "Ideal for large groups",
    image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064623/ace-tours-assets/tour_bus_hire.jpg",
    description: [
      "Hire the bus for the day",
      "Choose your own stops",
      "Light refreshments provided",
      "You take care of your entrance fees",
      "Ideal for large groups"
    ],
    capacity: 999 // High capacity for private hire
  }
];

export const transfers = [
  {
    id: "airport",
    title: "Airport Transfer Package",
    price: "A$15 per adult",
    duration: "24/7 Availability",
    minPax: "Min 5 pax",
    childPrice: "Babies FOC",
    description: [
      "Airport pickups and drop-offs",
      "Flight tracking included",
      "Meet-and-greet services",
      "VIP transfers available",
      "Babies travel free of charge"
    ],
    image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064625/ace-tours-assets/transfer_airport_van.jpg",
    capacity: 15 // Default capacity for transfers
  },
  {
    id: "event",
    title: "Event Transfer Package",
    price: "VT 25,000 (5 hours)",
    duration: "5 Hours",
    minPax: "+ VT1000/hr extra",
    description: [
      "Group transportation for events",
      "Coordination with event planners",
      "On-site support included",
      "Ideal for corporate events",
      "Weddings and special occasions"
    ],
    image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064625/ace-tours-assets/transfer_airport_van.jpg",
    capacity: 15 // Default capacity for transfers
  },
  {
    id: "hospitality",
    title: "Hospitality Package",
    price: "VT 25,000 bus hire",
    duration: "Up to 10 hours",
    minPax: "Max 10 hours",
    description: [
      "Customized itineraries",
      "Pick up and drop off for all meetings",
      "Ideal for hosting out-of-town clients",
      "Professional dedicated driver",
      "Comfortable air-conditioned transport"
    ],
    image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064623/ace-tours-assets/tour_bus_hire.jpg",
    capacity: 999 // High capacity for private hire
  }
];
