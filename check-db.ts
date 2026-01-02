
import { storage } from "./server/storage";

async function checkDB() {
  const tours = await storage.getTours();
  const vehicles = tours.filter(t => t.category === "vehicle");
  console.log("Total tours:", tours.length);
  console.log("Vehicles found:", JSON.stringify(vehicles, null, 2));
  process.exit(0);
}

checkDB();
