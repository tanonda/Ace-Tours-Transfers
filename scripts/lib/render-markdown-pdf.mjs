// scripts/lib/render-markdown-pdf.mjs

/**
 * Renders a repository markdown document to a styled A4 PDF with headless Chrome.
 *
 * The markdown stays the single source of truth; this helper is shared by the
 * BRED setup sheet and test-evidence generators so both PDFs use the same look.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import MarkdownIt from "markdown-it";

const STYLE = `
  body { font: 10pt/1.38 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; }
  h1 { font-size: 19pt; margin: 0 0 6pt; border-bottom: 2px solid #e35205; padding-bottom: 6pt; }
  h2 { font-size: 12.5pt; margin: 13pt 0 5pt; color: #b4400f; page-break-after: avoid; }
  h3 { font-size: 11pt; margin: 12pt 0 4pt; page-break-after: avoid; }
  p, li { margin: 3pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 5pt 0 7pt; font-size: 8.5pt; }
  th, td { border: 1px solid #cfcfcf; padding: 3.5pt 5pt; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  code { font-family: "SF Mono", Consolas, "Liberation Mono", monospace; font-size: 9pt; background: #f2f2f2; padding: 1pt 3pt; border-radius: 2px; overflow-wrap: anywhere; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #fff7f0; border-left: 3px solid #e35205; page-break-inside: avoid; }
  blockquote p { margin: 2pt 0; }
  a { color: #0b5cad; text-decoration: none; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 14pt 0; }
  ul, ol { padding-left: 18pt; }
  blockquote, tr { page-break-inside: avoid; }
  .page-break { break-before: page; }
  .meta { color: #555; font-size: 9pt; }
`;

const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true });

function findChrome() {
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

/**
 * @param {{ mdPath: string, outPath: string, title: string, landscape?: boolean }} options
 */
export function renderMarkdownPdf({ mdPath, outPath, title, landscape = false }) {
  if (!existsSync(mdPath)) {
    throw new Error(`Missing markdown source: ${mdPath}`);
  }

  const page = landscape
    ? "@page { size: A4 landscape; margin: 11mm 11mm 12mm; }"
    : "@page { size: A4; margin: 14mm 14mm 16mm; }";
  const body = markdown.render(readFileSync(mdPath, "utf8"));
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${page}${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;

  const workDir = mkdtempSync(join(tmpdir(), "markdown-pdf-"));
  const htmlPath = join(workDir, "document.html");
  writeFileSync(htmlPath, html, "utf8");

  const chrome = findChrome();
  if (!chrome) {
    throw new Error("Chrome/Chromium not found. Install one, or print the HTML manually.");
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
    throw new Error("Chrome did not produce the PDF.");
  }

  return statSync(outPath).size;
}
