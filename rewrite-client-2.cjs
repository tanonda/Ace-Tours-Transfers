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

const files = [
    ...walkSync("client/src"),
    ...walkSync("scripts")
];

for (const file of files) {
    let content = fs.readFileSync(file, "utf8");

    // Specific failures from `tsc`
    content = content.replace(/tours\.id/g, "products.id");
    content = content.replace(/db\.select\(\)\.from\(tours\)/g, "db.select().from(products)");

    // Replace schema imports
    content = content.replace(/import\s*\{([^}]*)\bTour\b([^}]*)\}\s*from\s*["']@shared\/schema["']/g,
        (match, p1, p2) => `import {${p1}Product${p2}} from "@shared/schema"`);
    content = content.replace(/import\s*\{([^}]*)\bInsertTour\b([^}]*)\}\s*from\s*["']@shared\/schema["']/g,
        (match, p1, p2) => `import {${p1}InsertProduct${p2}} from "@shared/schema"`);
    content = content.replace(/import\s*\{([^}]*)\btours\b([^}]*)\}\s*from\s*["']@shared\/schema["']/g,
        (match, p1, p2) => `import {${p1}products${p2}} from "@shared/schema"`);

    // Schema imports with regex mapping across the entire line
    content = content.replace(/import\s+\{[^}]+\}\s+from\s+["'](?:\.\.\/)+shared\/schema(?:\.js)?["']/g, (match) => {
        let replaced = match.replace(/\btours\b/g, "products");
        replaced = replaced.replace(/\bTour\b/g, "Product");
        replaced = replaced.replace(/\bInsertTour\b/g, "InsertProduct");
        replaced = replaced.replace(/\binsertTourSchema\b/g, "insertProductSchema");
        return replaced;
    });

    // Client specifics
    content = content.replace(/=>\s*Tour/g, "=> Product");
    content = content.replace(/tour:\s*Tour/g, "tour: Product");
    content = content.replace(/t:\s*Tour/g, "t: Product");
    content = content.replace(/queryKey:\s*\["\/api\/tours"\]/g, "queryKey: [\"/api/tours\"]"); // Ensure this didn't break

    // Scripts specifics
    content = content.replace(/db\.delete\(tours\)/g, "db.delete(products)");
    content = content.replace(/db\.insert\(tours\)/g, "db.insert(products)");
    content = content.replace(/storage\.getTours\(/g, "storage.getProducts(");
    content = content.replace(/storage\.createTour\(/g, "storage.createProduct(");
    content = content.replace(/storage\.updateTour\(/g, "storage.updateProduct(");

    fs.writeFileSync(file, content);
}
console.log("Secondary cleanup complete");
