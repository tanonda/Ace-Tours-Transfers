#!/usr/bin/env node
/**
 * Builds docs/BRED_PAYZEN_BANK_SETUP_SHEET.pdf from the markdown source.
 *
 * The markdown file is the single source of truth; this script renders it to a
 * styled A4 PDF, so the copy emailed to BRED never drifts from the repo document.
 *
 * Usage: node scripts/generate-bred-setup-sheet-pdf.mjs
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdownPdf } from "./lib/render-markdown-pdf.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = join(root, "docs", "BRED_PAYZEN_BANK_SETUP_SHEET.md");
const outPath = join(root, "docs", "BRED_PAYZEN_BANK_SETUP_SHEET.pdf");

const bytes = renderMarkdownPdf({
  mdPath,
  outPath,
  title: "BRED Bank / Lyra PayZen — Setup Sheet",
});
console.log(`Wrote ${outPath} (${(bytes / 1024).toFixed(1)} KB) from ${mdPath}`);
