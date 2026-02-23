import { insertTourSchema } from "./shared/schema";
try {
  const payload = {
    title: "Test Tour",
    isActive: true,
    price: "$100",
    childPrice: "$50",
    duration: "2 hours",
    minPax: "2",
    category: "tour",
    defaultCapacity: 20,
    description: ["Test description"],
    image: "http://example.com/image.jpg",
    vehicleDetails: null,
  };
  console.log("Parsing payload...");
  const result = insertTourSchema.parse(payload);
  console.log("Success:", result);
} catch (e: any) {
  console.error("Zod Error:", e.errors);
}
