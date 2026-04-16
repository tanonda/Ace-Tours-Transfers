import pkg from 'pg';
const { Client } = pkg;

async function testIP() {
    const host = '54.206.85.193'; // One of the IPs for ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech
    const port = 5432;
    const user = 'neondb_owner';
    const password = process.env.PGPASSWORD ?? '';
    const database = 'neondb';

    console.log(`Connecting to ${host}:${port} (IP)...`);

    const client = new Client({
        host,
        port,
        user,
        password,
        database,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("✅ Client connected via IP!");
        const res = await client.query('SELECT 1');
        console.log("✅ Query successful!");
        await client.end();
    } catch (err: any) {
        console.error("❌ Client failed via IP!");
        console.error(err);
    }
}

testIP();
