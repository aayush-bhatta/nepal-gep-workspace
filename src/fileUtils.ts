import JSZip from 'jszip';

export const MAX_UPLOAD = 20 * 1024 * 1024;
export const BROWSER_ARCHIVE_LIMIT = 250 * 1024 * 1024;
export const PREVIEW_ROWS = 200;
export type PreviewGrid = { title: string; columns: string[]; rows: string[][]; note: string };

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function fileExtension(name: string): string {
  return (name.toLowerCase().split('.').pop() || '').trim();
}

export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch { return null; }
}

/** Colab can open a notebook by URL if the notebook lives in Drive or on public GitHub.
 * A private Supabase object cannot be handed to Google Colab without a separate authorization/transfer step. */
export function colabUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.hostname === 'colab.research.google.com') return safe;
  if (url.hostname === 'drive.google.com') {
    const driveId = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)/)?.[1];
    if (driveId) return `https://colab.research.google.com/drive/${driveId}`;
  }
  if (url.hostname === 'github.com') {
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+\.ipynb)$/i);
    if (m) return `https://colab.research.google.com/github/${m[1]}/${m[2]}/blob/${m[3]}/${m[4]}`;
  }
  return null;
}

export function parseCsv(text: string, maxRows = PREVIEW_ROWS + 1): PreviewGrid {
  const records: string[][] = [];
  let inQuotes = false, cell = '', record: string[] = [];
  const finishCell = () => { record.push(cell); cell = ''; };
  const finishRow = () => { finishCell(); records.push(record); record = []; };
  // Respect RFC 4180 quoted delimiters, escaped quotes and CRLF. Never execute contents.
  for (let i = 0; i < text.length && records.length < maxRows; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') inQuotes = true;
    else if (ch === ',') finishCell();
    else if (ch === '\n') finishRow();
    else if (ch === '\r' && text[i + 1] === '\n') { finishRow(); i++; }
    else if (ch === '\r') finishRow();
    else cell += ch;
  }
  if (records.length < maxRows && (cell.length > 0 || record.length > 0)) finishRow();
  const columns = (records.shift() || []).map((c, i) => c || `Column ${i + 1}`);
  const rows = records.slice(0, PREVIEW_ROWS);
  return { title: 'CSV data preview', columns, rows, note: `First ${rows.length} data rows displayed. Preview does not validate timestamps, gaps, or units.` };
}

function xml(source: string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw Error('Invalid spreadsheet XML');
  return doc;
}
function nodes(doc: Document | Element, name: string): Element[] {
  return [...doc.getElementsByTagName('*')].filter(e => e.localName === name);
}
function letterIndex(address: string): number {
  const col = (address.match(/^[A-Z]+/i)?.[0] || '').toUpperCase();
  if (!col) return -1;
  let n = 0;
  for (const c of col) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}
function safeZipTarget(target: string): string {
  const p = (target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`).replaceAll('\\', '/');
  if (p.split('/').some(x => x === '..') || !p.startsWith('xl/')) throw Error('Invalid XLSX workbook path');
  return p;
}

export async function xlsxSheetNames(blob: Blob): Promise<string[]> {
  if(blob.size>8*1024*1024)throw Error('Spreadsheet preview capped at 8 MB');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  if(Object.values(zip.files).reduce((n,f)=>n+((f as any)._data?.uncompressedSize||0),0)>40*1024*1024)throw Error('Spreadsheet expanded size exceeds preview limit');
  if (Object.values(zip.files).some(f => ((f as any)._data?.uncompressedSize || 0) > 18 * 1024 * 1024)) throw Error('Spreadsheet contains an oversized entry; preview rejected');
  const book = zip.file('xl/workbook.xml');
  if (!book) throw Error('Not a supported .xlsx workbook');
  const workbook = xml(await book.async('text'));
  return nodes(workbook, 'sheet').map(s => s.getAttribute('name') || '').filter(Boolean);
}

export async function previewXlsx(blob: Blob, selectedSheet?: string): Promise<PreviewGrid> {
  // The ZIP is parsed as data only. Macros and spreadsheet formulas are never executed.
  if (blob.size > 8 * 1024 * 1024) throw Error('Spreadsheet preview capped at 8 MB; download this file for larger analyses.');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  if(Object.values(zip.files).reduce((n,f)=>n+((f as any)._data?.uncompressedSize||0),0)>40*1024*1024)throw Error('Spreadsheet expanded size exceeds preview limit');
  if (Object.values(zip.files).some(f => ((f as any)._data?.uncompressedSize || 0) > 18 * 1024 * 1024)) throw Error('Spreadsheet contains an oversized entry; preview rejected');
  const workbookEntry = zip.file('xl/workbook.xml');
  if (!workbookEntry) throw Error('Expected an .xlsx workbook (older .xls format is not supported).');
  const workbook = xml(await workbookEntry.async('text'));
  const sheets = nodes(workbook, 'sheet');
  const sheet = sheets.find(s => s.getAttribute('name') === selectedSheet) || sheets[0];
  if (!sheet) throw Error('No worksheets found');
  const relationshipId = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const relsEntry = zip.file('xl/_rels/workbook.xml.rels');
  const rels = relsEntry ? xml(await relsEntry.async('text')) : null;
  const target = rels && nodes(rels, 'Relationship').find(r => r.getAttribute('Id') === relationshipId)?.getAttribute('Target');
  const sheetPath = safeZipTarget(target || `worksheets/sheet${sheets.indexOf(sheet) + 1}.xml`);
  const sheetEntry = zip.file(sheetPath);
  if (!sheetEntry) throw Error('Worksheet is missing from the archive');
  const content = await sheetEntry.async('text');
  if (content.length > 18 * 1024 * 1024) throw Error('Worksheet too large to preview safely');
  const data = xml(content);
  const strings: string[] = [];
  const shared = zip.file('xl/sharedStrings.xml');
  if (shared) {
    const entries = nodes(xml(await shared.async('text')), 'si');
    for (const entry of entries) strings.push(nodes(entry, 't').map(x => x.textContent || '').join(''));
  }
  const matrix: string[][] = [];
  for (const row of nodes(data, 'row').slice(0, PREVIEW_ROWS + 1)) {
    const cells: string[] = [];
    for (const c of nodes(row, 'c')) {
      const index = letterIndex(c.getAttribute('r') || '');
      if (index < 0 || index >= 50) continue;
      const t = c.getAttribute('t');
      const val = nodes(c, 'v')[0]?.textContent || '';
      cells[index] = t === 's' ? (strings[Number(val)] || '') : t === 'inlineStr' ? nodes(c, 't').map(t => t.textContent || '').join('') : val;
    }
    matrix.push(Array.from({ length: Math.min(50, cells.length) }, (_, i) => cells[i] || ''));
  }
  const columns = (matrix.shift() || []).map((x, i) => x || `Column ${i + 1}`);
  const rows = matrix.slice(0, PREVIEW_ROWS);
  return { title: `Excel · ${sheet.getAttribute('name') || ''}`, columns, rows, note: `First ${rows.length} data rows. Formula values are cached values where present; formulas are not executed.` };
}

export function compactDate(value?: string | null): string {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}
