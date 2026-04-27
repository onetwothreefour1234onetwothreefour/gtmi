import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { remark } from 'remark';
import remarkHtml from 'remark-html';

/**
 * Load and render a markdown file from `apps/web/content/` to HTML.
 *
 * Used for editorial copy that the user reviews and edits separately from
 * feature commits (per dispatch §16). Returns "" when the file is missing
 * or empty so consumers can render a graceful "Summary forthcoming"
 * placeholder rather than erroring.
 *
 * Caller is responsible for matching the relative path inside `content/`.
 */
export async function loadContent(relativePath: string): Promise<string> {
  const safe = relativePath.replace(/\.\./g, '').replace(/^\/+/, '');
  const fullPath = path.join(process.cwd(), 'content', safe);
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    if (!raw.trim()) return '';
    const file = await remark().use(remarkHtml).process(raw);
    return String(file);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT'
    ) {
      return '';
    }
    throw error;
  }
}

/**
 * Synchronous-style "is content present" check used by pages that want to
 * branch on missing content vs render a placeholder.
 */
export async function contentExists(relativePath: string): Promise<boolean> {
  const safe = relativePath.replace(/\.\./g, '').replace(/^\/+/, '');
  const fullPath = path.join(process.cwd(), 'content', safe);
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    return raw.trim().length > 0;
  } catch {
    return false;
  }
}
