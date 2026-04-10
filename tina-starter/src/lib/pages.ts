import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'content/pages');

export function readPageJson<T>(filename: string): T {
  const full = path.join(pagesDir, filename);
  const raw = fs.readFileSync(full, 'utf-8');
  return JSON.parse(raw) as T;
}
