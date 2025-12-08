import { NormalizedTransaction } from "./transactions";
import { findLeadMatch } from "./leadMatcher";
import { prisma } from "./prisma";

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
  } else if (record.provider === "Starling") {
    // Attempt to match via CounterpartyMapping
    const raw = (record.raw as Record<string, unknown>) ?? {};
    const rawName = (raw.counterPartyName || raw.counterpartyName) as string | undefined;
    const keyCandidate =
      record.reference || record.personName || (typeof rawName === "string" ? rawName : "");
    const key = keyCandidate.trim().toLowerCase();

    if (key) {
      try {
        const mapping = await prisma.counterpartyMapping.findFirst({
          where: { provider: "Starling", key },
        });
        if (mapping && mapping.leadId) {
          record.leadId = mapping.leadId;
          if (record.status === "Needs Review") {
            record.status = "Completed";
          }
          if (!record.confidence || record.confidence.toLowerCase().includes("review")) {
            record.confidence = "Matched";
          }
        }
      } catch (e) {
        console.error("Failed to check counterparty mapping", e);
      }
    }
  }

  if (!record.leadId && !record.status) {
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
