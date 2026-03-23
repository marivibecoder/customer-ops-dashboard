import { promises as fs } from 'fs';
import path from 'path';
import { PeriskopeReport, SlackReport, MetabaseReport, MappingsFile } from './types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

export async function readReport<T>(source: string, date: string): Promise<T | null> {
  try {
    const filePath = path.join(DATA_DIR, source, `${date}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeReport(source: string, date: string, data: unknown): Promise<void> {
  const dir = path.join(DATA_DIR, source);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${date}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function listDates(source: string): Promise<string[]> {
  try {
    const dir = path.join(DATA_DIR, source);
    const files = await fs.readdir(dir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function listAllDates(): Promise<Record<string, string[]>> {
  const [periskope, slack, metabase] = await Promise.all([
    listDates('periskope'),
    listDates('slack'),
    listDates('metabase'),
  ]);
  return { periskope, slack, metabase };
}

export async function readMappings(): Promise<MappingsFile> {
  try {
    const filePath = path.join(DATA_DIR, 'mappings.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function writeMappings(mappings: MappingsFile): Promise<void> {
  const filePath = path.join(DATA_DIR, 'mappings.json');
  await fs.writeFile(filePath, JSON.stringify(mappings, null, 2), 'utf-8');
}

export async function getLatestDate(source: string): Promise<string | null> {
  const dates = await listDates(source);
  return dates[0] || null;
}

export function getPeriskopeReport(date: string) {
  return readReport<PeriskopeReport>('periskope', date);
}

export function getSlackReport(date: string) {
  return readReport<SlackReport>('slack', date);
}

export function getMetabaseReport(date: string) {
  return readReport<MetabaseReport>('metabase', date);
}
