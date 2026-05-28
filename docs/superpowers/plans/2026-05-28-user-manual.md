# User Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a PDF user manual for people managing the Ace Tours website, authored in Markdown so Phase 2 (in-app help) can reuse the same content.

**Architecture:** Markdown source files in `docs/user-manual/` (organised into `workflows/` and `reference/`) are concatenated by a Node build script (`scripts/build-user-manual.ts`) and rendered to a single PDF via `md-to-pdf` with custom CSS. Each chapter's YAML frontmatter (roles, screen, last_updated) drives in-PDF role tags and the future Phase-2 help drawer.

**Tech Stack:** TypeScript, tsx, md-to-pdf, gray-matter, vitest, Node ESM.

**Spec:** [docs/superpowers/specs/2026-05-28-user-manual-design.md](../specs/2026-05-28-user-manual-design.md)

---

## Phase 1 — Project setup

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

Run: `npm install --save-dev md-to-pdf gray-matter chokidar`

Expected: `package.json` and `package-lock.json` updated. `md-to-pdf` bundles a headless Chromium via Puppeteer; first install may take ~60 seconds.

- [ ] **Step 2: Verify install**

Run: `npx md-to-pdf --version`

Expected: prints a version number, no error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add md-to-pdf, gray-matter, chokidar for user manual build"
```

---

### Task 2: Create directory structure and gitignore entry

**Files:**
- Create: `docs/user-manual/` and subdirectories (placeholder `.gitkeep` files)
- Modify: `.gitignore`

- [ ] **Step 1: Create directory tree**

Run:
```bash
mkdir -p docs/user-manual/workflows
mkdir -p docs/user-manual/reference
mkdir -p docs/user-manual/images/workflows
mkdir -p docs/user-manual/images/reference
mkdir -p docs/user-manual/style
mkdir -p docs/user-manual/dist
touch docs/user-manual/workflows/.gitkeep
touch docs/user-manual/reference/.gitkeep
touch docs/user-manual/images/workflows/.gitkeep
touch docs/user-manual/images/reference/.gitkeep
```

- [ ] **Step 2: Update .gitignore to exclude built PDFs**

Add this line to `.gitignore` (find the existing `dist` entry — it currently excludes the top-level `dist/`, but the user-manual `dist/` is a different path):

```
# User manual built PDFs (generated)
docs/user-manual/dist/
```

- [ ] **Step 3: Commit**

```bash
git add docs/user-manual/ .gitignore
git commit -m "chore: scaffold docs/user-manual directory tree"
```

---

### Task 3: Add npm scripts and wire vitest

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add manual build scripts to package.json**

In `package.json`, add to the `"scripts"` object (preserve alphabetical/logical order with sibling entries):

```json
"docs:manual:build": "tsx scripts/build-user-manual.ts",
"docs:manual:watch": "tsx scripts/build-user-manual.ts --watch"
```

- [ ] **Step 2: Include scripts tests in vitest config**

Modify `vitest.config.ts` `include` array:

```ts
include: [
  'server/**/*.test.ts',
  'shared/**/*.test.ts',
  'scripts/**/*.test.ts',
],
```

- [ ] **Step 3: Verify vitest sees no failing tests yet**

Run: `npm test`

Expected: existing tests pass (or report current baseline). No new tests yet — scripts/ has no `.test.ts` files.

- [ ] **Step 4: Commit**

```bash
git add package.json vitest.config.ts
git commit -m "chore: add docs:manual:build script and include scripts in vitest"
```

---

## Phase 2 — Build script (TDD)

The build script reads `manual.config.json`, parses each chapter's frontmatter via gray-matter, injects role tags as HTML, rewrites image paths, warns on stale content, concatenates everything, and renders to PDF via `md-to-pdf`.

### Task 4: Define manual.config.json and Chapter type

**Files:**
- Create: `docs/user-manual/manual.config.json`
- Create: `scripts/build-user-manual.ts`
- Create: `scripts/build-user-manual.test.ts`

- [ ] **Step 1: Create manual.config.json with version and chapter order**

Create `docs/user-manual/manual.config.json`:

```json
{
  "title": "Ace Tours Manager Manual",
  "subtitle": "Phase 1 — Owner / Operator / Admin",
  "version": "1.0.0",
  "buildDate": null,
  "cover": "00-cover.md",
  "introduction": "01-introduction.md",
  "gettingStarted": "02-getting-started.md",
  "workflows": [
    "workflows/01-taking-bookings.md",
    "workflows/02-cancellations-refunds.md",
    "workflows/03-closing-dates-blackouts.md",
    "workflows/04-managing-capacity.md",
    "workflows/05-editing-website-content.md",
    "workflows/06-pricing-and-promotions.md",
    "workflows/07-managing-tours-and-transfers.md",
    "workflows/08-reports-and-performance.md",
    "workflows/09-staff-and-user-access.md",
    "workflows/10-reading-audit-logs.md"
  ],
  "reference": [
    "reference/dashboard.md",
    "reference/bookings.md",
    "reference/calendar.md",
    "reference/capacity-dashboard.md",
    "reference/blackouts.md",
    "reference/products.md",
    "reference/pricing.md",
    "reference/cms.md",
    "reference/promotions.md",
    "reference/reports-analytics.md",
    "reference/deferred-screens.md"
  ]
}
```

- [ ] **Step 2: Create the build script entry file with types**

Create `scripts/build-user-manual.ts` with the type definitions and a stub entrypoint:

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export interface ManualConfig {
  title: string;
  subtitle: string;
  version: string;
  buildDate: string | null;
  cover: string;
  introduction: string;
  gettingStarted: string;
  workflows: string[];
  reference: string[];
}

export interface ChapterFrontmatter {
  title: string;
  roles?: string[];
  screen?: string;
  last_updated?: string;
  order?: number;
}

export interface Chapter {
  sourcePath: string;
  frontmatter: ChapterFrontmatter;
  body: string;
}

export async function loadConfig(configPath: string): Promise<ManualConfig> {
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw) as ManualConfig;
}

export async function parseChapter(absPath: string): Promise<Chapter> {
  const raw = await readFile(absPath, 'utf8');
  const parsed = matter(raw);
  return {
    sourcePath: absPath,
    frontmatter: parsed.data as ChapterFrontmatter,
    body: parsed.content,
  };
}

async function main() {
  // Wired in Task 9.
  console.log('build-user-manual: not yet implemented');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

- [ ] **Step 3: Create the test file with a passing config-load test**

Create `scripts/build-user-manual.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './build-user-manual';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(HERE, '..', 'docs', 'user-manual', 'manual.config.json');

describe('loadConfig', () => {
  it('reads manual.config.json and returns typed config', async () => {
    const cfg = await loadConfig(CONFIG_PATH);
    expect(cfg.title).toBe('Ace Tours Manager Manual');
    expect(cfg.version).toBe('1.0.0');
    expect(cfg.workflows).toHaveLength(10);
    expect(cfg.reference).toHaveLength(11);
  });
});
```

Note: `import.meta.url` is used because the project is ESM (`"type": "module"` in package.json), where `__dirname` is undefined.

- [ ] **Step 4: Run the test**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/user-manual/manual.config.json scripts/build-user-manual.ts scripts/build-user-manual.test.ts
git commit -m "feat(manual): add manual.config.json and config loader with test"
```

---

### Task 5: Parse chapter frontmatter

**Files:**
- Modify: `scripts/build-user-manual.test.ts`
- (use `scripts/build-user-manual.ts:parseChapter` from Task 4)

- [ ] **Step 1: Write a failing test for parseChapter**

Append to `scripts/build-user-manual.test.ts`:

```ts
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { parseChapter } from './build-user-manual';

describe('parseChapter', () => {
  it('extracts frontmatter fields and body from a markdown file', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'manual-test-'));
    const file = path.join(tmp, 'sample.md');
    await writeFile(file, [
      '---',
      'title: Sample Chapter',
      'roles: [Operator, Owner]',
      'screen: bookings',
      'last_updated: 2026-05-28',
      'order: 1',
      '---',
      '',
      '## Hello',
      'body content',
    ].join('\n'));

    const chapter = await parseChapter(file);
    expect(chapter.frontmatter.title).toBe('Sample Chapter');
    expect(chapter.frontmatter.roles).toEqual(['Operator', 'Owner']);
    expect(chapter.frontmatter.screen).toBe('bookings');
    expect(chapter.frontmatter.last_updated).toBe('2026-05-28');
    expect(chapter.body.trim().startsWith('## Hello')).toBe(true);

    await rm(tmp, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test (already implemented in Task 4, expect PASS)**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: both tests PASS. (`parseChapter` was implemented in Task 4 — this test confirms it.)

- [ ] **Step 3: Commit**

```bash
git add scripts/build-user-manual.test.ts
git commit -m "test(manual): cover parseChapter with frontmatter and body extraction"
```

---

### Task 6: Render role-tag HTML from frontmatter

**Files:**
- Modify: `scripts/build-user-manual.ts`
- Modify: `scripts/build-user-manual.test.ts`

- [ ] **Step 1: Write a failing test for renderRoleTags**

Append to `scripts/build-user-manual.test.ts`:

```ts
import { renderRoleTags } from './build-user-manual';

