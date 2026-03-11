import "dotenv/config";

async function run() {
    try {
        // 1. Create Booking
        const bookingRes = await fetch("http://localhost:5000/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customerName: "API Test User",
                customerEmail: "api-test@acetours.vu",
                customerPhone: "+678 1234567",
                pickupLocation: "Hotel Vanuatu",
                items: [{
                    productId: "03db4647-1499-4156-aa0f-7997e3703955", // Any tour ID
                    adultPax: 2,
                    childPax: 0,
                    infantPax: 0,
                    petPax: 0,
                    date: new Date().toISOString().split('T')[0],
                    quantity: 1,
                    addonIds: []
                }]
            })
        });

        const bookingData = await bookingRes.json();
        console.log("Booking created:", bookingData);

        if (!bookingRes.ok) throw new Error(bookingData.error);

        // 2. Checkout
        console.log(`Checking out booking ${bookingData.id} with manual_transfer...`);
        const checkoutRes = await fetch("http://localhost:5000/api/payments/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                bookingId: bookingData.id,
                provider: "manual_transfer",
            })
        });

        const checkoutData = await checkoutRes.json();
        console.log("Checkout result:", checkoutData);

    } catch (err: any) {
        console.error("CRASH:", err);
    }
}

run();
