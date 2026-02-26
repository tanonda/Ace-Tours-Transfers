import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // 1. What tables exist?
    const tables = await pool.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    );
    console.log("\n=== PUBLIC TABLES ===");
    console.log(tables.rows.map((r: any) => r.tablename).join(", "));

    // 2. Current payment_gateways — timestamps tell us when data was created/modified
    const gw = await pool.query(`
    SELECT slug, display_name, active, is_default, created_at, updated_at
    FROM payment_gateways
    ORDER BY created_at ASC
  `);
    console.log("\n=== PAYMENT_GATEWAYS (creation history) ===");
    gw.rows.forEach((r: any) =>
        console.log(`  ${r.slug}: created=${r.created_at?.toISOString?.() ?? r.created_at}, updated=${r.updated_at?.toISOString?.() ?? r.updated_at}`)
    );

    // 3. Drizzle migration journal
    const mig = await pool.query(
        "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 15"
    ).catch((e: any) => ({ rows: null, errorMsg: e.message }));
    if ((mig as any).rows) {
        console.log("\n=== DRIZZLE MIGRATION JOURNAL ===");
        (mig as any).rows.forEach((r: any) => console.log(`  id=${r.id} hash=${r.hash} at=${r.created_at}`));
    } else {
        console.log("\n=== DRIZZLE MIGRATION JOURNAL: ERROR ===", (mig as any).errorMsg);
    }

    // 4. Capacity audit log — most recent 20 entries (only inventory events are tracked)
    const auditLog = await pool.query(`
    SELECT action, performed_by, product_id, created_at, metadata
    FROM capacity_audit_log
    ORDER BY created_at DESC
    LIMIT 20
  `).catch((e: any) => ({ rows: null, errorMsg: e.message }));
    if ((auditLog as any).rows) {
        console.log("\n=== CAPACITY AUDIT LOG (last 20) ===");
        (auditLog as any).rows.forEach((r: any) =>
            console.log(`  [${r.created_at?.toISOString?.() ?? r.created_at}] ${r.action} by=${r.performed_by} product=${r.product_id}`)
        );
    } else {
        console.log("\n=== CAPACITY AUDIT LOG: ERROR ===", (auditLog as any).errorMsg);
    }

    // 5. Check for a pg_stat_user_tables to see approximate DML counts on payment_gateways
    const stats = await pool.query(`
    SELECT relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze
    FROM pg_stat_user_tables
    WHERE relname = 'payment_gateways'
  `).catch((e: any) => ({ rows: null, errorMsg: e.message }));
    if ((stats as any).rows) {
        console.log("\n=== PG_STAT payment_gateways ===");
        console.log(JSON.stringify((stats as any).rows[0], null, 2));
    }

    // 6. Check pg_stat_activity for any recent long-running queries
    const serverLog = await pool.query(`
    SELECT query_start, state, query
    FROM pg_stat_activity
    WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
    LIMIT 10
  `).catch(() => ({ rows: [] }));
    console.log("\n=== ACTIVE QUERIES ===");
    (serverLog as any).rows.forEach((r: any) => console.log(`  [${r.state}] ${r.query?.trim()?.substring(0, 120)}`));

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
