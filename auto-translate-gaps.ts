import pg from "pg";
import translate from "google-translate-api-x";

const { Client } = pg;
const DB_URL = "postgresql://neondb_owner:REDACTED@ep-delicate-king-am3aopbg-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";

const LOCALE_MAP: Record<string, string> = { fr: "fr", es: "es", zh: "zh-CN" };
const TARGETS = ["fr", "es", "zh"] as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateText(text: string, locale: string): Promise<string> {
  if (!text?.trim()) return text;
  const googleLang = LOCALE_MAP[locale];
  try {
    const result = await translate(text, { from: "en", to: googleLang });
    return result.text;
  } catch (err: any) {
    console.error(`    ⚠️  Failed again (${locale}): ${err.message}`);
    return text;
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("🔌 Connected to database. Scanning for translation failures...\n");

  const products = (await client.query(`
    SELECT id, title, description, itinerary_intro, pickup_instructions,
           meeting_point, operating_hours, cancellation_policy,
           included_items, excluded_items, additional_info
    FROM products ORDER BY category, title
  `)).rows;

  let totalPatched = 0;

  for (const p of products) {
    for (const locale of TARGETS) {
      const existing = await client.query(
        `SELECT * FROM product_translations WHERE product_id = $1 AND locale = $2`,
        [p.id, locale]
      );

      if (existing.rows.length === 0) continue;
      const t = existing.rows[0];

      let needsUpdate = false;
      const updates: any = {};

      const checkField = async (field: string) => {
        if (p[field] && p[field] === t[field]) {
          console.log(`    ↻ Missing translation found in '${field}' for ${p.title} (${locale})`);
          updates[field] = await translateText(p[field], locale);
          await sleep(600); // Slower backoff
          needsUpdate = true;
        }
      };

      const checkArray = async (field: string) => {
        const pArr = p[field] as string[] || [];
        const tArr = t[field] as string[] || [];
        
        let arrNeedsUpdate = false;
        const newArr = [...tArr];

        for (let i = 0; i < pArr.length; i++) {
          if (pArr[i] && pArr[i] === tArr[i]) {
            console.log(`    ↻ Missing translation found in '${field}[${i}]' for ${p.title} (${locale})`);
            newArr[i] = await translateText(pArr[i], locale);
            await sleep(600); // Slower backoff
            arrNeedsUpdate = true;
          }
        }

        if (arrNeedsUpdate) {
          updates[field] = newArr;
          needsUpdate = true;
        }
      };

      await checkField("title");
      await checkField("itinerary_intro");
      await checkField("pickup_instructions");
      await checkField("meeting_point");
      await checkField("operating_hours");
      await checkField("cancellation_policy");

      await checkArray("description");
      await checkArray("included_items");
      await checkArray("excluded_items");
      await checkArray("additional_info");

      if (needsUpdate) {
        console.log(`    ✅ Saving patched translations for ${p.title} (${locale})\n`);
        
        const setClauses: string[] = [];
        const values: any[] = [];
        let i = 1;
        
        for (const [k, v] of Object.entries(updates)) {
          setClauses.push(`${k} = $${i}`);
          values.push(Array.isArray(v) && k !== 'description' ? JSON.stringify(v) : v);
          i++;
        }
        
        values.push(t.id);
        
        await client.query(`
          UPDATE product_translations 
          SET ${setClauses.join(', ')}, updated_at = NOW() 
          WHERE id = $${i}
        `, values);
        
        totalPatched++;
      }
    }
  }

  await client.end();
  console.log(`\n🎉 Gap-fill scan complete! ${totalPatched} locales successfully patched.`);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
