const fs = require("fs");
const path = require("path");

function walkSync(dir, filelist = []) {
    if (!fs.existsSync(dir)) return filelist;
    fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        if (fs.statSync(dirFile).isDirectory()) {
            if (!dirFile.includes("node_modules") && !dirFile.includes(".git")) {
                filelist = walkSync(dirFile, filelist);
            }
        } else {
            if (dirFile.endsWith(".ts") || dirFile.endsWith(".tsx")) {
                filelist.push(dirFile);
            }
        }
    });
    return filelist;
}

const files = walkSync("client/src");

for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    let changed = false;

    // Generic `any` parameters in array callbacks
    const regexes = [
        { from: /\.map\(\(tour \=>/g, to: ".map((tour: any) =>" },
        { from: /\.map\(\(t \=>/g, to: ".map((t: any) =>" },
        { from: /\.map\(\(transfer \=>/g, to: ".map((transfer: any) =>" },
        { from: /\.map\(\(vehicle \=>/g, to: ".map((vehicle: any) =>" },
        { from: /\.map\(\(item \=>/g, to: ".map((item: any) =>" },
        { from: /\.map\(\(p \=>/g, to: ".map((p: any) =>" },
        { from: /\.map\(\(v \=>/g, to: ".map((v: any) =>" },
        // comma index versions
        { from: /\.map\(\(tour, index\) =>/g, to: ".map((tour: any, index: number) =>" },
        { from: /\.map\(\(t, index\) =>/g, to: ".map((t: any, index: number) =>" },
        { from: /\.map\(\(transfer, index\) =>/g, to: ".map((transfer: any, index: number) =>" },
        { from: /\.map\(\(vehicle, index\) =>/g, to: ".map((vehicle: any, index: number) =>" },
        // Filters
        { from: /\.filter\(\(tour \=>/g, to: ".filter((tour: any) =>" },
        { from: /\.filter\(\(t \=>/g, to: ".filter((t: any) =>" },
        { from: /\.filter\(\(transfer \=>/g, to: ".filter((transfer: any) =>" },
        { from: /\.filter\(\(vehicle \=>/g, to: ".filter((vehicle: any) =>" },
        { from: /\.filter\(\(item \=>/g, to: ".filter((item: any) =>" },
        { from: /\.filter\(\(p \=>/g, to: ".filter((p: any) =>" },
        { from: /\.filter\(\(s \=>/g, to: ".filter((s: any) =>" },
        { from: /\.reduce<\w+>\(\(acc, current\) =>/g, to: ".reduce<any>((acc: any[], current: any) =>" }
    ];

    let newContent = content;
    for (const r of regexes) {
        newContent = newContent.replace(r.from, r.to);
    }

    if (newContent !== content) {
        fs.writeFileSync(file, newContent, "utf8");
    }
}

// Targeted fixes
function replaceRegexIn(file, regex, replaceStr) {
    if (!fs.existsSync(file)) return;
    let t = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, t.replace(regex, replaceStr));
}
// vehicle-detail icon imports again
replaceRegexIn("client/src/pages/vehicle-detail.tsx", /import\s*\{\s*Car\s*\}\s*from\s*["']lucide-react["'];/, "import { Car, Phone, Mail } from \"lucide-react\";");

// client/src/components/layout.tsx references to undefined products where it should be local arrays
replaceRegexIn("client/src/components/layout.tsx", /\{products\.map/g, "{tours.map");

// lib/api.ts missing imports
replaceRegexIn("client/src/lib/api.ts", /import type \{ ([^}]*) \} from "@shared\/schema";/, "import type { $1, Product } from \"@shared/schema\";");
replaceRegexIn("client/src/lib/api.ts", /tours\b/g, "products");

// admin components
replaceRegexIn("client/src/pages/admin/capacity-dashboard.tsx", /products\.length/g, "tours.length");
replaceRegexIn("client/src/pages/admin/capacity-dashboard.tsx", /products\.filter/g, "tours.filter");
replaceRegexIn("client/src/pages/admin/capacity-dashboard.tsx", /products\.find/g, "tours.find");

// Load test errors
replaceRegexIn("scripts/load-test.ts", /\bproducts\b(\s*\))/g, "products$1");

console.log("Cleanup pass 5");