describe('renderRoleTags', () => {
  it('renders an empty string when no roles are present', () => {
    expect(renderRoleTags(undefined)).toBe('');
    expect(renderRoleTags([])).toBe('');
  });

  it('renders an HTML span per role with uppercase label', () => {
    const html = renderRoleTags(['Operator', 'Owner']);
    expect(html).toContain('<span class="role-tag role-tag-operator">OPERATOR</span>');
    expect(html).toContain('<span class="role-tag role-tag-owner">OWNER</span>');
    expect(html.startsWith('<div class="role-tags">')).toBe(true);
    expect(html.endsWith('</div>')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: FAIL with "renderRoleTags is not a function".

- [ ] **Step 3: Implement renderRoleTags**

Append to `scripts/build-user-manual.ts`:

```ts
export function renderRoleTags(roles: string[] | undefined): string {
  if (!roles || roles.length === 0) return '';
  const pills = roles
    .map((role) => {
      const slug = role.toLowerCase();
      return `<span class="role-tag role-tag-${slug}">${role.toUpperCase()}</span>`;
    })
    .join(' ');
  return `<div class="role-tags">${pills}</div>`;
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: PASS (all three groups).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-user-manual.ts scripts/build-user-manual.test.ts
git commit -m "feat(manual): render role-tag pills from frontmatter"
```

---

### Task 7: Rewrite image paths to absolute

**Files:**
- Modify: `scripts/build-user-manual.ts`
- Modify: `scripts/build-user-manual.test.ts`

Why this is needed: md-to-pdf renders Markdown to HTML via headless Chromium, which fetches images by URL. Relative paths like `../images/workflows/01.png` only resolve correctly when the working directory matches the chapter location — which it won't after concatenation. We convert to `file://` absolute URLs.

- [ ] **Step 1: Write a failing test for rewriteImagePaths**

Append to `scripts/build-user-manual.test.ts`:

```ts
import { rewriteImagePaths } from './build-user-manual';

describe('rewriteImagePaths', () => {
  it('rewrites a relative image path to an absolute file:// URL', () => {
    const chapterAbsDir = '/abs/docs/user-manual/workflows';
    const md = '![alt](../images/workflows/01-new-booking.png)';
    const out = rewriteImagePaths(md, chapterAbsDir);
    expect(out).toBe('![alt](file:///abs/docs/user-manual/images/workflows/01-new-booking.png)');
  });

  it('leaves absolute http(s) and file:// URLs untouched', () => {
    const md = '![a](https://example.com/x.png) ![b](file:///already/abs.png)';
    expect(rewriteImagePaths(md, '/abs/docs/user-manual/workflows')).toBe(md);
  });

  it('rewrites multiple images in one chapter', () => {
    const md = '![a](../images/workflows/a.png) and ![b](../images/workflows/b.png)';
    const out = rewriteImagePaths(md, '/abs/docs/user-manual/workflows');
    expect(out).toContain('file:///abs/docs/user-manual/images/workflows/a.png');
    expect(out).toContain('file:///abs/docs/user-manual/images/workflows/b.png');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: FAIL with "rewriteImagePaths is not a function".

- [ ] **Step 3: Implement rewriteImagePaths**

Append to `scripts/build-user-manual.ts`:

```ts
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function rewriteImagePaths(markdown: string, chapterAbsDir: string): string {
  return markdown.replace(MARKDOWN_IMAGE_RE, (match, alt: string, src: string) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('file://')) {
      return match;
    }
    const absolute = path.resolve(chapterAbsDir, src);
    return `![${alt}](file://${absolute})`;
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-user-manual.ts scripts/build-user-manual.test.ts
git commit -m "feat(manual): rewrite relative image paths to absolute file:// URLs"
```

---

### Task 8: Stale-content warning

**Files:**
- Modify: `scripts/build-user-manual.ts`
- Modify: `scripts/build-user-manual.test.ts`

- [ ] **Step 1: Write a failing test for findStaleChapters**

Append to `scripts/build-user-manual.test.ts`:

```ts
import { findStaleChapters } from './build-user-manual';

describe('findStaleChapters', () => {
  const today = new Date('2026-05-28');

  it('returns chapters with last_updated older than 6 months', () => {
    const chapters: Chapter[] = [
      { sourcePath: 'a.md', frontmatter: { title: 'A', last_updated: '2025-10-01' }, body: '' },
      { sourcePath: 'b.md', frontmatter: { title: 'B', last_updated: '2026-04-01' }, body: '' },
      { sourcePath: 'c.md', frontmatter: { title: 'C', last_updated: '2025-01-01' }, body: '' },
    ];
    const stale = findStaleChapters(chapters, today);
    expect(stale.map((c) => c.frontmatter.title)).toEqual(['A', 'C']);
  });

  it('treats missing last_updated as not stale (avoid noise on new chapters)', () => {
    const chapters: Chapter[] = [
      { sourcePath: 'a.md', frontmatter: { title: 'A' }, body: '' },
    ];
    expect(findStaleChapters(chapters, today)).toEqual([]);
  });
});
```

Note: the test imports the `Chapter` type — re-export it from the build script if necessary, or import inline.

- [ ] **Step 2: Run the test**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: FAIL with "findStaleChapters is not a function".

- [ ] **Step 3: Implement findStaleChapters**

Append to `scripts/build-user-manual.ts`:

```ts
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export function findStaleChapters(chapters: Chapter[], today: Date = new Date()): Chapter[] {
  return chapters.filter((c) => {
    const ts = c.frontmatter.last_updated;
    if (!ts) return false;
    const updated = new Date(ts);
    if (Number.isNaN(updated.getTime())) return false;
    return today.getTime() - updated.getTime() > SIX_MONTHS_MS;
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-user-manual.ts scripts/build-user-manual.test.ts
git commit -m "feat(manual): warn on chapters older than 6 months"
```

---

### Task 9: Compose chapters and integrate md-to-pdf

**Files:**
- Modify: `scripts/build-user-manual.ts`

This task wires the pieces together. The output is verified by running the actual build in Task 16 (smoke build), not by a unit test — md-to-pdf launches Chromium, which is heavy and flaky inside vitest.

- [ ] **Step 1: Implement composeManual()**

Append to `scripts/build-user-manual.ts`:

```ts
export function composeManual(config: ManualConfig, chapters: Chapter[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const cover = chapters.find((c) => c.sourcePath.endsWith(config.cover));
  const intro = chapters.find((c) => c.sourcePath.endsWith(config.introduction));
  const getting = chapters.find((c) => c.sourcePath.endsWith(config.gettingStarted));
  const workflowChapters = config.workflows
    .map((rel) => chapters.find((c) => c.sourcePath.endsWith(rel)))
    .filter((c): c is Chapter => Boolean(c));
  const referenceChapters = config.reference
    .map((rel) => chapters.find((c) => c.sourcePath.endsWith(rel)))
    .filter((c): c is Chapter => Boolean(c));

  const parts: string[] = [];

  if (cover) {
    parts.push(`<div class="cover">
      <h1>${config.title}</h1>
      <p class="subtitle">${config.subtitle}</p>
      <p class="version">Version ${config.version} — ${today}</p>
    </div>`);
    parts.push(renderChapterBody(cover));
    parts.push('<div class="page-break"></div>');
  }

  for (const c of [intro, getting].filter(Boolean) as Chapter[]) {
    parts.push(renderChapterBody(c));
    parts.push('<div class="page-break"></div>');
  }

  parts.push('<h1 class="section-divider">Part I — Workflows</h1>');
  parts.push('<div class="page-break"></div>');
  for (const c of workflowChapters) {
    parts.push(renderChapterBody(c));
    parts.push('<div class="page-break"></div>');
  }

  parts.push('<h1 class="section-divider">Part II — Screen Reference</h1>');
  parts.push('<div class="page-break"></div>');
  for (const c of referenceChapters) {
    parts.push(renderChapterBody(c));
    parts.push('<div class="page-break"></div>');
  }

  return parts.join('\n\n');
}

function renderChapterBody(chapter: Chapter): string {
  const chapterDir = path.dirname(chapter.sourcePath);
  const rolePills = renderRoleTags(chapter.frontmatter.roles);
  const title = chapter.frontmatter.title ? `# ${chapter.frontmatter.title}\n\n` : '';
  const rewritten = rewriteImagePaths(chapter.body, chapterDir);
  return `${rolePills}\n${title}${rewritten}`.trim();
}
```

- [ ] **Step 2: Implement main() with md-to-pdf**

Replace the stub `main()` in `scripts/build-user-manual.ts` with:

```ts
import { mdToPdf } from 'md-to-pdf';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(__filename), '..');
  const manualRoot = path.join(repoRoot, 'docs', 'user-manual');
  const configPath = path.join(manualRoot, 'manual.config.json');
  const cssPath = path.join(manualRoot, 'style', 'manual.css');
  const distDir = path.join(manualRoot, 'dist');

  const config = await loadConfig(configPath);
  const allRelPaths = [
    config.cover,
    config.introduction,
    config.gettingStarted,
    ...config.workflows,
    ...config.reference,
  ];

  const chapters: Chapter[] = [];
  for (const rel of allRelPaths) {
    const abs = path.join(manualRoot, rel);
    if (!existsSync(abs)) {
      console.warn(`[skip] missing chapter: ${rel}`);
      continue;
    }
    chapters.push(await parseChapter(abs));
  }

  const stale = findStaleChapters(chapters);
  if (stale.length > 0) {
    console.warn(`[stale] ${stale.length} chapter(s) older than 6 months:`);
    for (const c of stale) {
      console.warn(`  - ${path.relative(manualRoot, c.sourcePath)} (last_updated: ${c.frontmatter.last_updated})`);
    }
  }

  const composed = composeManual(config, chapters);
  const css = existsSync(cssPath) ? await readFile(cssPath, 'utf8') : '';
  const outFile = path.join(distDir, `Ace-Tours-User-Manual-v${config.version}.pdf`);

  const result = await mdToPdf(
    { content: composed },
    {
      dest: outFile,
      css,
      pdf_options: {
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#666;">
          ${config.title} — v${config.version} — page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
        headerTemplate: '<div></div>',
      },
    },
  );

  if (!result) {
    throw new Error('md-to-pdf produced no result');
  }
  console.log(`[ok] built ${outFile}`);
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit scripts/build-user-manual.ts`

Expected: no errors. (If `md-to-pdf` lacks types, add `@ts-expect-error` on the import line or install `@types/md-to-pdf` if available.)

- [ ] **Step 4: Run vitest to confirm nothing broke**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: all earlier tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-user-manual.ts
git commit -m "feat(manual): compose chapters and integrate md-to-pdf"
```

---

### Task 10: Add --watch mode

**Files:**
- Modify: `scripts/build-user-manual.ts`

- [ ] **Step 1: Add watch mode to main()**

Modify the end of `scripts/build-user-manual.ts` so the entrypoint detects `--watch`:

```ts
import chokidar from 'chokidar';

async function runOnce() {
  // Move the body of the current main() into runOnce()
  // (Keep everything from `const __filename` through the final `console.log(...)`.)
}

async function main() {
  await runOnce();
  if (process.argv.includes('--watch')) {
    const __filename = fileURLToPath(import.meta.url);
    const manualRoot = path.resolve(path.dirname(__filename), '..', 'docs', 'user-manual');
    console.log(`[watch] watching ${manualRoot} for changes`);
    chokidar.watch(manualRoot, { ignored: /dist/, ignoreInitial: true }).on('all', async (event, file) => {
      console.log(`[watch] ${event}: ${path.relative(manualRoot, file)} — rebuilding`);
      try {
        await runOnce();
      } catch (err) {
        console.error('[watch] build failed:', err);
      }
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

- [ ] **Step 2: Smoke-test watch mode (manual)**

Run: `npm run docs:manual:watch &`

Expected: prints `[watch] watching ...` and exits when killed. (The build itself will fail because content files don't exist yet — that's fine, we're only testing the watcher wiring.)

Kill with `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add scripts/build-user-manual.ts
git commit -m "feat(manual): add --watch mode using chokidar"
```

---

## Phase 3 — PDF styling

### Task 11: Create manual.css

**Files:**
- Create: `docs/user-manual/style/manual.css`

- [ ] **Step 1: Write the CSS**

Create `docs/user-manual/style/manual.css`:

```css
@page {
  size: A4;
  margin: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1f2937;
  max-width: none;
  padding: 0;
}

h1, h2, h3, h4 {
  color: #0f3a52;
  page-break-after: avoid;
}

h1 { font-size: 22pt; margin-top: 1em; }
h2 { font-size: 16pt; margin-top: 1.2em; border-bottom: 2px solid #0f3a52; padding-bottom: 0.2em; }
h3 { font-size: 13pt; margin-top: 1em; }

p, ul, ol { orphans: 3; widows: 3; }

img { max-width: 100%; height: auto; page-break-inside: avoid; }

a { color: #0a6e9c; text-decoration: none; }

/* Page breaks */
.page-break { page-break-before: always; }

/* Cover page */
.cover {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  background: linear-gradient(180deg, #0f3a52 0%, #1c5d80 100%);
  color: white;
  page-break-after: always;
}
.cover h1 { color: white; font-size: 36pt; margin: 0 0 0.3em 0; }
.cover .subtitle { font-size: 16pt; opacity: 0.85; }
.cover .version { font-size: 12pt; opacity: 0.75; margin-top: 2em; }

/* Section divider */
.section-divider {
  text-align: center;
  font-size: 28pt;
  color: #0f3a52;
  margin-top: 40vh;
  page-break-after: always;
}

/* Role tags */
.role-tags { margin-bottom: 0.6em; }
.role-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-right: 4px;
  color: white;
}
.role-tag-owner    { background: #2563eb; }
.role-tag-operator { background: #047857; }
.role-tag-admin    { background: #b45309; }

/* Callouts (used as blockquote variants) */
blockquote {
  border-left: 4px solid #94a3b8;
  background: #f1f5f9;
  margin: 1em 0;
  padding: 0.6em 1em;
  page-break-inside: avoid;
}
blockquote.info    { border-color: #2563eb; background: #eff6ff; }
blockquote.tip     { border-color: #047857; background: #ecfdf5; }
blockquote.caution { border-color: #b45309; background: #fff7ed; }
blockquote.caution::before { content: "CAUTION — "; font-weight: 700; color: #b45309; }
blockquote.info::before    { content: "INFO — ";    font-weight: 700; color: #2563eb; }
blockquote.tip::before     { content: "TIP — ";     font-weight: 700; color: #047857; }

/* Code */
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9.5pt;
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
}
pre code { display: block; padding: 0.8em; }

/* Tables */
table { border-collapse: collapse; width: 100%; margin: 1em 0; page-break-inside: avoid; }
th, td { border: 1px solid #cbd5e1; padding: 0.4em 0.6em; text-align: left; }
th { background: #f1f5f9; }
```

- [ ] **Step 2: Commit**

```bash
git add docs/user-manual/style/manual.css
git commit -m "feat(manual): add PDF stylesheet (cover, role tags, callouts, layout)"
```

---

## Phase 4 — Skeleton content + smoke build

Each markdown skeleton in this phase has filled-in frontmatter and section headings, but body prose is filled in during Phase 5/6.

### Task 12: Cover, introduction, getting-started

**Files:**
- Create: `docs/user-manual/00-cover.md`
- Create: `docs/user-manual/01-introduction.md`
- Create: `docs/user-manual/02-getting-started.md`

- [ ] **Step 1: Write cover page**

Create `docs/user-manual/00-cover.md`:

```markdown
---
title: ""
last_updated: 2026-05-28
order: 0
---

<!-- Cover page content is generated by composeManual() from manual.config.json (title, subtitle, version, build date). This file exists so the build pipeline finds the slot. Add additional cover-page prose below if needed. -->
```

- [ ] **Step 2: Write introduction**

Create `docs/user-manual/01-introduction.md`:

```markdown
---
title: Introduction
last_updated: 2026-05-28
order: 0
---

## Who this manual is for

This manual is for the people running the Ace Tours & Transfers website day-to-day. It is written for three roles, and chapters are tagged so you can scan for what matters to you:

- **OWNER** — the business owner. You read reports, sometimes update content or pricing, and want to know how things are going at a glance.
- **OPERATOR** — daily operations. You handle bookings, refunds, blackouts, and customer questions.
- **ADMIN** — technical site administrator. You also manage staff access and audit logs.

If you do more than one of these, the chapters relevant to you will have more than one role tag at the top.

## How to use this manual

The manual has two parts:

- **Part I — Workflows** walks through complete jobs end-to-end: "how do I take a booking", "how do I refund someone", and so on. Start here if you have a task in mind.
- **Part II — Screen Reference** is a one-pager per admin screen. Use it when you're already on a screen and want to know what each button does.

Each workflow chapter has the same structure:

1. **What this covers** — one sentence summary.
2. **Before you start** — what you need before you begin.
3. **Steps** — numbered steps with a screenshot of the screen.
4. **Common issues** — what to do when things look wrong.
5. **See also** — pointers to related chapters.

## How to find things quickly

Open the PDF and press `Ctrl+F` (Windows / Linux) or `Cmd+F` (Mac) to search. The table of contents at the start of the PDF lists every chapter.
```

- [ ] **Step 3: Write getting-started**

Create `docs/user-manual/02-getting-started.md`:

```markdown
---
title: Getting started
roles: [Owner, Operator, Admin]
last_updated: 2026-05-28
order: 0
---

## Logging in

1. Open the admin login page at `https://acetoursvanuatu.com/login`.
2. Enter your email and password.
3. Click **Sign in**.

If you've forgotten your password, click **Forgot password?** on the login screen. A reset link will be emailed to you.

## The admin layout

After logging in you land on the **Dashboard**. The left sidebar lists the admin sections you have access to. The role tag at the top of each chapter in this manual tells you which sections each role usually uses.

> info
> If you don't see a section you expect, your account may not have permission. Ask the admin who set up your account.

## Working safely

A few habits that prevent expensive mistakes:

- Anything labelled **delete**, **refund**, or **publish** changes live data. Double-check before clicking.
- Use the **Audit logs** screen (covered in Part II) when you need to know who did what and when.
- If you're not sure what a button does, look it up in Part II before clicking.
```

- [ ] **Step 4: Commit**

```bash
git add docs/user-manual/00-cover.md docs/user-manual/01-introduction.md docs/user-manual/02-getting-started.md
git commit -m "feat(manual): cover, introduction, getting-started content"
```

---

### Task 13: Workflow chapter stubs (10 files)

**Files:**
- Create: `docs/user-manual/workflows/01-taking-bookings.md`
- Create: `docs/user-manual/workflows/02-cancellations-refunds.md`
- Create: `docs/user-manual/workflows/03-closing-dates-blackouts.md`
- Create: `docs/user-manual/workflows/04-managing-capacity.md`
- Create: `docs/user-manual/workflows/05-editing-website-content.md`
- Create: `docs/user-manual/workflows/06-pricing-and-promotions.md`
- Create: `docs/user-manual/workflows/07-managing-tours-and-transfers.md`
- Create: `docs/user-manual/workflows/08-reports-and-performance.md`
- Create: `docs/user-manual/workflows/09-staff-and-user-access.md`
- Create: `docs/user-manual/workflows/10-reading-audit-logs.md`

- [ ] **Step 1: Create each stub using this template**

For each file, write the following template, substituting `<TITLE>`, `<ROLES>`, `<SCREEN>`, and `<ORDER>` from the table below:

```markdown
---
title: <TITLE>
roles: <ROLES>
screen: <SCREEN>
last_updated: 2026-05-28
order: <ORDER>
---

## What this covers

_To be written._

## Before you start

_To be written._

## Steps

1. _To be written._

## Common issues

_To be written._

## See also

_To be written._
```

| File | TITLE | ROLES | SCREEN | ORDER |
|---|---|---|---|---|
| `01-taking-bookings.md` | Taking and confirming a booking | `[Operator, Owner]` | `bookings` | 1 |
| `02-cancellations-refunds.md` | Cancellations and refunds | `[Operator, Owner]` | `bookings` | 2 |
| `03-closing-dates-blackouts.md` | Closing dates and blackouts | `[Operator]` | `blackouts` | 3 |
| `04-managing-capacity.md` | Managing capacity and availability | `[Operator, Owner]` | `capacity-dashboard` | 4 |
| `05-editing-website-content.md` | Editing website content (CMS) | `[Owner, Operator]` | `cms` | 5 |
| `06-pricing-and-promotions.md` | Pricing and promotions | `[Owner, Operator]` | `pricing` | 6 |
| `07-managing-tours-and-transfers.md` | Adding and editing tours and transfers | `[Owner, Operator]` | `products` | 7 |
| `08-reports-and-performance.md` | Reports and reviewing performance | `[Owner]` | `reports-analytics` | 8 |
| `09-staff-and-user-access.md` | Staff and user access | `[Admin, Owner]` | `staff` | 9 |
| `10-reading-audit-logs.md` | Reading audit logs | `[Admin]` | `audit-logs` | 10 |

- [ ] **Step 2: Commit**

```bash
git add docs/user-manual/workflows/
git commit -m "feat(manual): scaffold 10 workflow chapter stubs"
```

---

### Task 14: Reference page stubs (11 files)

**Files:**
- Create one file under `docs/user-manual/reference/` per row in the table below.

- [ ] **Step 1: Create each reference stub using this template**

For each row, write:

```markdown
---
title: <TITLE>
roles: <ROLES>
screen: <SCREEN>
last_updated: 2026-05-28
order: <ORDER>
---

## Purpose

_What this screen is for, in one sentence._

## What you see

_Top-level layout: panels, lists, filters._

## What each section does

_Walk through each panel/section._

## Common gotchas

_Things to watch out for._

## Related workflows

_Links to workflow chapters that use this screen._
```

| File | TITLE | ROLES | SCREEN | ORDER |
|---|---|---|---|---|
| `dashboard.md` | Dashboard | `[Owner, Operator, Admin]` | `dashboard` | 1 |
| `bookings.md` | Bookings | `[Operator, Owner]` | `bookings` | 2 |
| `calendar.md` | Calendar | `[Operator, Owner]` | `calendar` | 3 |
| `capacity-dashboard.md` | Capacity dashboard | `[Operator, Owner]` | `capacity-dashboard` | 4 |
| `blackouts.md` | Blackouts | `[Operator]` | `blackouts` | 5 |
| `products.md` | Products | `[Owner, Operator]` | `products` | 6 |
| `pricing.md` | Pricing | `[Owner, Operator]` | `pricing` | 7 |
| `cms.md` | CMS | `[Owner, Operator]` | `cms` | 8 |
| `promotions.md` | Promotions | `[Owner, Operator]` | `promotions` | 9 |
| `reports-analytics.md` | Reports and analytics | `[Owner]` | `reports-analytics` | 10 |

- [ ] **Step 2: Create deferred-screens.md**

Create `docs/user-manual/reference/deferred-screens.md`:

```markdown
---
title: Other admin screens (deferred)
last_updated: 2026-05-28
order: 11
---

The following admin screens are present in the system but not yet covered in this manual. They are scheduled for inclusion in a future revision.

- **Reconciliation** — match bank deposits to bookings.
- **Fraud** — flag suspicious bookings for review.
- **Recovery** — recover abandoned or stuck bookings.
- **Audit logs (screen reference)** — the workflow for *reading* audit logs is in Part I; the full screen reference is deferred.
- **Reviews** — moderate customer reviews.
- **Newsletter** — send email newsletters to past customers.
- **Notifications (admin)** — view and replay system notifications.
- **External services** — manage third-party integrations (Cloudinary, Sentry, Twilio, etc.).
- **Settings (deep dive)** — full settings screen reference.
- **Payments (admin)** — admin-side payment screen.
- **Admin profile** — manage your own admin profile.
- **Staff and Users (screen reference)** — the workflow is in Part I; the full screen reference is deferred.

If any of these is urgent for your role, contact the development team to prioritise it.
```

- [ ] **Step 3: Commit**

```bash
git add docs/user-manual/reference/
git commit -m "feat(manual): scaffold 10 reference stubs + deferred-screens"
```

---

### Task 15: Smoke build — verify PDF outputs

**Files:**
- Read-only verification

- [ ] **Step 1: Run the build**

Run: `npm run docs:manual:build`

Expected:
- Console shows no errors
- Console may show `[stale] ...` warnings (depends on `last_updated`) — these are informational
- File `docs/user-manual/dist/Ace-Tours-User-Manual-v1.0.0.pdf` is created

- [ ] **Step 2: Verify the PDF exists and is non-empty**

Run: `ls -la docs/user-manual/dist/`

Expected: a `.pdf` file at least 50 KB in size.

- [ ] **Step 3: Open the PDF visually**

Run: `xdg-open docs/user-manual/dist/Ace-Tours-User-Manual-v1.0.0.pdf` (or open it in any PDF viewer).

Expected:
- Cover page renders with title, subtitle, version, and date
- "Part I — Workflows" section divider
- 10 workflow chapter stubs, each with role tags and section headings
- "Part II — Screen Reference" section divider
- 10 reference stubs + deferred-screens chapter

Bodies say "_To be written._" — that's expected at this stage.

- [ ] **Step 4: If the build fails or output looks wrong, debug before proceeding**

Common issues:
- Missing CSS path → manual.css path mismatch in `main()`
- Image rendering broken → check rewriteImagePaths logic
- Page breaks not happening → check CSS `.page-break` rule and HTML output

Do not commit anything in this task. It's a verification gate.

---

## Phase 5 — Writing workflow chapters

Each task in this phase replaces the `_To be written._` placeholders in one chapter with real content. The structure of every task is identical — read the relevant admin code, draft the chapter, capture the screenshot, rebuild, commit.

### Task 16: Write workflow 1 — Taking and confirming a booking

**Files:**
- Modify: `docs/user-manual/workflows/01-taking-bookings.md`
- Create: `docs/user-manual/images/workflows/01-new-booking.png`

- [ ] **Step 1: Read the relevant admin code**

Read these files to understand the booking flow before writing:
- `client/src/pages/admin/bookings.tsx`
- `server/routes/admin/bookings.ts` (or equivalent route file under `server/routes/`)
- `server/application/booking/` (booking application services)

Take notes on: what fields are shown for each booking, what statuses exist (pending/confirmed/cancelled/refunded), which actions are available on a single booking, what email/SMS notifications fire.

- [ ] **Step 2: Start the dev server with seeded data**

Run (in a separate terminal): `npm run dev`

Then in the browser, navigate to `http://localhost:5001/admin/bookings`. Confirm you see the seeded bookings.

If no bookings exist locally, run: `tsx server/seed-bookings.ts`

- [ ] **Step 3: Capture the screenshot**

Take a screenshot of the admin Bookings page at 1440px viewport width, showing a pending booking with the action buttons visible. Crop to the relevant area. Annotate with a red rectangle around the **Confirm** button.

Save as `docs/user-manual/images/workflows/01-new-booking.png` (PNG, recommended max width 1200px).

- [ ] **Step 4: Replace the chapter body**

Replace the contents of `docs/user-manual/workflows/01-taking-bookings.md` (keep the frontmatter) with the content below. Adjust any wording that doesn't match the actual UI you observed in Step 1–2.

```markdown
---
title: Taking and confirming a booking
roles: [Operator, Owner]
screen: bookings
last_updated: 2026-05-28
order: 1
---

## What this covers

How to find a new booking, confirm it, mark it paid, and make sure the customer gets their confirmation.

## Before you start

- You're signed in as an Operator or Owner.
- The booking has come in (you'll see it on the Dashboard or get an email notification).

## Steps

1. Open the **Bookings** page from the left sidebar.
2. Find the booking in the list. New bookings appear at the top with a **pending** badge.
3. Click the booking to open its detail panel. Check the guest name, date, number of people, and tour or transfer.
4. If the booking is correct, click **Confirm**. The status changes to **confirmed** and a confirmation email goes out automatically.
5. If the customer paid by bank transfer, wait for the deposit to clear, then click **Mark paid**. For cash on delivery, leave the booking marked as **awaiting payment** until the customer arrives.

![Bookings page with a pending booking and the Confirm button highlighted](../images/workflows/01-new-booking.png)

## Common issues

> caution
> If you click **Cancel** instead of **Confirm**, the booking is cancelled and the customer is notified. There's no undo. If this happens by mistake, see [Cancellations and refunds](02-cancellations-refunds.md).

- **The booking shows but no payment is recorded.** That's normal for bank transfer and cash bookings. Wait until the funds arrive, then mark it paid.
- **The customer says they didn't get a confirmation email.** Check the customer's email in the booking detail — typos are the usual cause. Resend the confirmation from the booking detail panel.
- **The booking is for a date that's blacked out.** It shouldn't have been accepted — check the [Blackouts](../reference/blackouts.md) screen and contact the development team if the system let it through.

## See also

- [Cancellations and refunds](02-cancellations-refunds.md)
- [Bookings screen reference](../reference/bookings.md)
```

- [ ] **Step 5: Rebuild the manual**

Run: `npm run docs:manual:build`

Expected: builds successfully, PDF updates.

- [ ] **Step 6: Commit**

```bash
git add docs/user-manual/workflows/01-taking-bookings.md docs/user-manual/images/workflows/01-new-booking.png
git commit -m "docs(manual): write 'Taking and confirming a booking' chapter"
```

---

### Task 17: Write workflow 2 — Cancellations and refunds

**Files:**
- Modify: `docs/user-manual/workflows/02-cancellations-refunds.md`
- Create: `docs/user-manual/images/workflows/02-refund-button.png`

- [ ] **Step 1: Read the relevant admin code**

Read:
- `client/src/pages/admin/bookings.tsx` (refund/cancel UI)
- `server/application/booking/` (cancellation and refund services)
- `server/routes/` (refund-related endpoints)

Take notes on: how partial vs. full refunds work, whether refunds are automatic via Stripe or manual, what email goes to the customer, whether the audit log captures the action and the operator.

- [ ] **Step 2: Capture the screenshot**

Run the dev server, open a paid booking in the admin, screenshot the cancel/refund action area with red annotation around the **Refund** button. Save as `docs/user-manual/images/workflows/02-refund-button.png`.

- [ ] **Step 3: Replace the chapter body**

Replace the contents of `docs/user-manual/workflows/02-cancellations-refunds.md` (keep the frontmatter). Use this exact structure:

```markdown
## What this covers
<one-sentence summary of what the chapter teaches>

## Before you start
- <preconditions: signed in as Operator/Owner; the booking exists>

## Steps
1. <numbered steps>

![Refund button on a paid booking](../images/workflows/02-refund-button.png)

## Common issues
> caution
> Refunds touch live money. There is no undo. Verify the amount before clicking.

- <troubleshooting bullets>

## See also
- [Taking and confirming a booking](01-taking-bookings.md)
- [Bookings screen reference](../reference/bookings.md)
- [Reading audit logs](10-reading-audit-logs.md)
```

Content the chapter must cover:
- How to **cancel** a booking (booking won't happen) vs. how to **refund** (return money to the customer). They are different actions in the system.
- Partial vs. full refunds, if both are supported.
- What email/SMS notification the customer receives and when.
- That the action is captured in the audit log with the operator's name.
- Caution: refunds are irreversible.

- [ ] **Step 4: Rebuild**

Run: `npm run docs:manual:build`

- [ ] **Step 5: Commit**

```bash
git add docs/user-manual/workflows/02-cancellations-refunds.md docs/user-manual/images/workflows/02-refund-button.png
git commit -m "docs(manual): write 'Cancellations and refunds' chapter"
```

---

### Task 18: Write workflow 3 — Closing dates and blackouts

**Files:**
- Modify: `docs/user-manual/workflows/03-closing-dates-blackouts.md`
- Create: `docs/user-manual/images/workflows/03-blackouts.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/blackouts.tsx` and the server routes that back it. Note: per-tour blackouts vs. all-tours blackouts, how blackouts interact with existing bookings on that date, how operators are warned if there are already bookings.

- [ ] **Step 2: Capture screenshot**

Take a screenshot of the Blackouts page with the **Add blackout** action highlighted. Save as `docs/user-manual/images/workflows/03-blackouts.png`.

- [ ] **Step 3: Write the chapter**

Follow the same template as Task 16, Step 4. Cover: when to use blackouts (public holidays, weather, maintenance), how to close all tours on a date, how to close just one tour, what happens to bookings that already exist on a date you blackout (with a caution callout).

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/03-closing-dates-blackouts.md docs/user-manual/images/workflows/03-blackouts.png
git commit -m "docs(manual): write 'Closing dates and blackouts' chapter"
```

---

### Task 19: Write workflow 4 — Managing capacity and availability

**Files:**
- Modify: `docs/user-manual/workflows/04-managing-capacity.md`
- Create: `docs/user-manual/images/workflows/04-capacity.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/capacity-dashboard.tsx` and server-side capacity logic in `server/domain/availability/` and `server/application/`. Note: how capacity is set per tour, whether there are per-date overrides, what "holds" are, how the system enforces no-overbook.

- [ ] **Step 2: Capture screenshot**

Screenshot the Capacity dashboard showing a tour's seat count, with the edit control highlighted. Save as `docs/user-manual/images/workflows/04-capacity.png`.

- [ ] **Step 3: Write the chapter**

Cover: viewing remaining seats, adjusting a tour's total capacity, the difference between capacity and bookings (capacity = max possible; bookings = currently sold), what happens if you reduce capacity below current bookings (caution callout — the system should refuse or warn).

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/04-managing-capacity.md docs/user-manual/images/workflows/04-capacity.png
git commit -m "docs(manual): write 'Managing capacity and availability' chapter"
```

---

### Task 20: Write workflow 5 — Editing website content (CMS)

**Files:**
- Modify: `docs/user-manual/workflows/05-editing-website-content.md`
- Create: `docs/user-manual/images/workflows/05-cms-edit.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/cms.tsx` and the CMS schema in `shared/`. Note: which content blocks exist (hero, about, FAQ, etc.), whether changes go live immediately or need publishing, whether there's a preview mode, whether multiple languages are editable.

- [ ] **Step 2: Capture screenshot**

Screenshot the CMS page showing the hero edit form with **Save** highlighted. Save as `docs/user-manual/images/workflows/05-cms-edit.png`.

- [ ] **Step 3: Write the chapter**

Cover: finding a content block, editing it, saving, what becomes live, how to handle multilingual content (English is canonical; translations may be auto-generated — note this if true), caution callout for publish/save being immediate.

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/05-editing-website-content.md docs/user-manual/images/workflows/05-cms-edit.png
git commit -m "docs(manual): write 'Editing website content' chapter"
```

---

### Task 21: Write workflow 6 — Pricing and promotions

**Files:**
- Modify: `docs/user-manual/workflows/06-pricing-and-promotions.md`
- Create: `docs/user-manual/images/workflows/06-pricing.png`
- Create: `docs/user-manual/images/workflows/06-promo-create.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/pricing.tsx`, `client/src/pages/admin/promotions.tsx`, and pricing logic in `server/domain/`. Note: per-tour pricing, seasonal pricing, promo code formats, percentage vs. fixed-amount discounts, expiry dates.

- [ ] **Step 2: Capture two screenshots**

- `06-pricing.png` — pricing screen with one tour's price field highlighted
- `06-promo-create.png` — promotion create form with the discount and expiry fields highlighted

- [ ] **Step 3: Write the chapter**

This chapter is longer than most because it covers two related workflows. Use sub-headings:

- `## Changing a tour's price` — steps 1–N
- `## Creating a promotion code` — steps 1–N

Caution callouts for: price changes affecting new bookings only (not existing); promo codes being case-sensitive (if true); expiry dates being end-of-day in the local timezone.

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/06-pricing-and-promotions.md docs/user-manual/images/workflows/06-pricing.png docs/user-manual/images/workflows/06-promo-create.png
git commit -m "docs(manual): write 'Pricing and promotions' chapter"
```

---

### Task 22: Write workflow 7 — Adding and editing tours and transfers

**Files:**
- Modify: `docs/user-manual/workflows/07-managing-tours-and-transfers.md`
- Create: `docs/user-manual/images/workflows/07-product-edit.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/products.tsx` and product-related schemas in `shared/`. Note: tour vs. transfer differences, required fields, image upload mechanism (Cloudinary), whether SEO fields exist, soft-delete vs. hard-delete.

- [ ] **Step 2: Capture screenshot**

Screenshot a product edit form showing name, description, price, image upload, with **Save** highlighted. Save as `docs/user-manual/images/workflows/07-product-edit.png`.

- [ ] **Step 3: Write the chapter**

Cover: adding a new tour or transfer (which fields are required), editing an existing product, uploading and replacing images, the SEO fields (if present), how to deactivate a product without deleting it (preserves history), caution callout for deletion (if hard delete is allowed).

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/07-managing-tours-and-transfers.md docs/user-manual/images/workflows/07-product-edit.png
git commit -m "docs(manual): write 'Managing tours and transfers' chapter"
```

---

### Task 23: Write workflow 8 — Reports and performance

**Files:**
- Modify: `docs/user-manual/workflows/08-reports-and-performance.md`
- Create: `docs/user-manual/images/workflows/08-report.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/reports.tsx`, `client/src/pages/admin/analytics.tsx`, `client/src/pages/admin/dashboard.tsx`. Note: which reports are available (revenue, bookings, conversion), what date ranges are supported, whether reports can be exported (CSV, PDF).

- [ ] **Step 2: Capture screenshot**

Screenshot a report view (e.g. monthly revenue) with the date range selector and export button highlighted. Save as `docs/user-manual/images/workflows/08-report.png`.

- [ ] **Step 3: Write the chapter**

Cover: the Dashboard overview, how to run a custom report, what each metric means in plain English (gross revenue vs. net, confirmed vs. paid, etc.), how to export, monthly close-out routine.

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/08-reports-and-performance.md docs/user-manual/images/workflows/08-report.png
git commit -m "docs(manual): write 'Reports and performance' chapter"
```

---

### Task 24: Write workflow 9 — Staff and user access

**Files:**
- Modify: `docs/user-manual/workflows/09-staff-and-user-access.md`
- Create: `docs/user-manual/images/workflows/09-add-staff.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/staff.tsx` and `client/src/pages/admin/users.tsx`. Note: roles available (owner, operator, admin), how invites work, password reset flow, deactivating vs. deleting an account.

- [ ] **Step 2: Capture screenshot**

Screenshot the **Add staff member** form with email, role, and **Send invite** highlighted. Save as `docs/user-manual/images/workflows/09-add-staff.png`.

- [ ] **Step 3: Write the chapter**

Cover: adding a new staff member (invite flow), what each role can do (one sentence per role: Owner / Operator / Admin), resetting a forgotten password, removing access when someone leaves (deactivate, don't delete — preserves audit log).

Caution callout: granting Admin role gives full access including ability to delete data. Be intentional.

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/09-staff-and-user-access.md docs/user-manual/images/workflows/09-add-staff.png
git commit -m "docs(manual): write 'Staff and user access' chapter"
```

---

### Task 25: Write workflow 10 — Reading audit logs

**Files:**
- Modify: `docs/user-manual/workflows/10-reading-audit-logs.md`
- Create: `docs/user-manual/images/workflows/10-audit-search.png`

- [ ] **Step 1: Read admin code**

Read `client/src/pages/admin/audit-logs.tsx` and the audit log domain code in `server/`. Note: which events are logged (logins, bookings, refunds, content edits, settings changes), how to filter by date / user / action type, retention policy.

- [ ] **Step 2: Capture screenshot**

Screenshot the audit logs page with the filter controls and a sample log entry highlighted. Save as `docs/user-manual/images/workflows/10-audit-search.png`.

- [ ] **Step 3: Write the chapter**

Cover: when to consult audit logs (a customer dispute, a staff question, an unexpected change), how to filter the log to find what you want, what each event type means, how long logs are kept.

Tip callout: audit logs are write-only — nobody can edit or delete entries. Treat them as the source of truth when there's a dispute.

- [ ] **Step 4: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/workflows/10-reading-audit-logs.md docs/user-manual/images/workflows/10-audit-search.png
git commit -m "docs(manual): write 'Reading audit logs' chapter"
```

---

## Phase 6 — Writing reference pages

Each reference page is one printed page covering: Purpose / What you see / What each section does / Common gotchas / Related workflows. Reference pages don't need their own screenshots — one overview screenshot per page is sufficient and several can reuse images already captured in Phase 5.

### Task 26: Write reference — Dashboard

**Files:**
- Modify: `docs/user-manual/reference/dashboard.md`
- Create: `docs/user-manual/images/reference/dashboard.png`

- [ ] **Step 1: Capture overview screenshot**

Screenshot the admin Dashboard at 1440px wide. Save as `docs/user-manual/images/reference/dashboard.png`.

- [ ] **Step 2: Write the reference**

Replace placeholder content. Cover:
- **Purpose** — at-a-glance health of the business: today's bookings, revenue this month, anything needing attention.
- **What you see** — top KPI cards; recent bookings list; alerts panel.
- **What each section does** — each KPI's meaning; how the recent bookings list is sorted; what triggers an alert.
- **Common gotchas** — KPIs are live, not cached; alerts clear once acknowledged.
- **Related workflows** — links to Reports (Task 23) and Bookings (Task 16).

Embed `dashboard.png` between "What you see" and "What each section does".

- [ ] **Step 3: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/dashboard.md docs/user-manual/images/reference/dashboard.png
git commit -m "docs(manual): write Dashboard reference"
```

---

### Task 27: Write reference — Bookings

**Files:**
- Modify: `docs/user-manual/reference/bookings.md`
- Reuse: `docs/user-manual/images/workflows/01-new-booking.png` (already captured)

- [ ] **Step 1: Write the reference**

Replace the body of `docs/user-manual/reference/bookings.md` (keep frontmatter). Use this structure:

```markdown
## Purpose
The main day-to-day screen for handling bookings. Shows every booking, filterable by date / status / customer, with a detail panel for actions.

## What you see
- Filter bar at the top (date range, status, search)
- Bookings list (rows = one booking each)
- Detail panel (opens on row click)

![Bookings page with new booking highlighted](../images/workflows/01-new-booking.png)

## What each section does
- **Filter bar** — narrows the list. Default range is the last 30 days.
- **Bookings list** — columns: reference, customer, tour/transfer, date, guests, status, payment.
- **Detail panel actions** — Confirm, Cancel, Refund, Resend confirmation, Mark paid. See [Taking and confirming a booking](../workflows/01-taking-bookings.md) and [Cancellations and refunds](../workflows/02-cancellations-refunds.md) for workflows.

## Common gotchas
- The list hides bookings outside the date filter. If a booking "disappeared", widen the date range.
- "Confirmed" and "Paid" are different states — a booking can be confirmed but unpaid (bank transfer pending).

## Related workflows
- [Taking and confirming a booking](../workflows/01-taking-bookings.md)
- [Cancellations and refunds](../workflows/02-cancellations-refunds.md)
```

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/bookings.md
git commit -m "docs(manual): write Bookings reference"
```

---

### Task 28: Write reference — Calendar

**Files:**
- Modify: `docs/user-manual/reference/calendar.md`
- Create: `docs/user-manual/images/reference/calendar.png`

- [ ] **Step 1: Capture overview screenshot**

Screenshot the Calendar view. Save as `docs/user-manual/images/reference/calendar.png`.

- [ ] **Step 2: Write the reference**

Five-section structure. Cover:
- **Purpose** — visual view of bookings across days/weeks.
- **What you see** — month/week toggle, colour-coded events, sidebar with day detail.
- **What each section does** — colours by status; click a day for detail; switch month/week.
- **Common gotchas** — events outside the current month are dimmed but still clickable.
- **Related workflows** — Bookings (Task 27), Blackouts (Task 30).

- [ ] **Step 3: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/calendar.md docs/user-manual/images/reference/calendar.png
git commit -m "docs(manual): write Calendar reference"
```

---

### Task 29: Write reference — Capacity dashboard

**Files:**
- Modify: `docs/user-manual/reference/capacity-dashboard.md`
- Reuse: `docs/user-manual/images/workflows/04-capacity.png` (from Task 19)

- [ ] **Step 1: Write the reference**

Five-section structure covering: per-tour capacity rows; remaining seats vs. total; edit control; holds (temporary reservations from the booking flow); seat utilisation chart. Embed the existing capacity screenshot.

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/capacity-dashboard.md
git commit -m "docs(manual): write Capacity dashboard reference"
```

---

### Task 30: Write reference — Blackouts

**Files:**
- Modify: `docs/user-manual/reference/blackouts.md`
- Reuse: `docs/user-manual/images/workflows/03-blackouts.png` (from Task 18)

- [ ] **Step 1: Write the reference**

Five-section structure covering: list of blackouts; add control; per-tour vs. all-tours blackouts; recurring blackouts (if supported); how to remove a blackout. Embed the existing screenshot.

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/blackouts.md
git commit -m "docs(manual): write Blackouts reference"
```

---

### Task 31: Write reference — Products

**Files:**
- Modify: `docs/user-manual/reference/products.md`
- Reuse: `docs/user-manual/images/workflows/07-product-edit.png` (from Task 22)

- [ ] **Step 1: Write the reference**

Five-section structure covering: product list (tours and transfers); status badges (active, inactive); add/edit/duplicate controls; SEO fields; image upload area. Embed the existing screenshot.

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/products.md
git commit -m "docs(manual): write Products reference"
```

---

### Task 32: Write reference — Pricing

**Files:**
- Modify: `docs/user-manual/reference/pricing.md`
- Reuse: `docs/user-manual/images/workflows/06-pricing.png` (from Task 21)

- [ ] **Step 1: Write the reference**

Five-section structure covering: per-tour price rows; seasonal overrides; effective date; bulk update control (if any). Embed the existing screenshot.

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/pricing.md
git commit -m "docs(manual): write Pricing reference"
```

---

### Task 33: Write reference — CMS

**Files:**
- Modify: `docs/user-manual/reference/cms.md`
- Reuse: `docs/user-manual/images/workflows/05-cms-edit.png` (from Task 20)

- [ ] **Step 1: Write the reference**

Five-section structure covering: content block list; edit form; language tabs (if multilingual editing is exposed); preview / save / publish controls; revision history (if present). Embed the existing screenshot.

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/cms.md
git commit -m "docs(manual): write CMS reference"
```

---

### Task 34: Write reference — Promotions

**Files:**
- Modify: `docs/user-manual/reference/promotions.md`
- Reuse: `docs/user-manual/images/workflows/06-promo-create.png` (from Task 21)

- [ ] **Step 1: Write the reference**

Five-section structure covering: promo list with status (active, expired, scheduled); create form fields; usage count; deactivate vs. delete. Embed the existing screenshot.

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/promotions.md
git commit -m "docs(manual): write Promotions reference"
```

---

### Task 35: Write reference — Reports and analytics

**Files:**
- Modify: `docs/user-manual/reference/reports-analytics.md`
- Reuse: `docs/user-manual/images/workflows/08-report.png` (from Task 23)

- [ ] **Step 1: Write the reference**

Five-section structure covering: report tabs (revenue, bookings, conversion, occupancy); date range and grouping controls; chart vs. table toggle; export controls. Embed the existing screenshot.

- [ ] **Step 2: Rebuild and commit**

```bash
npm run docs:manual:build
git add docs/user-manual/reference/reports-analytics.md
git commit -m "docs(manual): write Reports and analytics reference"
```

---

## Phase 7 — Polish and ship

### Task 36: Write the style guide

**Files:**
- Create: `docs/user-manual/STYLE.md`

- [ ] **Step 1: Write STYLE.md**

Create `docs/user-manual/STYLE.md`:

```markdown
# Manual style guide

This document defines voice and conventions for the Ace Tours user manual. Anyone updating the manual or building Phase 2 (in-app help) should read this first.

## Voice

- **Plain English.** Avoid jargon. If you must use a technical term, define it on first use.
- **Second person.** "You'll see a list of bookings", not "the user navigates to the bookings page".
- **Active voice.** "The system sends the confirmation email", not "a confirmation email is sent".
- **Imperative steps.** "Open the Bookings page", "Click Confirm". Number the steps.
- **Specific not abstract.** "Click the green **Confirm** button at the top right" beats "click the confirmation control".

## Structure of a workflow chapter

Every workflow chapter follows the same five sections in this order:

1. **What this covers** — one or two sentences.
2. **Before you start** — preconditions.
3. **Steps** — numbered. One screenshot per chapter near the relevant step.
4. **Common issues** — bullet list of "if X, then Y" troubleshooting.
5. **See also** — cross-links to related chapters.

## Structure of a reference page

1. **Purpose** — one sentence.
2. **What you see** — top-level layout.
3. **What each section does** — walk through every panel/control.
4. **Common gotchas** — bullet list.
5. **Related workflows** — cross-links.

## Callouts

Use blockquotes with a class to mark callouts:

```markdown
> caution
> Refunds touch live money. There's no undo.

> info
> The Calendar shows the timezone of the booking, not of the operator.

> tip
> Press F to jump to the search box on any list page.
```

CSS in `style/manual.css` renders the leading "CAUTION — ", "INFO — ", "TIP — " label.

Use **caution** sparingly — only for irreversible or expensive actions.

## Frontmatter

Every chapter has YAML frontmatter:

```yaml
---
title: <Chapter title>
roles: [Owner, Operator, Admin]   # any subset
screen: <slug matching the admin route>
last_updated: YYYY-MM-DD
order: <integer for sort order within section>
---
```

- `title` is required.
- `roles` drives the role pills at the top of the chapter and (later) the Phase-2 in-app help filter.
- `screen` lets Phase 2 map admin pages to chapters. Set it even if no in-app help exists yet.
- `last_updated` triggers the stale-content warning in the build script after 6 months.

## Screenshots

- Capture at 1440px viewport width.
- Save as PNG.
- Annotate with red rectangles or arrows.
- Use predictable filenames: `<chapter-number>-<short-description>.png`.
- Save under `images/workflows/` or `images/reference/`.
- Use seeded local data only — never capture from production.

## Updating the manual

When you change an admin screen:

1. Update the relevant workflow chapter and/or reference page.
2. Re-capture any screenshots that changed.
3. Update `last_updated` in the frontmatter.
4. Run `npm run docs:manual:build` and check the PDF.
5. Bump the version in `manual.config.json` (patch for typos, minor for new content, major for structure changes).
```

- [ ] **Step 2: Commit**

```bash
git add docs/user-manual/STYLE.md
git commit -m "docs(manual): add STYLE.md"
```

---

### Task 37: Write the manual's README

**Files:**
- Create: `docs/user-manual/README.md`

- [ ] **Step 1: Write README.md**

Create `docs/user-manual/README.md`:

```markdown
# Ace Tours user manual — source

This directory contains the source of the Ace Tours user manual. The built PDF is in `dist/` (gitignored) and attached to GitHub Releases tagged `manual-v<version>`.

## Layout

```
docs/user-manual/
├── manual.config.json         book metadata and chapter order
├── 00-cover.md, 01-introduction.md, 02-getting-started.md
├── workflows/                 the 10 workflow chapters
├── reference/                 the 10 screen-by-screen references + deferred-screens
├── images/                    PNG screenshots
├── style/manual.css           PDF styling
├── STYLE.md                   voice and conventions
└── dist/                      built PDFs (gitignored)
```

## Editing

See [STYLE.md](STYLE.md) for voice and structure conventions.

To edit a chapter:

1. Open the relevant `.md` file in `workflows/` or `reference/`.
2. Update the body. Keep frontmatter present.
3. Update `last_updated` in the frontmatter to today's date.
4. Re-capture any affected screenshots (see below).
5. Build the PDF and check it.

## Building the PDF

```bash
npm run docs:manual:build
```

Output: `docs/user-manual/dist/Ace-Tours-User-Manual-v<version>.pdf`

For live rebuild while editing:

```bash
npm run docs:manual:watch
```

## Capturing screenshots

1. Run `npm run dev` in one terminal.
2. Make sure local data is seeded: `tsx server/seed-bookings.ts`. (Never capture from production.)
3. Open the relevant admin page at `http://localhost:5001/admin/<page>` in a browser at 1440px width.
4. Take a screenshot, crop, annotate with red rectangles or arrows.
5. Save as PNG under `images/workflows/` or `images/reference/`.

### Required screenshots

The full list of screenshots referenced in the manual:

**Workflows**
- `images/workflows/01-new-booking.png`
- `images/workflows/02-refund-button.png`
- `images/workflows/03-blackouts.png`
- `images/workflows/04-capacity.png`
- `images/workflows/05-cms-edit.png`
- `images/workflows/06-pricing.png`
- `images/workflows/06-promo-create.png`
- `images/workflows/07-product-edit.png`
- `images/workflows/08-report.png`
- `images/workflows/09-add-staff.png`
- `images/workflows/10-audit-search.png`

**Reference**
- `images/reference/dashboard.png`
- `images/reference/calendar.png`
- (Other reference pages reuse workflow images by design.)

## Releasing a new version

1. Update `version` in `manual.config.json` (semver: patch / minor / major).
2. Update `last_updated` in any chapter you touched.
3. `npm run docs:manual:build`.
4. Verify the PDF visually.
5. Commit changes.
6. Create a GitHub Release: `gh release create manual-v<version> docs/user-manual/dist/Ace-Tours-User-Manual-v<version>.pdf --notes "<changelog>"`.

## Phase 2 (future)

The same Markdown files in this directory will power an in-app help drawer in a future release. The `roles:` and `screen:` keys in each chapter's frontmatter are the mapping that lets the admin UI fetch the right help content. Do not remove or change those keys without updating the (future) help-drawer code.
```

- [ ] **Step 2: Commit**

```bash
git add docs/user-manual/README.md
git commit -m "docs(manual): add README with editing, build, and release instructions"
```

---

### Task 38: Add PR template nudge

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Check if a template already exists**

Run: `ls .github/PULL_REQUEST_TEMPLATE.md .github/pull_request_template.md 2>/dev/null`

Expected: no output (no template exists yet).

If one exists, modify it instead of creating. Skip Step 2 and add only the new checkbox block to the existing file.

- [ ] **Step 2: Create the PR template**

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

<!-- One or two sentences describing the change. -->

## Why

<!-- The motivation. What problem does this solve? -->

## Test plan

- [ ] _to be filled_

## User manual

- [ ] This PR changes an admin screen or workflow covered in [docs/user-manual/](../docs/user-manual/). If yes:
  - [ ] Updated the relevant chapter(s)
  - [ ] Updated `last_updated:` in the chapter frontmatter
  - [ ] Re-captured any affected screenshots
  - [ ] Ran `npm run docs:manual:build` and checked the PDF
```

- [ ] **Step 3: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add PR template with user-manual update checklist"
```

---

### Task 39: Final build, validation, and release

**Files:**
- Modify: `docs/user-manual/manual.config.json` (set `buildDate`)

- [ ] **Step 1: Set the build date**

Modify `docs/user-manual/manual.config.json` `"buildDate"` field to today's ISO date, e.g. `"2026-05-28"`.

- [ ] **Step 2: Final clean build**

Run: `npm run docs:manual:build`

Expected: builds with no errors, no stale-content warnings (all chapters were just written).

- [ ] **Step 3: Manual review**

Open `docs/user-manual/dist/Ace-Tours-User-Manual-v1.0.0.pdf` and check:

- [ ] Cover page shows correct title, version, date
- [ ] Table of contents lists all chapters
- [ ] Each workflow chapter has: role tags, "What this covers", "Before you start", "Steps", "Common issues", "See also"
- [ ] Each reference page has: "Purpose", "What you see", "What each section does", "Common gotchas", "Related workflows"
- [ ] All 11+ workflow screenshots and 2 reference-only screenshots are embedded and readable
- [ ] Page breaks land reasonably (no orphan headings at page bottoms)
- [ ] Page footer shows manual name, version, and page number on every page
- [ ] Role-tag colours render correctly (blue / green / amber)
- [ ] Callouts (info / tip / caution) render with their labels

- [ ] **Step 4: Non-technical-reviewer pass (success criterion from spec §11)**

Ask someone not on the dev team to read the PDF cover-to-cover and note any sections that were unclear. Capture their feedback as issues (one issue per unclear section).

If they flagged sections, address them as a single revision pass and rebuild.

- [ ] **Step 5: Commit and create the release**

```bash
git add docs/user-manual/manual.config.json
git commit -m "docs(manual): finalize v1.0.0 build date"

# Push the branch (assumes remote is configured)
git push -u origin user-manual-spec

# Open a PR (via gh) so reviewers can sign off on the manual
gh pr create --title "User manual v1.0.0" --body "$(cat <<'EOF'
## Summary
- Adds the Phase 1 user manual: 10 workflow chapters + 10 screen-reference pages + introduction and getting started.
- Adds the build script (`scripts/build-user-manual.ts`) and the `npm run docs:manual:build` command.
- Adds STYLE.md, README.md, and a PR-template nudge to keep the manual current.

## Test plan
- [x] `npm test` passes
- [x] `npm run docs:manual:build` produces `dist/Ace-Tours-User-Manual-v1.0.0.pdf`
- [x] Manual cover-to-cover review by a non-technical reviewer
- [x] All 13 screenshots embedded; page breaks acceptable

## User manual
- [x] This PR changes an admin screen or workflow covered in `docs/user-manual/`. (This PR *is* the manual; no other code changes.)
EOF
)"

# After PR merge, attach the PDF to a GitHub Release for stable download
gh release create manual-v1.0.0 docs/user-manual/dist/Ace-Tours-User-Manual-v1.0.0.pdf --title "User Manual v1.0.0" --notes "First release of the Ace Tours manager user manual. See PR for changelog."
```

Expected:
- PR is created and open
- After merge, `gh release` creates a tag and uploads the PDF
- The PDF is downloadable at the release URL

---

## Self-review against spec

| Spec requirement | Plan task |
|---|---|
| §3 PDF delivery format | Tasks 1, 9, 39 |
| §4.1 ten workflow chapters | Tasks 16–25 |
| §4.2 ten reference pages | Tasks 26–35 |
| §4.3 deferred screens stub | Task 14 |
| §5 source structure | Tasks 2, 4, 12–14 |
| §5.1 per-chapter template | Tasks 13, 14, 16, 36 |
| §6.1 md-to-pdf tool choice | Task 1, 9 |
| §6.2 build commands | Task 3 |
| §6.3 styling (cover, role tags, callouts, footers) | Task 11 |
| §6.4 known page-break trade-off | Task 11 (page-break CSS), Task 39 (manual review) |
| §7 screenshot workflow | Tasks 16–25, 26, 28; README in Task 37 |
| §8 voice & writing style | Task 36 (STYLE.md) |
| §9 versioning | Task 4 (manual.config.json), Task 39 (release tag) |
| §10 maintenance plan: PR checklist nudge | Task 38 |
| §10 maintenance plan: README | Task 37 |
| §10 maintenance plan: stale-content warning | Task 8 |
| §11.1 clean build on fresh checkout | Task 39 Step 2 |
| §11.2 all chapters following template | Tasks 16–35 |
| §11.3 all screenshots captured | Tasks 16–28 |
| §11.4 non-technical reviewer pass | Task 39 Step 4 |
| §11.5 PDF attached to GitHub Release | Task 39 Step 5 |
| §12 Phase 2 readiness (frontmatter keys, stable anchors) | Tasks 4, 13, 14 (frontmatter) |
