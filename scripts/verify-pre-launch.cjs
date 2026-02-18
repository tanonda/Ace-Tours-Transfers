async function testRateLimit() {
    console.log("Testing rate limit on /api/availability/check...");
    for (let i = 0; i < 15; i++) {
        try {
            const resp = await fetch('http://localhost:5001/api/availability/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId: 'some-id',
                    date: '2026-03-01'
                })
            });
            const data = await resp.json();
            console.log(`[${i + 1}] Status: ${resp.status} - ${JSON.stringify(data)}`);
            if (resp.status === 429) {
                console.log("✅ Rate limit triggered successfully!");
                break;
            }
        } catch (err) {
            console.log(`[${i + 1}] Error: ${err.message}`);
        }
    }
}

testRateLimit();
