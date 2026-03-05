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
            if (dirFile.endsWith('.ts') || dirFile.endsWith('.tsx')) {
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
    let changed = false;

    // Replace type imports from schema
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*["'](?:@\/|(?:\.\.\/)+)[^"']*shared\/schema["']/g;
    content = content.replace(importRegex, (match, imports) => {
        let replaced = imports;
        replaced = replaced.replace(/\bTour\b/g, "Product");
        replaced = replaced.replace(/\bInsertTour\b/g, "InsertProduct");
        replaced = replaced.replace(/\binsertTourSchema\b/g, "insertProductSchema");
        replaced = replaced.replace(/\btours\b/g, "products");

        if (replaced !== imports) changed = true;
        return match.replace(imports, replaced);
    });

    // Replace component Tour type definitions
    const typeDefRegex = /(?:type|interface)\s+\w+\s*(?:extends|=\s*\{)[\s\S]*?(?:Tour|InsertTour)[\s\S]*?\}/g;
    // Actually, blind replacement inside the whole file is safer for type usages:
    const newContent = content
        .replace(/<Tour(?:\[\])?>/g, "<Product>")
        .replace(/<Product(?:\[\])?>/g, (m) => m) // avoid double replace if ran twice
        .replace(/:\s*Tour\b/g, ": Product")
        .replace(/:\s*Tour\[\]/g, ": Product[]")
        .replace(/:\s*InsertTour\b/g, ": InsertProduct")
        .replace(/\bTour(?=\s*\|)/g, "Product") // type A = Tour | undefined
        .replace(/\bInsertTour(?=\s*\|)/g, "InsertProduct")

        // React Query typings
        .replace(/useQuery<Tour\[\]/g, "useQuery<Product[]")
        .replace(/useQuery<Tour/g, "useQuery<Product")
        .replace(/useMutation<Tour/g, "useMutation<Product")

        // Validation schemas usage
        .replace(/\binsertTourSchema\b/g, "insertProductSchema")

        // Script specific `storage.*Tour` bindings
        .replace(/storage\.getTours\(/g, "storage.getProducts(")
        .replace(/storage\.getTour\(/g, "storage.getProduct(")
        .replace(/storage\.getTourByTitle\(/g, "storage.getProductByTitle(")
        .replace(/storage\.createTour\(/g, "storage.createProduct(")
        .replace(/storage\.updateTour\(/g, "storage.updateProduct(")
        .replace(/storage\.deleteTour\(/g, "storage.deleteProduct(");

    if (newContent !== content || changed) {
        fs.writeFileSync(file, newContent, "utf8");
    }
}

console.log("Client and scripts type rewrite complete.");
