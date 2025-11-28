import { listTransactions } from "@/lib/transactions";
import TransactionsClient from "./TransactionsClient";

export default async function TransactionsPage() {
  const transactions = await listTransactions();
  return <TransactionsClient transactions={transactions} />;
}
