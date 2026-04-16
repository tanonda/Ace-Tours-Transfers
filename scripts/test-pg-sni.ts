import pkg from 'pg';
const { Client } = pkg;

async function testIP_SNI() {
    const host = '54.206.85.193'; // One of the WORKING IPs from earlier
    const servername = 'ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech';
    const user = 'neondb_owner';
    const password = process.env.PGPASSWORD ?? '';
    const database = 'neondb';

    console.log(`Connecting to ${host}:5432 with SNI ${servername}...`);

    const client = new Client({
        host,
        port: 5432,
        user,
        password,
        database,
        ssl: {
            servername: servername,
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log("✅ Client connected via IP + SNI!");
        const res = await client.query('SELECT NOW()');
        console.log("✅ Query successful!", res.rows[0]);
        await client.end();
    } catch (err: any) {
        console.error("❌ Client failed via IP + SNI!");
        console.error(err);
    }
}

testIP_SNI();
