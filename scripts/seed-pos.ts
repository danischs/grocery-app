import 'dotenv/config';
import ExcelJS from 'exceljs';
import { db, client } from '../lib/db';
import { products, variants, stock } from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import path from 'path';

const GROCERY_FILE = path.resolve('data/grocery_file.xlsx');
const MATCHES_FILE = path.resolve('data/product_matches.xlsx');
const BATCH = 500;
const NOW = new Date().toISOString();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseCode(raw: unknown): string {
  let s = String(raw ?? '').trim();
  s = s.replace(/\.0$/, '');
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(s)) s = BigInt(Math.round(Number(s))).toString();
  return s;
}

function getHyperlink(cell: ExcelJS.Cell): string | null {
  if (typeof cell.hyperlink === 'string' && cell.hyperlink) return cell.hyperlink;
  const v = cell.value;
  if (v && typeof v === 'object' && 'hyperlink' in (v as object))
    return (v as { hyperlink: string }).hyperlink || null;
  return null;
}

function buildColMap(row: ExcelJS.Row): Record<string, number> {
  const m: Record<string, number> = {};
  row.eachCell((cell, col) => {
    const k = String(cell.value ?? '').trim();
    if (k) m[k] = col;
  });
  return m;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface PosItem { description: string; onHand: number; price: number; }
interface MatchInfo { name: string; imageUrl: string | null; }
interface SeedItem {
  itemCode: string;
  nameEn: string;
  posDescription: string;
  imageUrl: string | null;
  pricePaisa: number;
  onHand: number;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Read kayanis data (header row 2, data from row 3)
// ---------------------------------------------------------------------------

async function readPosItems(): Promise<Map<string, PosItem>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(GROCERY_FILE);
  const ws = wb.getWorksheet('kayanis data');
  if (!ws) throw new Error('Sheet "kayanis data" not found in grocery_file.xlsx');

  const cols = buildColMap(ws.getRow(2));
  for (const c of ['Item Code', 'Description', 'On Hand', 'PRICE']) {
    if (!cols[c]) throw new Error(`Column "${c}" not found in "kayanis data" header`);
  }

  const map = new Map<string, PosItem>();
  ws.eachRow((row, n) => {
    if (n <= 2) return;
    const code = normaliseCode(row.getCell(cols['Item Code']).value);
    if (!code) return;
    const description = String(row.getCell(cols['Description']).value ?? '').trim();
    const onHand = Number(row.getCell(cols['On Hand']).value) || 0;
    const price = Number(row.getCell(cols['PRICE']).value) || 0;
    if (map.has(code)) console.warn(`  [warn] Duplicate item_code in kayanis data: ${code}`);
    map.set(code, { description, onHand, price });
  });
  return map;
}

// ---------------------------------------------------------------------------
// Read match data (Auto-Matched + Review)
// ---------------------------------------------------------------------------

async function readMatchInfo(): Promise<Map<string, MatchInfo>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(MATCHES_FILE);
  const map = new Map<string, MatchInfo>();

  // Auto-Matched: Item Code | ... | C1 Name | C1 Score | C1 Image | C1 URL
  const autoWs = wb.getWorksheet('Auto-Matched');
  if (autoWs) {
    const cols = buildColMap(autoWs.getRow(1));
    autoWs.eachRow((row, n) => {
      if (n === 1) return;
      const code = normaliseCode(row.getCell(cols['Item Code']).value);
      if (!code || !cols['C1 Name']) return;
      const name = String(row.getCell(cols['C1 Name']).value ?? '').trim();
      const imageUrl = cols['C1 Image'] ? getHyperlink(row.getCell(cols['C1 Image'])) : null;
      if (name) map.set(code, { name, imageUrl });
    });
  }

  // Review: Pick (1/2/3/None) | Item Code | ... | C1 Name | C1 Score | C1 Image | C1 URL | C2... | C3...
  const reviewWs = wb.getWorksheet('Review');
  if (reviewWs) {
    const cols = buildColMap(reviewWs.getRow(1));
    reviewWs.eachRow((row, n) => {
      if (n === 1) return;
      const pickCol = cols['Pick (1/2/3/None)'];
      const pick = parseInt(String(row.getCell(pickCol ?? 1).value ?? ''), 10);
      if (![1, 2, 3].includes(pick)) return;
      const code = normaliseCode(row.getCell(cols['Item Code']).value);
      if (!code) return;
      const nameKey = `C${pick} Name`;
      const imageKey = `C${pick} Image`;
      const name = String(row.getCell(cols[nameKey] ?? 0).value ?? '').trim();
      const imageUrl = cols[imageKey] ? getHyperlink(row.getCell(cols[imageKey])) : null;
      if (name) map.set(code, { name, imageUrl });
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Reading kayanis data...');
  const posMap = await readPosItems();
  console.log(`  ${posMap.size} POS items`);

  console.log('Reading match data...');
  const matchMap = await readMatchInfo();
  console.log(`  ${matchMap.size} matched items`);

  // Merge
  const items: SeedItem[] = [];
  for (const [itemCode, pos] of posMap) {
    const match = matchMap.get(itemCode);
    items.push({
      itemCode,
      nameEn: match?.name ?? pos.description,
      posDescription: pos.description,
      imageUrl: match?.imageUrl ?? null,
      pricePaisa: Math.round(pos.price * 100),
      onHand: Math.round(pos.onHand),
      isActive: pos.price > 0,
    });
  }

  const matchedNames = items.filter(i => matchMap.has(i.itemCode)).length;
  const withImage = items.filter(i => i.imageUrl !== null).length;
  const inactive = items.filter(i => !i.isActive).length;
  console.log(`\n${items.length} seed items prepared`);
  console.log(`  Matched names: ${matchedNames}  Images: ${withImage}  Inactive (price=0): ${inactive}`);

  console.log('\nStarting database upsert...');
  let inserted = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    // Pre-fetch all existing variants for lookup
    const existing = await tx.select({
      itemCode: variants.item_code,
      variantId: variants.id,
      productId: variants.product_id,
    }).from(variants);

    const existingMap = new Map(existing.map(v => [v.itemCode, v]));
    const toInsert = items.filter(i => !existingMap.has(i.itemCode));
    const toUpdate = items.filter(i => existingMap.has(i.itemCode));
    console.log(`  New: ${toInsert.length}  Existing: ${toUpdate.length}`);

    // ------------------------------------------------------------------
    // INSERT path
    // ------------------------------------------------------------------
    for (const batch of chunk(toInsert, BATCH)) {
      const prodRows = await tx.insert(products)
        .values(batch.map(i => ({ name_en: i.nameEn, image_url: i.imageUrl })))
        .returning({ id: products.id });

      const variantRows = await tx.insert(variants)
        .values(batch.map((i, idx) => ({
          product_id: prodRows[idx].id,
          item_code: i.itemCode,
          price_paisa: i.pricePaisa,
          is_active: i.isActive,
          last_synced_at: NOW,
        })))
        .returning({ id: variants.id });

      await tx.insert(stock).values(
        variantRows.map((v, idx) => ({
          variant_id: v.id,
          location_id: 1,
          on_hand: batch[idx].onHand,
        }))
      );

      inserted += batch.length;
      process.stdout.write(`\r  Inserted ${inserted}/${toInsert.length}  `);
    }
    if (toInsert.length > 0) console.log();

    // ------------------------------------------------------------------
    // UPDATE path — one JSON param per query via jsonb_to_recordset
    // ------------------------------------------------------------------
    for (const batch of chunk(toUpdate, BATCH)) {
      // variants: always update price_paisa, is_active, last_synced_at
      const vJson = JSON.stringify(batch.map(i => {
        const e = existingMap.get(i.itemCode)!;
        return { id: e.variantId, p: i.pricePaisa, a: i.isActive };
      }));
      await tx.execute(sql`
        UPDATE variants SET
          price_paisa    = d.p,
          is_active      = d.a,
          last_synced_at = ${NOW}
        FROM jsonb_to_recordset(${vJson}::jsonb) AS d(id int, p int, a bool)
        WHERE variants.id = d.id
      `);

      // stock: always update on_hand
      const sJson = JSON.stringify(batch.map(i => ({
        vid: existingMap.get(i.itemCode)!.variantId,
        h: i.onHand,
      })));
      await tx.execute(sql`
        UPDATE stock SET on_hand = d.h
        FROM jsonb_to_recordset(${sJson}::jsonb) AS d(vid int, h int)
        WHERE stock.variant_id = d.vid AND stock.location_id = 1
      `);

      // products name_en: upgrade only when still equals POS description AND a match exists
      const nameItems = batch.filter(i => matchMap.has(i.itemCode));
      if (nameItems.length > 0) {
        const nJson = JSON.stringify(nameItems.map(i => ({
          id: existingMap.get(i.itemCode)!.productId,
          n: i.nameEn,
          pos_desc: i.posDescription,
        })));
        await tx.execute(sql`
          UPDATE products SET name_en = d.n
          FROM jsonb_to_recordset(${nJson}::jsonb) AS d(id int, n text, pos_desc text)
          WHERE products.id = d.id AND products.name_en = d.pos_desc
        `);
      }

      // products image_url: backfill only when currently NULL
      const imgItems = batch.filter(i => i.imageUrl !== null);
      if (imgItems.length > 0) {
        const iJson = JSON.stringify(imgItems.map(i => ({
          id: existingMap.get(i.itemCode)!.productId,
          u: i.imageUrl,
        })));
        await tx.execute(sql`
          UPDATE products SET image_url = d.u
          FROM jsonb_to_recordset(${iJson}::jsonb) AS d(id int, u text)
          WHERE products.id = d.id AND products.image_url IS NULL
        `);
      }

      updated += batch.length;
      process.stdout.write(`\r  Updated ${updated}/${toUpdate.length}  `);
    }
    if (toUpdate.length > 0) console.log();
  });

  console.log(`\nDone. Inserted: ${inserted}  Updated: ${updated}`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => client.end());
