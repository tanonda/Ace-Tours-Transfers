import pg from "pg";

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL is required");

const translations = [
  {
    id: "90b13e31-6e1b-44e9-942c-667203409126",
    title: "Blu Lagun mo Tetel Bei Kombo",
    description: [
      "Swim long spesel klin bluo wota",
      "Lukluk mo visitim ples blong ol tetel"
    ]
  },
  {
    id: "03db4647-1499-4156-aa0f-7997e3703955",
    title: "Raonem Aelan long Efate Tua",
    description: [
      "Eksperiensem best blo Efate: Joenem ful dei \"Raonem Aelan\" adventure blong mifala (8 am kasem 3 pm).",
      "Ol Top Ples: Visitim lokol joklet faktri, go swim long Raru Waterfall, mo traem ol rop swing long Blu Lagun.",
      "Evri Samting I Insaed: Spenem taem mo kakae long Banana Bay Beach Club, stop long duty-free, mo evri entry fee i pei finis.",
      "Praes: AUD$120 long wan adalt | AUD$60 long wan pikinini (<12 yia). Min 10-14 man."
    ]
  },
  {
    id: "a98ccc98-6201-45b7-b268-fce9a7e74241",
    title: "Ekasup Kaltjoral Vilej Tua",
    description: [
      "<p>Go bak long taem mo luk stret laef blong bifo long Melanesia. Ekasup Cultural Village hemi wan spesel ples blong lanem trufala kastom mo kalja blong Vanuatu.</p>",
      "<h3>Wanem Bae Yu Luk Mo Mekem</h3>",
      "<ul>",
      "<li>Jif bae i welkamem yu wetem wan kastom danis blong ol warior.</li>",
      "<li>Lukluk olsem wanem olgeta oli save faenem kakae, wokem trap, mo kasem fis long kastom wei.</li>",
      "<li>Lanem ol sikret blong fasin blong sevem kakae mo ol kastom meresin.</li>",
      "<li>Lukluk kastom majik mo harem ol olfala stori mo legend we oli pasem aot laen i kam.</li>",
      "</ul>"
    ]
  }
];

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  for (const t of translations) {
    await client.query(`
      INSERT INTO product_translations (product_id, locale, title, description, updated_at)
      VALUES ($1, 'bi', $2, $3, NOW())
      ON CONFLICT (product_id, locale) DO UPDATE SET
        title = $2, description = $3, updated_at = NOW()
    `, [t.id, t.title, t.description]);
    console.log("✅ Inserted Bislama translation for:", t.title);
  }

  await client.end();
}
main();
