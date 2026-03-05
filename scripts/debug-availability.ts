
// import fetch from "node-fetch";

async function check() {
    try {
        // 1. Fetch all tours
        console.log("Fetching all tours...");
        const toursRes = await fetch("http://localhost:5001/api/products");
        if (toursRes.status !== 200) {
            console.error("Failed to fetch tours:", toursRes.status);
            return;
        }
        const tours = await toursRes.json();
        console.log(`Found ${tours.length} tours.`);

        // 2. Check each tour
        for (const tour of tours) {
            // console.log(`Checking tour: ${tour.title} (${tour.id})`);

            const payload = {
                serviceId: tour.id,
                date: "2025-02-20", // Future date
                adultPax: 2,
                childPax: 0,
                startTime: "09:00",
                endTime: "12:00"
            };

            const res = await fetch("http://localhost:5001/api/availability/check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.status === 500) {
                console.error(`!!!! CRITICAL FAILURE ON TOUR ${tour.id} (${tour.title}) !!!!`);
                const text = await res.text();
                console.error("Body:", text);
            } else if (res.status !== 200) {
                // console.log(`Tour ${tour.id} returned status ${res.status}`);
            }
        }
        console.log("Scan complete.");

    } catch (e) {
        console.error("Fetch error:", e);
    }
}

check();
