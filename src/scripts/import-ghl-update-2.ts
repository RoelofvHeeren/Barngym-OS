
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// Row format: First Name,Last Name,Phone,Address,Email,Terms and Conditions,How did you find out about Barn Gym?,What would you like to know?,IP,Timezone,Submission Date,URL
type CsvRow = {
    "First Name": string;
    "Last Name": string;
    "Phone": string;
    "Address": string;
    "Email": string;
    "Submission Date": string;
    "URL": string;
    [key: string]: string; // Allow loose
};

function parseDateString(dateStr: string): Date | null {
    if (!dateStr || !dateStr.trim()) return null;
    const cleanStr = dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1");
    const date = new Date(cleanStr);
    return isNaN(date.getTime()) ? null : date;
}

function normalizePhone(phone: string): string | null {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    return clean.length >= 10 ? clean : null;
}

async function main() {
    const filePath = path.join(process.cwd(), "../Leads/Update 2.csv");
    console.log(`Reading CSV from ${filePath}`);

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as CsvRow[];

    console.log(`Found ${records.length} records. Processing...`);

    let processed = 0;
    let clientsMapped = 0;

    for (const row of records) {
        const email = row.Email?.trim();
        if (!email) continue;

        const submissionDate = parseDateString(row["Submission Date"]);
        const phone = normalizePhone(row.Phone);
        const firstName = row["First Name"]?.trim();
        const lastName = row["Last Name"]?.trim();
        const fullName = `${firstName} ${lastName}`.trim();

        // 1. Upsert Lead
        // Always mark source as 'ghl_ads' (or 'ads') so they show up in filtering.
        // Use submissionDate.

        // Check existing
        const existing = await prisma.lead.findFirst({
            where: { email: { equals: email, mode: "insensitive" as const } }
        });

        let leadId = existing?.id;
        let isClient = existing?.isClient ?? false;

        if (existing) {
            await prisma.lead.update({
                where: { id: existing.id },
                data: {
                    submissionDate: submissionDate ?? undefined,
                    source: "ghl_ads", // Ensure source allows filtering
                    isClient: isClient ? undefined : false, // Don't revert true
                }
            });
            console.log(`Updated lead: ${email}`);
        } else {
            const created = await prisma.lead.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    fullName,
                    phone,
                    submissionDate: submissionDate ?? undefined,
                    createdAt: submissionDate ?? new Date(),
                    source: "ghl_ads",
                    status: "LEAD", // Will update to CLIENT if we find payments
                    leadTracking: {
                        create: {
                            utmSource: "ghl_ads",
                            rawPayload: row as any
                        }
                    }
                }
            });
            leadId = created.id;
            console.log(`Created lead: ${email}`);
        }

        if (!leadId) continue;

        // 2. Map Transactions / Check Client Status
        // Look for matching Contact by email
        const contact = await prisma.contact.findUnique({
            where: { email: email } // Exact match usually required for Contact unique constraint
        });

        if (contact) {
            // Find Transactions linked to this contact
            const transactions = await prisma.transaction.findMany({
                where: { contactId: contact.id }
            });

            if (transactions.length > 0) {
                console.log(`Found ${transactions.length} transactions for contact ${contact.email}. Mapping to lead...`);
                isClient = true;

                // Link Transactions to Lead
                await prisma.transaction.updateMany({
                    where: { contactId: contact.id },
                    data: { leadId }
                });

                // Link Payments to Lead (by matching externalId)
                const txIds = transactions.map(t => t.externalId).filter(Boolean);
                const payments = await prisma.payment.findMany({
                    where: { externalPaymentId: { in: txIds } }
                });

                if (payments.length > 0) {
                    await prisma.payment.updateMany({
                        where: { id: { in: payments.map(p => p.id) } },
                        data: { leadId }
                    });

                    // Create client_conversion event for the FIRST payment if not exists
                    const firstPayment = payments.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

                    // Check if conversion event exists
                    const existingEvent = await prisma.leadEvent.findFirst({
                        where: { leadId, eventType: "client_conversion" }
                    });

                    if (!existingEvent) {
                        await prisma.leadEvent.create({
                            data: {
                                leadId,
                                eventType: "client_conversion",
                                createdAt: firstPayment.timestamp,
                                payload: {
                                    paymentId: firstPayment.id,
                                    amount: firstPayment.amountCents,
                                    source: "retroactive_mapping"
                                }
                            }
                        });
                        console.log(`Created conversion event for ${email}`);
                    }
                }

                clientsMapped++;
            }
        }

        // Update Lead status if we found they are a client
        if (isClient) {
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    isClient: true,
                    status: "CLIENT",
                    // Add 'ads' tag to metadata or tags json if requested?
                    // User: "add them with the ads tag". 
                    // schema: tags Json?
                    // Let's just rely on source="ghl_ads".
                }
            });
        }

        processed++;
    }

    console.log(`Finished. Processed: ${processed}, Clients Mapped: ${clientsMapped}`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
