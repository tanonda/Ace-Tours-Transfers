import "dotenv/config";
import fs from "fs";
import path from "path";
import { db } from "./server/db.js";
import { cmsContent } from "./shared/schema.js";

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

const biTranslations: Record<string, string> = {
  "admin.toursManagement": "Manejem ol Tura",
  "admin.manageToursDesc": "Mekem, jenisim, mo oganaesem ol tura.",
  "admin.addTour": "Ademap Niu Tura",
  "admin.editTour": "Jenisim Tura",
  "admin.tourTitle": "Nem blong Tura",
  "admin.category": "Katigori",
  "admin.price": "Praes",
  "admin.childPrice": "Praes blong Pikinini",
  "admin.duration": "Hamas Taem",
  "admin.minPax": "Min Kasa",
  "admin.description": "Diskripsen",
  "admin.image": "Pija URL",
  "admin.tourCreated": "Tura i krietem finis",
  "admin.tourCreatedDesc": "Ademap niu tura finis.",
  "admin.createFailed": "No save wokem tura.",
  "admin.tourUpdated": "Tura i jenis finis",
  "admin.tourUpdatedDesc": "Ol sevis i sevem finis.",
  "admin.updateFailed": "No save jenisim tura.",
  "admin.tourDeleted": "Tura i dilitem finis",
  "admin.tourDeletedDesc": "Aotem tura evriwan.",
  "admin.deleteFailed": "No save aotem tura.",
  "admin.deleteTourTitle": "Aotem Tura",
  "admin.deleteTourConfirm": "Yu sua blong aotem tura ia?",
  "admin.noToursFound": "I no gat tura i mejem sevis blong yu.",
  "admin.confirmDelete": "Aotem Tura",
  "admin.confirmDeleteDesc": "Yu no save mekem i kambak.",
  "admin.analyticsTitle": "Analitiks blong Dasbod",
  "admin.analyticsDesc": "Lukluk long ol buk, mani mo sevis.",
  "admin.revenueOverTime": "Mani i Kam In",
  "admin.bookingDistribution:":"Bak Buking",
  "admin.topPerformingTours":"Nambawan Tura",
  "vehicles.title": "Ol Trak blong Mifala",
  "vehicles.description": "Faenem ol nambawan trak blong rentakem.",
  "vehicles.noVehicles": "I no gat trak i mejem nid blong yu.",
  "vehicles.specs": "Geter blong Trak",
  "vehicles.make": "Kampani",
  "vehicles.model": "Model",
  "vehicles.seats": "Jia",
  "vehicles.transmission":"Gia",
  "vehicles.features":"Spesu Samting",
  "vehicles.bookNow":"Bukum Naoia"
};

