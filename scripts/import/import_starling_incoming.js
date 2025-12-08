#!/usr/bin/env node
/**
 * Import Starling incoming transactions CSV into transactions table.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parse } = require("csv-parse/sync");
const { getPrisma, resetPrisma, matchTransactionToMember } = require("./matching");

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

function toAmount(value) {
  if (!value) return 0;
  let cleaned = `${value}`.trim();
  cleaned = cleaned.replace(/[£$€\s]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/,/g, ".");
  }
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function buildUid(row) {
  if (row.feed_item_uid) return `starling:${row.feed_item_uid}`;
  const hash = crypto.createHash("sha1").update(`${row.timestamp}-${row.counterparty}`).digest("hex");
  return `starling:${hash.slice(0, 10)}`;
}

async function main() {
  loadEnv();
  const filePath = path.resolve(
    __dirname,
    "../../../Transactions/Final Starling.csv"
  );
  const rows = parse(fs.readFileSync(filePath, "utf8"), { columns: true, skip_empty_lines: true, trim: true });

  let imported = 0;
  let matched = 0;
  let manual = 0;

  for (const row of rows) {
    try {
      const transactionUid = buildUid(row);
      const amount = toAmount(row.amount_gbp ?? row.amount);
      const occurredAt = new Date(row.timestamp || row.transaction_timestamp || Date.now());
      const counterparty =
        row.counterPartyName ||
        row.counterpartyName ||
        row.counterparty ||
        row.reference ||
        "";

      const match = await matchTransactionToMember({
        fullName: counterparty,
        email: row.email,
        phone: row.phone,
      });

      const data = {
        provider: "Starling",
        source: "Starling",
        externalId: transactionUid,
        transactionUid,
        amountMinor: Math.round(amount * 100),
        currency: "GBP",
        occurredAt,
        personName: counterparty,
        productType: "bank_transfer",
        status: row.status || "Completed",
        confidence: match.kind === "single_confident" ? "Matched" : "Needs Review",
        description: row.description || row.category,
        reference: row.reference || counterparty, // prioritzie actual reference col if exists
        metadata: {
          category: row.category,
          source: row.source,
        },
        raw: row,
        grossAmount: amount,
        netAmount: amount,
        feeAmount: 0,
        starlingFeedItemId: row.feed_item_uid || null,
        leadId: null,
        sourceFile: path.basename(filePath),
      };

      if (match.kind === "single_confident") {
        data.leadId = match.memberId;
        matched++;
      }

      const tx = await getPrisma().transaction.upsert({
        where: { transactionUid },
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
          `[Starling] progress: ${imported}/${rows.length} (matched ${matched}, manual ${manual})`
        );
      }
    } catch (error) {
      if (error.code === "P1017") {
        console.log("[Starling] Connection dropped. Resetting Prisma and continuing...");
        resetPrisma();
        continue;
      }
      console.error("[Starling] Failed on row", row, error);
    }
  }

  console.log(`[Starling] imported ${imported}, matched ${matched}, manual queue ${manual}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
