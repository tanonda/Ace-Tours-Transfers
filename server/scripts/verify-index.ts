
import pg from 'pg';
import "dotenv/config";

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const res = await pool.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'tour_instances' AND indexname = 'idx_tour_instances_unique';
        `);
        console.table(res.rows);
        await pool.end();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
