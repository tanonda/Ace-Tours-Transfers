
import { execSync } from 'child_process';
import fs from 'fs';
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const urlObj = new URL(connectionString);
const endpoint = `https://${urlObj.hostname}/sql`;

console.log("🚀 Starting Granular SQL Migrator via Curl (V2)...");

function query(sqlText) {
  const payload = JSON.stringify({ query: sqlText.trim() });
  fs.writeFileSync('payload.json', payload);
  const cmd = `curl -s -X POST -H "Content-Type: application/json" -H "neon-connection-string: ${connectionString}" --data-binary @payload.json ${endpoint}`;
  
  try {
    const output = execSync(cmd).toString();
    const result = JSON.parse(output);
    if (result.message || result.error) {
       console.error("Result error:", result.message || result.error);
       throw new Error(result.message || result.error || "Unknown database error");
    }
    return result;
  } catch (e) {
    throw new Error(`Query execution failed: ${e.message}`);
  } finally {
    if (fs.existsSync('payload.json')) fs.unlinkSync('payload.json');
  }
}

async function run() {
  const sqlFile = "/home/bandit/Documents/AceToursVanuatu/server/migrations/consolidated-migration.sql";
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  
  // More robust splitting that removes comments first
  const cleanSql = sqlContent
    .split('\n')
    .map(line => line.split('--')[0]) // remove inline comments
    .join(' ');

  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Found ${statements.length} SQL statements to execute.`);

  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    console.log(`[${i+1}/${statements.length}] Executing: ${s.substring(0, 100)}...`);
    try {
      query(s);
      console.log(`   ✅ Success.`);
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log(`   ⏩ Skipping: already exists.`);
      } else {
        console.error(`   ❌ Failed: ${err.message}`);
        process.exit(1);
      }
    }
  }

  console.log("🏁 Granular SQL Migration and Backfill complete!");
  process.exit(0);
}

run();
