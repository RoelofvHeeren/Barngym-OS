import { listTransactions } from "@/lib/transactions";
import TransactionsClient, { TransactionRecord } from "./TransactionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TransactionsPage() {
  const raw = await listTransactions();
  const transactions: TransactionRecord[] = raw.map((t) => ({
    ...t,
    metadata: (t as { metadata?: unknown }).metadata as Record<string, unknown> | null,
  }));
  return <TransactionsClient transactions={transactions} />;
}
