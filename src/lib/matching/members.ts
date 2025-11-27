import { prisma } from "../prisma";
import { normalizeEmail, normalizeName, normalizePhone } from "../normalize";

type MatchResult =
  | { kind: "no_match" }
  | { kind: "single_confident"; memberId: string }
  | { kind: "multiple_candidates"; candidateMemberIds: string[] };

const STRONG_THRESHOLD = 0.9;
const WEAK_THRESHOLD = 0.75;

function jaroWinkler(a: string, b: string) {
  if (!a || !b) return 0;
  const m = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  let matches = 0;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - m);
    const end = Math.min(i + m + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;

  const jaro =
    (matches / a.length + matches / b.length + (matches - t) / matches) / 3;

  let l = 0;
  const maxL = 4;
  while (l < maxL && a[l] === b[l]) l++;

  return jaro + l * 0.1 * (1 - jaro);
}

export async function matchTransactionToMember(input: {
  email?: string;
  phone?: string;
  fullName?: string;
  glofoxMemberId?: string;
  stripeCustomerId?: string;
}): Promise<MatchResult> {
  const email = normalizeEmail(input.email ?? null);
  const phone = normalizePhone(input.phone ?? null);
  const fullName = normalizeName(input.fullName ?? null);

  if (input.glofoxMemberId) {
    const lead = await prisma.lead.findFirst({
      where: { glofoxMemberId: input.glofoxMemberId },
      select: { id: true },
    });
    if (lead) return { kind: "single_confident", memberId: lead.id };
  }

  if (input.stripeCustomerId) {
    const lead = await prisma.lead.findFirst({
      where: { stripeCustomerId: input.stripeCustomerId },
      select: { id: true },
    });
    if (lead) return { kind: "single_confident", memberId: lead.id };
  }

  if (email) {
    const lead = await prisma.lead.findFirst({
      where: { email },
      select: { id: true },
    });
    if (lead) return { kind: "single_confident", memberId: lead.id };
  }

  if (phone) {
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: phone.slice(-4), mode: "insensitive" } },
      select: { id: true },
    });
    if (lead) return { kind: "single_confident", memberId: lead.id };
  }

  if (fullName) {
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { firstName: { not: null } },
          { lastName: { not: null } },
          { metadata: { path: ["fullName"], string_contains: "" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, metadata: true },
      take: 50,
    });

    const scores: Array<{ id: string; score: number }> = [];
    for (const lead of leads) {
      const leadFullName =
        normalizeName(
          `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() ||
            (lead.metadata &&
              typeof lead.metadata === "object" &&
              "fullName" in lead.metadata
              ? (lead.metadata as Record<string, unknown>).fullName?.toString() ?? ""
              : "")
        ) ?? "";
      if (!leadFullName) continue;
      const score = jaroWinkler(fullName, leadFullName);
      if (score >= WEAK_THRESHOLD) {
        scores.push({ id: lead.id, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const strong = scores.filter((item) => item.score >= STRONG_THRESHOLD);
    if (strong.length === 1) {
      return { kind: "single_confident", memberId: strong[0].id };
    }
    if (scores.length) {
      return {
        kind: "multiple_candidates",
        candidateMemberIds: scores.map((s) => s.id),
      };
    }
  }

  return { kind: "no_match" };
}

export { MatchResult };
