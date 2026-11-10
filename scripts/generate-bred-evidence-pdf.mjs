#!/usr/bin/env node
/**
 * Builds docs/BRED_TEST_EVIDENCE.pdf from the markdown source.
 *
 * Landscape A4: the evidence table has many columns and is meant to be printed
 * and signed. The markdown file stays the single source of truth.
 *
 * Usage: node scripts/generate-bred-evidence-pdf.mjs
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdownPdf } from "./lib/render-markdown-pdf.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = join(root, "docs", "BRED_TEST_EVIDENCE.md");
const outPath = join(root, "docs", "BRED_TEST_EVIDENCE.pdf");

const bytes = renderMarkdownPdf({
  mdPath,
  outPath,
  title: "BRED PayZen — TEST Evidence & Endpoint Checks",
  landscape: true,
});
console.log(`Wrote ${outPath} (${(bytes / 1024).toFixed(1)} KB) from ${mdPath}`);
