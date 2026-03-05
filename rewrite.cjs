const fs = require("fs");
const path = require("path");

const files = [
    "server/application/admin/capacity-overview.service.ts",
    "server/application/booking.application-service.ts",
    "server/application/booking/CreateBookingFromCartService.ts",
    "server/application/events/BookingEventHandler.ts",
    "server/application/payment.application-service.ts",
    "server/application/pricing/PriceCartService.ts",
    "server/domain/availability/availability.service.ts",
    "server/domain/booking/booking-confirmation.service.ts",
    "server/domain/pricing/PriceResolver.ts",
    "server/domain/pricing/PricingEngine.ts",
    "server/domain/services/availability.domain-service.ts",
    "server/domain/users/user-profile.domain-service.ts",
    "server/infrastructure/metrics/metrics.service.ts",
    "server/migrate-images.ts",
    "server/migrations/backfill-numeric-pricing.ts",
    "server/routes.test.ts",
    "server/routes.ts",
    "server/scripts/load-test-comprehensive.ts",
    "server/scripts/test-atomic-session-confirmation.ts",
    "server/scripts/test-telemetry.ts",
    "server/scripts/verify-vehicle-overlap.ts",
    "server/seed-bookings.ts",
    "server/seed.ts",
    "server/storage.ts",
    "server/update-missing-images.ts",
    "server/update-tours-transfers.ts"
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, "utf8");

    // Fix schema imports
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*["'](\.\.\/)*shared\/schema(\.js|\.ts)?["']/g, (match, imports) => {
        let replaced = imports;
        replaced = replaced.replace(/\btours\b/g, "products");
        replaced = replaced.replace(/\bTour\b/g, "Product");
        replaced = replaced.replace(/\bInsertTour\b/g, "InsertProduct");
        replaced = replaced.replace(/\binsertTourSchema\b/g, "insertProductSchema");
        return match.replace(imports, replaced);
    });

    // Storage bindings usages in application logic
    content = content.replace(/this\.storage\.getTours\(/g, "this.storage.getProducts(");
    content = content.replace(/this\.storage\.getTour\(/g, "this.storage.getProduct(");
    content = content.replace(/this\.storage\.updateTour\(/g, "this.storage.updateProduct(");

    // General Storage access (routes, etc.)
    content = content.replace(/storage\.getTours\(/g, "storage.getProducts(");
    content = content.replace(/storage\.getTour\(/g, "storage.getProduct(");
    content = content.replace(/storage\.getTourByTitle\(/g, "storage.getProductByTitle(");
    content = content.replace(/storage\.createTour\(/g, "storage.createProduct(");
    content = content.replace(/storage\.updateTour\(/g, "storage.updateProduct(");
    content = content.replace(/storage\.deleteTour\(/g, "storage.deleteProduct(");

    // Internal drizzle query accesses (db.select().from(products) already partly done by previous bad regex but missing actual imports)
    // Let's ensure the explicit queries that failed are fixed:
    content = content.replace(/\btours\b/g, (match, offset, str) => {
        // We only want to replace standalone `tours` if it's likely a schema reference 
        // e.g., `from(tours)`, `insert(tours)`, `eq(tours.id)`, `tours,` 
        // We do NOT want to replace it inside `/api/tours` or variable names like `toursList`
        const prevChar = str[offset - 1];
        const nextChar = str[offset + match.length];

        // In TS, schema references often follow `(`, `{`, ` `, `,`, `.`
        if (prevChar === '.' || nextChar === '.' || prevChar === '(' || nextChar === ')' || nextChar === ',') {
            return "products";
        }
        return match;
    });

    // The above regex might break things if not careful, let's be more surgical instead:
    content = content.replace(/from\(tours\)/g, "from(products)");
    content = content.replace(/insert\(tours\)/g, "insert(products)");
    content = content.replace(/update\(tours\)/g, "update(products)");
    content = content.replace(/delete\(tours\)/g, "delete(products)");
    content = content.replace(/eq\(tours\./g, "eq(products.");
    content = content.replace(/\(tours\.id\)/g, "(products.id)");
    content = content.replace(/\{ tours \}/g, "{ products }");
    content = content.replace(/tours\./g, "products.");

    fs.writeFileSync(file, content);
}
console.log("Cleanup pass complete");
