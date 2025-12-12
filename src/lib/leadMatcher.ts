import { prisma } from "./prisma";
import { normalizeEmail, normalizePhone, normalizeName } from "./normalize";

export async function findLeadMatch(input: {
  email?: string | null;
  phone?: string | null;
  personName?: string | null;
}): Promise<{ leadId?: string; contactId?: string }> {
  const result: { leadId?: string; contactId?: string } = {};
  const email = normalizeEmail(input.email ?? null);
  const phone = normalizePhone(input.phone ?? null);
  const normalizedName = normalizeName(input.personName ?? null);

  // 1. Search Leads
  if (email) {
    const lead = await prisma.lead.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (lead) result.leadId = lead.id;
  }

  if (!result.leadId && phone) {
    const lead = await prisma.lead.findFirst({
      where: {
        phone: { contains: phone.slice(-4), mode: "insensitive" },
      },
      select: { id: true },
    });
    if (lead) result.leadId = lead.id;
  }

  if (!result.leadId && normalizedName) {
    const nameParts = normalizedName.split(" ");
    const first = nameParts[0];
    const last = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined;

    const lead = await prisma.lead.findFirst({
      where: {
        AND: [
          first ? { OR: [{ firstName: { equals: first, mode: "insensitive" } }, { lastName: { equals: first, mode: "insensitive" } }] } : {},
          last ? { OR: [{ lastName: { equals: last, mode: "insensitive" } }, { firstName: { equals: last, mode: "insensitive" } }] } : {},
        ],
      },
      select: { id: true },
    });
    if (lead) result.leadId = lead.id;
  }

  // 2. Search Contacts (if no Lead found OR to supplement?)
  // Strategy: Try to find Contact as well.
  if (email) {
    const contact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });
    if (contact) result.contactId = contact.id;
  }

  if (!result.contactId && !result.leadId && normalizedName) {
    // Basic name search for contact if we haven't found anything
    const contact = await prisma.contact.findFirst({
      where: { fullName: { equals: normalizedName, mode: 'insensitive' } },
      select: { id: true }
    });
    if (contact) result.contactId = contact.id;
  }

  return result;
}
