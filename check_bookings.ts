import { db } from "./server/db";
import { products, bookings } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const allProducts = await db.select({
        id: products.id,
        title: products.title,
        category: products.category,
        image: products.image,
    }).from(products);

    const allBookings = await db.select({
        tourId: bookings.tourId,
    }).from(bookings);

    const bookingCounts = new Map<string, number>();
    for (const b of allBookings) {
        if (b.tourId) {
            bookingCounts.set(b.tourId, (bookingCounts.get(b.tourId) || 0) + 1);
        }
    }

    console.log("Products and their booking counts:");
    allProducts.sort((a, b) => a.title.localeCompare(b.title)).forEach(p => {
        const count = bookingCounts.get(p.id) || 0;
        console.log(`- [${p.id}] ${p.title} (${p.category}) - Bookings: ${count}`);
    });

    process.exit(0);
}

main().catch(console.error);
