import { db } from "./server/db";
import { products } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Mapping new images to products...");
  
  const mappings = [
    { title: "Mele Cascades Waterfall Tour", path: "/attached_assets/images/mele_cascades_1772981707199.png" },
    { title: "Ekasup Cultural Village Tour", path: "/attached_assets/images/ekasup_village_1772981725789.png" },
    { title: "Port Vila City & Market Tour", path: "/attached_assets/images/vila_city_market_1772981742791.png" },
    { title: "Havannah Harbour Sunset Cruise & Dinner", path: "/attached_assets/images/sunset_dinner_cruise_1772981762728.png" },
    { title: "Hideaway Island Resort Transfer", path: "/attached_assets/images/hideaway_transfer_1772981781516.png" },
    { title: "Havannah Harbour Resort Area Transfer", path: "/attached_assets/images/havannah_transfer_1772981801762.png" },
    { title: "Toyota Prado SUV (7-Seater)", path: "/attached_assets/images/prado_suv_1772981864527.png" },
    { title: "15-Seater Minibus", path: "/attached_assets/images/minibus_1772981883603.png" },
    { title: "Hospitality Package", path: "/attached_assets/images/hospitality_transfer_1772981900394.png" },
    { title: "Events Transfer Package: Professional Group Logistics", path: "/attached_assets/images/events_transport_1772981918262.png" },
    { title: "Dinner Transfer (Round Trip)", path: "/attached_assets/images/dinner_transfer_1772981935394.png" }
  ];
  
  for (const map of mappings) {
      await db.update(products).set({ image: map.path }).where(eq(products.title, map.title));
      console.log(`Updated ${map.title}`);
  }

  process.exit(0);
}

main().catch(console.error);
