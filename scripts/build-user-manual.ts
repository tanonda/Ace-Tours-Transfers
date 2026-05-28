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
