#!/usr/bin/env node
/**
 * Import unified Stripe transactions CSV.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { getPrisma, resetPrisma, matchTransactionToMember, normalizeEmail } = require("./matching");

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

function toNumber(value) {
  if (!value) return 0;
  const cleaned = `${value}`.replace(/,/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function main() {
  loadEnv();
  const filePath = path.resolve(
    __dirname,
    "../../../Barn Gym Transaction : Member Data/unified_payments (1).csv"
  );
  const rows = parse(fs.readFileSync(filePath, "utf8"), { columns: true, skip_empty_lines: true, trim: true });

  let imported = 0;
  let matched = 0;
  let manual = 0;

  for (const row of rows) {
    try {
      const chargeId = row["Charge ID"] || row["charge_id"] || row["ID"] || row["id"];
      if (!chargeId) continue;
      const transactionUid = `stripe:${chargeId}`;
      const gross = toNumber(row["Amount"]);
      const fee = toNumber(row["Fee"]);
      const net = gross - fee;
      const statusRaw = (row["Status"] || "").toLowerCase();
      const captured =
        row["Captured"] === "true" ||
        row["Captured"] === true ||
        row["Captured"] === "TRUE" ||
        row["Captured"] === "True";
      const status =
        statusRaw === "succeeded" || captured
          ? "Completed"
          : statusRaw === "failed"
          ? "Failed"
          : "Needs Review";

      const email = normalizeEmail(row["Customer Email"] || row["customer_email"]);
      const customerId = row["Customer ID"] || row["customer_id"];
      const match = await matchTransactionToMember({
        email,
        stripeCustomerId: customerId,
        fullName: row["Customer Name"] || row["Customer Description"] || email,
      });

      const data = {
        provider: "Stripe",
        externalId: transactionUid,
        transactionUid,
        transactionType: "payment",
        amountMinor: Math.round(net * 100),
        currency: (row["Currency"] || "GBP").toUpperCase(),
        occurredAt: toDate(row["Created (UTC)"] || row["Created date (UTC)"] || row["Created"]),
        personName: row["Customer Name"] || row["Customer Description"],
        productType: row["Product name"] || "Stripe Payment",
        status,
        confidence: match.kind === "single_confident" ? "Matched" : "Needs Review",
        description: row["Description"],
        reference: row["Invoice Number"] || row["Invoice ID"] || row["Invoice ID"] || chargeId,
      metadata: {
        customerEmail: email,
        email,
        customerId,
        paymentMethod: row["Payment Method"],
      },
        grossAmount: gross,
        feeAmount: fee,
        netAmount: net,
        stripeChargeId: chargeId,
        leadId: null,
        sourceFile: path.basename(filePath),
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
      if (imported % 50 === 0) {
        console.log(
          `[Stripe CSV] progress: ${imported}/${rows.length} (matched ${matched}, manual ${manual})`
        );
      }
    } catch (error) {
      if (error.code === "P1017") {
        console.log("[Stripe CSV] Connection dropped. Resetting Prisma and continuing...");
        resetPrisma();
        continue;
      }
      console.error("[Stripe CSV] Failed on row", error);
    }
  }

  console.log(`[Stripe CSV] imported ${imported}, matched ${matched}, manual queue ${manual}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
