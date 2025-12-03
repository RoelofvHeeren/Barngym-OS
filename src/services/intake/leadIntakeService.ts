import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

type NormalizedPayload = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  goal?: string | null;
  source: string;
  contactId?: string | null;
  tags: string[];
  utm: {
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
    fbclid?: string | null;
    gclid?: string | null;
  };
  trackingIds: {
    formId?: string | null;
    adId?: string | null;
    campaignId?: string | null;
    adsetId?: string | null;
    platform?: string | null;
  };
  raw: Record<string, unknown>;
};

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePhone(value: unknown) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length ? digits : null;
}

function extractArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : null))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizePayload(rawPayload: Record<string, any>): NormalizedPayload {
  const contact = rawPayload.contact ?? {};
  const root = rawPayload ?? {};

  const firstName =
    normalizeString(root.firstName) ||
    normalizeString(contact.first_name) ||
    normalizeString(contact.firstName);
  const lastName =
    normalizeString(root.lastName) ||
    normalizeString(contact.last_name) ||
    normalizeString(contact.lastName);
  const email =
    normalizeString(root.email) ||
    normalizeString(contact.email);
  const phone =
    normalizePhone(root.phone) ||
    normalizePhone(contact.phone);

  const source =
    normalizeString(root.source) ||
    normalizeString(contact.source) ||
    "ghl";

  const tags = extractArray(root.tags ?? contact.tags);

  const utm = {
    utmSource: normalizeString(root.utm_source ?? root.utmSource ?? contact.utm_source ?? contact.utmSource),
    utmMedium: normalizeString(root.utm_medium ?? root.utmMedium ?? contact.utm_medium ?? contact.utmMedium),
    utmCampaign: normalizeString(root.utm_campaign ?? root.utmCampaign ?? contact.utm_campaign ?? contact.utmCampaign),
    utmTerm: normalizeString(root.utm_term ?? root.utmTerm ?? contact.utm_term ?? contact.utmTerm),
    utmContent: normalizeString(root.utm_content ?? root.utmContent ?? contact.utm_content ?? contact.utmContent),
    fbclid: normalizeString(root.fbclid ?? contact.fbclid),
    gclid: normalizeString(root.gclid ?? contact.gclid),
  };

  const trackingIds = {
    formId: normalizeString(root.formId ?? contact.formId),
    adId: normalizeString(root.adId ?? contact.adId),
    campaignId: normalizeString(root.campaignId ?? contact.campaignId),
    adsetId: normalizeString(root.adsetId ?? contact.adsetId),
    platform: normalizeString(root.platform ?? contact.platform),
  };

  const goal = normalizeString(root.goal ?? contact.goal);
  const contactId =
    normalizeString(root.contactId) ||
    normalizeString(contact.id) ||
    normalizeString(contact.contactId);

  return {
    firstName,
    lastName,
    email,
    phone,
    goal,
    contactId,
    source,
    tags,
    utm,
    trackingIds,
    raw: rawPayload as Record<string, unknown>,
  };
}

export async function processLeadIntake(rawPayload: unknown) {
  const payload = (rawPayload as Record<string, any>) ?? {};
  const normalized = normalizePayload(payload);

  const leadWhere = {
    OR: [
      normalized.contactId ? { ghlContactId: normalized.contactId } : null,
      normalized.email ? { email: normalized.email } : null,
      normalized.phone ? { phone: normalized.phone } : null,
    ].filter(Boolean) as Array<{
      ghlContactId?: string;
      email?: string;
      phone?: string;
    }>,
  };

  const existing =
    (leadWhere.OR?.length ?? 0) > 0 ? await prisma.lead.findFirst({ where: leadWhere }) : null;

  const tagsJson: Prisma.JsonValue = {
    ...(existing?.tags as Prisma.JsonObject | undefined),
    ghlTags: normalized.tags,
  };

  const metadataJson: Prisma.JsonValue = {
    ...(existing?.metadata as Prisma.JsonObject | undefined),
    source: normalized.source ?? "ghl",
    ghlTags: normalized.tags,
    raw: normalized.raw as unknown as Prisma.JsonValue,
  };

  const rawTrackingJson: Prisma.InputJsonValue = (normalized.raw as Prisma.InputJsonValue) ?? {};

  const baseData = {
    firstName: normalized.firstName ?? undefined,
    lastName: normalized.lastName ?? undefined,
    email: normalized.email ?? undefined,
    phone: normalized.phone ?? undefined,
    goal: normalized.goal ?? undefined,
    source: normalized.source ?? "ghl",
    ghlContactId: normalized.contactId ?? undefined,
    tags: tagsJson as Prisma.InputJsonValue,
    metadata: metadataJson as Prisma.InputJsonValue,
  };

  let leadId = existing?.id;
  let created = false;

  if (existing) {
    const updateData: Record<string, unknown> = {};
    if (!existing.firstName && baseData.firstName) updateData.firstName = baseData.firstName;
    if (!existing.lastName && baseData.lastName) updateData.lastName = baseData.lastName;
    if (!existing.email && baseData.email) updateData.email = baseData.email;
    if (!existing.phone && baseData.phone) updateData.phone = baseData.phone;
    if (!existing.goal && baseData.goal) updateData.goal = baseData.goal;
    if (!existing.source && baseData.source) updateData.source = baseData.source;
    if (!existing.ghlContactId && baseData.ghlContactId) updateData.ghlContactId = baseData.ghlContactId;
    updateData.tags = baseData.tags;
    updateData.metadata = baseData.metadata;

    await prisma.lead.update({
      where: { id: existing.id },
      data: updateData,
    });
  } else {
    const createdLead = await prisma.lead.create({
      data: baseData,
    });
    leadId = createdLead.id;
    created = true;
  }

  if (!leadId) {
    throw new Error("Failed to resolve lead ID.");
  }

  await prisma.leadTracking.create({
    data: {
      leadId,
      utmSource: normalized.utm.utmSource ?? undefined,
      utmMedium: normalized.utm.utmMedium ?? undefined,
      utmCampaign: normalized.utm.utmCampaign ?? undefined,
      utmTerm: normalized.utm.utmTerm ?? undefined,
      utmContent: normalized.utm.utmContent ?? undefined,
      fbclid: normalized.utm.fbclid ?? undefined,
      gclid: normalized.utm.gclid ?? undefined,
      formId: normalized.trackingIds.formId ?? undefined,
      adId: normalized.trackingIds.adId ?? undefined,
      campaignId: normalized.trackingIds.campaignId ?? undefined,
      adsetId: normalized.trackingIds.adsetId ?? undefined,
      platform: normalized.trackingIds.platform ?? undefined,
      rawPayload: rawTrackingJson,
    },
  });

  await prisma.leadEvent.create({
    data: {
      leadId,
      eventType: "lead_created",
      payload: {
        source: normalized.source,
        tags: normalized.tags,
        tracking: normalized.utm,
        raw: normalized.raw as Prisma.JsonValue,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    success: true,
    leadId,
    created,
    source: normalized.source,
  };
}
