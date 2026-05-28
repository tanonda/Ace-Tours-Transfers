import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { loadConfig, parseChapter, renderRoleTags, rewriteImagePaths } from './build-user-manual';

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
    // gray-matter automatically parses dates, so last_updated becomes a Date object
    const lastUpdated = chapter.frontmatter.last_updated as unknown as Date;
    expect(lastUpdated.toISOString()).toBe('2026-05-28T00:00:00.000Z');
    expect(chapter.body.trim().startsWith('## Hello')).toBe(true);

    await rm(tmp, { recursive: true, force: true });
  });
});

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
