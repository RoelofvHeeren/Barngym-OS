#!/usr/bin/env node
/**
 * Import Trainerize clients CSV into the Lead table.
 * - Matches by email, phone (last 4), or normalized full name to avoid duplicates.
 * - Adds/merges trainer info into tags/metadata.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { getPrisma, resetPrisma, normalizeEmail, normalizePhone, normalizeName } = require("./matching");

const TRAINERIZE_SOURCE = "Trainerize";
const TRAINER_NAMES = [
  "Guy Kennedy",
  "Charlotte Knudson",
  "Charlie Crick",
  "Caroline Kennedy",
  "Rob",
  "Sam",
  "Kasper",
];

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

function normalizeTrainer(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const match = TRAINER_NAMES.find((name) => name.toLowerCase() === lower);
  return match ?? trimmed;
}

async function main() {
  loadEnv();
  const filePath = path.resolve(
    __dirname,
    "../../../Barn Gym Transaction : Member Data/Trainerize Clients.csv"
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found at ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    try {
      const firstName = getField(row, ["First Name", "FirstName", "first_name"]);
      const lastName = getField(row, ["Last Name", "LastName", "last_name"]);
      const email = normalizeEmail(getField(row, ["Email", "email"]));
      const phone = normalizePhone(getField(row, ["Phone", "phone"]));
      const trainer = normalizeTrainer(getField(row, ["Trainer", "trainer", "Coach", "coach"]));

      const normalizedName = normalizeName(`${firstName ?? ""} ${lastName ?? ""}`);

      // Look for an existing lead by email, phone (last 4), or normalized name.
      const existing = await getPrisma().lead.findFirst({
        where: {
          OR: [
            email ? { email } : undefined,
            phone ? { phone: { contains: phone.slice(-4), mode: "insensitive" } } : undefined,
            normalizedName
              ? { metadata: { path: ["normalizedName"], equals: normalizedName } }
              : undefined,
          ].filter(Boolean),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          channel: true,
          tags: true,
          metadata: true,
        },
      });

      const baseData = {
        firstName,
        lastName,
        email,
        phone,
        channel: existing?.channel ?? TRAINERIZE_SOURCE,
        tags: {
          ...(existing?.tags ?? {}),
          trainer: trainer ?? (existing?.tags && existing.tags.trainer) ?? "No Coach",
          source: TRAINERIZE_SOURCE,
        },
        metadata: {
          ...(existing?.metadata ?? {}),
          trainer,
          source: TRAINERIZE_SOURCE,
          normalizedName,
          raw: row,
        },
      };

      if (existing) {
        const updateData = {
          tags: baseData.tags,
          metadata: baseData.metadata,
        };
        if (!existing.firstName && firstName) updateData.firstName = firstName;
        if (!existing.lastName && lastName) updateData.lastName = lastName;
        if (!existing.email && email) updateData.email = email;
        if (!existing.phone && phone) updateData.phone = phone;
        if (!existing.channel) updateData.channel = TRAINERIZE_SOURCE;

        await getPrisma().lead.update({ where: { id: existing.id }, data: updateData });
        updated++;
      } else {
        await getPrisma().lead.create({
          data: {
            ...baseData,
            externalId: email ? `trainerize:${email}` : undefined,
          },
        });
        created++;
      }

      if ((created + updated) % 50 === 0) {
        console.log(
          `[Trainerize Clients] progress: ${created + updated}/${rows.length} (created ${created}, updated ${updated})`
        );
      }
    } catch (error) {
      if (error.code === "P1017") {
        console.log("[Trainerize Clients] Connection dropped. Resetting Prisma and continuing...");
        resetPrisma();
        continue;
      }
      console.error("[Trainerize Clients] Failed on row", row, error);
    }
  }

  console.log(`[Trainerize Clients] processed: ${rows.length}, created ${created}, updated ${updated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
