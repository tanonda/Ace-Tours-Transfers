import pg from "pg";

const { Client } = pg;
const DB_URL = "postgresql://neondb_owner:REDACTED@ep-delicate-king-am3aopbg-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";

const translations = [
  {
    "id": "e9e78832-10b0-4472-90ac-2cdffd44dc3b",
    "title": "Krus long San I Godaon long Havannah Harbour & Dina",
    "description": [
      "<p>Eksperiensem nambawan eksperiens long win mo solwota wetem wan kwaet krus taem san i godaon long klin wota blong Havannah Harbour, mo afta, kakae sfesel dina long saed blong bis aninit long ol sta.</p>",
      "<ul>",
      "<li>2 aoa krus lukluk san i godaon long Pasifik.</li>",
      "<li>Frii waen o lokol Tusker bia taem yu step nomo insaed long bot.</li>",
      "<li>Faenem turtel mo ol narfala samting blong solwota long kwaet wota blong haba.</li>",
      "<li>3 kos dina we i gat fres lokol siifud mo organik aelan mit.</li>",
      "</ul>"
    ]
  },
  {
    "id": "1bb5acf1-075d-4760-92da-20e2f427a3d3",
    "title": "Tua long Mele Cascades Waterfall",
    "description": [
      "<p>Go aot long taon mo go insaed long naesfala bus blong Vanuatu blong luk smat wota fal ia, Mele Cascades. Tua ia hemi tekem yu wokabaot long naesfala bus, kasem 35-mita waterfall.</p>",
      "<h3>Wanem Bae Yu Luk</h3>",
      "<ul>",
      "<li>Wokebaot wetem gaed thru long naesfala gadin mo bus.</li>",
      "<li>Swim long ol klin mo kul pul we wota i rastaon.</li>",
      "<li>Spesel ples blong lukluk bigfala wota fal daon.</li>",
      "<li>Rileks mo kakae plet we i fulap long ol fres aelan frut long saed blong reva.</li>",
      "</ul>"
    ]
  },
  {
    "id": "f915274d-5376-4f9c-a34f-69c09a5b84f1",
    "title": "Dei long Bis long Pele Aelan",
    "description": [
      "<p>Hae wei i go long nambawan paradaes wetem Tua blong Pele Aelan. I sot we nomo long bot stat long Not Efate, Pele Aelan i gat klin wota, naesfala korel blong go snokol long hem, mo waet sanbis.</p><ul><li>Bot blong go mo kambak i stap insaed long praes.</li><li>Gaed blong soemaot ol korel we gavman i protektem.</li><li>BBQ lanis long saed blong bis.</li><li>Frii taem blong rileks, swim, mo go wokabaot luk ol vilej.</li></ul>"
    ]
  },
  {
    "id": "8dd890db-8812-435f-be04-9a9882fe111c",
    "title": "Tua long Port Vila Taon mo Maket",
    "description": [
      "<p>Faenem ol ples mo lanem moa long main taon blong Vanuatu. Tua ia i tekem yu raon long ol maket, ol olfala ples, mo ples evriwan i stap go lukluk뷰 long Port Vila.</p>",
      "<ul>",
      "<li>Visitim kalafol 24/7 Port Vila Maket (Mama's Maket) blong faenem fres kakae mo ol kastom samting we ol lokol i strakem.</li>",
      "<li>Visitim Palamen Haos mo Nasonal Miusiam blong Vanuatu.</li>",
      "<li>Enjoyim lukluk long haba daon long Port Vila luk-aot ples.</li>",
      "<li>Sop long duty-free sipos yu wantem.</li>",
      "</ul>"
    ]
  },
  {
    "id": "f9be5daa-41e4-4cc3-a4ab-6076eda9add1",
    "title": "Praevet Bas blong Rentem",
    "description": [
      "Rentem Bas: Rentem wan praevet bas wetem draeva blong 5 kasem 8 aoa. Yu nomo jusum ol ples blong stop; mifala nomo soemaot aelan.",
      "Gud long ol Grup: Hemi best blong ol bigfala famili, weting, o eni grup we i wantem raon long aelan long ona taem blong olgeta."
    ]
  },
  {
    "id": "b321c7d5-7990-4084-b993-88da0724f593",
    "title": "Roots & Routes Kaltjoral Tua | Tesem Kava | Vilej Kastom",
    "description": [
      "Kastom Trip: Faenemaot \"Kastom\" wei blong laef long wan 4 kasem 5 aoa tua long vilij.",
      "Tru Kastom: Hemi gat wan gaed blong soem Kaltjoral Vilej, visit we i go long Kaltjoral Senta, mo wan walks go tru long ol tabu lif mo bus."
    ]
  },
  {
    "id": "36a21c27-a805-461f-8f42-ab4331cdd678",
    "title": "Dropem yu long Dina (Raon Trip)",
    "description": [
      "<p>Enjoyim naet we yu no nid blong wari long transpot. Mifala bae pikiap yu long hotel blong yu, dropem yu long resturon long Port Vila, mo tekem yu i gobak sef afta we yu kakae finis.</p>"
    ],
    "included_items": ["Transpot go mo kam", "Draeva we i save wok blong hem"],
    "excluded_items": ["Pei blong table long resturon"],
    "cancellation_policy": "Yu save kanselem frii bifo 12 aoa long taem we mifala kam pikiap yu."
  },
  {
    "id": "a4a59c53-ef06-4cd0-b62f-9196e459f855",
    "title": "Pakij blong Transpot long Ol Bigfala Iven",
    "description": [
      "<p>Mifala i proevaedem protranspot blong ol bigmak miting blong kampani, weting, mo ol bigfala grup blong man we i kam long Vanuatu. Mifala i gat plante bas blong mekem sua se evri man i kasem ples sef mo long taem stret.</p><ul><li>Man we i dil wetem evri transpot blong iven blong yu.</li><li>Plante niufala bas mo VIP van.</li><li>Yu save jenisim taem tebol mo wei olsem we yu wantem.</li></ul>"
    ]
  },
  {
    "id": "95c5c0f5-aaf4-41c3-b690-a952674114fd",
    "title": "Transpot i go long Havannah Harbour Resot",
    "description": [
      "<p>VIP transpot blong karim yu i godaon long nambawan resot we i stap long Not Efate (olsem The Havannah, Trees and Fishes, Gideon's Landing).</p>",
      "<p>Bae yu slakbak gud long kos we draeva i daarem 45 minit go daon. I gat gudfala lukluk long saed blong solwota. Wota blong dring i stap frii we i wet long yu.</p>"
    ]
  },
  {
    "id": "5241b26a-7fd5-4c9e-bc37-77c1ea48d123",
    "title": "Transpot i go long Hideaway Island Resot",
    "description": [
      "<p>Stret mo naesfala bas blong Port Vila Eapot o hotel i go long poynt blong feri long Mele Beach blong yu save gon Hideaway Island Resot.</p>",
      "<p>Kar blong mifala i gat AC insaed so bae yu filing kul taem yu startem holidei. Mifala i dil wetem man blong feri blong Hideaway Island we bae yu no nid blong westem taem wea yu stap wet.</p>"
    ]
  },
  {
    "id": "43297acd-0608-42bc-bb54-d2f32c97e014",
    "title": "Pakij blong Hospetaliti",
    "description": [
      "<p>Mifala i folem taem tebol blong yu nomo. Letem mifala pikiap yu mo dropem yu blong ol miting blong yu.</p><ul><li>I nambawan blong ol man blong ofis we i kam afsaed.</li><li>Stat long VT 25,000 - i karem bas mo draeva finis (5 kasem 8 aoa).</li><li>Spesel: VT 18,000 sipos yufala i blong NGO blong karem we yu stap ful dei.</li></ul>"
    ]
  },
  {
    "id": "214d8d80-f909-4e5f-a96f-c18a049b6f4e",
    "title": "VIP Transpot blong Ol Bigman",
    "description": [
      "Praevet VIP transpot",
      "Mit mo greet lida",
      "Waet taoel o kol taoel wit wota we lida givim"
    ],
    "included_items": ["Praevet VIP transpot", "Mit mo greet", "Kol taoel mo wota", "Wi-Fi insaed"],
    "excluded_items": ["Presen mane (Gratuity)"],
    "cancellation_policy": "Kanselem frii bifo 48 aoa. I no save tekem bak peimen witim 48 aoa."
  },
  {
    "id": "445b3808-fbee-4a9b-9aaa-73fe30b350e0",
    "title": "Transpot i kam long Wof / Krus Sip",
    "description": [
      "<p>Kam insaed long Krus Sip? Letem mifala wekem gud taem blong yu taem mifala save mekem kuik pikiap long wof we sip i stop. Mifala bae dropem yu stret long taon o aenap long ol tua.</p>"
    ],
    "included_items": ["Bas wetem AC", "Bae oli helpem karem ol bag"],
    "cancellation_policy": "Kanselem frii bifo 24 aoa."
  },
  {
    "id": "602f6517-8f99-4e2d-9316-e803f40957b4",
    "title": "✈️ VIP Transpot long Eapot",
    "description": [
      "<p>Eksperiensem bestfala wei blong transpot tru long VIP transpot blong Eapot blong yumi. Kam olsem waetman insaed long wan VIP kar we i gat fri waota, Wi-Fi, mo draeva blong soem rispek.</p>"
    ],
    "included_items": ["Kar we i gat AC", "Welikamim stret long doa blong eapot", "Help karem bag"],
    "excluded_items": ["Wet antap long 30 minit"],
    "cancellation_policy": "Frii kanseleson sipos i no kasem 24 aoa jet. Haf pei (50%) sipos i let."
  },
  {
    "id": "8ffdeaab-f076-4355-9ded-f00a937b4d42",
    "title": "Minibas blong 15 Man",
    "description": [
      "<p>Yu stap travil wetem famili grup o weting o paty? Minibas blong 15 man i spesies inaf blong let evriwan trabol wanples.</p>",
      "<ul>",
      "<li>Wanem i gat: Manual/Oto i dipen long wanem i sapotem, 2 AC we blou moa pawa, speis long kiamman.</li>",
      "<li>Sita: Bitim 15 man. Trailer blong karem hae load bae yu mas putim preorda if yu yusum long eapot runs.</li>",
      "<li>Note: Hem i nidim drving laesens we i fit long big bus o yu save rentem wetem lokal draeva.</li>",
      "</ul>"
    ]
  },
  {
    "id": "523c4a7d-5140-4ef9-a128-0ba442ada650",
    "title": "Rentem Bas blong ful dei",
    "description": [
      "Rentem bas blong ful dei (olsem 5 kasem 8 aoa)",
      "Jusum stop we yu wantem go",
      "Kafé o snak we kam wetem bas",
      "Bae yu nomo blong pem ol entrens fis blong tua"
    ]
  },
  {
    "id": "dc445dd1-5653-444e-99c3-c81106e2f60a",
    "title": "Ford Ranger Wildtrak",
    "description": [
      "No-wori, wan strong 4WD",
      "Ol sil insaed blong letha",
      "Top brand insaed long trak"
    ]
  },
  {
    "id": "b3057338-9b8e-4840-aff7-ceba8eed407d",
    "title": "Hyundai Grand i10",
    "description": [
      "<p>Hyundai Grand i10 i perfik trak we no big tumas mo izi blong muv long Port Vila o long rot saed solota long Efate. I saevm gud fiul, izi blong pakem, mo speisis gud blong man.</p><ul><li>5 doa kadi</li><li>Oto Transmisin</li><li>Air Konition</li><li>4 man save sita rileks gud</li><li>Blutut</li></ul>"
    ]
  },
  {
    "id": "3b0428ff-2f1f-49fa-a07b-72814972e151",
    "title": "Kia Cerato Sedan",
    "description": [
      "Smatfala kar blong ful famili",
      "I ron smood sipos yufala i round-island go raon",
      "Bigfala boot i stap behin"
    ]
  },
  {
    "id": "a9ebfa1d-7734-49a1-8a28-d2ecbbbd26f4",
    "title": "Suzuki Jimny",
    "description": [
      "Smat, fan 4WD",
      "Stael blong aelan",
      "Kar blong go evriwhia"
    ]
  },
  {
    "id": "925a00cb-7aef-4b2f-9934-3a16ebd46fc5",
    "title": "Toyota Hiace Bas",
    "description": [
      "12-man mini bas",
      "Gud long ol big grup",
      "Spesel mo bigfala ruang we yu haremgud"
    ]
  },
  {
    "id": "db634559-5fdc-4e8b-9a49-d7d7ec6d5dbd",
    "title": "Toyota Hilux 4WD",
    "description": [
      "Trasti 4WD piackup truk",
      "Nambawan taem we yu drv long ol aelan rong road",
      "Insurans i pei finis i kam wetem trak"
    ],
    "included_items": [
      "Ful insignans",
      "Drive evriwer",
      "Halp sipos yu bräk dowun"
    ],
    "excluded_items": [
      "Bensin of Fiul",
      "Faen blong polism"
    ],
    "cancellation_policy": "Frii cancel bifo 48 awas. Haf pei inside 48 awas."
  },
  {
    "id": "ef2a01bf-dbf8-4e4f-b8d9-7b6b7d0746c1",
    "title": "Toyota Prado SUV (7-Sita)",
    "description": [
      "<p>Nambawan trak blong hol famili faenemaout ples mo travil. Eksperiens rodd sae blong Vanuatu sef mo long comfot. I gat AC inside gud.</p>",
      "<ul>",
      "<li>Wanem i gat: Oto Transmisin, 4WD powa, AC bloumo, blutut radio.</li>",
      "<li>Sita: 7 man save sit (O 5 man we karim plenti bags).</li>",
      "<li>Nambawan blong wokem roud aelan run o draf blong fainem wite beach long gudfala style.</li>",
      "</ul>"
    ]
  }
];

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  for (const t of translations) {
    const included = t.included_items ? JSON.stringify(t.included_items) : null;
    const excluded = t.excluded_items ? JSON.stringify(t.excluded_items) : null;
    const desc = t.description ? t.description : null;
    const policy = t.cancellation_policy || null;

    let query = `
      INSERT INTO product_translations (product_id, locale, title, description, included_items, excluded_items, cancellation_policy, updated_at)
      VALUES ($1, 'bi', $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (product_id, locale) DO UPDATE SET
        title = $2, description = $3, included_items = $4, excluded_items = $5, cancellation_policy = $6, updated_at = NOW()
    `;
    await client.query(query, [t.id, t.title, desc, included, excluded, policy]);
    console.log("✅ Inserted Bislama translation for:", t.title);
  }

  await client.end();
}
main();
