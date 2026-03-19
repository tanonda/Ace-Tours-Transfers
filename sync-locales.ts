import "dotenv/config";
import fs from "fs";
import path from "path";
import { db } from "./server/db.js";
import { cmsContent } from "./shared/schema.js";
import { eq, and } from "drizzle-orm";
import { translateText } from "./server/lib/translate.js";

const LOCALES_DIR = path.join(process.cwd(), "client/src/locales");
const AUTO_LANGS = ["fr", "es", "zh"];
const enJson = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));

// Helper to flatten/unflatten object
function flattenObj(ob: any): any {
  let result: any = {};
  for (const i in ob) {
    if ((typeof ob[i]) === 'object' && !Array.isArray(ob[i])) {
      const temp = flattenObj(ob[i]);
      for (const j in temp) result[i + '.' + j] = temp[j];
    } else {
      result[i] = ob[i];
    }
  }
  return result;
}

function unflattenObj(ob: any): any {
  const result: any = {};
  for (const key in ob) {
    const keys = key.split('.');
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = ob[key];
  }
  return result;
}

async function run() {
  const enFlat = flattenObj(enJson);

  // 1. Sync JSON Files
  for (const lang of AUTO_LANGS) {
    const langPath = path.join(LOCALES_DIR, `${lang}.json`);
    const langJson = fs.existsSync(langPath) ? JSON.parse(fs.readFileSync(langPath, "utf8")) : {};
    const langFlat = flattenObj(langJson);
    let updated = false;

    for (const [key, val] of Object.entries(enFlat)) {
      if (!langFlat[key] && typeof val === "string") {
        console.log(`[JSON] Translating ${lang} key: ${key}`);
        langFlat[key] = await translateText(val, lang);
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(langPath, JSON.stringify(unflattenObj(langFlat), null, 2) + "\n");
      console.log(`Saved ${lang}.json`);
    }
  }

  // 2. Sync CMS database for Auto-Langs
  const allCms = await db.select().from(cmsContent);
  const enCms = allCms.filter(c => c.locale === 'en');
  
  for (const lang of AUTO_LANGS) {
    const langCms = allCms.filter(c => c.locale === lang);
    for (const enItem of enCms) {
      const exists = langCms.some(c => c.blockSlug === enItem.blockSlug && c.contentKey === enItem.contentKey);
      if (!exists && enItem.value?.trim()) {
        console.log(`[CMS] Translating ${lang} field: ${enItem.blockSlug}.${enItem.contentKey}`);
        const translated = await translateText(enItem.value, lang);
        await db.insert(cmsContent).values({
          blockSlug: enItem.blockSlug,
          contentKey: enItem.contentKey,
          contentType: enItem.contentType,
          value: translated,
          locale: lang,
        });
      }
    }
  }

  // 3. Extract missing Bislama info
  const biPath = path.join(LOCALES_DIR, "bi.json");
  const biJson = fs.existsSync(biPath) ? JSON.parse(fs.readFileSync(biPath, "utf8")) : {};
  const biFlat = flattenObj(biJson);
  const biMissingJson = [];
  
  for (const [key, val] of Object.entries(enFlat)) {
    if (!biFlat[key] && typeof val === "string") {
      biMissingJson.push({ key, en: val });
    }
  }

  const biCms = allCms.filter(c => c.locale === 'bi');
  const biMissingCms = [];
  for (const enItem of enCms) {
    const exists = biCms.some(c => c.blockSlug === enItem.blockSlug && c.contentKey === enItem.contentKey);
    if (!exists && enItem.value?.trim()) {
      biMissingCms.push({ id: enItem.id, blockSlug: enItem.blockSlug, contentKey: enItem.contentKey, en: enItem.value });
    }
  }

  if (biMissingJson.length > 0 || biMissingCms.length > 0) {
    console.log("\n=============================");
    console.log("MISSING BISLAMA TRANSLATIONS");
    console.log("=============================\n");
    console.log("JSON KEYS (copy output into translation script):");
    console.log(JSON.stringify(biMissingJson, null, 2));
    console.log("\nCMS FIELDS (copy output into translation script):");
    console.log(JSON.stringify(biMissingCms, null, 2));
  } else {
    console.log("Bislama is fully up to date!");
  }

  process.exit(0);
}

run();
