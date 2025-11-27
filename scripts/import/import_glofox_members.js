#!/usr/bin/env node
/**
 * Import Glofox members CSV into the Lead table.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { PrismaClient } = require("../../src/generated/prisma");
const { normalizeEmail, normalizePhone, normalizeName } = require("../../src/lib/normalize");

const prisma = new PrismaClient();

function loadEnv() {
  const envPath = path.resolve(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=")?.trim();
  }
}

function getField(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && `${row[key]}`.trim()) {
      return `${row[key]}`.trim();
    }
  }
  return null;
}

async function main() {
  loadEnv();
  const filePath = path.resolve(
    __dirname,
    "../../../Barn Gym Transaction : Member Data/members (7) (1).csv"
  );
  const content = fs.readFileSync(filePath, "utf8");
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const memberId = getField(row, ["member_id", "Member ID"]);
    const email = normalizeEmail(getField(row, ["Email", "email"]));
    const phone = normalizePhone(getField(row, ["Phone", "phone"]));
    const firstName = getField(row, ["First Name", "first_name"]);
    const lastName = getField(row, ["Last Name", "last_name"]);
    const membership = getField(row, ["Membership Name", "Membership Plan"]);

    const externalId = memberId ? `glofox_member:${memberId}` : null;

    const data = {
      externalId,
      glofoxMemberId: memberId ?? undefined,
      firstName,
      lastName,
      email,
      phone,
      channel: row["Source"] || "Glofox",
      membershipName: membership,
      primaryMembershipPlan: getField(row, ["Membership Plan"]),
      tags: {
        membershipPlan: membership,
        totalBookings: row["Total Bookings"],
        totalAttendances: row["Total Attendances"],
      },
      metadata: {
        raw: row,
        normalizedName: normalizeName(`${firstName ?? ""} ${lastName ?? ""}`),
      },
    };

    const where =
      externalId != null
        ? { externalId }
        : email
        ? { email }
        : phone
        ? { phone }
        : { externalId: `import_${row.rowid ?? Math.random()}` };

    const result = await prisma.lead.upsert({
      where,
      update: data,
      create: data,
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`[Glofox Members] processed: ${rows.length}, created ${created}, updated ${updated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
