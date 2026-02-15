
import { pool } from '../server/db.js';

async function verify() {
    try {
        console.log('Testing connection via server/db.ts...');
        const client = await pool.connect();
        console.log('Connected successfully!');
        const res = await client.query('SELECT NOW()');
        console.log('Query result:', res.rows[0]);
        client.release();
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
}

verify();
