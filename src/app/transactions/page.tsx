import { listTransactions } from "@/lib/transactions";
import TransactionsClient from "./TransactionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TransactionsPage() {
  const transactions = await listTransactions();
  return <TransactionsClient transactions={transactions} />;
}
