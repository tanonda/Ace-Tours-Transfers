import "dotenv/config";
import pkg from 'pg';
const { Client } = pkg;

async function testSimple() {
    const url = process.env.DATABASE_URL;
    if (!url) return;

    // Strip channel_binding just in case
    const cleanUrl = url.replace(/&channel_binding=[^&]+/, '').replace(/\?channel_binding=[^&]+&/, '?').replace(/\?channel_binding=[^&]+$/, '');

    console.log("Connecting with Client to:", cleanUrl.split('@')[1]);

    const client = new Client({
        connectionString: cleanUrl,
        ssl: { rejectUnauthorized: false } // Force SSL
    });

    try {
        await client.connect();
        console.log("✅ Client connected!");
        const res = await client.query('SELECT 1');
        console.log("✅ Query successful!");
        await client.end();
    } catch (err: any) {
        console.error("❌ Client failed!");
        console.error(err);
    }
}

testSimple();
