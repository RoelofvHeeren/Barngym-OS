#!/usr/bin/env node
/**
 * One-off importer to load the Barn Gym master CSV into the database.
 * - Creates leads from the members export
 * - Imports normalized transactions and links them to matched leads
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { PrismaClient } = require("@prisma/client");

loadEnv();
const prisma = new PrismaClient();

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const safeString = (value) => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const normalizeEmail = (value) => {
  const str = safeString(value);
  return str ? str.toLowerCase() : null;
};

const normalizePhone = (value) => {
  const str = safeString(value);
  return str ? str.replace(/\D/g, "") || null : null;
};

const normalizeName = (value) => {
  const str = safeString(value);
  if (!str) return null;
  const withoutPunctuation = str.replace(/[.,]/g, " ").toLowerCase();
  const parts = withoutPunctuation
    .split(/\s+/)
    .filter(
      (part) =>
        part &&
        !["ltd", "limited", "inc", "llc", "co", "company", "plc", "gmbh"].includes(part)
    );
  return parts.length ? parts.join(" ") : null;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase();
  return str === "true" || str === "1";
};

const toMinorUnits = (value) => {
  const num = Number.parseFloat(String(value).replace(/,/g, ""));
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
};

const parseCsv = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
};

const getField = (row, keys) => {
  for (const key of keys) {
    if (key in row && row[key] !== undefined && row[key] !== null) {
      const value = safeString(row[key]);
      if (value !== null) return value;
    }
  }
  return null;
};

const normalizeStatus = (status, needsManual) => {
  if (needsManual) return "Needs Review";
  const value = (status || "").toString().toLowerCase();
  if (["failed", "canceled", "cancelled", "refunded"].includes(value)) return "Failed";
  if (["paid", "completed", "settled"].includes(value)) return "Completed";
  if (value.startsWith("requires_")) return "Needs Review";
  return "Needs Review";
};

const normalizeConfidence = (score, needsManual) => {
  if (needsManual) return "Needs Review";
  if (score >= 90) return "High";
  if (score >= 70) return "Medium";
  return "Needs Review";
};

async function importLeads(members) {
  const leads = members.map((row, index) => {
    const memberId = getField(row, ["member_id", "Member ID"]);
    const externalId = `glofox_member:${memberId ?? index}`;
    const firstName = getField(row, ["First Name", "first_name"]);
    const lastName = getField(row, ["Last Name", "last_name"]);
    const email = normalizeEmail(getField(row, ["Email", "email"]));
    const phone = normalizePhone(getField(row, ["Phone", "phone"]));
    const membershipName = getField(row, ["Membership Name", "Membership Plan"]);
    const channel = getField(row, ["Source"]) || "Imported";

    return {
      externalId,
      firstName,
      lastName,
      email,
      phone,
      channel,
      stage: "Won",
      owner: "Barn Gym",
      nextStep: null,
      valueMinor: null,
      membershipName,
      metadata: { source: "barn-gym-master", raw: row },
    };
  });

  const externalIds = leads.map((lead) => lead.externalId);
  const existing = await prisma.lead.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((lead) => lead.externalId));

  let created = 0;
  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { externalId: lead.externalId },
      update: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        channel: lead.channel,
        stage: lead.stage,
        owner: lead.owner,
        nextStep: lead.nextStep,
        valueMinor: lead.valueMinor,
        membershipName: lead.membershipName,
        metadata: lead.metadata,
      },
      create: lead,
    });
    if (!existingSet.has(lead.externalId)) {
      created += 1;
    }
  }

  const total = await prisma.lead.count();
  return { created, total };
}

async function importTransactions(masterRows) {
  const allLeads = await prisma.lead.findMany({
    select: {
      id: true,
      externalId: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });
  const leadIdMap = new Map(allLeads.map((lead) => [lead.externalId ?? "", lead.id]));
  const emailMap = new Map();
  const phoneMap = new Map();
  const nameMap = new Map();

  allLeads.forEach((lead) => {
    const email = normalizeEmail(lead.email);
    const phone = normalizePhone(lead.phone);
    const fullName = normalizeName(
      [lead.firstName ?? "", lead.lastName ?? ""].join(" ").trim()
    );
    const first = normalizeName(lead.firstName);
    const last = normalizeName(lead.lastName);

    if (email) emailMap.set(email, lead.id);
    if (phone) phoneMap.set(phone.slice(-4), lead.id);
    if (fullName) nameMap.set(fullName, lead.id);
    if (first) nameMap.set(first, lead.id);
    if (last) nameMap.set(last, lead.id);
  });

  const findLeadMatchLocal = (record) => {
    const email = normalizeEmail(record.metadata?.email);
    if (email && emailMap.has(email)) return emailMap.get(email);

    const phone = normalizePhone(record.metadata?.phone);
    if (phone) {
      const match = phoneMap.get(phone.slice(-4));
      if (match) return match;
    }

    const normalizedName = normalizeName(record.personName);
    if (normalizedName) {
      const direct = nameMap.get(normalizedName);
      if (direct) return direct;
      const parts = normalizedName.split(" ");
      if (parts.length > 1) {
        const swap = nameMap.get([parts[1], parts[0]].join(" "));
        if (swap) return swap;
      }
    }
    return null;
  };

  const records = masterRows.map((row) => {
    const needsManual = toBoolean(row.needs_manual_match);
    const matchConfidence = Number.parseInt(row.match_confidence ?? "0", 10) || 0;
    const currency = (getField(row, ["currency"]) || "GBP").toUpperCase();
    const productName =
      getField(row, ["product_name"]) ||
      getField(row, ["membership_plan"]) ||
      getField(row, ["membership_plan.1"]) ||
      "Uncategorized";
    const firstName = getField(row, ["first_name"]);
    const lastName = getField(row, ["last_name"]);
    const nameParts = [firstName, lastName].filter(Boolean).join(" ").trim();
    const personName = nameParts || getField(row, ["reference"]) || null;
    const email = normalizeEmail(getField(row, ["email"]));
    const phone = normalizePhone(getField(row, ["phone", "phone.1"]));
    const leadExternalId = getField(row, ["member_uid"]);
    const leadId = leadExternalId ? leadIdMap.get(leadExternalId) : null;

    return {
      externalId: `barn_master:${row.transaction_uid}`,
      provider: (getField(row, ["source"]) || "Barn Gym").replace(/\b\w/g, (m) => m.toUpperCase()),
      amountMinor: toMinorUnits(row.amount),
      currency,
      occurredAt: new Date(getField(row, ["occurred_at"]) || Date.now()).toISOString(),
      personName,
      productType: productName,
      status: normalizeStatus(row.status, needsManual),
      confidence: normalizeConfidence(matchConfidence, needsManual),
      description: getField(row, ["description"]),
      reference: getField(row, ["reference"]) || row.transaction_uid,
      leadId,
      metadata: {
        sourceFile: getField(row, ["source_file"]),
        transactionType: getField(row, ["transaction_type"]),
        paymentMethod: getField(row, ["payment_method"]),
        memberUid: leadExternalId,
        matchConfidence,
        needsManualMatch: needsManual,
        email,
        phone,
      },
      raw: row,
    };
  });

  const existing = await prisma.transaction.findMany({
    where: { externalId: { in: records.map((record) => record.externalId) } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((record) => record.externalId));

  const newRecords = [];
  const updateRecords = [];

  for (const record of records) {
    if (!record.leadId) {
      const matchedLeadId = findLeadMatchLocal(record);
      if (matchedLeadId) {
        record.leadId = matchedLeadId;
        if (record.status === "Needs Review") {
          record.status = "Completed";
        }
        if (!record.confidence || record.confidence === "Needs Review") {
          record.confidence = "Matched";
        }
      }
    }

    const payload = {
      provider: record.provider,
      externalId: record.externalId,
      amountMinor: record.amountMinor,
      currency: record.currency,
      occurredAt: new Date(record.occurredAt),
      personName: record.personName,
      productType: record.productType,
      status: record.status,
      confidence: record.confidence,
      description: record.description,
      reference: record.reference,
      raw: record.raw,
      metadata: record.metadata,
      leadId: record.leadId ?? null,
    };

    if (existingSet.has(record.externalId)) {
      updateRecords.push(payload);
    } else {
      newRecords.push(payload);
      existingSet.add(record.externalId);
    }
  }

  let created = 0;
  if (newRecords.length) {
    await prisma.transaction.createMany({
      data: newRecords,
      skipDuplicates: true,
    });
    created = newRecords.length;
  }

  for (const record of updateRecords) {
    await prisma.transaction.update({
      where: { externalId: record.externalId },
      data: record,
    });
  }

  const total = await prisma.transaction.count();
  return { created, total };
}

async function main() {
  loadEnv();

  const membersPath = path.resolve(
    __dirname,
    "../../Barn Gym Transaction : Member Data/members (7) (1).csv"
  );
  const masterPath = path.resolve(
    __dirname,
    "../../Barn Gym Transaction : Member Data/barn-gym-master.csv"
  );

  if (!fs.existsSync(membersPath) || !fs.existsSync(masterPath)) {
    throw new Error("Barn Gym data files are missing. Verify the data directory.");
  }

  const members = parseCsv(membersPath);
  const masterRows = parseCsv(masterPath);

  console.log(`[Importer] Loading ${members.length} members as leads...`);
  const leadResult = await importLeads(members);
  console.log(
    `[Importer] Leads complete: ${leadResult.created} new, ${leadResult.total} total.`
  );

  console.log(`[Importer] Loading ${masterRows.length} transactions...`);
  const txResult = await importTransactions(masterRows);
  console.log(
    `[Importer] Transactions complete: ${txResult.created} new, ${txResult.total} total.`
  );
}

main()
  .catch((error) => {
    console.error("[Importer] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
