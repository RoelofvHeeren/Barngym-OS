import { promises as fs } from "fs";
import path from "path";

export type TransactionRecord = {
  id: string;
  source: string;
  personName?: string;
  productType?: string;
  status: string;
  confidence: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  description?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
};

const STORE_PATH = process.env.TRANSACTION_STORE_PATH
  ? path.resolve(process.env.TRANSACTION_STORE_PATH)
  : path.join(process.cwd(), ".data", "transactions.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

export async function readTransactions(): Promise<TransactionRecord[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as TransactionRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

async function writeTransactions(records: TransactionRecord[]): Promise<void> {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(records, null, 2), "utf8");
}

export async function addTransactions(newRecords: TransactionRecord[]) {
  if (!newRecords.length) {
    const existing = await readTransactions();
    return { added: 0, total: existing.length };
  }

  const existing = await readTransactions();
  const recordMap = new Map<string, TransactionRecord>();

  existing.forEach((record) => recordMap.set(record.id, record));

  let addedCount = 0;
  newRecords.forEach((record) => {
    if (!record.id) return;
    if (!recordMap.has(record.id)) {
      addedCount += 1;
    }
    recordMap.set(record.id, record);
  });

  const merged = Array.from(recordMap.values()).sort((a, b) =>
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  await writeTransactions(merged);

  return { added: addedCount, total: merged.length };
}

export async function clearTransactions() {
  await writeTransactions([]);
}
