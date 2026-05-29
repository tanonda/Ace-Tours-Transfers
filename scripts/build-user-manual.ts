import { readFile, existsSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';
import matter from 'gray-matter';
import chokidar from 'chokidar';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Config loader ────────────────────────────────────────────────────────────

export async function loadConfig(configPath: string): Promise<ManualConfig> {
  const raw = await readFileAsync(configPath, 'utf8');
  return JSON.parse(raw) as ManualConfig;
}

// ─── Chapter parser ───────────────────────────────────────────────────────────

export async function parseChapter(absPath: string): Promise<Chapter> {
  const raw = await readFileAsync(absPath, 'utf8');
  const parsed = matter(raw);
  return {
    sourcePath: absPath,
    frontmatter: parsed.data as ChapterFrontmatter,
    body: parsed.content,
  };
}

// ─── Role tags ────────────────────────────────────────────────────────────────

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

// ─── Image path rewriter ──────────────────────────────────────────────────────

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

// ─── Stale chapter detection ──────────────────────────────────────────────────

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export function findStaleChapters(chapters: Chapter[], today: Date = new Date()): Chapter[] {
  return chapters.filter((c) => {
    const ts = c.frontmatter.last_updated;
    if (!ts) return false;
    const updated = new Date(ts as string);
    if (Number.isNaN(updated.getTime())) return false;
    return today.getTime() - updated.getTime() > SIX_MONTHS_MS;
  });
}

// ─── Chapter role validation ──────────────────────────────────────────────────

export const ALLOWED_ROLES = new Set(['admin', 'field_service', 'customer']);

export function validateChapterRoles(
  chapters: Chapter[],
  allowed: Set<string> = ALLOWED_ROLES,
): string[] {
  const errors: string[] = [];
  for (const c of chapters) {
    const roles = c.frontmatter.roles ?? [];
    for (const role of roles) {
      if (!allowed.has(role)) {
        errors.push(`${c.sourcePath}: unknown role "${role}"`);
      }
    }
  }
  return errors;
}

// ─── Chapter renderer ─────────────────────────────────────────────────────────

function renderChapterBody(chapter: Chapter): string {
  const chapterDir = path.dirname(chapter.sourcePath);
  const rolePills = renderRoleTags(chapter.frontmatter.roles);
  const title = chapter.frontmatter.title ? `# ${chapter.frontmatter.title}\n\n` : '';
  const rewritten = rewriteImagePaths(chapter.body, chapterDir);
  return `${rolePills}\n${title}${rewritten}`.trim();
}

// ─── Manual composer ──────────────────────────────────────────────────────────

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

// ─── Build runner ─────────────────────────────────────────────────────────────

async function runOnce(): Promise<void> {
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
  const css = existsSync(cssPath) ? await readFileAsync(cssPath, 'utf8') : '';
  const outFile = path.join(distDir, `Ace-Tours-User-Manual-v${config.version}.pdf`);

  const result = await mdToPdf(
    { content: composed },
    {
      dest: outFile,
      css,
      launch_options: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
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

// ─── Entrypoint ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await runOnce();

  if (process.argv.includes('--watch')) {
    const __filename = fileURLToPath(import.meta.url);
    const manualRoot = path.resolve(path.dirname(__filename), '..', 'docs', 'user-manual');
    console.log(`[watch] watching ${manualRoot} for changes`);
    chokidar.watch(manualRoot, { ignored: /dist/, ignoreInitial: true }).on('all', async (event, file) => {
      console.log(`[watch] ${event}: ${path.relative(manualRoot, file as string)} — rebuilding`);
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
