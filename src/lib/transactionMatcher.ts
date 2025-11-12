import { NormalizedTransaction } from "./transactions";
import { findLeadMatch } from "./leadMatcher";

export async function attachLead(record: NormalizedTransaction) {
  if (record.leadId) {
    return record;
  }
  const email = (record.metadata?.email as string | undefined) ?? undefined;
  const phone = (record.metadata?.phone as string | undefined) ?? undefined;
  const leadId = await findLeadMatch({ email, phone, personName: record.personName });

  if (leadId) {
    record.leadId = leadId;
    if (record.status === "Needs Review") {
      record.status = "Completed";
    }
    if (!record.confidence || record.confidence.toLowerCase().includes("review")) {
      record.confidence = "Matched";
    }
  } else if (!record.status) {
    record.status = "Needs Review";
  }

  return record;
}

export async function attachLeadBatch(records: NormalizedTransaction[]) {
  const enriched: NormalizedTransaction[] = [];
  for (const record of records) {
    enriched.push(await attachLead(record));
  }
  return enriched;
}