const cmsTranslations: Record<string, Record<string, string>> = {
  "home": {
    "hero_image": "https://res.cloudinary.com/dwro1dh5q/image/upload/v1772779188/ace-tours-uploads/drawpefnndpwvdwohvhj.jpg",
    "hero_title_part1": "Eksperiensim blong Vanuatu",
    "hero_title_part2": "Nambawan Naoia",
    "hero_subtitle": "Trasted patna blong yu blong ol earport transfa, rekoaingkarem rentakem trak, mo ol nambawan tura raon long aelan long Port Vila.",
    "about_title": "Nambawan Transpot & Tura Opereita blong Vanuatu",
    "about_desc1": "<p>Welkam long <strong>Ace Tours & Transfers Vanuatu</strong>. Mifala wan kampani we ol man ples oli onam, mo mifala wantem soemaot gudfala aelan blong mifala long yu.</p><p>Sapos yu wantem i go kwik long resot o rentakem trak blong spiala raon, mifala i save halpem yu.</p>",
    "about_desc2": "<p></p>",
    "about_quote": "<p>Eksperiensim gudfala laef blong Vanuatu.</p>",
    "about_badge1": "Lokal Eksperiens",
    "about_badge2": "Safe Trabel",
    "about_badge3": "24/7 Sapot",
    "about_badge4": "Izi Buking",
    "tours_label": "OL TURA",
    "tours_title": "Spiala Raon Aelan",
    "tours_desc": "Tekem ol samting we yu no save fogetem long aelan blong mifala.",
    "transfers_label": "OL TRANSFA",
    "transfers_title": "Earport mo Resot Transfa",
    "transfers_desc": "Safe mo gudfala transfa long Port Vila.",
    "vehicles_label": "RENTATRAK",
    "vehicles_title": "Rentakem ol Trak",
    "vehicles_desc": "Faenem trak blong halpem yu spiala aelan.",
    "cta_title": "Redi blong spiala?",
    "cta_desc": "Bukum tura o trak blong yu naoia.",
    "cta_button": "Bukum Naoia",
    "trust_licensed": "Laesens Transpot",
    "trust_licensed_desc": "Gavman i appruvum mifala.",
    "trust_rated": "Nambawan Sevis",
    "trust_rated_desc": "Ol kastoma oli glad tumas.",
    "trust_secure": "Sekua Buking",
    "trust_secure_desc": "Izi we blong pem onlaen.",
    "about_label": "ABAUT MIFALA"
  },
  "home-page": {
    "hero_title_part1": "Taem blong",
    "hero_title_part2": "neks advenja"
  },
  "about": {
    "page_title": "Ace Tours & Transfers Vanuatu",
    "page_subtitle": "Abaut Mifala",
    "story_title": "Stori blong Mifala",
    "story_desc1": "<p>Ace Tours i stat from drim blong serem nambawan aelan blong mifala wetem ol man we oli kam visitim Vanuatu.</p>",
    "story_desc2": "<p></p>",
    "story_image": "https://res.cloudinary.com/dwro1dh5q/image/upload/v1772288204/ace-tours/wd7wxewgkdg8pzfwpfuj.jpg",
    "title": "Nambawan Transpot & Tura Opereita blong Vanuatu",
    "content": "<p>Welkam long <strong>Ace Tours & Transfers Vanuatu</strong>. Mifala wan kampani we ol man ples oli onam, mo mifala wantem soemaot gudfala aelan blong mifala long yu.</p><p>Sapos yu wantem i go kwik long resot o rentakem trak blong spiala raon, mifala i save halpem yu.</p>",
    "why_choose_us": "Yumi Nambawan",
    "feature1_title": "Lokal Gaed",
    "feature1_desc": "<p>Oli save gud ol prapa kastom mo kakarong blong ol aelan.</p>",
    "feature2_title": "Safe Transpot",
    "feature2_desc": "<p>Punctuality mo gudfala trak blong mekem trip i gud.</p>",
    "feature3_title": "Oganaesem folem Yu",
    "feature3_desc": "<p>Mifala i save jenisim program blong folem niid blong yu.</p>",
    "badge1": "100% Man Ples",
    "badge2": "Sefti Fas",
    "badge3": "Bes Praes",
    "badge4": "Eksperiens Gaed",
    "badge5": "Klin Trak",
    "badge6": "Frengli Haf"
  },
  "faq": {
    "faq1_q": "Ai mi nid blong pem advans?",
    "faq1_a": "No, yu save pem taem yu tekem sevis o onlaen.",
    "faq2_q": "Wanem i hapen sipos mi wantem kanselem bukings?",
    "faq2_a": "I fri blong kanselem bitim 48 haoa. Sipos i sot long hemi i gat smol fi.",
    "faq3_q": "Yu pikap long we?",
    "faq3_a": "Mifala pikap long evri hotela, resot, mo eapot long Port Vila.",
    "faq4_q": "Ol trak blong yu i gat ea-kon?",
    "faq4_a": "Yes! Evri trak i gat ea-kon, stamba blong yu filim gud.",
    "faq5_q": "I gat praevet o grup tura?",
    "faq5_a": "Mifala wokem tufala wangeta. Yu save jusum wanem i stret.",
    "faq6_q": "Hao mi kan kontactem yufala long ovasi?",
    "faq6_a": "WhatsApp +678 7342389 o acetoursvanuatu@outlook.com.",
    "faq7_q": "Wanem mane yu akseptem?",
    "faq7_a": "VUV (Vatu), AUD, mo NZD. Yu save pem online o kash."
  },
  "contact": {
    "page_title": "Kontaktem Mifala",
    "page_subtitle": "Kasem Mifala",
    "get_in_touch_desc": "Sapos yu gat kwestin, pliz kontaktem mifala naoia.",
    "phone_availability": "24/7 Sapot",
    "email_reply_time": "Mifala ansa kwik",
    "office_hours": "Open 8am kasem 5pm",
    "whatsapp_desc": "Klik blong toktok long WhatsApp"
  },
  "footer": {
    "description": "Nambawan opereta blong tura, transfa mo rentakem trak long Port Vila, Vanuatu.",
    "copyright": "Ol raet i stap wetem mifala."
  }
};

async function run() {
  console.log("Updating Bislama JSON...");
  const biPath = path.join(process.cwd(), "client/src/locales/bi.json");
  const biJson = fs.existsSync(biPath) ? JSON.parse(fs.readFileSync(biPath, "utf8")) : {};
  
  // Flatten to safely inject
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
  
  const biFlat = flattenObj(biJson);
  for (const [k, v] of Object.entries(biTranslations)) {
    biFlat[k] = v;
  }
  
  fs.writeFileSync(biPath, JSON.stringify(unflattenObj(biFlat), null, 2) + "\n");
  console.log("bi.json updated.");

  console.log("Updating Bislama CMS content...");
  const allCms = await db.select().from(cmsContent);
  const biCms = allCms.filter(c => c.locale === 'bi');
  const enCms = allCms.filter(c => c.locale === 'en');

  // Insert any CMS strings from translating our mapping
  let insertCount = 0;
  for (const [blockSlug, items] of Object.entries(cmsTranslations)) {
    for (const [contentKey, value] of Object.entries(items)) {
      // check if it exists in 'en' so we have proper types
      const enRef = enCms.find(e => e.blockSlug === blockSlug && e.contentKey === contentKey);
      const exists = biCms.some(c => c.blockSlug === blockSlug && c.contentKey === contentKey);
      
      if (!exists && enRef) {
        await db.insert(cmsContent).values({
          blockSlug,
          contentKey,
          contentType: enRef.contentType,
          value,
          locale: "bi"
        });
        insertCount++;
      }
    }
  }

  console.log(`Successfully added ${insertCount} Bislama CMS entries!`);
  process.exit(0);
}

run();
