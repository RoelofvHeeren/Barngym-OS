#!/usr/bin/env node
/**
 * Import Glofox gross sales exports into transactions.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parse } = require("csv-parse/sync");
const { getPrisma, resetPrisma, matchTransactionToMember, normalizeEmail, normalizePhone } = require("./matching");

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

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = `${value}`.replace(/,/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  const str = String(value).trim();
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const m = str.match(ddmmyyyy);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function inferProductType(row) {
  const stream = (row["Revenue stream type"] || row["Revenue Stream Type"] || "").toLowerCase();
  const membership = (row["Membership Name"] || "").toLowerCase();
  const service = (row["Service type"] || row["Service Type"] || "").toLowerCase();

  if (membership.includes("corporate") || service.includes("corporate")) return "corporate";
  if (membership.includes("retreat")) return "retreats";
  if (membership.includes("small group") || service.includes("class")) return "classes";
  if (membership.includes("personal") || service.includes("pt") || service.includes("personal"))
    return "pt";
  if (membership.includes("online")) return "online_coaching";
  return "other";
}

async function main() {
  loadEnv();
  const base = path.resolve(__dirname, "../../../Barn Gym Transaction : Member Data");
  const files = fs
    .readdirSync(base)
    .filter((f) => (f.startsWith("Gross Sales") || f.startsWith("Glofox")) && f.endsWith(".csv"))
    .map((f) => path.join(base, f));

  let imported = 0;
  let matched = 0;
  let manual = 0;

  for (const file of files) {
    const rows = parse(fs.readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true, trim: true });
    for (const row of rows) {
      try {
        const transactionId = getField(row, ["Transaction Id", "Transaction ID", "transaction_id"]) ??
          crypto.createHash("sha1").update(JSON.stringify(row)).digest("hex").slice(0, 10);
        const transactionUid = `glofox_sale:${transactionId}`;
        const grossAmount = toNumber(row["Gross sale"] ?? row["Gross Sale"]);
        const netAmount = toNumber(row["Net sale"] ?? row["Net Sale"]);
        const feeAmount = grossAmount && netAmount ? grossAmount - netAmount : 0;
        const amountMinor = Math.round(netAmount * 100);

        const memberId = getField(row, ["Member ID", "member_id"]);
        const email = normalizeEmail(getField(row, ["Email", "Customer Email"]));
        const phone = normalizePhone(getField(row, ["Phone", "Customer Phone"]));
        const fullName = getField(row, ["Customer Name", "customer_name", "Full name", "Full Name"]);

        const match = await matchTransactionToMember({
          email,
          phone,
          fullName,
          glofoxMemberId: memberId ?? undefined,
        });

        const data = {
          provider: "Glofox",
          externalId: transactionUid,
          transactionUid,
          transactionType: "payment",
          amountMinor,
          currency: (row["Currency"] || "GBP").toUpperCase(),
          occurredAt: new Date(
            toIso(
              row["Transaction time"] ||
              row["transaction_time"] ||
              row["Completed at"] ||
              row["Created at"] ||
              row["created_at"]
            )
          ),
          personName: fullName || email || phone || null,
          productType: inferProductType(row),
          status: (row["Order status"] || row["Status"] || "completed").toString(),
          confidence: match.kind === "single_confident" ? "Matched" : "Needs Review",
          description:
            row["Product description"] ||
            row["Product Name"] ||
            row["Description"] ||
            row["Service name"],
          reference: getField(row, ["Order note", "Reference", "Transaction Id", "Invoice Id"]),
          metadata: {
            paymentMethod: row["Payment method"],
            serviceType: row["Service type"],
            revenueStream: row["Revenue stream type"],
            raw: row,
          },
          grossAmount,
          netAmount,
          feeAmount,
          membershipPlan: row["Membership Name"],
          glofoxSaleId: transactionId,
          leadId: null,
          sourceFile: path.basename(file),
        };

        if (match.kind === "single_confident") {
          data.leadId = match.memberId;
          matched++;
        }

        const tx = await getPrisma().transaction.upsert({
          where: { externalId: transactionUid },
          update: data,
          create: data,
        });

        if (match.kind === "multiple_candidates") {
          manual++;
          await getPrisma().manualMatchQueue.create({
            data: {
              transactionId: tx.id,
              reason: "ambiguous_match",
              suggestedMemberIds: match.candidateMemberIds,
            },
          });
        } else if (match.kind === "no_match") {
          manual++;
          await getPrisma().manualMatchQueue.create({
            data: {
              transactionId: tx.id,
              reason: "no_match",
              suggestedMemberIds: [],
            },
          });
        }

        imported++;
        if (imported % 100 === 0) {
          console.log(
            `[Glofox Sales] progress: ${imported} rows processed (matched ${matched}, manual ${manual})`
          );
        }
      } catch (error) {
        if (error.code === "P1017") {
          console.log("[Glofox Sales] Connection dropped. Resetting Prisma and continuing...");
          resetPrisma();
          continue;
        }
        console.error("[Glofox Sales] Failed on row", row, error);
      }
    }
  }

  console.log(
    `[Glofox Sales] imported ${imported}, matched ${matched}, manual queue ${manual}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
