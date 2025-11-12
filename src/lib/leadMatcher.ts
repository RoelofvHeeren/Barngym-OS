import { prisma } from "./prisma";
import { normalizeEmail, normalizePhone, normalizeName } from "./normalize";

export async function findLeadMatch(input: {
  email?: string | null;
  phone?: string | null;
  personName?: string | null;
}) {
  const email = normalizeEmail(input.email ?? null);
  if (email) {
    const lead = await prisma.lead.findFirst({
      where: { email },
      select: { id: true },
    });
    if (lead) {
      return lead.id;
    }
  }

  const phone = normalizePhone(input.phone ?? null);
  if (phone) {
    const lead = await prisma.lead.findFirst({
      where: {
        phone: {
          contains: phone.slice(-4),
          mode: "insensitive",
        },
      },
      select: { id: true },
    });
    if (lead) {
      return lead.id;
    }
  }

  const normalizedName = normalizeName(input.personName ?? null);
  if (normalizedName) {
    const nameParts = normalizedName.split(" ");
    const first = nameParts[0];
    const last = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined;

    const lead = await prisma.lead.findFirst({
      where: {
        AND: [
          first
            ? {
                OR: [
                  { firstName: { equals: first, mode: "insensitive" } },
                  { lastName: { equals: first, mode: "insensitive" } },
                ],
              }
            : {},
          last
            ? {
                OR: [
                  { lastName: { equals: last, mode: "insensitive" } },
                  { firstName: { equals: last, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      select: { id: true },
    });

    if (lead) {
      return lead.id;
    }
  }

  return null;
}
