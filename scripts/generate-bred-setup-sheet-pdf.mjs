#!/usr/bin/env node
/**
 * Builds docs/BRED_PAYZEN_BANK_SETUP_SHEET.pdf from the markdown source.
 *
 * The markdown file is the single source of truth; this script renders it to a
 * styled A4 HTML page and prints it with headless Chrome, so the PDF emailed to
 * BRED never drifts from the document in the repo.
 *
 * Usage: node scripts/generate-bred-setup-sheet-pdf.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = join(root, "docs", "BRED_PAYZEN_BANK_SETUP_SHEET.md");
const outPath = join(root, "docs", "BRED_PAYZEN_BANK_SETUP_SHEET.pdf");

if (!existsSync(mdPath)) {
  console.error(`Missing source: ${mdPath}`);
  process.exit(1);
}

const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true });
const body = markdown.render(readFileSync(mdPath, "utf8"));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BRED Bank / Lyra PayZen — Setup Sheet</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  body { font: 10pt/1.38 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; }
  h1 { font-size: 19pt; margin: 0 0 6pt; border-bottom: 2px solid #e35205; padding-bottom: 6pt; }
  h2 { font-size: 12.5pt; margin: 13pt 0 5pt; color: #b4400f; page-break-after: avoid; }
  h3 { font-size: 11pt; margin: 12pt 0 4pt; page-break-after: avoid; }
  p, li { margin: 3pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 5pt 0 7pt; font-size: 9pt; }
  th, td { border: 1px solid #cfcfcf; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  code { font-family: "SF Mono", Consolas, "Liberation Mono", monospace; font-size: 9pt; background: #f2f2f2; padding: 1pt 3pt; border-radius: 2px; overflow-wrap: anywhere; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #fff7f0; border-left: 3px solid #e35205; page-break-inside: avoid; }
  blockquote p { margin: 2pt 0; }
  a { color: #0b5cad; text-decoration: none; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 14pt 0; }
  ul { padding-left: 16pt; }
  table, blockquote, tr { page-break-inside: avoid; }
</style>
</head>
<body>
${body}
</body>
</html>`;

const workDir = mkdtempSync(join(tmpdir(), "bred-setup-sheet-"));
const htmlPath = join(workDir, "setup.html");
writeFileSync(htmlPath, html, "utf8");

const chrome = [
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
].find((candidate) => existsSync(candidate));

if (!chrome) {
  console.error("Chrome/Chromium not found. Install one, or print the HTML manually.");
  process.exit(1);
}

execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--user-data-dir=${workDir}`,
    "--no-pdf-header-footer",
    `--print-to-pdf=${outPath}`,
    `file://${htmlPath}`,
  ],
  { stdio: "inherit" },
);

if (!existsSync(outPath)) {
  console.error("Chrome did not produce the PDF.");
  process.exit(1);
}

const kb = statSync(outPath).size / 1024;
console.log(`Wrote ${outPath} (${kb.toFixed(1)} KB) from ${mdPath}`);
